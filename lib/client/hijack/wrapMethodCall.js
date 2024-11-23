import { Meteor } from 'meteor/meteor';
import { Ntp } from '../../ntp';

let oldApplyAsync;
export function wrapMethodCall () {
  oldApplyAsync = Meteor.applyAsync;
  Meteor.applyAsync = function (name, args, options) {
    const start = Ntp._now();
    Kadira.webVitals.pendingObjects += 1;
    return oldApplyAsync(name, args, options).finally(() => {
      Kadira.webVitals.completedObjects += 1;
      Kadira.webVitals.methods.push({start,end: Ntp._now()});
    });
  };
}
export function unwrapMethodCall () {
  Meteor.applyAsync = oldApplyAsync;
}
