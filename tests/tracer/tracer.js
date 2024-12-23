import { _ } from 'meteor/underscore';
import { Tracer } from '../../lib/tracer/tracer';
import {
  addAsyncTest,
  callAsync,
  cleanBuiltEvents,
  cleanTrace,
  deepFreeze,
  getLastMethodEvents,
  registerMethod,
  subscribeAndWait
} from '../_helpers/helpers';
import { sleep } from '../../lib/utils';
import { TestData } from '../_helpers/globals';
import { getInfo, MontiAsyncStorage } from '../../lib/async/als';
import { EventType } from '../../lib/constants';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { Ntp } from '../../lib/ntp';

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
  'Tracer - Monti.event - run function outside of trace',
  async function (test) {
    MontiAsyncStorage.run(undefined, () => {
      test.equal(getInfo(), undefined);
      let result = Monti.event('test', () => 'result');
      test.equal(result, 'result');
    });
  }
);

addAsyncTest(
  'Tracer - Monti.event - provide data',
  async function (test) {
    let info;
    let data = { value: 5 };
    let ran = false;

    const methodId = registerMethod(async function () {
      Monti.event('test', data, () => {
        ran = true;
      });

      info = getInfo();
    });

    await callAsync(methodId);

    const expected = [
      'custom',
      0,
      data,
      { name: 'test', nested: [] }
    ];
    let actualEvent = cleanBuiltEvents(info.trace.events)
      .find(event => event[0] === 'custom');

    test.equal(actualEvent, expected);
    test.equal(ran, true);
  }
);

addAsyncTest(
  'Tracer - Build Trace - simple',
  async function (test) {
    let now = Ntp._now();

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
  'Tracer - Build Trace - compute time with force end events',
  async function (test) {
    let now = Ntp._now();

    // TODO: work around needed since optimizeEvent sets missing endAt as
    // the current time
    let oldNow = Ntp._now;
    Ntp._now = () => now + 4500;

    let traceInfo = {
      events: [
        {...eventDefaults, type: 'start', at: now, endAt: now},
        {...eventDefaults, type: 'wait', at: now, endAt: now + 1000},
        {...eventDefaults, type: 'db', at: now + 2000, endAt: undefined},
        {type: EventType.Complete, at: now + 4500}
      ]
    };

    Kadira.tracer.buildTrace(traceInfo);

    Ntp._now = oldNow;

    const expected = {
      total: 4500,
      wait: 1000,
      db: 2500,
      compute: 1000,
      async: 0,
    };

    test.stableEqual(traceInfo.metrics, expected);
    test.stableEqual(traceInfo.errored, false);
  }
);

addAsyncTest(
  'Tracer - Build Trace - compute time at beginning of nested events',
  async function (test) {
    let info;

    const methodId = registerMethod(async function () {
      doCompute(20);
      await Kadira.event('test', async () => {
        doCompute(41);
        await TestData.insertAsync({});
      });
      doCompute(10);
      info = getInfo();
    });

    await callAsync(methodId);

    const expected = [
      ['start', 0, { userId: null, params: '[]' }],
      ['wait', 0, { waitOn: [] }],
      ['compute', 20],
      ['custom', 40, {}, {
        name: 'test',
        nested: [
          ['compute', 40],
          ['db', 0, { coll: 'tinytest-data', func: 'insertAsync' }],
        ]
      }],
      ['compute', 0],
      ['complete']
    ];
    let actual = cleanBuiltEvents(info.trace.events, 20);

    test.stableEqual(actual, expected);
  }
);

addAsyncTest(
  'Tracer - Build Trace - compute time at end of nested events',
  async function (test) {
    let info;

    const methodId = registerMethod(async function () {
      doCompute(20);
      await Kadira.event('test', async () => {
        await TestData.insertAsync({});
        doCompute(41);
      });
      doCompute(20);
      info = getInfo();
    });

    await callAsync(methodId);

    const expected = [
      ['start', 0, { userId: null, params: '[]' }],
      ['wait', 0, { waitOn: [] }],
      ['compute', 20],
      ['custom', 40, {}, {
        name: 'test',
        nested: [
          ['db', 0, { coll: 'tinytest-data', func: 'insertAsync' }],
          ['compute', 40],
        ]
      }],
      ['compute', 20],
      ['complete']
    ];

    let actual = cleanBuiltEvents(info.trace.events, 20);

    test.stableEqual(actual, expected);

    test.equal(info.trace.metrics.compute >= 70, true);
    test.equal(info.trace.metrics.async < 5, true);
    test.equal(info.trace.metrics.custom, undefined);
  }
);

addAsyncTest(
  'Tracer - Build Trace - use events nested under custom for metrics',
  async function (test) {
    let info;

    const methodId = registerMethod(async function () {
      await Kadira.event('test', async () => {
        doCompute(50);
        await TestData.insertAsync({ a: 2 });
        await TestData.insertAsync({ b: 3 });
        await TestData.insertAsync({ b: 3 });
        await TestData.insertAsync({ b: 3 });
        await sleep(11);
      });
      info = getInfo();
    });

    await callAsync(methodId);
    test.equal(info.trace.metrics.compute >= 50, true, `${info.trace.metrics.compute} >= 50`);
    test.equal(info.trace.metrics.db > 0, true, `${info.trace.metrics.db} > 0`);
    test.equal(info.trace.metrics.async >= 10, true, `${info.trace.metrics.async} >= 10`);
    test.equal(info.trace.metrics.custom, undefined, `${info.trace.metrics.custom} == undefined`);
  }
);

addAsyncTest(
  'Tracer - Build Trace - compute time for custom event without nested events',
  async function (test) {
    let info;

    const methodId = registerMethod(async function () {
      Kadira.event('test', async () => {
        doCompute(50);
      });
      info = getInfo();
    });

    await callAsync(methodId);
    test.equal(info.trace.metrics.compute > 40, true);
    test.equal(info.trace.metrics.custom, undefined);
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
      ['wait', traceInfo.events[1][1], {}, { forcedEnd: true }],
      ['db', 500, {}, { offset: traceInfo.events[2][3].offset }],
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

addAsyncTest('Tracer - Build Trace - each ms counted once with parallel events', async function (test) {
  const Email = Package['email'].Email;
  let info;

  let methodId = registerMethod(async function () {
    let backgroundPromise;
    // Compute
    await sleep(30);

    await TestData.insertAsync({ _id: 'a', n: 1 });
    await TestData.insertAsync({ _id: 'b', n: 2 });
    await TestData.insertAsync({ _id: 'c', n: 3 });

    backgroundPromise = Promise.resolve().then(async () => {
      // Email
      Email.sendAsync({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
    });

    // Compute
    await sleep(30);

    const ids = ['a', 'b', 'c'];

    // DB
    await Promise.all(ids.map(_id => TestData.findOneAsync({ _id })));

    await TestData.findOneAsync({ _id: 'a1' }).then(() =>
      // Is this nested under the previous findOneAsync or is it a sibling?
      TestData.findOneAsync({ _id: 'a2' })
    );

    info = getInfo();

    return backgroundPromise;
  });

  await callAsync(methodId);

  let metrics = info.trace.metrics;
  let total = metrics.total;
  let sum = 0;
  Object.keys(metrics).forEach(key => {
    if (key !== 'total') {
      sum += metrics[key];
    }
  });

  test.equal(sum, total);
});

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

  const expected = [
    ['start',{userId: null,params: '[]'}],
    ['wait',{waitOn: []}],
    ['custom', {}, {name: 'test',
      nested: [
        ['db',{coll: 'tinytest-data',func: 'insertAsync'}],
        ['db',{coll: 'tinytest-data',func: 'insertAsync'}],
        ['db',{coll: 'tinytest-data',func: 'insertAsync'}],
        ['email',{from: 'arunoda@meteorhacks.com',to: 'hello@meteor.com', func: 'emailAsync'}, { offset: 1 }],
        ['db',{coll: 'tinytest-data',selector: '{"_id":"a"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1}],
        ['db',{coll: 'tinytest-data',selector: '{"_id":"b"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1}, { offset: 1 }],
        ['db',{coll: 'tinytest-data',selector: '{"_id":"c"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 1,docSize: 1}, { offset: 1 }],
        ['db',{coll: 'tinytest-data',selector: '{"_id":"a1"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 0,docSize: 0}],
        ['db',{coll: 'tinytest-data',selector: '{"_id":"a2"}',func: 'fetch',cursor: true,limit: 1,docsFetched: 0,docSize: 0}]
      ]}
    ],
    ['complete']
  ];

  test.stableEqual(events, expected);
});

addAsyncTest('Tracer - Build Trace - offset is reversible', async function (test) {
  const Email = Package['email'].Email;

  let origEvents;
  let info;
  let methodId = registerMethod(async function () {
    let backgroundPromise;
    // Compute
    await sleep(30);

    await Kadira.event('test', async (event) => {
      await TestData.insertAsync({ _id: 'a', n: 1 });
      await TestData.insertAsync({ _id: 'b', n: 2 });
      await TestData.insertAsync({ _id: 'c', n: 3 });

      backgroundPromise = Promise.resolve().then(async () => {
        // Email
        Email.sendAsync({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
      });

      // Compute
      await sleep(30);

      const ids = ['a', 'b', 'c'];

      // DB
      await Promise.all(ids.map(_id => TestData.findOneAsync({ _id })));

      await TestData.findOneAsync({ _id: 'a1' }).then(() =>
        // Is this nested under the previous findOneAsync or is it a sibling?
        TestData.findOneAsync({ _id: 'a2' })
      );

      Kadira.endEvent(event);
    });

    origEvents = getInfo().trace.events;
    info = getInfo();

    return backgroundPromise;
  });

  await callAsync(methodId);

  let origTimestamps = origEvents.reduce((timestamps, event) => {
    if (event.type !== 'async') {
      timestamps.push(event.at);
    }
    if (event.nested && event.type === 'custom') {
      event.nested.forEach(nestedEvent => {
        if (nestedEvent.type !== 'async') {
          timestamps.push(nestedEvent.at);
        }
      });
    }

    return timestamps;
  }, []);

  let calculatedTimestamps = [];
  let total = info.trace.at;
  info.trace.events.forEach((event) => {
    let [type, duration = 0, , details = {}] = event;
    let offset = details.offset || 0;

    total -= offset;
    if (type !== 'async' && type !== 'compute') {
      calculatedTimestamps.push(total);
    }

    if (details.nested && type === 'custom') {
      let nestedTotal = total;
      details.nested.forEach(nestedEvent => {
        if (nestedEvent[3] && nestedEvent[3].offset) {
          nestedTotal -= nestedEvent[3].offset;
        }

        if (nestedEvent[0] !== 'async' && nestedEvent[0] !== 'compute') {
          calculatedTimestamps.push(nestedTotal);
        }

        nestedTotal += nestedEvent[1] || 0;
      });
    }

    total += duration;
  });

  test.stableEqual(calculatedTimestamps, origTimestamps);
});

addAsyncTest('Tracer - Build Trace - should end custom event', async (test) => {
  let info;

  const methodId = registerMethod(async function () {
    Kadira.event('test', { async: false }, () => {
      Kadira.event('test2', { value: true }, () => {});
    });
    Kadira.event('test3', () => {});

    info = getInfo();
  });

  await callAsync(methodId);

  const expected = [
    ['start', 0, { userId: null, params: '[]' }],
    ['wait', 0, { waitOn: []}],
    ['custom', 0, { async: false }, {
      name: 'test',
      nested: [
        ['custom', 0, { value: true }, { name: 'test2', nested: []}],
      ]
    }],
    ['custom', 0, {}, { name: 'test3', nested: [] }],
    ['complete']
  ];
  let actual = cleanBuiltEvents(info.trace.events);

  test.stableEqual(actual, expected);
});

addAsyncTest('Tracer - Build Trace - should end async events', async (test) => {
  let info;

  const methodId = registerMethod(async function () {
    await sleep(21);

    info = getInfo();
  });

  await callAsync(methodId);

  const expected = [
    ['start', 0, { userId: null, params: '[]' }],
    ['wait', 0, { waitOn: [] }],
    ['async', 20],
    ['complete']
  ];
  let actual = cleanBuiltEvents(info.trace.events);

  test.stableEqual(actual, expected);
});

addAsyncTest('Tracer - Build Trace - the correct number of async events are captured for methods', async (test) => {
  let info;

  const methodId = registerMethod(async function () {
    await sleep(60);
    await sleep(70);

    info = getInfo();

    return await sleep(80);
  });

  await callAsync(methodId);

  const asyncEvents = info.trace.events.filter(([type, duration]) => type === EventType.Async && duration >= 50);

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

  const asyncEvents = info.trace.events.filter(([type, duration]) => type === EventType.Async && duration >= 100);

  test.equal(asyncEvents.length,1);
});

addAsyncTest('Tracer - Optimize Events - no mutation', async (test) => {
  let partialEvents;

  const methodId = registerMethod(async function () {
    const Email = Package['email'].Email;

    await TestData.insertAsync({ _id: 'a', n: 1 });
    await sleep(20);

    await Email.sendAsync({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });

    let info = getInfo();
    let events = info.trace.events.slice();
    deepFreeze(events);

    // testing this doesn't throw
    partialEvents = Kadira.tracer.optimizeEvents(events);

    info.trace.events = [Kadira.tracer.event(info.trace, 'start')];
  });

  await callAsync(methodId);

  test.equal(Array.isArray(partialEvents), true);
});

addAsyncTest('Tracer - Optimize Events - without metrics', async (test) => {
  let now = Ntp._now();

  let events = [
    { ...eventDefaults, type: 'start', at: now, endAt: now },
    { ...eventDefaults, type: 'wait', at: now, endAt: now + 1000 },
    { ...eventDefaults, type: 'db', at: now + 2000, endAt: now + 2500 },
    { type: EventType.Complete, at: now + 4500 }
  ];

  let expected = [
    ['start'],
    ['wait', 1000],
    ['compute', 1000],
    ['db', 500],
    ['compute', 2000],
    ['complete']
  ];

  let optimized = Kadira.tracer.optimizeEvents(events);

  test.stableEqual(optimized, expected);
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

function doCompute (ms) {
  let start = Date.now();
  while (Date.now() - start < ms) {
    // do work...
  }
}
