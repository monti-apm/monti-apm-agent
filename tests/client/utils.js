
Tinytest.addAsync(
  'Client Side - Settings - publication',
  function (test, done) {
    const SettingsCollection = new Meteor.Collection('kadira_settings');
    let ran = false;
    SettingsCollection.find().observe({added (options) {
      if (ran) {
        return;
      }
      ran = true;

      test.equal(Boolean(options.appId), true);
      test.equal(Boolean(options.endpoint), true);
      test.equal(Boolean(options.clientEngineSyncDelay), true);
      done();
    }});
  }
);

Tinytest.add(
  'Client Side - Error Manager - Utils - getErrorStack()',
  function (test) {
    test.equal('function', typeof getErrorStack);
  }
);

Tinytest.addAsync(
  'Client Side - Error Manager - Utils - getErrorStack() errored stack',
  function (test, done) {
    let stack = '-- test stack --';
    let zone = {
      erroredStack: {get () { return stack; }}
    };
    getErrorStack(zone, function (trace) {
      test.equal(1, trace.length);
      test.equal('number', typeof trace[0].at);
      test.equal('string', typeof trace[0].stack);
      done();
    });
  }
);

Tinytest.addAsync(
  'Client Side - Error Manager - Utils - getErrorStack() without events',
  function (test, done) {
    let stack = '-- test stack --';
    let zone = {
      id: 'foo',
      createdAt: 100,
      runAt: 200,
      owner: '_owner',
      currentStack: {get () { return stack; }},
      erroredStack: {get () { return stack; }},
      // eventMap: {}
      depth: 20
    };

    let expected = {
      createdAt: 100,
      runAt: 200,
      stack,
      owner: '_owner',
      ownerArgs: [],
      info: [],
      events: [],
      zoneId: 'foo'
    };

    getErrorStack(zone, function (trace) {
      test.equal(2, trace.length);
      test.equal('number', typeof trace[0].at);
      test.equal(stack, trace[0].stack);
      test.equal(expected, trace[1]);
      done();
    });
  }
);

Tinytest.addAsync(
  'Client Side - Error Manager - Utils - getErrorStack() with stack',
  function (test, done) {
    let stack = '-- test stack --';
    let eventMap = {foo: [
      {type: 'owner-args', args: ['foo', 'bar'], at: 300},
      {type: '_type', args: ['bar', 'baz']},
    ]};

    let zone = {
      id: 'foo',
      createdAt: 100,
      runAt: 200,
      owner: '_owner',
      currentStack: {get () { return stack; }},
      erroredStack: {get () { return stack; }},
      eventMap,
      depth: 20
    };

    let expected = {
      createdAt: 100,
      runAt: 300,
      stack,
      owner: '_owner',
      ownerArgs: ['foo', 'bar'],
      info: [],
      events: [{type: '_type', args: ['bar', 'baz']}],
      zoneId: 'foo'
    };

    getErrorStack(zone, function (trace) {
      test.equal(2, trace.length);
      test.equal('number', typeof trace[0].at);
      test.equal(stack, trace[0].stack);
      test.equal(expected, trace[1]);
      done();
    });
  }
);

Tinytest.addAsync(
  'Client Side - Error Manager - Utils - getErrorStack() with parent zone',
  function (test, done) {
    let stack = '-- test stack --';

    let eventMap = {
      foo: [
        {type: 'owner-args', args: ['foo', 'bar'], at: 300},
        {type: '_type', args: ['bar', 'baz']},
      ],
      bar: [
        {type: 'owner-args', args: ['foo2', 'bar2'], at: 310},
        {type: '_type2', args: ['bar2', 'baz2']},
      ]
    };

    let zone2 = {
      id: 'bar',
      createdAt: 110,
      runAt: 210,
      owner: '_owner2',
      currentStack: {get () { return stack; }},
      erroredStack: {get () { return stack; }},
      depth: 20
    };

    let zone = {
      id: 'foo',
      createdAt: 100,
      runAt: 200,
      owner: '_owner',
      parent: zone2,
      currentStack: {get () { return stack; }},
      erroredStack: {get () { return stack; }},
      eventMap,
      depth: 20
    };

    let expected = {
      createdAt: 100,
      runAt: 300,
      stack,
      owner: '_owner',
      ownerArgs: ['foo', 'bar'],
      info: [],
      events: [{type: '_type', args: ['bar', 'baz']}],
      zoneId: 'foo'
    };

    let expected2 = {
      createdAt: 110,
      runAt: 310,
      stack,
      owner: '_owner2',
      ownerArgs: ['foo2', 'bar2'],
      info: [],
      events: [{type: '_type2', args: ['bar2', 'baz2']}],
      zoneId: 'bar'
    };

    getErrorStack(zone, function (trace) {
      test.equal(3, trace.length);
      test.equal('number', typeof trace[0].at);
      test.equal(stack, trace[0].stack);
      test.equal(expected, trace[1]);
      test.equal(expected2, trace[2]);
      done();
    });
  }
);

Tinytest.add(
  'Client Side - Error Manager - Utils - getBrowserInfo() for guest',
  function (test) {
    test.equal(typeof getBrowserInfo, 'function');
    let info = getBrowserInfo();
    test.equal('string', typeof info.browser);
    test.equal('string', typeof info.url);
    test.equal(undefined, info.userId);
  }
);

Tinytest.add(
  'Client Side - Error Manager - Utils - getBrowserInfo() for users',
  function (test) {
    hijackMeteorUserId(mock_MeteorUserId);
    test.equal(typeof getBrowserInfo, 'function');
    let info = getBrowserInfo();
    test.equal('string', typeof info.browser);
    test.equal('string', typeof info.url);
    test.equal('string', typeof info.userId);
    restoreMeteorUserId();
  }
);

Tinytest.add(
  'Client Side - Error Manager - Utils - checkSizeAndPickFields - filter large fields',
  function (test) {
    let obj = {
      shortOne: 'hello',
      longOne: {a: 'cooliossssss'}
    };

    let expected = {
      shortOne: 'hello',
      longOne: '{"a":"cool ...'
    };
    let result = checkSizeAndPickFields(10)(obj);
    test.equal(result, expected);
  }
);

Tinytest.add(
  'Client Side - Error Manager - Utils - checkSizeAndPickFields - handling cyclic fields',
  function (test) {
    let obj = {
      shortOne: 'hello',
      longOne: {}
    };
    obj.longOne.same = obj;

    let expected = {
      shortOne: 'hello',
      longOne: 'Error: cannot stringify value'
    };
    let result = checkSizeAndPickFields(10)(obj);
    test.equal(result, expected);
  }
);

// --------------------------------------------------------------------------\\

let original_MeteorUserId = Meteor.userId;

function hijackMeteorUserId (mock) {
  Meteor.userId = mock;
}

function restoreMeteorUserId () {
  Meteor.userId = original_MeteorUserId;
}

function mock_MeteorUserId () {
  return Random.id();
}
