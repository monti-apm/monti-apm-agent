import { _ } from 'meteor/underscore';
import { MeteorDebugIgnore } from './error';

export function wrapSubscription (subscriptionProto) {
  // If the ready event runs outside the Fiber, Kadira._getInfo() doesn't work.
  // we need some other way to store kadiraInfo, so we can use it at ready hijack.
  const originalRunHandler = subscriptionProto._runHandler;
  subscriptionProto._runHandler = function () {
    const kadiraInfo = Kadira._getInfo();
    if (kadiraInfo) {
      this.__kadiraInfo = kadiraInfo;
    }
    originalRunHandler.call(this);
  };

  const originalReady = subscriptionProto.ready;
  subscriptionProto.ready = function () {
    // meteor has a field called `_ready` which tracks this
    // but we need to make it future proof
    if (!this._apmReadyTracked) {
      const kadiraInfo = Kadira._getInfo() || this.__kadiraInfo;
      delete this.__kadiraInfo;
      // sometime .ready can be called in the context of the method
      // then we have some problems, that's why we are checking this
      // eg:- Accounts.createUser
      // Also, when the subscription is created by fast render, _subscriptionId and
      // the trace.id are both undefined, but we don't want to complete the HTTP trace here
      if (kadiraInfo && this._subscriptionId && this._subscriptionId == kadiraInfo.trace.id) {
        Kadira.tracer.endLastEvent(kadiraInfo.trace);
        Kadira.tracer.event(kadiraInfo.trace, 'complete');
        var trace = Kadira.tracer.buildTrace(kadiraInfo.trace);
      }

      Kadira.EventBus.emit('pubsub', 'subCompleted', trace, this._session, this);
      Kadira.models.pubsub._trackReady(this._session, this, trace);
      this._apmReadyTracked = true;
    }

    // we still pass the control to the original implementation
    // since multiple ready calls are handled by itself
    originalReady.call(this);
  };

  const originalError = subscriptionProto.error;
  subscriptionProto.error = function (err) {
    if (typeof err === 'string') {
      err = { message: err };
    }

    const kadiraInfo = Kadira._getInfo();

    if (kadiraInfo && this._subscriptionId && this._subscriptionId == kadiraInfo.trace.id) {
      Kadira.tracer.endLastEvent(kadiraInfo.trace);

      const errorForApm = _.pick(err, 'message', 'stack');
      Kadira.tracer.event(kadiraInfo.trace, 'error', {error: errorForApm});
      const trace = Kadira.tracer.buildTrace(kadiraInfo.trace);

      Kadira.models.pubsub._trackError(this._session, this, trace);

      // error tracking can be disabled and if there is a trace
      // trace should be available all the time, but it won't
      // if something wrong happened on the trace building
      if (Kadira.options.enableErrorTracking && trace) {
        Kadira.models.error.trackError(err, trace);
      }
    }

    // wrap error stack so Meteor._debug can identify and ignore it
    // it is not wrapped when error tracking is disabled since it
    // would be shown as an object in the logs
    if (Kadira.options.enableErrorTracking) {
      err.stack = {stack: err.stack, source: 'subscription', [MeteorDebugIgnore]: true};
    }
    originalError.call(this, err);
  };

  const originalDeactivate = subscriptionProto._deactivate;
  subscriptionProto._deactivate = function () {
    Kadira.EventBus.emit('pubsub', 'subDeactivated', this._session, this);
    Kadira.models.pubsub._trackUnsub(this._session, this);
    originalDeactivate.call(this);
  };

  // adding the currenSub env variable
  ['added', 'changed', 'removed'].forEach(function (funcName) {
    const originalFunc = subscriptionProto[funcName];
    subscriptionProto[funcName] = function (collectionName, id, fields) {
      const self = this;

      // we need to run this code in a fiber and that's how we track
      // subscription info. Maybe we can figure out, some other way to do this
      // We use this currently to get the publication info when tracking message
      // sizes at wrap_ddp_stringify.js
      Kadira.env.currentSub = self;
      const res = originalFunc.call(self, collectionName, id, fields);
      Kadira.env.currentSub = null;

      return res;
    };
  });
}
