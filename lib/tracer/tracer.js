var eventLogger = Npm.require('debug')('kadira:tracer');
var REPITITIVE_EVENTS = {'db': true, 'http': true, 'email': true, 'wait': true, 'async': true, 'custom': true};
var TRACE_TYPES = ['sub', 'method'];
var MAX_TRACE_EVENTS = 1500;

Tracer = function Tracer() {
  this._filters = [];
};

//In the future, we might wan't to track inner fiber events too.
//Then we can't serialize the object with methods
//That's why we use this method of returning the data
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

    if(msg.msg == 'method') {
      type = 'method';
      name = msg.method;
    } else if(msg.msg == 'sub') {
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


  var traceInfo = {
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
  var lastEvent = this.getLastEvent(traceInfo);

  if(
    // trace completed but has not been processed
    lastEvent &&
    ['complete', 'error'].indexOf(lastEvent.type) >= 0 ||
    // trace completed and processed.
    traceInfo.isEventsProcessed
    ) {
    return false;
  }

  var event = {
    type,
    at: Ntp._now(),
    endAt: null,
    nested: [],
  };

  // special handling for events that are not repititive
  if (!REPITITIVE_EVENTS[type]) {
    event.endAt = event.at;
  }

  if(data) {
    var info = _.pick(traceInfo, 'type', 'name')
    event.data = this._applyFilters(type, data, info, "start");
  }

  if (metaData && metaData.name) {
    event.name = metaData.name
  }

  if (Kadira.options.eventStackTrace) {
    event.stack = this._createStack()
  }
  
  eventLogger("%s %s", type, traceInfo._id);

  if (lastEvent && !lastEvent.endAt) {
    var lastNested = lastEvent.nested[lastEvent.nested.length - 1];

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

Tracer.prototype.eventEnd = function(traceInfo, event, data) {
  if (event.endAt) {
    // Event already ended or is not a repititive event
    return false;
  }

  event.endAt = Ntp._now();

  if(data) {
    var info = _.pick(traceInfo, 'type', 'name')
    event.data = Object.assign(
      event.data || {},
      this._applyFilters(`${event.type}end`, data, info, 'end')
    );
  }
  eventLogger("%s %s", event.type + 'end', traceInfo._id);

  return true;
};

Tracer.prototype.getLastEvent = function(traceInfo) {
  return traceInfo.events[traceInfo.events.length -1]
};

Tracer.prototype.endLastEvent = function(traceInfo) {
  var lastEvent = this.getLastEvent(traceInfo);

  if (!lastEvent.endAt) {
    this.eventEnd(traceInfo, lastEvent);
    lastEvent.forcedEnd = true;
    return true;
  }
  return false;
};

Tracer.prototype._createStack = function () {
  const stack = (new Error()).stack.split('\n');
  let toRemove = 1;

  // Find how many frames need to be removed
  // to make the user's code the first frame
  for (; toRemove < stack.length; toRemove++) {
    if (stack[toRemove].indexOf('montiapm:agent') === -1) {
      break;
    }
  }

  return stack.slice(toRemove).join('\n');
};

// Most of the time, all of the nested events are async
// which is not helpful. This returns true if
// there are nested events other than async.
Tracer.prototype._hasUsefulNested = function (event) {
  return !event.nested.every(event => {
    return event.type === 'async';
  });
}

Tracer.prototype.buildEvent = function(event, depth = 0, trace) {
  var elapsedTimeForEvent = event.endAt - event.at;
  var builtEvent = [event.type];
  var nested = [];

  builtEvent.push(elapsedTimeForEvent);
  builtEvent.push(event.data || {});
  
  if (event.nested.length && this._hasUsefulNested(event)) {
    let prevEnd = event.at;
    for(let i = 0; i < event.nested.length; i++) {
      var nestedEvent = event.nested[i];
      if (!nestedEvent.endAt) {
        this.eventEnd(trace, nestedEvent);
        nestedEvent.forcedEnd = true;
      }

      var computeTime = nestedEvent.at - prevEnd;
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
}

Tracer.prototype.buildTrace = function (traceInfo) {
  var firstEvent = traceInfo.events[0];
  var lastEvent = traceInfo.events[traceInfo.events.length - 1];
  var processedEvents = [];

  if (firstEvent.type !== 'start') {
    console.warn('Monti APM: trace has not started yet');
    return null;
  } else if (lastEvent.type !== 'complete' && lastEvent.type !== 'error') {
    //trace is not completed or errored yet
    console.warn('Monti APM: trace has not completed or errored yet');
    return null;
  } else {
    //build the metrics
    traceInfo.errored = lastEvent.type === 'error';
    traceInfo.at = firstEvent.at;

    var metrics = {
      total: lastEvent.at - firstEvent.at,
    };

    var totalNonCompute = 0;

    firstEvent = ['start', 0];
    if (traceInfo.events[0].data) {
      firstEvent.push(traceInfo.events[0].data);
    }
    processedEvents.push(firstEvent);

    for (var lc = 1; lc < traceInfo.events.length - 1; lc += 1) {
      var prevEvent = traceInfo.events[lc - 1];
      var event = traceInfo.events[lc];

      if (!event.endAt) {
        console.error('Monti APM: no end event for type: ', event.type);
        return null;
      }

      var computeTime = event.at - prevEvent.endAt;
      if (computeTime > 0) {
        processedEvents.push(['compute', computeTime]);
      }
      var builtEvent = this.buildEvent(event, 0, traceInfo);
      processedEvents.push(builtEvent);

      metrics[event.type] = metrics[event.type] || 0;
      metrics[event.type] += builtEvent[1];
      totalNonCompute += builtEvent[1];
    }
  }

  computeTime = lastEvent.at - traceInfo.events[traceInfo.events.length - 1].endAt;
  if(computeTime > 0) processedEvents.push(['compute', computeTime]);

  var lastEventData = [lastEvent.type, 0];
  if(lastEvent.data) lastEventData.push(lastEvent.data);
  processedEvents.push(lastEventData);

  if (processedEvents.length > MAX_TRACE_EVENTS) {
    const removeCount = processedEvents.length - MAX_TRACE_EVENTS
    processedEvents.splice(MAX_TRACE_EVENTS, removeCount);
  }

  metrics.compute = metrics.total - totalNonCompute;
  traceInfo.metrics = metrics;
  traceInfo.events = processedEvents;
  traceInfo.isEventsProcessed = true;
  return traceInfo;
};

Tracer.prototype.addFilter = function(filterFn) {
  this._filters.push(filterFn);
};

Tracer.prototype._applyFilters = function(eventType, data, info) {
  this._filters.forEach(function(filterFn) {
    data = filterFn(eventType, _.clone(data), info);
  });

  return data;
};

Kadira.tracer = new Tracer();
// need to expose Tracer to provide default set of filters
Kadira.Tracer = Tracer;
