import { _ } from 'meteor/underscore';
import { Tracer } from '../../lib/tracer/tracer';
import {
  addAsyncTest,
  callAsync,
  cleanTrace,
  getLastMethodEvents,
  registerMethod,
  subscribeAndWait
} from '../_helpers/helpers';
import { sleep } from '../../lib/utils';
import { TestData } from '../_helpers/globals';
import { getInfo } from '../../lib/async/als';
import { mergeIntervals, subtractIntervals } from '../../lib/utils/time';
import { diffObjects, prettyLog } from '../_helpers/pretty-log';
import { EventType } from '../../lib/constants';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

let eventDefaults = {
  endAt: 0,
  nested: [],
};

addAsyncTest(
  'Tracer - Trace Method - method',
  async function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };

    let traceInfo = Kadira.tracer.start({id: 'session-id', userId: 'uid'}, ddpMessage);

    Kadira.tracer.event(traceInfo, 'start', {abc: 100});
    Kadira.tracer.event(traceInfo, 'end', {abc: 200});

    cleanTrace(traceInfo);

    let expected = {
      _id: 'session-id::the-id',
      id: 'the-id',
      session: 'session-id',
      userId: 'uid',
      type: 'method',
      name: 'method-name',
      events: [
        {type: 'start', data: {abc: 100}},
        {type: 'end', data: {abc: 200}}
      ]
    };

    diffObjects(traceInfo, expected);

    test.equal(traceInfo, expected);
  }
);

addAsyncTest(
  'Tracer - Trace Method - complete after errored',
  function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };

    let traceInfo = Kadira.tracer.start({id: 'session-id', userId: 'uid'}, ddpMessage);

    Kadira.tracer.event(traceInfo, 'start');
    Kadira.tracer.event(traceInfo, 'error');
    Kadira.tracer.event(traceInfo, 'complete');

    cleanTrace(traceInfo);

    let expected = {
      _id: 'session-id::the-id',
      id: 'the-id',
      session: 'session-id',
      userId: 'uid',
      type: 'method',
      name: 'method-name',
      events: [
        {type: 'start'},
        {type: 'error'}
      ],
    };

    test.equal(traceInfo, expected);
  }
);

Tinytest.add(
  'Tracer - trace sub',
  function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'sub',
      name: 'sub-name'
    };
    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);
    Kadira.tracer.event(traceInfo, 'start', {abc: 100});
    Kadira.tracer.event(traceInfo, 'end', {abc: 200});
    cleanTrace(traceInfo);
    let expected = {
      _id: 'session-id::the-id',
      session: 'session-id',
      id: 'the-id',
      events: [
        {type: 'start', data: {abc: 100}},
        {type: 'end', data: {abc: 200}}
      ],
      type: 'sub',
      name: 'sub-name'
    };
    delete traceInfo.userId;
    test.equal(traceInfo, expected);
  }
);

Tinytest.add(
  'Tracer - trace other ddp',
  function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'unsub',
      name: 'sub-name'
    };
    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);
    test.equal(traceInfo, null);
  }
);

addAsyncTest(
  'Tracer - trace other events',
  async function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };

    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);

    Kadira.tracer.event(traceInfo, 'start', {abc: 100});

    let eventId = Kadira.tracer.event(traceInfo, 'db');

    await sleep(25);

    Kadira.tracer.eventEnd(traceInfo, eventId);

    Kadira.tracer.event(traceInfo, 'end', {abc: 200});

    cleanTrace(traceInfo);

    let expected = {
      _id: 'session-id::the-id',
      id: 'the-id',
      session: 'session-id',
      type: 'method',
      name: 'method-name',
      events: [
        {type: 'start', data: {abc: 100}},
        {type: 'db', endAt: 10},
        {type: 'end', data: {abc: 200}}
      ],
    };

    delete traceInfo.userId;

    test.stableEqual(traceInfo, expected);
  }
);

addAsyncTest(
  'Tracer - end last event',
  async function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };

    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);

    Kadira.tracer.event(traceInfo, 'start', {abc: 100});
    Kadira.tracer.event(traceInfo, 'db');

    await sleep(25);

    Kadira.tracer.endLastEvent(traceInfo);
    Kadira.tracer.event(traceInfo, 'end', {abc: 200});

    cleanTrace(traceInfo);

    let expected = {
      _id: 'session-id::the-id',
      id: 'the-id',
      session: 'session-id',
      type: 'method',
      name: 'method-name',
      events: [
        {type: 'start', data: {abc: 100}},
        {type: 'db', endAt: 10, forcedEnd: true},
        {type: 'end', data: {abc: 200}}
      ]
    };

    delete traceInfo.userId;

    test.equal(traceInfo, expected);
  }
);

addAsyncTest(
  'Tracer - trace same event twice',
  async function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };

    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);

    Kadira.tracer.event(traceInfo, 'start', {abc: 100});

    let eventId = Kadira.tracer.event(traceInfo, 'db');

    // Due to parallelization, we should not assume the order of events.
    Kadira.tracer.event(traceInfo, 'db');

    await sleep(20);

    Kadira.tracer.eventEnd(traceInfo, eventId);

    Kadira.tracer.event(traceInfo, 'end', {abc: 200});

    cleanTrace(traceInfo);

    let expected = {
      _id: 'session-id::the-id',
      id: 'the-id',
      session: 'session-id',
      type: 'method',
      name: 'method-name',
      events: [
        {type: 'start', data: {abc: 100}},
        {type: 'db', endAt: 10},
        {type: 'db'},
        {type: 'end', data: {abc: 200}}
      ]
    };

    delete traceInfo.userId;

    test.stableEqual(traceInfo, expected);
  }
);

addAsyncTest(
  'Tracer - Build Trace - simple',
  async function (test) {
    let now = new Date().getTime();

    let traceInfo = {
      events: [
        {...eventDefaults, type: 'start', at: now, endAt: now},
        {...eventDefaults, type: 'wait', at: now, endAt: now + 1000},
        {...eventDefaults, type: 'db', at: now + 2000, endAt: now + 2500},
        {type: EventType.Complete, at: now + 4500}
      ]
    };

    Kadira.tracer.buildTrace(traceInfo);

    const expected = {
      total: 4500,
      wait: 1000,
      db: 500,
      compute: 3000,
      async: 0,
    };

    test.stableEqual(traceInfo.metrics, expected);
    test.stableEqual(traceInfo.errored, false);
  }
);

addAsyncTest(
  'Tracer - Build Trace - errored',
  function (test) {
    let now = new Date().getTime();

    let traceInfo = {
      events: [
        {...eventDefaults, type: 'start', at: now},
        {...eventDefaults, type: 'wait', at: now, endAt: now + 1000},
        {...eventDefaults, type: 'db', at: now + 2000, endAt: now + 2500},
        {...eventDefaults, type: 'error', at: now + 2500}
      ]
    };

    Kadira.tracer.buildTrace(traceInfo);

    const expected = {
      total: 2500,
      wait: 1000,
      db: 500,
      compute: 1000,
      async: 0,
    };

    test.equal(traceInfo.metrics, expected);
    test.equal(traceInfo.errored, true);
  }
);

Tinytest.add(
  'Tracer - Build Trace - no start',
  function (test) {
    let now = new Date().getTime();
    let traceInfo = {
      events: [
        {type: 'wait', at: now, endAt: now + 1000},
        {type: 'db', at: now + 2000, endAt: now + 2500},
        {type: 'complete', at: now + 2500}
      ]
    };
    Kadira.tracer.buildTrace(traceInfo);
    test.equal(traceInfo.metrics, undefined);
  }
);

Tinytest.add(
  'Tracer - Build Trace - no complete',
  function (test) {
    let now = new Date().getTime();
    let traceInfo = {
      events: [
        {type: 'start', at: now, endAt: now},
        {type: 'wait', at: now, endAt: now + 1000},
        {type: 'db', at: now + 2000, endAt: 2500},
      ]
    };
    Kadira.tracer.buildTrace(traceInfo);
    test.equal(traceInfo.metrics, undefined);
  }
);

addAsyncTest(
  'Tracer - Build Trace - event not ended',
  function (test) {
    const now = 0;

    const traceInfo = {
      events: [
        {type: 'start', at: now},
        {type: 'wait', at: now, endAt: null},
        {type: 'db', at: now + 2000, endAt: now + 2500},
        {type: 'complete', at: now + 2500}
      ]
    };

    Kadira.tracer.buildTrace(traceInfo);

    const expected = [
      ['start'],
      ['wait', 0, null, { at: 0, endAt: 0, forcedEnd: true }],
      ['db', 500, null, { at: 2000, endAt: 2500}],
      ['complete']
    ];

    test.stableEqual(traceInfo.events, expected);
  }
);

addAsyncTest(
  'Tracer - Build Trace - truncate events',
  function (test) {
    let now = new Date().getTime();
    let traceInfo = {
      events: [
        {...eventDefaults, type: 'start', at: now},
        {...eventDefaults, type: 'wait', at: now, endAt: now},
      ]
    };

    for (let i = 0; i < 10000; i++) {
      traceInfo.events.push({ ...eventDefaults, type: 'db', at: now, endAt: now + 500 });
      now += 500;
    }

    traceInfo.events.push({...eventDefaults, type: 'complete', at: now + 2500});
    Kadira.tracer.buildTrace(traceInfo);

    test.equal(traceInfo.metrics.db, 5000000);
    test.equal(traceInfo.events.length, 1500);
  }
);

Tinytest.add(
  'Tracer - Filters - filter start',
  function (test) {
    let tracer = new Tracer();
    tracer.addFilter(function (type, data) {
      test.equal(type, 'db');
      return _.pick(data, 'coll');
    });

    let traceInfo = startTrace(tracer);
    tracer.event(traceInfo, 'db', {coll: 'posts', secret: ''});

    let expected = {coll: 'posts'};
    test.equal(traceInfo.events[0].data, expected);
  }
);

Tinytest.add(
  'Tracer - Filters - filter end',
  function (test) {
    let tracer = new Tracer();
    tracer.addFilter(function (type, data) {
      test.equal(type, 'dbend');
      return _.pick(data, 'coll');
    });

    let traceInfo = startTrace(tracer);
    let id = tracer.event(traceInfo, 'db');
    tracer.eventEnd(traceInfo, id, {coll: 'posts', secret: ''});

    let expected = {coll: 'posts'};
    test.equal(traceInfo.events[0].data, expected);
  }
);

Tinytest.add(
  'Tracer - Filters - ignore side effects',
  function (test) {
    let tracer = new Tracer();
    tracer.addFilter(function (type, data) {
      data.someOtherField = 'value';
      return _.pick(data, 'coll');
    });

    let traceInfo = startTrace(tracer);
    tracer.event(traceInfo, 'db', {coll: 'posts', secret: ''});

    let expected = {coll: 'posts'};
    test.equal(traceInfo.events[0].data, expected);
  }
);

Tinytest.add(
  'Tracer - Filters - multiple filters',
  function (test) {
    let tracer = new Tracer();
    tracer.addFilter(function (type, data) {
      return _.pick(data, 'coll');
    });
    tracer.addFilter(function (type, data) {
      data.newField = 'value';
      return data;
    });

    let traceInfo = startTrace(tracer);
    tracer.event(traceInfo, 'db', {coll: 'posts', secret: ''});

    let expected = {coll: 'posts', newField: 'value'};
    test.equal(traceInfo.events[0].data, expected);
  }
);

Tinytest.add(
  'Tracer - Filters - Filter by method name',
  function (test) {
    let tracer = new Tracer();
    tracer.addFilter(function (type, data, info) {
      if (info.type === 'method' && info.name === 'method-name') {
        return _.pick(data, 'coll');
      }
      return data;
    });

    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };
    let info = {id: 'session-id', userId: 'uid'};
    let traceInfo = Kadira.tracer.start(info, ddpMessage);

    tracer.event(traceInfo, 'db', {coll: 'posts', secret: ''});

    let expected = {coll: 'posts'};
    test.equal(traceInfo.events[0].data, expected);
  }
);

Tinytest.add(
  'Tracer - Filters - Filter by sub name',
  function (test) {
    let tracer = new Tracer();
    tracer.addFilter(function (type, data, info) {
      if (info.type === 'sub' && info.name === 'sub-name') {
        return _.pick(data, 'coll');
      }
      return data;
    });

    let ddpMessage = {
      id: 'the-id',
      msg: 'sub',
      name: 'sub-name'
    };
    let info = {id: 'session-id', userId: 'uid'};
    let traceInfo = Kadira.tracer.start(info, ddpMessage);

    tracer.event(traceInfo, 'db', {coll: 'posts', secret: ''});

    let expected = {coll: 'posts'};
    test.equal(traceInfo.events[0].data, expected);
  }
);

addAsyncTest('Tracer - Build Trace - custom with nested parallel events', async function (test) {
  const Email = Package['email'].Email;

  let methodId = registerMethod(async function () {
    let backgroundPromise;

    // Compute
    await sleep(30);

    await Kadira.event('test', async (event) => {
      await TestData.insertAsync({ _id: 'a', n: 1 });
      await TestData.insertAsync({ _id: 'b', n: 2 });
      await TestData.insertAsync({ _id: 'c', n: 3 });

      await Meteor.userAsync();

      backgroundPromise = Promise.resolve().then(async () => {
        // Email
        Email.sendAsync({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
      });

      // Compute
      await sleep(30);

      const ids = ['a', 'b', 'c'];

      // DB
      await Promise.all(ids.map(_id => TestData.findOneAsync({_id})));

      await TestData.findOneAsync({ _id: 'a1'}).then(() =>
        // Is this nested under the previous findOneAsync or is it a sibling?
        TestData.findOneAsync({ _id: 'a2' })
      );

      Kadira.endEvent(event);
    });

    return backgroundPromise;
  });

  await callAsync(methodId);

  const events = getLastMethodEvents([0, 2, 3]);

  const expected = [['start',{userId: null,params: '[]'}],['wait',{waitOn: []},{at: 1,endAt: 1}],['custom',null,{name: 'test',at: 1,endAt: 1,nested: [['db',{coll: 'tinytest-data',func: 'insertAsync'},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'insertAsync'},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',func: 'insertAsync'},{at: 1,endAt: 1}],['emailAsync',{from: 'arunoda@meteorhacks.com',to: 'hello@meteor.com'},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',selector: '{"_id":"a"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',selector: '{"_id":"b"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',selector: '{"_id":"c"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',selector: '{"_id":"a1"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 0,docSize: 0},{at: 1,endAt: 1}],['db',{coll: 'tinytest-data',selector: '{"_id":"a2"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 0,docSize: 0},{at: 1,endAt: 1}]]}],['complete']];

  test.stableEqual(events, expected);
});

addAsyncTest.only('Tracer - Build Trace - the correct number of async events are captured for methods', async (test) => {
  let info;

  const methodId = registerMethod(async function () {
    await sleep(100);
    await sleep(200);

    info = getInfo();

    return await sleep(300);
  });

  await callAsync(methodId);

  const asyncEvents = info.trace.events.filter(([type, duration]) => type === EventType.Async && duration >= 100);

  prettyLog(info.trace.events);

  test.equal(asyncEvents.length, 3);
});

addAsyncTest('Tracer - Build Trace - the correct number of async events are captured for pubsub', async (test, client) => {
  const subName = `sub_${Random.id()}`;

  let info;

  Meteor.publish(subName, async function () {
    await sleep(100);

    info = getInfo();

    return [];
  });

  await subscribeAndWait(client, subName);

  prettyLog(info.trace.events);

  const asyncEvents = info.trace.events.filter(([type, duration]) => type === EventType.Async && duration >= 100);

  test.equal(asyncEvents.length,1);
});

addAsyncTest('Tracer - Time - Subtract Intervals', async function (test) {
  function testSubtractIntervals (arr1, arr2, expected) {
    const result = subtractIntervals(arr1, arr2);
    test.stableEqual(result, expected);
  }

  testSubtractIntervals([
    [0, 10],
    [20, 30],
    [40, 50],
  ],[
    [5, 15],
    [25, 35],
    [35, 45],
  ],[
    [0, 5],
    [20, 25],
    [45, 50],
  ]);

  testSubtractIntervals(
    [
      [0, 10],
      [20, 30],
      [40, 50],
    ],
    [[0, 50]],
    []
  );

  testSubtractIntervals(
    [
      [0, 100],
    ],
    [
      [0, 50],
    ],
    [
      [50, 100],
    ]
  );
});

addAsyncTest('Tracer- Time - Merge Parallel Intervals', async function (test) {
  function testMergeParallelIntervals (arr, expected) {
    const result = mergeIntervals(arr);
    test.stableEqual(result, expected);
  }

  testMergeParallelIntervals([
    [0, 10],
    [20, 30],
    [40, 50],
  ],[
    [0, 10],
    [20, 30],
    [40, 50],
  ]);

  testMergeParallelIntervals([
    [0, 10],
    [5, 15],
    [20, 30],
    [25, 35],
    [40, 50],
    [35, 45],
  ],[
    [0, 15],
    [20, 50],
  ]);

  testMergeParallelIntervals([
    [0, 10],
    [5, 15],
    [20, 30],
    [25, 35],
    [40, 50],
    [35, 45],
    [0, 50],
  ],[
    [0, 50],
  ]);
});

function startTrace () {
  const ddpMessage = {
    id: 'the-id',
    msg: 'method',
    method: 'method-name'
  };

  const info = {id: 'session-id', userId: 'uid'};

  return Kadira.tracer.start(info, ddpMessage);
}
