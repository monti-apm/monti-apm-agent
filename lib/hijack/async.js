var Fibers = Npm.require('fibers');
var EventSymbol = Symbol();

var originalYield = Fibers.yield;
Fibers.yield = function() {
  var kadiraInfo = Kadira._getInfo();
  if(kadiraInfo) {
    var eventId = Kadira.tracer.event(kadiraInfo.trace, 'async');
    if(eventId) {
      // The event unique to this fiber
      // Using a symbol since Meteor doesn't copy symbols to new fibers created
      // for promises. This is needed so the correct event is ended when a fiber runs after being yielded.
      Fibers.current[EventSymbol] = eventId;
    }
  }

  return originalYield();
};

var originalRun = Fibers.prototype.run;
Fibers.prototype.run = function(val) {
  if(this[EventSymbol]) {
    var kadiraInfo = Kadira._getInfo(this);
    if(kadiraInfo) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, this[EventSymbol]);
      this[EventSymbol] = null;
    }
  } else if (!this.__kadiraInfo && Fibers.current && Fibers.current.__kadiraInfo) {
    // Copy kadiraInfo when packages or user code creates a new fiber
    // Done by many apps and packages in connect middleware since older
    // versions of Meteor did not do it automatically
    this.__kadiraInfo = Fibers.current.__kadiraInfo;
  }
  return originalRun.call(this, val);
};
