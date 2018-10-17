Kadira = {};
Kadira.options = {};

Monti = Kadira;

if(Meteor.wrapAsync) {
  Kadira._wrapAsync = Meteor.wrapAsync;
} else {
  Kadira._wrapAsync = Meteor._wrapAsync;
}

if(Meteor.isServer) {
  var EventEmitter = Npm.require('events').EventEmitter;
  var eventBus = new EventEmitter();
  eventBus.setMaxListeners(0);

  var buildArgs = function(args) {
    var eventName = args[0] + '-' + args[1];
    var args = args.slice(2);
    args.unshift(eventName);
    return args;
  };
  
  Kadira.EventBus = {};
  ['on', 'emit', 'removeListener', 'removeAllListeners'].forEach(function(m) {
    Kadira.EventBus[m] = function(...args) {
      var args = buildArgs(args);
      return eventBus[m].apply(eventBus, args);
    };
  });
}