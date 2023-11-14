import { _ } from 'meteor/underscore';
import { objectHasData } from '../common/utils';
import { CreateUserStack, DefaultUniqueId, isPromise, last } from '../utils';
import { Ntp } from '../ntp';
import { EventType, MaxAsyncLevel } from '../constants';
import { getActiveEvent, getInfo, getStore, MontiAsyncStorage } from '../async/als';
import assert from 'assert';

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

  return function reset () {
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
    return fn(false);
  }

  const event = this.event(info.trace, type, data, meta);

  let reset = this.setActiveEvent(event);
  let result;

  try {
    result = fn(event);
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
  if (!event.nested || event.nested.length === 0) {
    return false;
  }

  return event.type === Event.Custom ||
    event.nested.some(e => e.type !== 'async');
};

Tracer.prototype.buildTrace = function (traceInfo) {
  let metrics = {
    compute: 0,
    async: 0,
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

  traceInfo.metrics = metrics;
  traceInfo.events = processedEvents;
  traceInfo.isEventsProcessed = true;

  return traceInfo;
};

function incrementMetric (metrics, name, value) {
  if (!metrics || value === 0) {
    return;
  }

  metrics[name] = metrics[name] || 0;
  metrics[name] += value;
}

/**
 * There are two formats for traces. While the method/publication is running,
 * the trace is in the object format. This is easier to work with, but takes more
 * space to store. After the trace is complete (either finished or errored),
 * it is built which among other things converts the events to the array format.
 *
 * optimizeEvent does not mutate the events, so it can safely be called
 * multiple times for the same trace
 *
 * @param {Object} objectEvent Expanded object event.
 *
 * @param {Number}  prevEnded The timestamp the previous event ended
 * @param {Object} nestedMetrics A metrics object to be updated for nested events
 *                 Only include if the nested events should affect metrics
 * @returns {Array} Array notation of the event optimized for transport.
 */
Tracer.prototype.optimizeEvent = function (objectEvent, prevEnded, nestedMetrics) {
  if (Array.isArray(objectEvent)) {
    // If it is an array, it is already optimized
    return objectEvent;
  }

  let { at, endAt, stack, nested = [], name, forcedEnd, type, data } = objectEvent;
  let isCustom = type === EventType.Custom;

  // Unused data is removed at the end
  const optimizedEvent = [type, 0, EMPTY_OBJECT, null];

  const extraInfo = {
    stack,
    name,
    forcedEnd,
  };

  // Start and end events do not have duration or nested events.
  if (![EventType.Complete, EventType.Start].includes(type)) {
    if (!endAt) {
      // TODO: this might make the metrics a little off since it could be a
      // couple ms since the trace ended. This should use the same timestamp
      // as when the trace ended
      endAt = Ntp._now();
      extraInfo.forcedEnd = true;
    }

    let duration = endAt - at;
    optimizedEvent[1] = duration;

    let offset = prevEnded - at;
    if (offset < 0) {
      throw new Error('Monti APM: unexpected gap between events');
    } else if (offset > 0) {
      extraInfo.offset = offset;
    }

    if (this._hasUsefulNested(objectEvent)) {
      let nestedStartedAt = nested[0].at;
      let beginningCompute = nestedStartedAt - at;
      extraInfo.nested = this.optimizeEvents(nested, nestedMetrics);

      if (beginningCompute > 0) {
        extraInfo.nested.unshift(['compute', beginningCompute]);
        incrementMetric(nestedMetrics, 'compute', beginningCompute);
      }

      let lastEvent = last(nested);
      let lastEndedAt = lastEvent.at + (last(extraInfo.nested)[1] || 0);
      let endComputeTime = endAt - lastEndedAt;
      if (endComputeTime > 0) {
        extraInfo.nested.push(['compute', endComputeTime]);
        incrementMetric(nestedMetrics, 'compute', endComputeTime);
      }
    } else if (isCustom) {
      // If there are no nested events, record everything as compute time
      extraInfo.nested = [['compute', duration]];
      incrementMetric(nestedMetrics, 'compute', duration);
    }
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
  if (!events || events.length === 0) {
    return [];
  }

  let processedEvents = [];

  let computeTime;

  processedEvents.push(this.optimizeEvent(events[0], events[0].at, metrics));

  let previousEnd = events[0].at + (processedEvents[0][1] || 0);
  let countedUntil = previousEnd;

  for (let i = 1; i < events.length; i += 1) {
    let event = events[i];
    let isCustomEvent = event.type === EventType.Custom;

    computeTime = event.at - previousEnd;

    if (computeTime > 0) {
      processedEvents.push([EventType.Compute, computeTime]);
      previousEnd += computeTime;

      if (previousEnd > countedUntil) {
        let diff = Math.min(computeTime, previousEnd - countedUntil);
        incrementMetric(metrics, 'compute', diff);
        countedUntil = previousEnd;
      }
    }

    let processedEvent = this.optimizeEvent(
      event,
      previousEnd,
      isCustomEvent ? metrics : undefined
    );
    processedEvents.push(processedEvent);

    let duration = processedEvent[1] || 0;
    previousEnd = event.at + duration;

    if (duration > 0 && previousEnd > countedUntil) {
      let count = previousEnd - countedUntil;
      assert(count <= duration, 'unexpected gap in countedUntil');

      // The nested events are used instead
      if (!isCustomEvent) {
        incrementMetric(metrics, processedEvent[0], count);
      }

      countedUntil = previousEnd;
    }
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
