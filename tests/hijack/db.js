import { TestData } from '../_helpers/globals';
import {
  callAsync,
  CleanTestData,
  EnableTrackingMethods,
  GetLastMethodEvents,
  GetMeteorClient,
  RegisterMethod
} from '../_helpers/helpers';

Tinytest.addAsync(
  'Database - insert',
  async function (test, done) {
    EnableTrackingMethods();

    const methodId = RegisterMethod(async function () {
      await TestData.insertAsync({aa: 10});
      return 'insert';
    });

    await callAsync(methodId);

    let events = GetLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insertAsync'}],
      ['complete']
    ];

    console.warn({ events, expected });

    test.equal(events, expected);

    await CleanTestData();

    done();
  }
);

Tinytest.add(
  'Database - insert with async callback',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      TestData.insert({aa: 10}, function () {
        // body...
      });
      return 'insert';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insert', async: true}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - throw error and catch',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      try {
        TestData.insert({_id: 'aa'});
        TestData.insert({_id: 'aa', aa: 10});
      } catch (ex) { /* empty */ }
      return 'insert';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    if (events && events[3] && events[3][2] && events[3][2].err) {
      events[3][2].err = events[3][2].err.indexOf('E11000') >= 0 ? 'E11000' : null;
    }
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insert'}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insert', err: 'E11000'}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - update',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa', dd: 10});
    let methodId = RegisterMethod(function () {
      TestData.update({_id: 'aa'}, {$set: {dd: 30}});
      return 'update';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'update', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - remove',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa', dd: 10});
    let methodId = RegisterMethod(function () {
      TestData.remove({_id: 'aa'});
      return 'remove';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'remove', selector: JSON.stringify({_id: 'aa'}), removedDocs: 1}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - findOne',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa', dd: 10});
    let methodId = RegisterMethod(function () {
      return TestData.findOne({_id: 'aa'});
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
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
    CleanTestData();
  }
);

Tinytest.add(
  'Database - findOne with sort and fields',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa', dd: 10});
    let methodId = RegisterMethod(function () {
      return TestData.findOne({_id: 'aa'}, {
        sort: {dd: -1},
        fields: {dd: 1}
      });
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
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
    CleanTestData();
  }
);

Tinytest.add(
  'Database - upsert',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      TestData.upsert({_id: 'aa'}, {$set: {bb: 20}});
      TestData.upsert({_id: 'aa'}, {$set: {bb: 30}});
      return 'upsert';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: 'aa'}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1, insertedId: undefined}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - upsert with update',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      TestData.update({_id: 'aa'}, {$set: {bb: 20}}, {upsert: true});
      TestData.update({_id: 'aa'}, {$set: {bb: 30}}, {upsert: true});
      return 'upsert';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
      ['db',undefined,{coll: 'tinytest-data', func: 'upsert', selector: JSON.stringify({_id: 'aa'}), updatedDocs: 1}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - indexes',
  function (test) {
    EnableTrackingMethods();
    let name = typeof TestData.createIndex === 'function' ? 'createIndex' : '_ensureIndex';
    let methodId = RegisterMethod(function () {
      TestData[name]({aa: 1, bb: 1});
      TestData._dropIndex({aa: 1, bb: 1});
      return 'indexes';
    });
    let client = GetMeteorClient();
    client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: name, index: JSON.stringify({aa: 1, bb: 1})}],
      ['db',undefined,{coll: 'tinytest-data', func: '_dropIndex', index: JSON.stringify({aa: 1, bb: 1})}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - count',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({aa: 100});
    TestData.insert({aa: 300});
    let methodId = RegisterMethod(function () {
      return TestData.find().count();
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'count', selector: JSON.stringify({})}],
      ['complete']
    ];
    test.equal(result, 2);
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - fetch',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      return TestData.find({_id: {$exists: true}}).fetch();
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'fetch', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2, docSize: JSON.stringify({_id: 'aa'}).length * 2}],
      ['complete']
    ];
    test.equal(result, [{_id: 'aa'}, {_id: 'bb'}]);
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - map',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      return TestData.find({_id: {$exists: true}}).map(function (doc) {
        return doc._id;
      });
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'map', selector: JSON.stringify({_id: {$exists: true}}), docsFetched: 2}],
      ['complete']
    ];
    test.equal(result, ['aa', 'bb']);
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - forEach',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      let res = [];
      TestData.find({_id: {$exists: true}}).forEach(function (doc) {
        res.push(doc._id);
      });
      return res;
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'forEach', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];
    test.equal(result, ['aa', 'bb']);
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - forEach:findOne inside',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      let res = [];
      TestData.find({_id: {$exists: true}}).forEach(function (doc) {
        res.push(doc._id);
        TestData.findOne();
      });
      return res;
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'find', selector: JSON.stringify({_id: {$exists: true}})}],
      ['db',undefined,{coll: 'tinytest-data', cursor: true, func: 'forEach', selector: JSON.stringify({_id: {$exists: true}})}],
      ['complete']
    ];
    test.equal(result, ['aa', 'bb']);
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - observeChanges',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      let data = [];
      let handle = TestData.find({}).observeChanges({
        added (id, fields) {
          fields._id = id;
          data.push(fields);
        }
      });
      handle.stop();
      return data;
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
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
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - observeChanges:re-using-multiflexer',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      let data = [];
      let handle = TestData.find({}).observeChanges({
        added (id, fields) {
          fields._id = id;
          data.push(fields);
        }
      });
      let handle2 = TestData.find({}).observeChanges({
        added () {
          // body
        }
      });
      handle.stop();
      handle2.stop();
      return data;
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
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
    CleanTestData();
  }
);

Tinytest.add(
  'Database - Cursor - observe',
  function (test) {
    EnableTrackingMethods();
    TestData.insert({_id: 'aa'});
    TestData.insert({_id: 'bb'});
    let methodId = RegisterMethod(function () {
      let data = [];
      let handle = TestData.find({}).observe({
        added (doc) {
          data.push(doc);
        }
      });
      handle.stop();
      return data;
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
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
    CleanTestData();
  }
);

function clearAdditionalObserverInfo (info) {
  delete info.queueLength;
  delete info.initialPollingTime;
  delete info.elapsedPollingTime;
}
