import { _ } from 'meteor/underscore';
import { Tracer } from '../../lib/tracer/tracer';
import { addAsyncTest, callAsync, registerMethod } from '../_helpers/helpers';
import { sleep } from '../../lib/utils';
import { TestData } from '../_helpers/globals';
import { mergeSegmentIntervals } from '../../lib/utils/time';
import { prettyLog } from '../_helpers/pretty-log';

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

Tinytest.add(
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

    test.equal(traceInfo, expected);
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
        {type: 'db', endAt: 10, nested: [{ type: 'db', endAt: null }]},
        {type: 'end', data: {abc: 200}}
      ]
    };

    delete traceInfo.userId;

    test.equal(traceInfo, expected);
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
        {type: 'complete', at: now + 2500}
      ]
    };
    Kadira.tracer.buildTrace(traceInfo);

    const expected = {
      total: 2500,
      wait: 1000,
      db: 500,
      compute: 1000,
    };

    test.equal(traceInfo.metrics, expected);
    test.equal(traceInfo.errored, false);
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
    let now = new Date().getTime();

    let traceInfo = {
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
      ['wait', 0, { forcedEnd: true }],
      ['db', 500],
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

addAsyncTest.only('Tracer - Build Trace - Async Parallel Events', async function (test) {
  const Email = Package['email'].Email;

  let info;

  let methodId = registerMethod(async function () {
    let backgroundPromise;

    await Kadira.startEvent('test', null, async (event) => {
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

    info = Kadira._getInfo();

    return backgroundPromise;
  });

  await callAsync(methodId);

  prettyLog(info.trace);

  console.log('resources');
  prettyLog(mergeSegmentIntervals(info.resources));
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

function cleanTrace (traceInfo) {
  cleanEvents(traceInfo.events);
}

function cleanEvents (events) {
  events.forEach(function (event) {
    if (event.endAt > event.at) {
      event.endAt = 10;
    } else if (event.endAt) {
      delete event.endAt;
    }
    delete event.at;
    delete event._id;

    if (event.nested.length === 0) {
      delete event.nested;
    } else {
      cleanEvents(event.nested);
    }
  });
}
