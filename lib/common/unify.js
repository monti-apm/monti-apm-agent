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
  let EventEmitter = Npm.require('events').EventEmitter;

  let eventBus = new EventEmitter();
  eventBus.setMaxListeners(0);

  let buildArgs = function (args) {
    let eventName = `${args[0]}-${args[1]}`;
    var args = args.slice(2);
    args.unshift(eventName);
    return args;
  };

  Kadira.EventBus = {};

  ['on', 'emit', 'removeListener', 'removeAllListeners', 'once'].forEach(function (m) {
    Kadira.EventBus[m] = function (...args) {
      var args = buildArgs(args);
      return eventBus[m].apply(eventBus, args);
    };
  });
}
