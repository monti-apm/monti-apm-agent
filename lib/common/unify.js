import { Meteor } from 'meteor/meteor';

Kadira = {};
Kadira.options = {};

Monti = Kadira;

if (Meteor.wrapAsync) {
  Kadira._wrapAsync = Meteor.wrapAsync;
} else {
  Kadira._wrapAsync = Meteor._wrapAsync;
}

if (Meteor.isServer) {
  const EventEmitter = require('events').EventEmitter;
  const eventBus = new EventEmitter();
  eventBus.setMaxListeners(0);

  const buildArgs = function (args) {
    let eventName = `${args[0]}-${args[1]}`;
    args = args.slice(2);
    args.unshift(eventName);
    return args;
  };

  Kadira.EventBus = {};

  ['on', 'emit', 'removeListener', 'removeAllListeners', 'once'].forEach(function (m) {
    Kadira.EventBus[m] = function (...args) {
      const _args = buildArgs(args);
      return eventBus[m](..._args);
    };
  });
}
