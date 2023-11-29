import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { MeteorDebugIgnore } from './error';
import { TimeoutManager } from './timeout_manager';

const MAX_PARAMS_LENGTH = 4000;


export function wrapSession (sessionProto) {
  let originalProcessMessage = sessionProto.processMessage;
  sessionProto.processMessage = function (msg) {
    let kadiraInfo = {
      session: this.id,
      userId: this.userId
    };
    if (msg.msg === 'method' || msg.msg === 'sub') {
      kadiraInfo.trace = Kadira.tracer.start(this, msg);

      Kadira.waitTimeBuilder.register(this, msg.id);

      let params = Kadira.tracer._applyObjectFilters(msg.params || []);
      // use JSON instead of EJSON to save the CPU
      let stringifiedParams = JSON.stringify(params);

      // The params could be several mb or larger.
      // Truncate if it is large
      if (stringifiedParams.length > MAX_PARAMS_LENGTH) {
        stringifiedParams = `Monti APM: params are too big. First ${MAX_PARAMS_LENGTH} characters: ${stringifiedParams.slice(0, MAX_PARAMS_LENGTH)}`;
      }

      let startData = { userId: this.userId, params: stringifiedParams };
      Kadira.tracer.event(kadiraInfo.trace, 'start', startData);
      msg._waitEventId = Kadira.tracer.event(kadiraInfo.trace, 'wait', {}, kadiraInfo);
      msg.__kadiraInfo = kadiraInfo;

      if (msg.msg === 'sub') {
        // start tracking inside processMessage allows us to indicate
        // wait time as well
        Kadira.EventBus.emit('pubsub', 'subReceived', this, msg);
        Kadira.models.pubsub._trackSub(this, msg);
      }
    }
    Kadira.EventBus.emit('system', 'ddpMessageReceived', this, msg);
    Kadira.models.system.handleSessionActivity(msg, this);

    return originalProcessMessage.call(this, msg);
  };

  // adding the method context to the current fiber
  let originalMethodHandler = sessionProto.protocol_handlers.method;
  sessionProto.protocol_handlers.method = function (msg, unblock) {
    let self = this;
    // add context
    let kadiraInfo = msg.__kadiraInfo;

    let response;

    if (kadiraInfo) {
      Kadira._setInfo(kadiraInfo);

      TimeoutManager.trackTimeout({
        kadiraInfo,
        msg,
      });

      // end wait event
      let waitList = Kadira.waitTimeBuilder.build(this, msg.id);
      Kadira.tracer.eventEnd(kadiraInfo.trace, msg._waitEventId, {waitOn: waitList});

      unblock = Kadira.waitTimeBuilder.trackWaitTime(this, msg, unblock);
      response = Kadira.env.kadiraInfo.withValue(kadiraInfo, function () {
        return originalMethodHandler.call(self, msg, unblock);
      });
      unblock();

      Kadira.models.methods.trackWaitedOn(kadiraInfo.trace.name, this.inQueue);
    } else {
      response = originalMethodHandler.call(self, msg, unblock);
    }

    return response;
  };

  // to capture the currently processing message
  let orginalSubHandler = sessionProto.protocol_handlers.sub;
  sessionProto.protocol_handlers.sub = function (msg, unblock) {
    let self = this;
    // add context
    let kadiraInfo = msg.__kadiraInfo;
    let response;
    if (kadiraInfo) {
      Kadira._setInfo(kadiraInfo);

      TimeoutManager.trackTimeout({
        kadiraInfo,
        msg,
      });

      // end wait event
      let waitList = Kadira.waitTimeBuilder.build(this, msg.id);
      Kadira.tracer.eventEnd(kadiraInfo.trace, msg._waitEventId, {waitOn: waitList});

      unblock = Kadira.waitTimeBuilder.trackWaitTime(this, msg, unblock);
      response = Kadira.env.kadiraInfo.withValue(kadiraInfo, function () {
        return orginalSubHandler.call(self, msg, unblock);
      });
      unblock();

      Kadira.models.pubsub.trackWaitedOn(kadiraInfo.trace.name, this.inQueue);
    } else {
      response = orginalSubHandler.call(self, msg, unblock);
    }

    return response;
  };

  // to capture the currently processing message
  let orginalUnSubHandler = sessionProto.protocol_handlers.unsub;
  sessionProto.protocol_handlers.unsub = function (msg, unblock) {
    unblock = Kadira.waitTimeBuilder.trackWaitTime(this, msg, unblock);
    let response = orginalUnSubHandler.call(this, msg, unblock);
    unblock();
    return response;
  };

  // track method ending (to get the result of error)
  let originalSend = sessionProto.send;
  sessionProto.send = function (msg) {
    if (msg.msg === 'result') {
      let kadiraInfo = Kadira._getInfo();
      if (kadiraInfo) {
        TimeoutManager.clearTimeout({ kadiraInfo });

        let error;

        if (msg.error) {
          error = _.pick(msg.error, ['message', 'stack', 'details']);

          // pick the error from the wrapped method handler
          if (kadiraInfo && kadiraInfo.currentError) {
            // the error stack is wrapped so Meteor._debug can identify
            // this as a method error.
            error = _.pick(kadiraInfo.currentError, ['message', 'stack', 'details']);
            // see wrapMethodHanderForErrors() method def for more info
            if (error.stack && error.stack.stack) {
              error.stack = error.stack.stack;
            }
          }

          Kadira.tracer.endLastEvent(kadiraInfo.trace);
          Kadira.tracer.event(kadiraInfo.trace, 'error', {error});
        } else {
          Kadira.tracer.endLastEvent(kadiraInfo.trace);
          Kadira.tracer.event(kadiraInfo.trace, 'complete');
        }

        // processing the message
        let trace = Kadira.tracer.buildTrace(kadiraInfo.trace);
        Kadira.EventBus.emit('method', 'methodCompleted', trace, this);
        Kadira.models.methods.processMethod(trace);

        // error may or may not exist and error tracking can be disabled
        if (error && Kadira.options.enableErrorTracking) {
          Kadira.models.error.trackError(error, trace);
        }

        // clean and make sure, fiber is clean
        // not sure we need to do this, but a preventive measure
        Kadira._setInfo(null);
      }
    }

    return originalSend.call(this, msg);
  };
}

// wrap existing method handlers for capturing errors
_.each(Meteor.server.method_handlers, function (handler, name) {
  wrapMethodHanderForErrors(name, handler, Meteor.server.method_handlers);
});

// wrap future method handlers for capturing errors
let originalMeteorMethods = Meteor.methods;
Meteor.methods = function (methodMap) {
  _.each(methodMap, function (handler, name) {
    wrapMethodHanderForErrors(name, handler, methodMap);
  });
  originalMeteorMethods(methodMap);
};


function wrapMethodHanderForErrors (name, originalHandler, methodMap) {
  methodMap[name] = function () {
    try {
      return originalHandler.apply(this, arguments);
    } catch (ex) {
      if (ex && Kadira._getInfo()) {
        // sometimes error may be just a string or a primitive
        // in that case, we need to make it a psuedo error
        if (typeof ex !== 'object') {
          // eslint-disable-next-line no-ex-assign
          ex = {message: ex, stack: ex};
        }
        // Now we are marking this error to get tracked via methods
        // But, this also triggers a Meteor.debug call, and
        // it only gets the stack
        // We also track Meteor.debug errors and want to stop
        // tracking this error. That's why we do this
        // See Meteor.debug error tracking code for more
        // If error tracking is disabled, we do not modify the stack since
        // it would be shown as an object in the logs
        if (Kadira.options.enableErrorTracking) {
          ex.stack = {stack: ex.stack, source: 'method', [MeteorDebugIgnore]: true};
          Kadira._getInfo().currentError = ex;
        }
      }
      throw ex;
    }
  };
}
