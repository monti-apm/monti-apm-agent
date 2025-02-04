import { Meteor } from 'meteor/meteor';
import { Ntp } from '../../ntp';
const oldSubscribe = Meteor.subscribe;

export function wrapSubscription () {
  Meteor.subscribe = function (/* name, .. [arguments] .. (callback|callbacks) */) {
    Kadira.webVitals.pendingObjects += 1;
    const start = Ntp._now();
    const params = [...arguments].slice(1);
    let callbacks = Object.create(null);

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
      Kadira.webVitals.completedObjects += 1;
      Kadira.webVitals.subs.push({ start, end: Ntp._now() });
      if (oldReady) {
        oldReady();
      }
    };
    callbacks.onReady = onReady;
    return oldSubscribe(arguments[0],...params, callbacks);
  };
}
export function unwrapSubscription () {
  Meteor.subscribe = oldSubscribe;
}
