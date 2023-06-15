import { EventType } from '../../constants';
import { haveAsyncCallback } from '../../utils';

export function hijackAsyncMethods () {
  let mongoConnectionProto = MeteorX.MongoConnection.prototype;

  const ASYNC_METHODS = [
    'insertAsync',
    'removeAsync',
    'updateAsync',
    'createIndexAsync',
    'dropIndexAsync',
    'ensureIndex',
    'findOneAsync'
  ];

  // findOne is handled by find - so no need to track it
  // upsert is handles by update
  ASYNC_METHODS.forEach(function (func) {
    let originalFunc = mongoConnectionProto[func];

    if (!originalFunc) {
      return;
    }

    mongoConnectionProto[func] = function (collName, selector, mod, options) {
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

      return Kadira.tracer.asyncEvent(EventType.DB, payload, null, async (event) => {
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
}
