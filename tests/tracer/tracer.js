import { _ } from 'meteor/underscore';

let eventDefaults = {
  endAt: 0,
  nested: [],
};

Tinytest.add(
  'Tracer - Trace Method - method',
  function (test) {
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

Tinytest.add(
  'Tracer - trace other events',
  function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };
    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);
    Kadira.tracer.event(traceInfo, 'start', {abc: 100});
    let eventId = Kadira.tracer.event(traceInfo, 'db');
    Wait(25);
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

Tinytest.add(
  'Tracer - end last event',
  function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };
    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);
    Kadira.tracer.event(traceInfo, 'start', {abc: 100});
    Kadira.tracer.event(traceInfo, 'db');
    Wait(20);
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

Tinytest.add(
  'Tracer - trace same event twice',
  function (test) {
    let ddpMessage = {
      id: 'the-id',
      msg: 'method',
      method: 'method-name'
    };
    let traceInfo = Kadira.tracer.start({id: 'session-id'}, ddpMessage);
    Kadira.tracer.event(traceInfo, 'start', {abc: 100});
    let eventId = Kadira.tracer.event(traceInfo, 'db');
    Kadira.tracer.event(traceInfo, 'db');
    Kadira.tracer.eventEnd(traceInfo, eventId);
    Kadira.tracer.event(traceInfo, 'end', {abc: 200});

    console.log(JSON.stringify({ traceInfo }, null, 2));

    cleanTrace(traceInfo);

    let expected = {
      _id: 'session-id::the-id',
      id: 'the-id',
      session: 'session-id',
      type: 'method',
      name: 'method-name',
      events: [
        {type: 'start', data: {abc: 100}},
        {type: 'db', nested: [{ type: 'db', endAt: null }]},
        {type: 'end', data: {abc: 200}}
      ]
    };
    delete traceInfo.userId;
    test.equal(traceInfo, expected);
  }
);

Tinytest.add(
  'Tracer - Build Trace - simple',
  function (test) {
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
    test.equal(traceInfo.metrics, {
      total: 2500,
      wait: 1000,
      db: 500,
      compute: 1000,
    });
    test.equal(traceInfo.errored, false);
  }
);

Tinytest.add(
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
    test.equal(traceInfo.metrics, {
      total: 2500,
      wait: 1000,
      db: 500,
      compute: 1000,
    });
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

Tinytest.add(
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
    test.equal(traceInfo.metrics, undefined);
  }
);

Tinytest.add(
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

function startTrace (tracer) {
  let ddpMessage = {
    id: 'the-id',
    msg: 'method',
    method: 'method-name'
  };
  let info = {id: 'session-id', userId: 'uid'};
  let traceInfo = Kadira.tracer.start(info, ddpMessage);

  return traceInfo;
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
