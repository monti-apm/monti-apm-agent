import { TestData } from '../_helpers/globals';
import {
  addAsyncTest,
  callAsync,
  getLastMethodEvents,
  GetLastMethodEvents,
  registerMethod,
  RegisterMethod
} from '../_helpers/helpers';

addAsyncTest(
  'Database - insert',
  async function (test) {
    const methodId = RegisterMethod(async function () {
      await TestData.insertAsync({aa: 10});
      return 'insert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insertAsync'}],
      ['complete']
    ];

    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    if (events && events[3] && events[3][2] && events[3][2].err) {
      events[3][2].err = events[3][2].err.indexOf('E11000') >= 0 ? 'E11000' : null;
    }

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insertAsync'}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insertAsync', err: 'E11000'}],
      ['complete']
    ];

    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'updateAsync', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
      ['complete']
    ];

    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'removeAsync', selector: JSON.stringify({_id: 'aa'}), removedDocs: 1}],
      ['complete']
    ];

    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: 'aa'})}],
      ['db',undefined,{
        coll: 'tinytest-data',
        func: 'fetch',
        cursor: true,
        selector: JSON.stringify({_id: 'aa'}),
        docsFetched: 1,
        docSize: JSON.stringify({_id: 'aa', dd: 10}).length,
        limit: 1
      }],
      ['complete']
    ];

    test.equal(result, {_id: 'aa', dd: 10});
    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: 'aa'})}],
      ['db',undefined,{
        coll: 'tinytest-data',
        func: 'fetch',
        cursor: true,
        selector: JSON.stringify({_id: 'aa'}),
        sort: JSON.stringify({dd: -1}),
        docsFetched: 1,
        docSize: JSON.stringify({_id: 'aa', dd: 10}).length,
        projection: JSON.stringify({dd: 1}),
        limit: 1
      }],
      ['complete']
    ];

    const projection = JSON.stringify({dd: 1});

    if (events[3][2].projection) {
      expected[3][2].projection = projection;
    } else {
      expected[3][2].fields = projection;
    }

    test.equal(result, {_id: 'aa', dd: 10});
    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: 'aa'}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: undefined}],
      ['complete']
    ];

    test.equal(events, expected);
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

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
      ['complete']
    ];

    test.equal(events, expected);
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

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'createIndexAsync', index: JSON.stringify({aa: 1, bb: 1})}],
      ['db',undefined,{coll: 'tinytest-data', func: 'dropIndexAsync', index: JSON.stringify({aa: 1, bb: 1})}],
      ['complete']
    ];

    test.equal(events, expected);
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
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'count', selector: JSON.stringify({})}],
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'fetch', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2, docSize: JSON.stringify({_id: 'aa'}).length * 2}],
      ['complete']
    ];

    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);
    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'map', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2}],
      ['complete']
    ];

    test.equal(result, ['aa', 'bb']);
    test.equal(events, expected);
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
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'forEach', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];

    test.equal(result, ['aa', 'bb']);
    test.equal(events, expected);
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
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'forEach', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];

    test.equal(result, ['aa', 'bb']);

    test.equal(events, expected);
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

    let events = getLastMethodEvents([0, 2]);

    events[3][2].oplog = false;

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2, wasMultiplexerReady: false}],
      ['complete']
    ];

    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);

    clearAdditionalObserverInfo(events[3][2]);

    test.equal(events, expected);
  }
);


/**
 * @flaky
 * @todo `wasMultiplexerReady` is true for both when it should be false then true all the time
 */
addAsyncTest(
  'Database - Cursor - observeChanges:re-using-multiflexer',
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
      let handle2 = await TestData.find({}).observeChanges({
        added () {
          // body
        }
      });
      handle.stop();
      handle2.stop();
      return data;
    });

    let result = await callAsync(methodId);
    let events = GetLastMethodEvents([0, 2]);

    events[3][2].oplog = false;
    events[5][2].oplog = false;

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2, wasMultiplexerReady: false}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2, wasMultiplexerReady: true}],
      ['complete']
    ];

    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);

    clearAdditionalObserverInfo(events[3][2]);
    clearAdditionalObserverInfo(events[5][2]);

    test.equal(events, expected);
  }
);

/**
 * @issue found in Meteor's codebase
 */
addAsyncTest.skip(
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
    let events = getLastMethodEvents([0, 2]);

    events[3][2].oplog = false;

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({})}],
      ['db',undefined,{coll: 'tinytest-data', func: 'observe', cursor: true, selector: JSON.stringify({}), oplog: false, noOfCachedDocs: 2, wasMultiplexerReady: false}],
      ['complete']
    ];

    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);
    clearAdditionalObserverInfo(events[3][2]);
    test.equal(events, expected);
  }
);

function clearAdditionalObserverInfo (info) {
  delete info.queueLength;
  delete info.initialPollingTime;
  delete info.elapsedPollingTime;
}
