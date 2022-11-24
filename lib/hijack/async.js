let Fibers = Npm.require('fibers');
let EventSymbol = Symbol();
let StartTracked = Symbol();

let activeFibers = 0;
let wrapped = false;

function endAsyncEvent (fiber) {
  if (!fiber[EventSymbol]) return;

  const kadiraInfo = Kadira._getInfo(fiber);

  if (!kadiraInfo) return;

  Kadira.tracer.eventEnd(kadiraInfo.trace, fiber[EventSymbol]);

  fiber[EventSymbol] = null;
}

export function wrapFibers () {
  if (wrapped) {
    return;
  }
  wrapped = true;

  let originalYield = Fibers.yield;
  Fibers.yield = function () {
    let kadiraInfo = Kadira._getInfo();
    if (kadiraInfo) {
      let eventId = Kadira.tracer.event(kadiraInfo.trace, 'async');
      if (eventId) {
        // The event unique to this fiber
        // Using a symbol since Meteor doesn't copy symbols to new fibers created
        // for promises. This is needed so the correct event is ended when a fiber runs after being yielded.
        Fibers.current[EventSymbol] = eventId;
      }
    }

    return originalYield();
  };

  let originalRun = Fibers.prototype.run;
  let originalThrowInto = Fibers.prototype.throwInto;

  function ensureFiberCounted (fiber) {
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
      endAsyncEvent(this);
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
    endAsyncEvent(this);

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

export function getFiberMetrics () {
  return {
    created: Fibers.fibersCreated - previousTotalCreated,
    active: activeFiberTotal / activeFiberCount,
    poolSize: Fibers.poolSize
  };
}

export function resetFiberMetrics () {
  activeFiberTotal = 0;
  activeFiberCount = 0;
  previousTotalCreated = Fibers.fibersCreated;
}
