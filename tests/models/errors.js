import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { ErrorModel } from '../../lib/models/errors';

Tinytest.add(
  'Models - Errors - empty',
  function (test) {
    let model = new ErrorModel('_appId');
    let metrics = model.buildPayload();
    test.isTrue(Array.isArray(metrics));
    test.equal(metrics.length, 0);
  }
);

Tinytest.add(
  'Models - Errors - add errors to model',
  function (test) {
    let model = new ErrorModel('_appId');
    let error = {name: '_name', message: '_message', stack: '_stack'};
    let trace = {type: '_type', subType: '_subType', name: '_name'};
    model.trackError(error, trace);
    let storedMetric = model.errors['_type:_message'];
    let expected = {
      appId: '_appId',
      name: '_message',
      subType: '_subType',
      // startTime: Date.now(),
      type: '_type',
      trace,
      stacks: [{stack: '_stack'}],
      count: 1,
    };
    test.equal(typeof storedMetric.startTime, 'number');
    delete storedMetric.startTime;
    test.equal(storedMetric, expected);
  }
);

Tinytest.add(
  'Models - Errors - add errors to model (trace without subType)',
  function (test) {
    let model = new ErrorModel('_appId');
    let error = {name: '_name', message: '_message', stack: '_stack'};
    let trace = {type: '_type', name: '_name'};
    model.trackError(error, trace);
    let storedMetric = model.errors['_type:_message'];
    let expected = {
      appId: '_appId',
      name: '_message',
      subType: '_name',
      // startTime: Date.now(),
      type: '_type',
      trace,
      stacks: [{stack: '_stack'}],
      count: 1,
    };
    test.equal(typeof storedMetric.startTime, 'number');
    delete storedMetric.startTime;
    test.equal(storedMetric, expected);
  }
);

Tinytest.add(
  'Models - Errors - buildPayload',
  function (test) {
    let model = new ErrorModel('_appId');
    let error = {name: '_name', message: '_message', stack: '_stack'};
    let trace = {type: '_type', subType: '_subType', name: '_name'};
    model.trackError(error, trace);
    let metrics = model.buildPayload();
    test.isTrue(Array.isArray(metrics));
    test.equal(metrics.length, 1);
    let payload = metrics[0];
    let expected = {
      appId: '_appId',
      name: '_message',
      subType: '_subType',
      // startTime: Date.now(),
      type: '_type',
      trace,
      stacks: [{stack: '_stack'}],
      count: 1,
    };
    test.equal(typeof payload.startTime, 'number');
    delete payload.startTime;
    test.equal(payload, expected);
  }
);

Tinytest.add(
  'Models - Errors - clear data after buildPayload',
  function (test) {
    let model = new ErrorModel('_appId');
    let error = {name: '_name', message: '_message', stack: '_stack'};
    let trace = {type: '_type', subType: '_subType', name: '_name'};
    model.trackError(error, trace);
    test.equal(true, !!model.errors['_type:_message']);
    model.buildPayload();
    test.equal(false, !!model.errors['_type:_message']);
  }
);

Tinytest.add(
  'Models - Errors - buildPayload with same error message',
  function (test) {
    let model = new ErrorModel('_appId');
    let error = {name: '_name', message: '_message', stack: '_stack'};
    let trace = {type: '_type', subType: '_subType', name: '_name'};
    model.trackError(error, trace);
    model.trackError(error, trace);
    model.trackError(error, trace);
    let metrics = model.buildPayload();
    test.isTrue(Array.isArray(metrics));
    test.equal(metrics.length, 1);
    let payload = metrics[0];
    let expected = {
      appId: '_appId',
      name: '_message',
      subType: '_subType',
      // startTime: Date.now(),
      type: '_type',
      trace,
      stacks: [{stack: '_stack'}],
      count: 3,
    };
    test.equal(typeof payload.startTime, 'number');
    delete payload.startTime;
    test.equal(payload, expected);
  }
);

Tinytest.add(
  'Models - Errors - buildPayload with different error messages',
  function (test) {
    let model = new ErrorModel('_appId');
    [1, 2, 3].forEach(function (n) {
      let error = {name: `_name${n}`, message: `_message${n}`, stack: `_stack${n}`};
      let trace = {type: `_type${n}`, subType: `_subType${n}`, name: `_name${n}`};
      model.trackError(error, trace);
    });

    let metrics = model.buildPayload();
    test.isTrue(Array.isArray(metrics));
    test.equal(metrics.length, 3);

    [1, 2, 3].forEach(function (n) {
      let payload = metrics[n - 1];
      let trace = {type: `_type${n}`, subType: `_subType${n}`, name: `_name${n}`};
      let expected = {
        appId: '_appId',
        name: `_message${n}`,
        subType: `_subType${n}`,
        // startTime: Date.now(),
        type: `_type${n}`,
        trace,
        stacks: [{stack: `_stack${n}`}],
        count: 1,
      };
      test.equal(typeof payload.startTime, 'number');
      delete payload.startTime;
      test.equal(payload, expected);
    });
  }
);

Tinytest.add(
  'Models - Errors - buildPayload with too much errors',
  function (test) {
    let model = new ErrorModel('_appId');
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach(function (n) {
      let error = {name: `_name${n}`, message: `_message${n}`, stack: `_stack${n}`};
      let trace = {type: `_type${n}`, subType: `_subType${n}`, name: `_name${n}`};
      model.trackError(error, trace);
    });

    let metrics = model.buildPayload();
    test.isTrue(Array.isArray(metrics));
    test.equal(metrics.length, 10);

    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (n) {
      let payload = metrics[n - 1];
      let trace = {type: `_type${n}`, subType: `_subType${n}`, name: `_name${n}`};
      let expected = {
        appId: '_appId',
        name: `_message${n}`,
        subType: `_subType${n}`,
        // startTime: Date.now(),
        type: `_type${n}`,
        trace,
        stacks: [{stack: `_stack${n}`}],
        count: 1,
      };
      test.equal(typeof payload.startTime, 'number');
      delete payload.startTime;
      test.equal(payload, expected);
    });
  }
);

Tinytest.add(
  'Models - Errors - format Error - with Meteor.Error details',
  function (test) {
    let model = new ErrorModel('_appId');
    let details = Random.id();
    let error = new Meteor.Error('code', 'message', details);
    let trace = {};
    let payload = model._formatError(error, trace);

    let hasDetails = payload.stacks[0].stack.indexOf(details);
    test.isTrue(hasDetails >= 0);
  }
);

Tinytest.add(
  'Models - Errors - format Error - with Meteor.Error details, with trace',
  function (test) {
    let model = new ErrorModel('_appId');
    let details = Random.id();
    let error = new Meteor.Error('code', 'message', details);
    let traceError = {stack: 'oldstack'};
    let trace = {events: [0, 1, [0, 1, {error: traceError}]]};
    model._formatError(error, trace);

    let hasDetails = traceError.stack.indexOf(details);
    test.isTrue(hasDetails >= 0);
  }
);
