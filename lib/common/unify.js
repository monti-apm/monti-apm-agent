import { Meteor } from 'meteor/meteor';

// eslint-disable-next-line no-native-reassign,no-global-assign
Kadira = {};
Kadira.options = {};

// eslint-disable-next-line no-undef
Monti = Kadira;

if (Meteor.wrapAsync) {
  Kadira._wrapAsync = Meteor.wrapAsync;
} else {
  Kadira._wrapAsync = Meteor._wrapAsync;
}

if (Meteor.isServer) {
  const EventEmitter = Npm.require('events').EventEmitter;
  const eventBus = new EventEmitter();
  eventBus.setMaxListeners(0);

  const buildArgs = function (args) {
    const eventName = `${args[0]}-${args[1]}`;
    const newArgs = args.slice(2);
    newArgs.unshift(eventName);
    return newArgs;
  };

  Kadira.EventBus = {};
  ['on', 'emit', 'removeListener', 'removeAllListeners'].forEach(function (m) {
    Kadira.EventBus[m] = function (...args) {
      const newArgs = buildArgs(args);
      // eslint-disable-next-line prefer-spread
      return eventBus[m].apply(eventBus, newArgs);
    };
  });
}
