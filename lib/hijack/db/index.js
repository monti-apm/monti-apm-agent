import { MongoInternals } from 'meteor/mongo';
import { _ } from 'meteor/underscore';
import { optimizedApply } from '../../utils';
import { hijackAsyncMethods } from './hijack-async-methods';
import { hijackObserveMethods } from './hijack-observe-methods';
import { hijackCursorMethods } from './hijack-cursor-methods';
import { hijackNextObject } from './hijack-next-object';


// This hijack is important to make sure, collections created before
// we hijack dbOps, even gets tracked.
//  Meteor does not simply expose MongoConnection object to the client
//  It picks methods which are necessary and make a binded object and
//  assigned to the Mongo.Collection
//  so, even we updated prototype, we can't track those collections
//  but, this will fix it.

let originalOpen = MongoInternals.RemoteCollectionDriver.prototype.open;

MongoInternals.RemoteCollectionDriver.prototype.open = function open (name) {
  let self = this;
  let ret = originalOpen.call(self, name);

  _.each(ret, function (fn, m) {
    // make sure, it's in the actual mongo connection object
    // meteorhacks:mongo-collection-utils package add some arbitary methods
    // which does not exist in the mongo connection
    if (self.mongo[m]) {
      ret[m] = function () {
        Array.prototype.unshift.call(arguments, name);
        return optimizedApply(self.mongo, self.mongo[m], arguments);
      };
    }
  });

  return ret;
};

export function hijackDBOps () {
  hijackAsyncMethods();

  hijackObserveMethods();

  hijackCursorMethods();

  hijackNextObject();
}
