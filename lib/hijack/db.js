import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Mongo, MongoInternals } from 'meteor/mongo';
import { _ } from 'meteor/underscore';
import {haveAsyncCallback, OptimizedApply} from '../utils';


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
        return OptimizedApply(self.mongo, self.mongo[m], arguments);
      };
    }
  });

  return ret;
};

// TODO: this should be added to Meteorx
function getSyncronousCursor () {
  const MongoColl = typeof Mongo !== 'undefined' ? Mongo.Collection : Meteor.Collection;
  const coll = new MongoColl(`__dummy_coll_${Random.id()}`);
  // we need to wait until the db is connected with meteor. findOne does that
  coll.findOne();

  const cursor = coll.find();
  cursor.fetch();
  return cursor._synchronousCursor.constructor;
}

export function hijackDBOps () {
  let mongoConnectionProto = MeteorX.MongoConnection.prototype;
  // findOne is handled by find - so no need to track it
  // upsert is handles by update
  // 2.4 replaced _ensureIndex with createIndex
  [
    'find', 'update', 'remove', 'insert', '_ensureIndex', '_dropIndex', 'createIndex'
  ].forEach(function (func) {
    let originalFunc = mongoConnectionProto[func];

    if (!originalFunc) {
      return;
    }

    mongoConnectionProto[func] = function (collName, selector, mod, options) {
      let payload = {
        coll: collName,
        func,
      };

      if (func === 'insert') {
        // add nothing more to the payload
      } else if (func === '_ensureIndex' || func === '_dropIndex' || func === 'createIndex') {
        // add index
        payload.index = JSON.stringify(selector);
      } else if (func === 'update' && options && options.upsert) {
        payload.func = 'upsert';
        payload.selector = JSON.stringify(selector);
      } else {
        // all the other functions have selectors
        payload.selector = JSON.stringify(selector);
      }

      let kadiraInfo = Kadira._getInfo();

      let eventId;

      if (kadiraInfo) {
        eventId = Kadira.tracer.event(kadiraInfo.trace, 'db', payload);
      }

      // this cause V8 to avoid any performance optimizations, but this is must use
      // otherwise, if the error adds try catch block our logs get messy and didn't work
      // see: issue #6

      let ret;

      try {
        ret = originalFunc.apply(this, arguments);
        // handling functions which can be triggered with an asyncCallback
        let endOptions = {};

        if (haveAsyncCallback(arguments)) {
          endOptions.async = true;
        }

        if (func === 'update') {
          // upsert only returns an object when called `upsert` directly
          // otherwise it only act an update command
          if (options && options.upsert && typeof ret === 'object') {
            endOptions.updatedDocs = ret.numberAffected;
            endOptions.insertedId = ret.insertedId;
          } else {
            endOptions.updatedDocs = ret;
          }
        } else if (func === 'remove') {
          endOptions.removedDocs = ret;
        }

        if (eventId) {
          Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, endOptions);
        }
      } catch (ex) {
        if (eventId) {
          Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, {err: ex.message});
        }
        throw ex;
      }

      return ret;
    };
  });

  let cursorProto = MeteorX.MongoCursor.prototype;
  ['forEach', 'map', 'fetch', 'count', 'observeChanges', 'observe'].forEach(function (type) {
    let originalFunc = cursorProto[type];
    cursorProto[type] = function () {
      let cursorDescription = this._cursorDescription;
      let payload = Object.assign(Object.create(null), {
        coll: cursorDescription.collectionName,
        selector: JSON.stringify(cursorDescription.selector),
        func: type,
        cursor: true
      });

      if (cursorDescription.options) {
        let cursorOptions = _.pick(cursorDescription.options, ['fields', 'projection', 'sort', 'limit']);
        for (let field in cursorOptions) {
          let value = cursorOptions[field];
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          }
          payload[field] = value;
        }
      }

      let kadiraInfo = Kadira._getInfo();
      let previousTrackNextObject;
      let eventId;

      if (kadiraInfo) {
        eventId = Kadira.tracer.event(kadiraInfo.trace, 'db', payload);

        previousTrackNextObject = kadiraInfo.trackNextObject;
        if (type === 'forEach' || type === 'map') {
          kadiraInfo.trackNextObject = true;
        }
      }

      try {
        let ret = originalFunc.apply(this, arguments);

        let endData = {};

        if (type === 'observeChanges' || type === 'observe') {
          let observerDriver;
          endData.oplog = false;
          // get data written by the multiplexer
          endData.wasMultiplexerReady = ret._wasMultiplexerReady;
          endData.queueLength = ret._queueLength;
          endData.elapsedPollingTime = ret._elapsedPollingTime;

          if (ret._multiplexer) {
            // older meteor versions done not have an _multiplexer value
            observerDriver = ret._multiplexer._observeDriver;
            if (observerDriver) {
              observerDriver = ret._multiplexer._observeDriver;
              let observerDriverClass = observerDriver.constructor;
              endData.oplog = typeof observerDriverClass.cursorSupported === 'function';

              let size = 0;
              ret._multiplexer._cache.docs.forEach(function () {
                size++;
              });
              endData.noOfCachedDocs = size;

              // if multiplexerWasNotReady, we need to get the time spend for the polling
              if (!ret._wasMultiplexerReady) {
                endData.initialPollingTime = observerDriver._lastPollTime;
              }
            }
          }

          if (!endData.oplog) {
            // let's try to find the reason
            let reasonInfo = Kadira.checkWhyNoOplog(cursorDescription, observerDriver);
            endData.noOplogCode = reasonInfo.code;
            endData.noOplogReason = reasonInfo.reason;
            endData.noOplogSolution = reasonInfo.solution;
          }
        } else if (type === 'fetch' || type === 'map') {
          // for other cursor operation

          endData.docsFetched = ret.length;

          if (type === 'fetch') {
            let coll = cursorDescription.collectionName;
            let query = cursorDescription.selector;
            let opts = cursorDescription.options;
            let docSize = Kadira.docSzCache.getSize(coll, query, opts, ret) * ret.length;
            endData.docSize = docSize;

            if (kadiraInfo) {
              if (kadiraInfo.trace.type === 'method') {
                Kadira.models.methods.trackDocSize(kadiraInfo.trace.name, docSize);
              } else if (kadiraInfo.trace.type === 'sub') {
                Kadira.models.pubsub.trackDocSize(kadiraInfo.trace.name, 'cursorFetches', docSize);
              }

              kadiraInfo.trackNextObject = previousTrackNextObject;
            } else {
              // Fetch with no kadira info are tracked as from a null method
              Kadira.models.methods.trackDocSize('<not-a-method-or-a-pub>', docSize);
            }

            // TODO: Add doc size tracking to `map` as well.
          }
        }

        if (eventId) {
          Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, endData);
        }
        return ret;
      } catch (ex) {
        if (eventId) {
          Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, {err: ex.message});
        }
        throw ex;
      }
    };
  });

  const SyncronousCursor = getSyncronousCursor();
  let origNextObject = SyncronousCursor.prototype._nextObject;
  SyncronousCursor.prototype._nextObject = function () {
    let kadiraInfo = Kadira._getInfo();
    let shouldTrack = kadiraInfo && kadiraInfo.trackNextObject;
    let event;
    if (shouldTrack ) {
      event = Kadira.tracer.event(kadiraInfo.trace, 'db', {
        func: '_nextObject',
        coll: this._cursorDescription.collectionName
      });
    }

    let result = origNextObject.call(this);

    if (shouldTrack) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, event);
    }
    return result;
  };
}
