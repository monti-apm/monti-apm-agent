import { Tracker } from 'meteor/tracker';
import { getBrowserInfo } from '../utils';

const origCompute = Tracker.Computation.prototype._compute;
const origAfterFlush = Tracker.afterFlush;
const origRunFlush = Tracker._runFlush;

// Internal variable in the Tracker package set during Tracker._runFlush
// If it is true, Tracker throws the error instead of using Meteor._debug
// In that case, we should not report the error in afterFlush and
// instead let another reporter handle it
let throwFirstError = false;

Tracker._runFlush = function (options = {}) {
  throwFirstError = !!options.throwFirstError;
  return origRunFlush.apply(this, arguments);
};

Tracker.afterFlush = function (func) {
  return origAfterFlush(function () {
    try {
      return func();
    } catch (e) {
      if (Kadira.options.enableErrorTracking && !throwFirstError) {
        let message = e.message;
        let stack = e.stack;
        let now = new Date().getTime();

        Kadira.errors.sendError({
          appId: Kadira.options.appId,
          name: message,
          type: 'client',
          startTime: now,
          subType: 'tracker.afterFlush',
          info: getBrowserInfo(),
          stacks: JSON.stringify([{at: now, events: [], stack}])
        });

        // Once the error is thrown, Tracker will call
        // Meteor._debug 2 or 3 times. The last time will
        // have the stack trace.
        Kadira._ignoreDebugMessagesUntil(stack, 3);
      }

      throw e;
    }
  });
};

Tracker.Computation.prototype._compute = function () {
  try {
    return origCompute.apply(this, arguments);
  } catch (e) {
    // During the first run, Tracker throws the error
    // It will be handled by a different error reporter
    if (Kadira.options.enableErrorTracking && !this.firstRun) {
      let message = e.message;
      let stack = e.stack;
      let now = new Date().getTime();

      Kadira.errors.sendError({
        appId: Kadira.options.appId,
        name: message,
        type: 'client',
        startTime: now,
        subType: 'tracker.compute',
        info: getBrowserInfo(),
        stacks: JSON.stringify([{at: now, events: [], stack}])
      });

      // Once the error is thrown, Tracker will call
      // Meteor._debug 2 or 3 times. The last time will
      // have the stack trace.
      Kadira._ignoreDebugMessagesUntil(stack, 3);
    }

    throw e;
  }
};
