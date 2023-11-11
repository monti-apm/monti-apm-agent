import { _ } from 'meteor/underscore';
import { objectHasData } from '../common/utils';
import { CreateUserStack, DefaultUniqueId, isPromise, last } from '../utils';
import { Ntp } from '../ntp';
import { EventType, MaxAsyncLevel } from '../constants';
import { getActiveEvent, getInfo, getStore, MontiAsyncStorage } from '../async/als';
import { executionAsyncId, triggerAsyncId } from 'async_hooks';
import util from 'util';

let eventLogger = require('debug')('kadira:tracer');

let REPETITIVE_EVENTS = {db: true, http: true, email: true, wait: true, async: true, custom: true, fs: true};
let TRACE_TYPES = ['sub', 'method', 'http'];
let MAX_TRACE_EVENTS = 1500;

const EMPTY_OBJECT = Object.freeze({});

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
  // We should never nest start and complete events.
  let activeEvent = [EventType.Start, EventType.Complete, EventType.Error].includes(type) ? null : getActiveEvent();

  const level = activeEvent ? activeEvent.level + 1 : 0;

  if (level > MaxAsyncLevel) {
    return false;
  }

  // We should not nest based on the last event,
  // but based on the active event of the current context, due to parallel execution.
  const lastEvent = last(trace.events);

  // Do not allow proceeding, if already completed or errored
  if (
    // Trace completed but has not been processed
    [EventType.Complete, EventType.Error].includes(lastEvent?.type) ||
    // Trace completed and processed.
    trace.isEventsProcessed
  ) {
    return false;
  }

  let event = {
    type,
    at: Ntp._now(),
    level,
  };

  if (meta && meta.name) {
    event.name = meta.name;
  }

  // special handling for events that are not repetitive
  if (!REPETITIVE_EVENTS[type]) {
    event.endAt = event.at;
  }

  if (data) {
    let info = { type: trace.type, name: trace.name };
    event.data = this._applyFilters(type, data, info, 'start');
  }

  if (Kadira.options.eventStackTrace) {
    event.stack = CreateUserStack();
  }

  event.nested = [];

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

  if (!prev || !event) return fn.call(this, event);

  als.enterWith(Object.assign({}, prev, partial));

  try {
    return fn.call(this, event);
  } finally {
    als.enterWith(prev);
  }
};

// Sets the current event for nesting events
// The returned function resets the active event to the previous value
// It must be synchronously called - the value will still be preserved
// for any async resources created before it was reset.
Tracer.prototype.setActiveEvent = function (event) {
  let prev = MontiAsyncStorage.getStore();

  if (!prev || !event) {
    return () => {};
  }

  let newValue = Object.assign({}, prev, { activeEvent: event });

  MontiAsyncStorage.enterWith(newValue);

  return function reset() {
    MontiAsyncStorage.enterWith(prev);
  };
};

// Pass the returned value from a function as result
// If the function returned a promise, ends the event once the promise
// is settled. Otherwise, the function was sync so the event is ended
// immediately
Tracer.prototype.endAfterResult = function (event, result) {
  const { info } = getStore();
 
  if (!event || !info) {
    return;
  }

  if (isPromise(result)) {
    result.then(() => {
      this.eventEnd(info.trace, event);
    }, (err) => {
      this.eventEnd(info.trace, event, { err: err.message });
    });
  } else {
    this.eventEnd(info.trace, event);
  }
};

Tracer.prototype.asyncEvent = function (type, data, meta, fn) {
  const { info } = getStore();

  if (!info) {
    return Reflect.apply(fn, this, [false]);
  }

  data.triggerAsyncId = triggerAsyncId();
  data.executionAsyncId = executionAsyncId();

  const event = this.event(info.trace, type, data, meta);

  if (event) {
    event.parentEvent = getActiveEvent();
  }

  let reset = this.setActiveEvent(event);
  let result;

  try {
    result = Reflect.apply(fn, this, [event]);
  } catch (err) {
    this.eventEnd(info.trace, event, { err: err.message });
    throw err;
  } finally {
    this.endAfterResult(event, result);
    reset();
  }

  return result;
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
  event.duration = event.endAt - event.at;

  if (data) {
    let info = { type: trace.type, name: trace.name };
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

Tracer.prototype.buildTrace = function (traceInfo) {
  let metrics = {
    compute: 0,
    async: 0,
    totalNonCompute: 0,
  };

  let firstEvent = traceInfo.events[0];
  let lastEvent = last(traceInfo.events);

  if (firstEvent.type !== EventType.Start) {
    console.warn('Monti APM: trace has not started yet');
    return null;
  } else if (lastEvent.type !== EventType.Complete && lastEvent.type !== EventType.Error) {
    console.warn('Monti APM: trace has not completed or errored yet');
    return null;
  }

  const processedEvents = this.optimizeEvents(traceInfo.events, metrics);

  // build the metrics
  traceInfo.errored = lastEvent.type === EventType.Error;
  traceInfo.at = firstEvent.at;
  traceInfo.endAt = lastEvent.endAt || lastEvent.at;

  metrics.total = traceInfo.endAt - firstEvent.at;
  metrics.compute = metrics.total - metrics.totalNonCompute;

  // Remove temporary fields
  delete metrics.totalNonCompute;

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


  let {at, endAt, stack, nested = [], name, forcedEnd, type, data, level = 0} = objectEvent;

  const optimizedNestedEvents = this._hasUsefulNested(objectEvent) ? this.optimizeEvents(nested, metrics) : undefined;

  // Unused data is removed at the end
  const optimizedEvent = [type, 0, EMPTY_OBJECT, null];

  const extraInfo = {
    stack,
    name,
    forcedEnd,
  };

  if (![EventType.Complete, EventType.Start].includes(type)) {
    if (!endAt) {
      endAt = Ntp._now();
      extraInfo.forcedEnd = true;
    }

    objectEvent.duration = endAt - at;

    const {duration} = objectEvent;

    // We need this info as events are not always in order or in series.
    extraInfo.at = at;
    extraInfo.endAt = endAt;
    extraInfo.nested = optimizedNestedEvents;

    if (metrics && duration > 0 && level === 0) {
      metrics[type] = metrics[type] || 0;
      metrics[type] += duration;
      metrics.totalNonCompute += duration;
    }

    // Start and end events do not have duration.
    optimizedEvent[1] = duration;
  }

  if (data) {
    optimizedEvent[2] = data;
  }

  if (objectHasData(extraInfo)) {
    optimizedEvent[3] = extraInfo;
  }

  // remove unneeded values from end of array
  if (optimizedEvent[3]) {
    // do nothing, everything is needed
  } else if (optimizedEvent[2] !== EMPTY_OBJECT) {
    optimizedEvent.length = 3;
  } else if (optimizedEvent[1] !== 0) {
    optimizedEvent.length = 2;
  } else {
    optimizedEvent.length = 1;
  }

  return optimizedEvent;
};

Tracer.prototype.optimizeEvents = function (events, metrics) {
  if (!events) {
    return [];
  }

  let processedEvents = [];

  let computeTime;

  processedEvents.push(this.optimizeEvent(events[0], metrics));

  for (let i = 1; i < events.length; i += 1) {
    let prevEvent = events[i - 1];
    let event = events[i];

    computeTime = event.at - (prevEvent.endAt || prevEvent.at);

    if (computeTime > 0) {
      processedEvents.push([EventType.Compute, computeTime]);
    }

    processedEvents.push(this.optimizeEvent(event, metrics));
  }

  if (processedEvents.length > MAX_TRACE_EVENTS) {
    processedEvents.length = MAX_TRACE_EVENTS;
  }

  return processedEvents;
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
