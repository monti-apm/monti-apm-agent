var Fibers = Npm.require('fibers');
var EventSymbol = Symbol();
var StartTracked = Symbol();

var activeFibers = 0;
var wrapped = false;

export function wrapFibers() {
  if (wrapped) {
    return;
  }
  wrapped = true;

  var originalYield = Fibers.yield;
  Fibers.yield = function () {
    var kadiraInfo = Kadira._getInfo();
    if (kadiraInfo) {
      var eventId = Kadira.tracer.event(kadiraInfo.trace, 'async');
      if (eventId) {
        // The event unique to this fiber
        // Using a symbol since Meteor doesn't copy symbols to new fibers created
        // for promises. This is needed so the correct event is ended when a fiber runs after being yielded.
        Fibers.current[EventSymbol] = eventId;
      }
    }

    return originalYield();
  };

  var originalRun = Fibers.prototype.run;
  var originalThrowInto = Fibers.prototype.throwInto;

  function ensureFiberCounted(fiber) {
    // If fiber.started is true, and StartTracked is false
    // then the fiber was probably initially ran before we wrapped Fibers.run
    if (!fiber.started || !fiber[StartTracked]) {
      activeFibers += 1;
      fiber[StartTracked] = true;
    }
  }

  Fibers.prototype.run = function (val) {
    ensureFiberCounted(this);

    if (this[EventSymbol]) {
      var kadiraInfo = Kadira._getInfo(this);
      if (kadiraInfo) {
        Kadira.tracer.eventEnd(kadiraInfo.trace, this[EventSymbol]);
        this[EventSymbol] = null;
      }
    } else if (!this.__kadiraInfo && Fibers.current && Fibers.current.__kadiraInfo) {
      // Copy kadiraInfo when packages or user code creates a new fiber
      // Done by many apps and packages in connect middleware since older
      // versions of Meteor did not do it automatically
      this.__kadiraInfo = Fibers.current.__kadiraInfo;
    }

    let result;
    try {
      result = originalRun.call(this, val);
    } finally {
      if (!this.started) {
        activeFibers -= 1;
        this[StartTracked] = false;
      }
    }

    return result;
  };

  Fibers.prototype.throwInto = function (val) {
    ensureFiberCounted(this);

    // TODO: this should probably end the current async event since in some places
    // Meteor calls throwInto instead of run after a fiber is yielded. For example,
    // when a promise is awaited and rejects an error.

    let result;
    try {
      result = originalThrowInto.call(this, val);
    } finally {
      if (!this.started) {
        activeFibers -= 1;
        this[StartTracked] = false;
      }
    }

    return result;
  };
}

let activeFiberTotal = 0;
let activeFiberCount = 0;
let previousTotalCreated = 0;

setInterval(() => {
  activeFiberTotal += activeFibers;
  activeFiberCount += 1;
}, 1000);

export function getFiberMetrics() {
  return {
    created: Fibers.fibersCreated - previousTotalCreated,
    active: activeFiberTotal / activeFiberCount,
    poolSize: Fibers.poolSize
  }
}

export function resetFiberMetrics() {
  activeFiberTotal = 0;
  activeFiberCount = 0;
  previousTotalCreated = Fibers.fibersCreated;
}
