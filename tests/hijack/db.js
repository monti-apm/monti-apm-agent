import { observerOptions, assertObserverDriver } from '../_helpers/observer_drivers';
import { TestData } from '../_helpers/globals';
import {
  addAsyncTest,
  callAsync,
  dumpEvents,
  getLastMethodEvents,
  getMethodEvents,
  isRedisOplogEnabled,
  registerMethod,
  RegisterMethod
} from '../_helpers/helpers';
import assert from 'assert';

addAsyncTest(
  'Database - basic - insert',
  async function (test) {
    const methodId = RegisterMethod(async function () {
      await TestData.insertAsync({aa: 10});
      return 'insert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    dumpEvents(events);

    let expected = [
      ['start',{userId: null,params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data',func: 'insertAsync'}],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - throw error and catch',
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

    let expected = [
      ['start',{userId: null,params: '[]'}],
      ['wait',{waitOn: []}],['db',{coll: 'tinytest-data',func: 'insertAsync'}],
      ['db',{coll: 'tinytest-data',func: 'insertAsync',err: 'E11000'}],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - update',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      await TestData.updateAsync({_id: 'aa'}, {$set: {dd: 30}});
      return 'update';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ... isRedisOplogEnabled ? [
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docSize: 1, docsFetched: 1, limit: 1, projection: JSON.stringify({_id: 1})}],
        ['db',{coll: 'tinytest-data', func: 'updateAsync', selector: JSON.stringify({_id: { $in: ['aa']}}), updatedDocs: 1}]
      ] : [['db', {coll: 'tinytest-data', func: 'updateAsync', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}]],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - remove',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      await TestData.removeAsync({_id: 'aa'});
      return 'remove';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ...isRedisOplogEnabled ? [
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docSize: 1, docsFetched: 1, projection: JSON.stringify({_id: 1})}],
        ['db',{coll: 'tinytest-data', func: 'removeAsync', selector: JSON.stringify({_id: 'aa'}), removedDocs: 1}]
      ] : [['db', {coll: 'tinytest-data', func: 'removeAsync', selector: JSON.stringify({_id: 'aa'}), removedDocs: 1}]],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - findOne',
  async function (test) {
    await TestData.insertAsync({_id: 'aa', dd: 10});

    let methodId = registerMethod(async function () {
      return TestData.findOneAsync({_id: 'aa'});
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [
      ['start',{userId: null,params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data',selector: '{"_id":"aa"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1}],
      ['complete']
    ];

    test.equal(result, {_id: 'aa', dd: 10});

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - findOne with sort and fields',
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

    const expected = [
      ['start',0,{userId: null,params: '[]'}],
      ['wait',0,{waitOn: []}],
      ['db',0,{coll: 'tinytest-data',selector: '{"_id":"aa"}',func: 'fetch',cursor: true,projection: '{"dd":1}',sort: '{"dd":-1}',limit: 1,docsFetched: 1,docSize: 1}],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - upsert',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.upsertAsync({_id: 'aa'}, {$set: {bb: 20}});
      await TestData.upsertAsync({_id: 'aa'}, {$set: {bb: 30}});
      return 'upsert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ...isRedisOplogEnabled ? [
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docsFetched: 0, docSize: 0, limit: 1, projection: JSON.stringify({_id: 1})}],
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: 'aa'}],
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docsFetched: 1, docSize: 1, limit: 1, projection: JSON.stringify({_id: 1})}],
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: undefined}],
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docsFetched: 1, docSize: 1 }]
      ] : [
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: 'aa'}],
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: undefined}]
      ],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - upsert with update',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.updateAsync({_id: 'aa'}, {$set: {bb: 20}}, {upsert: true});
      await TestData.updateAsync({_id: 'aa'}, {$set: {bb: 30}}, {upsert: true});
      return 'upsert';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ...isRedisOplogEnabled ? [
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docsFetched: 0, docSize: 0, limit: 1, projection: JSON.stringify({_id: 1})}],
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: 'aa'}],
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docsFetched: 1, docSize: 1, limit: 1, projection: JSON.stringify({_id: 1})}],
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: undefined}],
        ['db',{coll: 'tinytest-data', func: 'fetch', selector: JSON.stringify({_id: 'aa'}), cursor: true, docsFetched: 1, docSize: 1 }]
      ] : [
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
        ['db',{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}]
      ],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);

addAsyncTest(
  'Database - basic - indexes',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.createIndexAsync({aa: 1, bb: 1});
      await TestData.dropIndexAsync({aa: 1, bb: 1});
      return 'indexes';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',{userId: null,params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data',func: 'createIndexAsync',index: '{"aa":1,"bb":1}'}],
      ['db',{coll: 'tinytest-data',func: 'dropIndexAsync',index: '{"aa":1,"bb":1}'}],
      ['complete']
    ];

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
      ['db',{coll: 'tinytest-data', cursor: true, func: 'map', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2}],
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
      ['db',{coll: 'tinytest-data', cursor: true, func: 'forEach', selector: JSON.stringify({_id: {$exists: true}})}],
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
      ['db',{coll: 'tinytest-data', cursor: true, func: 'forEach', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];

    test.stableEqual(result, ['aa', 'bb']);
    test.stableEqual(events, expected);
  }
);

addAsyncTest.eachDriver(
  'Database - Cursor - observeChanges',
  async function (test, client, driver) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = registerMethod(async function () {
      let data = [];

      let handle = await TestData.find({}, observerOptions()).observeChanges({
        added (id, fields) {
          fields._id = id;
          data.push(fields);
        }
      });

      assertObserverDriver(test, handle, driver);
      await handle.stop();

      return data;
    });

    let result = await callAsync(methodId);

    let events = getLastMethodEvents([0, 2], ['noOfCachedDocs']);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), ...expectedObserverInfo(driver), noOfCachedDocs: 2}],
      ['complete']
    ];

    test.stableEqual(result, [{_id: 'aa'}, {_id: 'bb'}]);

    clearAdditionalObserverInfo(events[2][1]);

    test.stableEqual(events, expected);
  }
);

// Redis-oplog 3.0.1 doesn't preserve nonMutatingCallbacks
if (!process.env.REDIS_OPLOG_SETTINGS) {
  addAsyncTest.eachDriver(
    'Database - Cursor - observeChanges preserves nonMutatingCallbacks',
    async function (test, client, driver) {
      await TestData.insertAsync({_id: 'aa'});

      let methodId = registerMethod(async function () {
        let handle = await TestData.find({}, observerOptions()).observeChanges({
          added () {}
        }, {
          nonMutatingCallbacks: true
        });

        let result = handle.nonMutatingCallbacks;
        assertObserverDriver(test, handle, driver);
        await handle.stop();
        return result;
      });

      let result = await callAsync(methodId);
      test.equal(result, true);
    }
  );
}


/**
 * @warning `wasMultiplexerReady` is true for both when it should be false for the first one. Which might be an issue in Meteor code, so let's not test that.
 */
addAsyncTest.eachDriver(
  'Database - Cursor - observeChanges:re-using-multiplexer',
  async function (test, client, driver) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = registerMethod(async function () {
      let data = [];

      let handle1 = await TestData.find({}, observerOptions()).observeChanges({
        added (id, fields) {
          fields._id = id;
          data.push(fields);
        }
      });

      let handle2 = await TestData.find({}, observerOptions()).observeChanges({
        added () {
          // body
        }
      });

      assert.strictEqual(handle1._multiplexer, handle2._multiplexer, 'Multiplexer should be the same for both handles');

      assertObserverDriver(test, handle1, driver);
      assertObserverDriver(test, handle2, driver);
      await handle1.stop();
      await handle2.stop();
      return data;
    });

    let result = await callAsync(methodId);
    let events = getLastMethodEvents([0, 2], ['noOfCachedDocs']);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), ...expectedObserverInfo(driver), noOfCachedDocs: 2 }],
      ['db',{coll: 'tinytest-data', cursor: true, func: 'observeChanges', selector: JSON.stringify({}), ...expectedObserverInfo(driver), noOfCachedDocs: 2 }],
      ['complete']
    ];

    test.stableEqual(result, [{_id: 'aa'}, {_id: 'bb'}]);

    clearAdditionalObserverInfo(events[2][1]);
    clearAdditionalObserverInfo(events[3][1]);

    test.stableEqual(events, expected);
  }
);

addAsyncTest.eachDriver(
  'Database - Cursor - observe',
  async function (test, client, driver) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = registerMethod(async function () {
      let data = [];
      let handle = await TestData.find({}, observerOptions()).observe({
        added (doc) {
          data.push(doc);
        }
      });
      assertObserverDriver(test, handle, driver);
      await handle.stop();
      return data;
    });

    let result = await callAsync(methodId);
    let events = getLastMethodEvents([0, 2], ['noOfCachedDocs']);

    let expected = [
      ['start',{userId: null, params: '[]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data', func: 'observe', cursor: true, selector: JSON.stringify({}), ...expectedObserverInfo(driver), noOfCachedDocs: 2 }],
      ['complete']
    ];

    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);
    clearAdditionalObserverInfo(events[2][1]);
    test.stableEqual(events, expected);
  }
);

addAsyncTest('Database - AsynchronousCursor - _nextObjectPromise', async function (test) {
  await TestData.insertAsync({_id: 'aa'});
  await TestData.insertAsync({_id: 'bb'});

  let methodId = registerMethod(async function () {
    let data = [];
    let cursor = TestData.find({});

    await cursor.forEach(function (doc) {
      data.push(doc);
    });

    return data;
  });

  let result = await callAsync(methodId);

  let events = getLastMethodEvents([0, 2, 3], ['noOfCachedDocs']);

  let expected = [
    ['start',{userId: null, params: '[]'}],
    ['wait',{waitOn: []}],
    ['db', { coll: 'tinytest-data', func: 'forEach', cursor: true, selector: JSON.stringify({}) }, {
      nested: [
        ['db', { coll: 'tinytest-data', func: '_nextObjectPromise'}],
        ['db', { coll: 'tinytest-data', func: '_nextObjectPromise'}],
        ['db', { coll: 'tinytest-data', func: '_nextObjectPromise'}],
      ]
    }],
    ['complete']
  ];

  test.stableEqual(result, [{_id: 'aa'}, {_id: 'bb'}]);
  test.stableEqual(events, expected);
});

addAsyncTest(
  'Database - Cursor - fetch after forEach does not track per-document events',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});
    await TestData.insertAsync({_id: 'bb'});

    let methodId = RegisterMethod(async function () {
      await TestData.find({_id: {$exists: true}}).forEachAsync(function () {});
      await TestData.find({_id: {$exists: true}}).fetchAsync();
      return 'done';
    });

    await callAsync(methodId);

    let events = getMethodEvents();

    let forEachEvents = findDbEvents(events, 'forEach');
    test.equal(forEachEvents.length, 1);
    let forEachPerDoc = findDbEvents((forEachEvents[0][3] && forEachEvents[0][3].nested) || [], '_nextObjectPromise');
    test.isTrue(forEachPerDoc.length > 0, 'per-document events should be tracked during forEach');

    let fetchEvents = findDbEvents(events, 'fetch');
    test.equal(fetchEvents.length, 1);
    let fetchPerDoc = findDbEvents((fetchEvents[0][3] && fetchEvents[0][3].nested) || [], '_nextObjectPromise');
    test.equal(fetchPerDoc.length, 0, 'fetch should not track per-document events after a forEach in the same trace');
  }
);

addAsyncTest(
  'Database - Cursor - forEach and map outside a trace',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});

    let ids = [];
    // Shouldn't throw
    await TestData.find({}).forEachAsync(doc => ids.push(doc._id));
    let mapped = await TestData.find({}).mapAsync(doc => doc._id);

    test.equal(ids, ['aa']);
    test.equal(mapped, ['aa']);
  }
);

addAsyncTest(
  'Database - basic - countDocuments and estimatedDocumentCount',
  async function (test) {
    await TestData.insertAsync({_id: 'aa'});

    let methodId = RegisterMethod(async function () {
      let count = await TestData.countDocuments({_id: {$exists: true}});
      let estimated = await TestData.estimatedDocumentCount();
      return { count, estimated };
    });

    let result = await callAsync(methodId);

    test.equal(result.count, 1);

    let events = getMethodEvents();

    test.equal(findDbEvents(events, 'countDocuments').length, 1, 'countDocuments should be tracked as a db event');
    test.equal(findDbEvents(events, 'estimatedDocumentCount').length, 1, 'estimatedDocumentCount should be tracked as a db event');
  }
);

function expectedObserverInfo (driver) {
  if (driver === 'polling') {
    return {
      oplog: false,
      noOplogCode: 'DISABLE_OPLOG',
      noOplogReason: "You've disabled oplog for this cursor explicitly with _disableOplog option."
    };
  }
  return {oplog: driver === 'oplog' || driver === 'redis'};
}

function clearAdditionalObserverInfo (info) {
  delete info.queueLength;
  delete info.initialPollingTime;
  delete info.elapsedPollingTime;
  delete info.wasMultiplexerReady;
}

// Recursively finds built db events with the given func in the
// events and their nested events
function findDbEvents (events, func, acc = []) {
  events.forEach((event) => {
    if (!Array.isArray(event)) {
      return;
    }

    if (event[0] === 'db' && event[2] && event[2].func === func) {
      acc.push(event);
    }

    findDbEvents((event[3] && event[3].nested) || [], func, acc);
  });

  return acc;
}
