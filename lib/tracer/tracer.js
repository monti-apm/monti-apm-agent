import { _ } from 'meteor/underscore';
import { isNumber, objectHasData } from '../common/utils';
import { CreateUserStack, DefaultUniqueId, isPromise, pick } from '../utils';
import { Ntp } from '../ntp';
import { EventType } from '../constants';
import { getTotalDuration, mergeParallelIntervalsArray, subtractIntervals } from '../utils/time';
import { getActiveEvent, getInfo, getStore, MontiAsyncStorage } from '../async/als';
import { executionAsyncId, triggerAsyncId } from 'async_hooks';

let eventLogger = require('debug')('kadira:tracer');

let REPETITIVE_EVENTS = {db: true, http: true, email: true, wait: true, async: true, custom: true, fs: true};
let TRACE_TYPES = ['sub', 'method', 'http'];
let MAX_TRACE_EVENTS = 1500;


export const Tracer = function () {
  this._filters = [];
  this._filterFields = ['password'];
  this.maxArrayItemsToFilter = 20;
};

// In the future, we might wan't to track inner fiber events too.
// Then we can't serialize the object with methods
// That's why we use this method of returning the data
Tracer.prototype.start = function (name, type, {
  sessionId,
  msgId,
  userId
} = {}) {
  // for backward compatibility
  if (typeof name === 'object' && typeof type === 'object') {
    let session = name;
    let msg = type;
    sessionId = session.id;
    msgId = msg.id;
    userId = session.userId;

    if (msg.msg === 'method') {
      type = 'method';
      name = msg.method;
    } else if (msg.msg === 'sub') {
      type = 'sub';
      name = msg.name;
    } else {
      return null;
    }
  }

  if (TRACE_TYPES.indexOf(type) === -1) {
    console.warn(`Monti APM: unknown trace type "${type}"`);
    return null;
  }

  return {
    _id: `${sessionId}::${msgId || DefaultUniqueId.get()}`,
    type,
    name,
    session: sessionId,
    id: msgId,
    events: [],
    userId,
  };
};

Tracer.prototype.event = function (trace, type, data, meta) {
  const activeEvent = getActiveEvent();
  const level = activeEvent ? activeEvent.level + 1 : 0;

  if (level > 1) {
    return false;
  }

  // We should not nest based on the last event,
  // but based on the active event of the current context, due to parallel execution.
  const lastEvent = trace.events[trace.events.length - 1];

  // Do not allow proceeding, if already completed or errored
  if (
    // Trace completed but has not been processed
    [EventType.Complete, EventType.Error].includes(lastEvent?.type) ||
    // Trace completed and processed.
    trace.isEventsProcessed
  ) {
    return false;
  }

  if (type === EventType.Start) {
    trace.rootAsyncId = executionAsyncId();
  }

  let event = {
    type,
    at: Ntp._now(),
    endAt: null,
    nested: [],
    asyncId: executionAsyncId(),
    triggerAsyncId: triggerAsyncId(),
    level,
    ...pick(meta, ['name']),
  };

  // special handling for events that are not repetitive
  if (!REPETITIVE_EVENTS[type]) {
    event.endAt = event.at;
  }

  if (data) {
    let info = _.pick(trace, 'type', 'name');
    event.data = this._applyFilters(type, data, info, 'start');
  }

  if (Kadira.options.eventStackTrace) {
    event.stack = CreateUserStack();
  }

  eventLogger('%s %s', type, trace._id);

  if (activeEvent) {
    activeEvent.nested.push(event);
    return event;
  }

  trace.events.push(event);

  return event;
};

Tracer.prototype.runWithEvent = function (fn, event) {
  const als = MontiAsyncStorage;

  const partial = {
    activeEvent: event
  };

  const prev = als.getStore();

  if (!prev) return fn.call(this, event);

  als.enterWith(Object.assign({}, prev, partial));

  try {
    return fn.call(this, event);
  } finally {
    als.enterWith(prev);
  }
};

Tracer.prototype.asyncEvent = function (type, data, meta, fn) {
  const { info } = getStore();

  if (!info) {
    return Reflect.apply(fn, this, [false]);
  }

  const event = this.event(info.trace, type, data, meta);

  return this.runWithEvent(() => {
    try {
      let result = Reflect.apply(fn, this, [event]);

      if (isPromise(result)) {
        return result.then((res) => {
          // If the event is not yet finished, finish it.
          this.eventEnd(info.trace, event);
          return res;
        }).catch((err) => {
          this.eventEnd(info.trace, event, { err: err.message });
          throw err;
        });
      }

      // If the event is not yet finished, finish it.
      this.eventEnd(info.trace, event);
      return result;
    } catch (err) {
      this.eventEnd(info.trace, event, { err: err.message });
      throw err;
    }
  }, event);
};

Tracer.prototype.eventEnd = function (trace, event, data) {
  if (!event) {
    return false;
  }

  if (event.endAt) {
    // Event already ended or is not a repetitive event
    return false;
  }

  event.endAt = Ntp._now();

  if (data) {
    let info = _.pick(trace, 'type', 'name');
    event.data = Object.assign(
      event.data || {},
      this._applyFilters(`${event.type}end`, data, info, 'end')
    );
  }

  eventLogger('%s %s', `${event.type}end`, trace._id);

  return true;
};

Tracer.prototype.asyncEventEnd = function (event, data) {
  const info = getInfo();

  if (!info) {
    return;
  }

  this.eventEnd(info.trace, event, data);
};

Tracer.prototype.getLastEvent = function (traceInfo) {
  return traceInfo.events[traceInfo.events.length - 1];
};

Tracer.prototype.endLastEvent = function (traceInfo) {
  let lastEvent = this.getLastEvent(traceInfo);

  if (!lastEvent.endAt) {
    this.eventEnd(traceInfo, lastEvent);
    lastEvent.forcedEnd = true;
    return true;
  }
  return false;
};

// Most of the time, all the nested events are async
// which is not helpful. This returns true if
// there are nested events other than async.
Tracer.prototype._hasUsefulNested = function (event) {
  return event.nested &&
    event.nested.length &&
    !event.nested.every(e => e.type === 'async');
};

Tracer.prototype.calculateAsync = function (traceInfo, metrics) {
  return getTotalDuration(metrics.asyncIntervalsMerged);
};

Tracer.prototype.calculateCompute = function (traceInfo, metrics) {
  const total = [[traceInfo.at, traceInfo.endAt]];

  const withoutWork = subtractIntervals(total, metrics.workIntervalsMerged);
  const withoutAsync = subtractIntervals(withoutWork, metrics.asyncIntervalsMerged);

  return getTotalDuration(withoutAsync);
};

Tracer.prototype.buildTrace = function (traceInfo) {
  let firstEvent = traceInfo.events[0];
  let lastEvent = traceInfo.events[traceInfo.events.length - 1];

  if (firstEvent.type !== EventType.Start) {
    console.warn('Monti APM: trace has not started yet');
    return null;
  } else if (lastEvent.type !== EventType.Complete && lastEvent.type !== EventType.Error) {
    // trace is not completed or errored yet
    console.warn('Monti APM: trace has not completed or errored yet');
    return null;
  }

  // build the metrics
  traceInfo.errored = lastEvent.type === EventType.Error;
  traceInfo.at = firstEvent.at;
  traceInfo.endAt = lastEvent.endAt || lastEvent.at;

  let metrics = {
    total: traceInfo.endAt - firstEvent.at,
    compute: 0,
    async: 0,
    workIntervals: [],
    asyncIntervals: [],
    workIntervalsMerged: [],
    asyncIntervalsMerged: [],
  };

  const processedEvents = this.optimizeEvents(traceInfo.events, metrics);

  metrics.workIntervalsMerged = mergeParallelIntervalsArray(metrics.workIntervals);
  metrics.asyncIntervalsMerged = mergeParallelIntervalsArray(metrics.asyncIntervals);

  metrics.compute = this.calculateCompute(traceInfo, metrics);
  metrics.async = this.calculateAsync(traceInfo, metrics);

  // Remove temporary fields
  delete metrics.workIntervals;
  delete metrics.workIntervalsMerged;
  delete metrics.asyncIntervals;
  delete metrics.asyncIntervalsMerged;

  traceInfo.metrics = metrics;
  traceInfo.events = processedEvents;
  traceInfo.isEventsProcessed = true;

  return traceInfo;
};

/**
 * There are two formats for traces. While the method/publication is running, the trace is in the object format.
 * This is easier to work with, but takes more space to store. After the trace is complete (either finished or errored),
 * it is built which among other things converts the events to the array format.
 *
 * The key difference of `optimizeEvent` and `optimizeEvents` is that they do not mutate the original events.
 *
 * @param {Object} objectEvent Expanded object event.
 *
 * @param {Object} metrics A metrics object to be updated along the optimization process.
 * @returns {Array} Array notation of the event optimized for transport.
 */
Tracer.prototype.optimizeEvent = function (objectEvent, metrics) {
  if (Array.isArray(objectEvent)) {
    // If it is an array, it is already optimized
    return objectEvent;
  }

  let {at, endAt, stack, nested = [], name, forcedEnd, type, data, asyncId, level = 0} = objectEvent;

  let duration;

  const optimizedNestedEvents = this._hasUsefulNested(objectEvent) ? this.optimizeEvents(nested, metrics) : undefined;

  // Trailing nulls are removed afterward.
  const optimizedEvent = [type, null, null, null];

  const extraInfo = {
    stack,
    name,
    nested: optimizedNestedEvents,
    forcedEnd,
  };

  if (![EventType.Complete, EventType.Start].includes(type)) {
    if (!endAt) {
      endAt = at;
      extraInfo.forcedEnd = true;
    }

    // We need this info as events are not always in order or in series.
    extraInfo.at = at;
    extraInfo.endAt = endAt;
    extraInfo.asyncId = asyncId;

    // We can enable traces in development.
    if (objectEvent.stack) {
      extraInfo.stack = objectEvent.stack;
    }

    duration = isNumber(at) && isNumber(endAt) ? endAt - at : 0;

    if (duration > 0 && metrics) {
      const isAsyncAndRootOrOther = type === EventType.Async && level === 0 || type !== EventType.Async;

      if (isAsyncAndRootOrOther) {
        metrics[type] = metrics[type] || 0;
        metrics[type] += duration;
      }

      if (level === 0) {
        if (type === EventType.Async) {
          metrics.asyncIntervals.push([at, endAt]);
        } else {
          metrics.workIntervals.push([at, endAt]);
        }
      }
    }

    // Start and end events do not have duration.
    optimizedEvent[1] = duration;
  }

  if (objectHasData(data)) {
    optimizedEvent[2] = data;
  }

  if (objectHasData(extraInfo)) {
    optimizedEvent[3] = extraInfo;
  }

  // Cleanup trailing nulls
  for (let i = 3; i >= 0; i--) {
    if (optimizedEvent[i] === null) {
      optimizedEvent.splice(i, 1);
    } else {
      break;
    }
  }

  return optimizedEvent;
};

Tracer.prototype.optimizeEvents = function (events, metrics) {
  if (!events) {
    return [];
  }

  return events.map(event => this.optimizeEvent(event, metrics)).slice(0, MAX_TRACE_EVENTS);
};

Tracer.prototype.addFilter = function (filterFn) {
  this._filters.push(filterFn);
};

Tracer.prototype.redactField = function (field) {
  this._filterFields.push(field);
};

Tracer.prototype._applyFilters = function (eventType, data, info) {
  this._filters.forEach(function (filterFn) {
    data = filterFn(eventType, _.clone(data), info);
  });

  return data;
};

Tracer.prototype._applyObjectFilters = function (toFilter) {
  const filterObject = (obj) => {
    let cloned;
    this._filterFields.forEach(function (field) {
      if (field in obj) {
        cloned = cloned || Object.assign({}, obj);
        cloned[field] = 'Monti: redacted';
      }
    });

    return cloned;
  };

  if (Array.isArray(toFilter)) {
    let cloned;
    // There could be thousands or more items in the array, and this usually runs
    // before the data is validated. For performance reasons we limit how
    // many to check
    let length = Math.min(toFilter.length, this.maxArrayItemsToFilter);
    for (let i = 0; i < length; i++) {
      if (typeof toFilter[i] === 'object' && toFilter[i] !== null) {
        let result = filterObject(toFilter[i]);
        if (result) {
          cloned = cloned || [...toFilter];
          cloned[i] = result;
        }
      }
    }

    return cloned || toFilter;
  }

  return filterObject(toFilter) || toFilter;
};

Kadira.tracer = new Tracer();
// need to expose Tracer to provide default set of filters
Kadira.Tracer = Tracer;
