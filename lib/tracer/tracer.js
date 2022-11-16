import { _ } from 'meteor/underscore';
import { objectHasData } from '../common/utils';


let eventLogger = Npm.require('debug')('kadira:tracer');
let REPETITIVE_EVENTS = {db: true, http: true, email: true, wait: true, async: true, custom: true, fs: true};
let TRACE_TYPES = ['sub', 'method', 'http'];
let MAX_TRACE_EVENTS = 1500;

Tracer = function Tracer () {
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

    if (msg.msg == 'method') {
      type = 'method';
      name = msg.method;
    } else if (msg.msg == 'sub') {
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

  const traceInfo = {
    _id: `${sessionId}::${msgId || DefaultUniqueId.get()}`,
    type,
    name,
    session: sessionId,
    id: msgId,
    events: [],
    userId,
  };

  return traceInfo;
};

Tracer.prototype.event = function (traceInfo, type, data, metaData) {
  // do not allow to proceed, if already completed or errored
  let lastEvent = this.getLastEvent(traceInfo);

  if (
    // trace completed but has not been processed
    lastEvent &&
    ['complete', 'error'].indexOf(lastEvent.type) >= 0 ||
    // trace completed and processed.
    traceInfo.isEventsProcessed
  ) {
    return false;
  }

  let event = {
    type,
    at: Ntp._now(),
    endAt: null,
    nested: [],
  };

  // special handling for events that are not repetitive
  if (!REPETITIVE_EVENTS[type]) {
    event.endAt = event.at;
  }

  if (data) {
    let info = _.pick(traceInfo, 'type', 'name');
    event.data = this._applyFilters(type, data, info, 'start');
  }

  if (metaData && metaData.name) {
    event.name = metaData.name;
  }

  if (Kadira.options.eventStackTrace) {
    event.stack = CreateUserStack();
  }

  eventLogger('%s %s', type, traceInfo._id);

  if (lastEvent && !lastEvent.endAt) {
    if (!lastEvent.nested) {
      console.error('Monti: invalid trace. Please share the trace below at');
      console.error('Monti: https://github.com/monti-apm/monti-apm-agent/issues/14');
      console.dir(traceInfo, { depth: 10 });
    }
    let lastNested = lastEvent.nested[lastEvent.nested.length - 1];

    // Only nest one level
    if (!lastNested || lastNested.endAt) {
      lastEvent.nested.push(event);
      return event;
    }

    return false;
  }

  traceInfo.events.push(event);

  return event;
};

Tracer.prototype.eventEnd = function (traceInfo, event, data) {
  if (event.endAt) {
    // Event already ended or is not a repititive event
    return false;
  }

  event.endAt = Ntp._now();

  if (data) {
    let info = _.pick(traceInfo, 'type', 'name');
    event.data = Object.assign(
      event.data || {},
      this._applyFilters(`${event.type}end`, data, info, 'end')
    );
  }
  eventLogger('%s %s', `${event.type}end`, traceInfo._id);

  return true;
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

// Most of the time, all of the nested events are async
// which is not helpful. This returns true if
// there are nested events other than async.
Tracer.prototype._hasUsefulNested = function (event) {
  return event.nested && event.nested.length && !event.nested.every(event => event.type === 'async');
};

Tracer.prototype.buildEvent = function (event, depth = 0, trace) {
  let elapsedTimeForEvent = event.endAt - event.at;
  let builtEvent = [event.type];
  let nested = [];

  builtEvent.push(elapsedTimeForEvent);
  builtEvent.push(event.data || {});

  if (this._hasUsefulNested(event)) {
    let prevEnd = event.at;
    for (let i = 0; i < event.nested.length; i++) {
      let nestedEvent = event.nested[i];
      if (!nestedEvent.endAt) {
        this.eventEnd(trace, nestedEvent);
        nestedEvent.forcedEnd = true;
      }

      let computeTime = nestedEvent.at - prevEnd;
      if (computeTime > 0) {
        nested.push(['compute', computeTime]);
      }

      nested.push(this.buildEvent(nestedEvent, depth + 1, trace));
      prevEnd = nestedEvent.endAt;
    }
  }


  if (
    nested.length ||
    event.stack ||
    event.forcedEnd ||
    event.name
  ) {
    builtEvent.push({
      stack: event.stack,
      nested: nested.length ? nested : undefined,
      forcedEnd: event.forcedEnd,
      name: event.name
    });
  }

  return builtEvent;
};

Tracer.prototype.buildTrace = function (traceInfo) {
  let firstEvent = traceInfo.events[0];
  let lastEvent = traceInfo.events[traceInfo.events.length - 1];
  let processedEvents = [];

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
    total: lastEvent.at - firstEvent.at,
  };

  let totalNonCompute = 0;

  firstEvent = ['start', 0];
  if (traceInfo.events[0].data) {
    firstEvent.push(traceInfo.events[0].data);
  }
  processedEvents.push(firstEvent);

  for (let lc = 1; lc < traceInfo.events.length - 1; lc += 1) {
    let prevEvent = traceInfo.events[lc - 1];
    let event = traceInfo.events[lc];

    if (!event.endAt) {
      console.error('Monti APM: no end event for type: ', event.type);
      return null;
    }

    var computeTime = event.at - prevEvent.endAt;
    if (computeTime > 0) {
      processedEvents.push(['compute', computeTime]);
    }
    let builtEvent = this.buildEvent(event, 0, traceInfo);
    processedEvents.push(builtEvent);

    metrics[event.type] = metrics[event.type] || 0;
    metrics[event.type] += builtEvent[1];
    totalNonCompute += builtEvent[1];
  }


  computeTime = lastEvent.at - traceInfo.events[traceInfo.events.length - 2].endAt;
  if (computeTime > 0) { processedEvents.push(['compute', computeTime]); }

  let lastEventData = [lastEvent.type, 0];
  if (lastEvent.data) { lastEventData.push(lastEvent.data); }
  processedEvents.push(lastEventData);

  if (processedEvents.length > MAX_TRACE_EVENTS) {
    const removeCount = processedEvents.length - MAX_TRACE_EVENTS;
    processedEvents.splice(MAX_TRACE_EVENTS, removeCount);
  }

  metrics.compute = metrics.total - totalNonCompute;
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
 */
Tracer.prototype.optimizeEvent = function (objectEvent) {
  let {at, endAt, stack, nested = [], forcedEnd, name, type, data} = objectEvent;

  if (!endAt) {
    endAt = Ntp._now();
    forcedEnd = true;
  }

  let duration = at && endAt ? endAt - at : 0;

  const optimizedNestedEvents = this._hasUsefulNested(objectEvent) ? this.optimizeEvents(nested) : undefined;

  const optimizedEvent = [type, duration, data || {}];

  const extraInfo = {
    stack,
    forcedEnd,
    name,
    nested: optimizedNestedEvents
  };

  if (objectHasData(extraInfo)) {
    optimizedEvent.push(extraInfo);
  }

  return optimizedEvent;
};

Tracer.prototype.optimizeEvents = function (events) {
  if (!events) {
    return [];
  }

  const optimizedEvents = [];

  let prevEvent = {};

  events.forEach((event) => {
    if (prevEvent.endAt && event.at) {
      const computeTime = event.at - prevEvent.endAt;

      if (computeTime > 0) {
        optimizedEvents.push(['compute', computeTime]);
      }
    }

    optimizedEvents.push(this.optimizeEvent(event));

    prevEvent = event;
  });

  return optimizedEvents;
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
