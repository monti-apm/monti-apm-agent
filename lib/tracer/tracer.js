import { _ } from 'meteor/underscore';
import { isNumber, objectHasData } from '../common/utils';
import { CreateUserStack, DefaultUniqueId } from '../utils';
import { Ntp } from '../ntp';
import { EventType } from '../constants';
import { prettyLog } from '../../tests/_helpers/pretty-log';
import { mergeOverlappingIntervals } from '../utils/time';
import { getActiveEvent, getStore, runWithPartial } from '../als/als';
import { executionAsyncId } from 'async_hooks';

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
  // do not allow to proceed, if already completed or errored
  let lastEvent = this.getLastEvent(trace);

  if (
    // trace completed but has not been processed
    lastEvent &&
    [EventType.Complete, EventType.Error].includes(lastEvent.type) ||
    // trace completed and processed.
    trace.isEventsProcessed
  ) {
    return false;
  }

  let event = {
    type,
    at: Ntp._now(),
    endAt: null,
    nested: [],
    asyncId: executionAsyncId(),
    ...meta,
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

  const activeEvent = getActiveEvent();

  event.level = activeEvent ? activeEvent.level + 1 : 0;

  if (event.level > 1) {
    return false;
  }

  if (activeEvent && !activeEvent.endAt) {
    if (!activeEvent.nested) {
      console.error('Monti: invalid trace. Please share the trace below at');
      console.error('Monti: https://github.com/monti-apm/monti-apm-agent/issues/14');
      console.dir(trace, { depth: 10 });
    }

    activeEvent.nested.push(event);
    return event;
  }

  trace.events.push(event);

  return event;
};

Tracer.prototype.runWithEvent = function (fn, event) {
  return runWithPartial(fn, {
    activeEvent: event
  })(event);
};

Tracer.prototype.asyncEvent = function (type, data, meta, fn) {
  const { info } = getStore();

  if (!info) {
    return Reflect.apply(fn, this, [null]);
  }

  const event = this.event(info.trace, type, data, meta);

  return this.runWithEvent(() => {
    try {
      const result = Reflect.apply(fn, this, [event]);
      // If the event is not yet finished, finish it.
      this.eventEnd(info.trace, event);
      return result;
    } catch (err) {
      this.eventEnd(info.trace, event, { error: err });
      throw err;
    }
  }, event);
};

Tracer.prototype.eventEnd = function (trace, event, data) {
  if (!event) {
    return false;
  }

  if (event.endAt) {
    // Event already ended or is not a repititive event
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

Tracer.prototype.asyncEventEnd = function (data) {
  const info = Kadira._getInfo();

  if (!info) {
    return;
  }

  const { activeEvent: event } = info;

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

Tracer.prototype.buildTrace = function (traceInfo) {
  let firstEvent = traceInfo.events[0];
  let lastEvent = traceInfo.events[traceInfo.events.length - 1];

  if (firstEvent.type !== 'start') {
    console.warn('Monti APM: trace has not started yet');
    return null;
  } else if (lastEvent.type !== 'complete' && lastEvent.type !== 'error') {
    // trace is not completed or errored yet
    console.warn('Monti APM: trace has not completed or errored yet');
    return null;
  }

  // build the metrics
  traceInfo.errored = lastEvent.type === 'error';
  traceInfo.at = firstEvent.at;

  let metrics = {
    total: (lastEvent.endAt || lastEvent.at) - firstEvent.at,
    work: 0, // Used to calculate compute time only
    compute: 0,
    workIntervals: [],
    workIntervalsMerged: [],
  };

  const processedEvents = this.optimizeEvents(traceInfo.events, metrics);

  metrics.compute = metrics.total - metrics.work;

  metrics.workIntervalsMerged = mergeOverlappingIntervals(metrics.workIntervals);

  prettyLog(metrics.workIntervalsMerged);

  delete metrics.work;
  delete metrics.workIntervals;

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

  let {at, endAt, stack, nested = [], name, forcedEnd, type, data, asyncId} = objectEvent;

  let duration;

  const optimizedNestedEvents = this._hasUsefulNested(objectEvent) ? this.optimizeEvents(nested, metrics) : undefined;

  const optimizedEvent = [type, null, null, null];

  const extraInfo = {
    stack,
    name,
    nested: optimizedNestedEvents,
    asyncId
  };

  if (![EventType.Complete, EventType.Start].includes(type)) {
    if (!endAt) {
      endAt = at;
      forcedEnd = true;
    }

    // We need this info as events are not always in order or in series.
    extraInfo.at = at;
    extraInfo.endAt = endAt;

    duration = isNumber(at) && isNumber(endAt) ? endAt - at : null;

    // We do not need duration for start and complete events.
    if (isNumber(duration)) {
      if (metrics) {
        metrics.work += duration;

        if (at !== endAt) {
          metrics.workIntervals.push([at, endAt]);
        }

        if (duration > 0) {
          metrics[type] = metrics[type] || 0;
          metrics[type] += duration;
        }
      }
      optimizedEvent[1] = duration;
    }
  }

  if (objectHasData(data)) {
    optimizedEvent[2] = data;
  }

  optimizedEvent[3] = { ...extraInfo, forcedEnd };

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
