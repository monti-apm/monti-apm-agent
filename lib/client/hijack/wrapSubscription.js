import { Meteor } from 'meteor/meteor';
import { Ntp } from '../../ntp';
const oldSubscribe = Meteor.subscribe;

export function wrapSubscription () {
  Meteor.subscribe = function (/* name, .. [arguments] .. (callback|callbacks) */) {
    const params = [...arguments].slice(1);
    let callbacks = Object.create(null);
    const now = Ntp._now();

    if (params.length) {
      const lastParam = params[params.length - 1];
      if (typeof lastParam === 'function') {
        callbacks.onReady = params.pop();
      } else if (lastParam && [
        lastParam.onReady,
        // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
        // onStop with an error callback instead.
        lastParam.onError,
        lastParam.onStop
      ].some(f => typeof f === 'function')) {
        callbacks = params.pop();
      }
    }
    const oldReady = callbacks.onReady;
    const onReady = () => {
      const diff = Ntp._now() - now;
      if (diff > 0) {
        Kadira.webVitals.subs.push(diff);
      }
      oldReady?.();
    };
    callbacks.onReady = onReady;
    return oldSubscribe(arguments[0],...params, callbacks);
  }.bind(Meteor.connection);
}
export function unwrapSubscription () {
  Meteor.subscribe = oldSubscribe;
}
