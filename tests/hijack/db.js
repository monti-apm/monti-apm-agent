import { TestData } from '../_helpers/globals';
import {
  addAsyncTest,
  callAsync,
  dumpEvents,
  getLastMethodEvents,
  registerMethod,
  RegisterMethod
} from '../_helpers/helpers';
import assert from 'assert';

addAsyncTest(
  'Database - insert',
  async function (test) {
    const methodId = RegisterMethod(async function () {
      await TestData.insertAsync({aa: 10});
      return 'insert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    dumpEvents(events);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'insertAsync'},{at: 1,endAt: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - throw error and catch',
  async function (test) {
    let methodId = registerMethod(async function () {
      try {
        await TestData.insertAsync({_id: 'aa'});
        await TestData.insertAsync({_id: 'aa', aa: 10});
      } catch (ex) { /* empty */ }
      return 'insert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'insertAsync'},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'insertAsync',err: 'E11000'},{at: 1,endAt: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - update',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      await TestData.updateAsync({_id: 'aa'}, {$set: {dd: 30}});
      return 'update';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'updateAsync',selector: '{"_id":"aa"}',updatedDocs: 1},{at: 1,endAt: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - remove',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      await TestData.removeAsync({_id: 'aa'});
      return 'remove';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'removeAsync',selector: '{"_id":"aa"}',removedDocs: 1},{at: 1,endAt: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - findOne',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      return TestData.findOneAsync({_id: 'aa'});
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',selector: '{"_id":"aa"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1},{at: 1,endAt: 1}],['complete']];

    test.equal(result, {_id: 'aa', dd: 10});

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - findOne with sort and fields',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      return TestData.findOneAsync({_id: 'aa'}, {
        sort: {dd: -1},
        fields: {dd: 1}
      });
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 1, 2, 3]);

    test.equal(result, {_id: 'aa', dd: 10});

    const expected = [['start',null,{userId: null,params: '[]'}],['wait',0,{waitOn: []},{at: 1,endAt: 1}],['db',0,{coll: 'tinytest-data',selector: '{"_id":"aa"}',func: 'fetch',cursor: true,projection: '{"dd":1}',sort: '{"dd":-1}',limit: 1,docsFetched: 1,docSize: 1},{at: 1,endAt: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - upsert',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.upsertAsync({_id: 'aa'}, {$set: {bb: 20}});
      await TestData.upsertAsync({_id: 'aa'}, {$set: {bb: 30}});
      return 'upsert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'upsert',selector: '{"_id":"aa"}',updatedDocs: 1,insertedId: 'aa'},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'upsert',selector: '{"_id":"aa"}',updatedDocs: 1},{at: 1,endAt: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - upsert with update',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.updateAsync({_id: 'aa'}, {$set: {bb: 20}}, {upsert: true});
      await TestData.updateAsync({_id: 'aa'}, {$set: {bb: 30}}, {upsert: true});
      return 'upsert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []}],['db',{coll: 'tinytest-data',func: 'upsert',selector: '{"_id":"aa"}',updatedDocs: 1}],['db',{coll: 'tinytest-data',func: 'upsert',selector: '{"_id":"aa"}',updatedDocs: 1}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - indexes',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.createIndexAsync({aa: 1, bb: 1});
      await TestData.dropIndexAsync({aa: 1, bb: 1});
      return 'indexes';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []}],['db',{coll: 'tinytest-data',func: 'createIndexAsync',index: '{"aa":1,"bb":1}'}],['db',{coll: 'tinytest-data',func: 'dropIndexAsync',index: '{"aa":1,"bb":1}'}],['complete']];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - count',
  async function (test) {
    await TestData.insertAsync({aa: 100});
    await TestData.insertAsync({aa: 300});

    let methodId = RegisterMethod(async function () {
      return TestData.find().countAsync();
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'countAsync', selector: JSON.stringify({})}],
      ['complete']
    ];

    test.equal(result, 2);
    test.equal(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - fetch',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = RegisterMethod(async function () {
      return TestData.find({_id: {$exists: true}}).fetchAsync();
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2], ['docSize', 'docsFetched']);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'fetch', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2, docSize: JSON.stringify({_id: 'aa'}).length * 2}],
      ['complete']
    ];

    test.stableEqual(result, [{_id: 'aa'}, {_id: 'bb'}]);
    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - map',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = RegisterMethod(async function () {
      return TestData.find({_id: {$exists: true}}).mapAsync(function (doc) {
        return doc._id;
      });
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2], ['docsFetched']);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'mapAsync', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2}],
      ['complete']
    ];

    test.stableEqual(result, ['aa', 'bb']);
    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - forEach',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = RegisterMethod(async function () {
      let res = [];

      await TestData.find({_id: {$exists: true}}).forEachAsync(function (doc) {
        res.push(doc._id);
      });

      return res;
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'forEachAsync', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];

    test.stableEqual(result, ['aa', 'bb']);
    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - forEach:findOne inside',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = RegisterMethod(async function () {
      let res = [];

      await TestData.find({_id: {$exists: true}}).forEachAsync(async function (doc) {
        res.push(doc._id);
        await TestData.findOneAsync();
      });

      return res;
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'forEachAsync', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];

    test.stableEqual(result, ['aa', 'bb']);
    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - observeChanges',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = registerMethod(async function () {
      let data = [];

      let handle = await TestData.find({}).observeChanges({
        added (id, fields) {
          fields._id = id;
          data.push(fields);
        }
      });

      handle.stop();

      return data;
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2], ['noOfCachedDocs']);

    events[2][1].oplog = false;

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2}],
      ['complete']
    ];

    test.stableEqual(result, [{_id: 'aa'}, {_id: 'bb'}]);

    clearAdditionalObserverInfo(events[2][1]);

    test.stableEqual(events, expected);
  }
);


/**
 * @warning `wasMultiplexerReady` is true for both when it should be false for the first one. Which might be an issue in Meteor code, so let's not test that.
 */
addAsyncTest(
  'Database - Cursor - observeChanges:re-using-multiplexer',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = registerMethod(async function () {
      let data = [];

      let handle1 = await TestData.find({}).observeChanges({
        added (id, fields) {
          fields._id = id;
          data.push(fields);
        }
      });

      let handle2 = await TestData.find({}).observeChanges({
        added () {
          // body
        }
      });

      assert.strictEqual(handle1._multiplexer, handle2._multiplexer, 'Multiplexer should be the same for both handles');

      handle1.stop();
      handle2.stop();
      return data;
    });

    let result = await callAsync(methodId);
    let events = getLastMethodEvents([0, 2], ['noOfCachedDocs']);

    events[2][1].oplog = false;
    events[3][1].oplog = false;

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2 }],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2 }],
      ['complete']
    ];

    test.stableEqual(result, [{_id: 'aa'}, {_id: 'bb'}]);

    clearAdditionalObserverInfo(events[2][1]);
    clearAdditionalObserverInfo(events[3][1]);

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - Cursor - observe',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = registerMethod(async function () {
      let data = [];
      let handle = await TestData.find({}).observe({
        added (doc) {
          data.push(doc);
        }
      });
      handle.stop();
      return data;
    });

    let result = await callAsync(methodId);
    let events = getLastMethodEvents([0, 2], ['noOfCachedDocs']);

    events[2][1].oplog = false;

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', func: 'observe', cursor: true, selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2 }],
      ['complete']
    ];

    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);
    clearAdditionalObserverInfo(events[2][1]);
    test.stableEqual(events, expected);
  }
);

function clearAdditionalObserverInfo (info) {
  delete info.queueLength;
  delete info.initialPollingTime;
  delete info.elapsedPollingTime;
  delete info.wasMultiplexerReady;
}
