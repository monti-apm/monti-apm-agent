import { MongoInternals } from 'meteor/mongo';
import { _ } from 'meteor/underscore';
import { haveAsyncCallback, OptimizedApply } from '../utils';
import { EventType } from '../constants';

function getCursorData ({ type, cursor }) {
  const cursorDescription = cursor._cursorDescription;

  const payload = Object.assign(Object.create(null), {
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

  return { payload, cursorDescription };
}


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

export function hijackDBOps () {
  let mongoConnectionProto = MeteorX.MongoConnection.prototype;

  const ASYNC_METHODS = ['insertAsync', 'removeAsync', 'updateAsync', 'createIndexAsync', 'dropIndexAsync', 'ensureIndex'];

  // findOne is handled by find - so no need to track it
  // upsert is handles by update
  ASYNC_METHODS.forEach(function (func) {
    let originalFunc = mongoConnectionProto[func];

    if (!originalFunc) {
      return;
    }

    mongoConnectionProto[func] = async function (collName, selector, mod, options) {
      let payload = {
        coll: collName,
        func,
      };

      if (func === 'insert' || func === 'insertAsync') {
        // add nothing more to the payload
      } else if (['dropIndexAsync', 'createIndexAsync', 'dropIndexAsync'].includes(func)) {
        // add index
        payload.index = JSON.stringify(selector);
      } else if (func === 'updateAsync' && options && options.upsert) {
        payload.func = 'upsert';
        payload.selector = JSON.stringify(selector);
      } else {
        // all the other functions have selectors
        payload.selector = JSON.stringify(selector);
      }

      return await Kadira.tracer.asyncEvent(EventType.DB, payload, null, async (event) => {
        // this cause V8 to avoid any performance optimizations, but this is must use
        // otherwise, if the error adds try catch block our logs get messy and didn't work
        // see: issue #6

        const result = await originalFunc.apply(this, arguments);
        // handling functions which can be triggered with an asyncCallback
        let endData = {};

        if (haveAsyncCallback(arguments)) {
          endData.async = true;
        }

        if (func === 'updateAsync') {
          // upsert only returns an object when called `upsert` directly
          // otherwise it only act an update command
          if (options && options.upsert && typeof result === 'object') {
            endData.updatedDocs = result.numberAffected;
            endData.insertedId = result.insertedId;
          } else {
            endData.updatedDocs = result;
          }
        } else if (func === 'removeAsync') {
          endData.removedDocs = result;
        }

        Kadira.tracer.asyncEventEnd(event, endData);

        return result;
      });
    };
  });

  let cursorProto = MeteorX.MongoCursor.prototype;

  // Right now they are async in the server and sync in the client, but it might change.
  const OBSERVE_METHODS = ['observeChanges', 'observe'];

  OBSERVE_METHODS.forEach(function (type) {
    let originalFunc = cursorProto[type];

    cursorProto[type] = async function () {
      const { payload, cursorDescription } = getCursorData({
        type,
        cursor: this,
      });

      return await Kadira.tracer.asyncEvent(EventType.DB, payload, null, async (event) => {
        let ret = await originalFunc.apply(this, arguments);

        let endData = {};

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

        Kadira.tracer.asyncEventEnd(event, endData);

        return ret;
      });
    };
  });


  // `fetchAsync` calls `fetch` behind the scenes, so we only need to intercept `fetch`, which is also called by `findOneAsync`.
  const ASYNC_CURSOR_METHODS = ['fetch', 'forEachAsync', 'mapAsync', 'countAsync'];

  function calculateMetrics (cursorDescription, result, endData, kadiraInfo, previousTrackNextObject) {
    let coll = cursorDescription.collectionName;
    let query = cursorDescription.selector;
    let opts = cursorDescription.options;
    let docSize = Kadira.docSzCache.getSize(coll, query, opts, result) * result.length;
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
  }

  ASYNC_CURSOR_METHODS.forEach(function (type) {
    let originalFunc = cursorProto[type];

    cursorProto[type] = async function () {
      const { payload, cursorDescription } = getCursorData({
        type,
        cursor: this,
      });

      return await Kadira.tracer.asyncEvent(EventType.DB, payload, null, async (event) => {
        let kadiraInfo = Kadira._getInfo();
        let previousTrackNextObject;

        if (kadiraInfo) {
          previousTrackNextObject = kadiraInfo.trackNextObject;

          if (['forEach', 'forEachAsync', 'map', 'mapAsync'].includes(type)) {
            kadiraInfo.trackNextObject = true;
          }
        }

        const result = await originalFunc.apply(this, arguments);

        let endData = {};

        if (['fetch', 'map', 'mapAsync'].includes(type)) {
          // for other cursor operation
          endData.docsFetched = result.length;

          if (type === 'fetch') {
            calculateMetrics(cursorDescription, result, endData, kadiraInfo, previousTrackNextObject);

            // TODO: Add doc size tracking to `map` as well.
          }
        }

        Kadira.tracer.asyncEventEnd(event, endData);
        return result;
      });
    };
  });

  const SynchronousCursor = MeteorX.SynchronousCursor;

  let origNextObject = SynchronousCursor.prototype._nextObject;

  SynchronousCursor.prototype._nextObject = function () {
    let kadiraInfo = Kadira._getInfo();
    let shouldTrack = kadiraInfo && kadiraInfo.trackNextObject;
    let event;
    if (shouldTrack ) {
      event = Kadira.tracer.event(kadiraInfo.trace, EventType.DB, {
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
