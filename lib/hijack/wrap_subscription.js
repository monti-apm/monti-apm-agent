import { _ } from 'meteor/underscore';
import { EventType } from '../constants';
import { withCurrentSub } from './wrap_ddp_stringify';
import { toErrorObject } from '../common/utils';

export function wrapSubscription (subscriptionProto) {
  let originalRunHandler = subscriptionProto._runHandler;

  subscriptionProto._runHandler = function () {
    let kadiraInfo = Kadira._getInfo();

    if (kadiraInfo) {
      this.__kadiraInfo = kadiraInfo;
    }

    return originalRunHandler.call(this);
  };

  let originalReady = subscriptionProto.ready;

  subscriptionProto.ready = function () {
    // meteor has a field called `_ready` which tracks this,
    // but we need to make it future-proof
    if (!this._apmReadyTracked) {
      let kadiraInfo = Kadira._getInfo() || this.__kadiraInfo;
      delete this.__kadiraInfo;

      let trace;

      // sometime .ready can be called in the context of the method
      // then we have some problems, that's why we are checking this
      // eg:- Accounts.createUser
      // Also, when the subscription is created by fast render, _subscriptionId and
      // the trace.id are both undefined, but we don't want to complete the HTTP trace here
      if (
        kadiraInfo?.trace?.type === 'sub' &&
        this._subscriptionId &&
        this._subscriptionId === kadiraInfo.trace.id
      ) {
        Kadira.tracer.endLastEvent(kadiraInfo.trace);
        Kadira.tracer.event(kadiraInfo.trace, EventType.Complete);
        trace = Kadira.tracer.buildTrace(kadiraInfo.trace);
      }

      Kadira.EventBus.emit('pubsub', 'subCompleted', trace, this._session, this);
      Kadira.models.pubsub._trackReady(this._session, this, trace);
      this._apmReadyTracked = true;
    }

    // we still pass the control to the original implementation
    // since multiple ready calls are handled by itself
    let result = originalReady.call(this);

    // Meteor sets _ready immediately after sending or queueing the ready state.
    if (this._ready) {
      this._initialSentFinished = true;
    }

    return result;
  };

  let originalError = subscriptionProto.error;

  subscriptionProto.error = withCurrentSub(function (err) {
    let kadiraInfo = Kadira._getInfo();

    if (
      kadiraInfo?.trace?.type === 'sub' &&
      this._subscriptionId &&
      this._subscriptionId === kadiraInfo.trace.id
    ) {
      Kadira.tracer.endLastEvent(kadiraInfo.trace);

      let errorObject = toErrorObject(err);
      let errorForApm = _.pick(errorObject, 'message', 'stack');
      Kadira.tracer.event(kadiraInfo.trace, EventType.Error, {error: errorForApm});
      let trace = Kadira.tracer.buildTrace(kadiraInfo.trace);

      Kadira.models.pubsub._trackError(this._session, this, trace);

      // error tracking can be disabled and if there is a trace
      // should be available all the time, but it won't
      // if something wrong happened on the trace building
      if (Kadira.options.enableErrorTracking && trace) {
        Kadira.models.error.trackError(errorObject, trace);
        // Meteor._debug uses currentError to avoid tracking it a second time
        kadiraInfo.currentError = err;
      }
    }

    return originalError.call(this, err);
  });

  let originalStop = subscriptionProto.stop;
  subscriptionProto.stop = withCurrentSub(originalStop);

  let originalDeactivate = subscriptionProto._deactivate;

  subscriptionProto._deactivate = function () {
    if (this._deactivated) {
      // _deactivate can be called multiple times. We only want to
      // track it once. The original function sets _deactivated.
      return originalDeactivate.call(this);
    }

    Kadira.EventBus.emit('pubsub', 'subDeactivated', this._session, this);
    Kadira.models.pubsub._trackUnsub(this._session, this);
    return originalDeactivate.call(this);
  };

  ['added', 'changed', 'removed'].forEach(function (funcName) {
    let originalFunc = subscriptionProto[funcName];
    subscriptionProto[funcName] = withCurrentSub(originalFunc);
  });
}
