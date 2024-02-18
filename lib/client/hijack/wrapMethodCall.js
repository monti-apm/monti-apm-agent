import { Meteor } from 'meteor/meteor';
import { Ntp } from '../../ntp';
const oldCall = Meteor.call;

export function wrapMethodCall () {
  Meteor.call = function (name, /* .. [arguments] .. callback */) {
    // if it's a function, the last argument is the result callback,
    // not a parameter to the remote method.
    const args = [...arguments].slice(1);
    let callback;
    if (args.length && typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }
    const now = Ntp._now();

    const newCallback = (...params) => {
      Kadira.webVitals.methods.push(Ntp._now() - now);
      callback?.(...params);
    };
    return this.apply(name, args, newCallback);
  }.bind(Meteor.connection);
}
export function unwrapMethodCall () {
  Meteor.call = oldCall;
}
