import { Meteor } from 'meteor/meteor';
import { ErrorModel } from '../../lib/models/errors';
import {
  addAsyncTest,
  callAsync,
  getMeteorClient,
  registerMethod,
  RegisterMethod,
  registerPublication
} from '../_helpers/helpers';
const HTTP = Package['http']?.HTTP;

Tinytest.add(
  'Errors - Meteor._debug - track with Meteor._debug',
  function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');
    Meteor._debug('_debug', '_stack');
    let payload = Kadira.models.error.buildPayload();
    let error = payload.errors[0];
    let expected = {
      appId: 'foo',
      name: '_debug',
      subType: 'Meteor._debug',
      // startTime: 1408098721327,
      type: 'server-internal',
      trace: {
        type: 'server-internal',
        name: '_debug',
        subType: 'Meteor._debug',
        errored: true,
        // at: 1408098721326,
        events: [
          ['start', 0, {}],
          ['error', 0, { error: { message: '_debug', stack: '_stack' } }]
        ],
        metrics: { total: 0 }
      },
      stacks: [{ stack: '_stack' }],
      count: 1
    };

    delete error.startTime;
    delete error.trace.at;
    test.equal(expected, error);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Meteor._debug - create stack when it doesn\'t exist',
  function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');
    Meteor._debug('_debug');

    let payload = Kadira.models.error.buildPayload();
    let error = payload.errors[0];
    const stack = error.stacks[0].stack;

    test.equal(error.name, '_debug');
    test.equal(typeof stack, 'string');
    test.equal(stack.split('\n').length > 2, true);

    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

addAsyncTest(
  'Errors - Meteor._debug - do not track method errors',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    Kadira.enableErrorTracking();

    Kadira.models.error = new ErrorModel('foo');

    let method = RegisterMethod(causeError);

    try {
      await callAsync(method);
    } catch (e) {
      // ignore the error
    }

    let payload = Kadira.models.error.buildPayload();
    let error = payload.errors[0];
    test.equal(1, payload.errors.length);
    test.equal(error.type, 'method');
    test.equal(error.subType, method);
    _resetErrorTracking(originalErrorTrackingStatus);

    function causeError () {
      HTTP.call('POST', 'localhost', () => {});
    }
  }
);

Tinytest.addAsync(
  'Errors - Meteor._debug - do not track pubsub errors',
  function (test, done) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');
    let pubsub = registerPublication(causeError);
    let client = getMeteorClient();
    client.subscribe(pubsub, {
      onError () {
        let payload = Kadira.models.error.buildPayload();
        let error = payload.errors[0];
        test.equal(1, payload.errors.length);
        test.equal(error.type, 'sub');
        test.equal(error.subType, pubsub);
        _resetErrorTracking(originalErrorTrackingStatus);
        done();
      }
    });

    function causeError () {
      HTTP.call('POST', 'localhost', () => {});
    }
  }
);

addAsyncTest(
  'Errors - Meteor._debug - do not track when no arguments',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');
    Meteor._debug();
    let payload = Kadira.models.error.buildPayload();
    test.equal(0, payload.errors.length);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

// How Meteor gives errors to Meteor._debug versions 1.4 - 1.6
// is already tested above. It changed in 1.7 which these tests covers
if (!['1.4', '1.5', '1.6'].find(prefix => Meteor.release.startsWith(`METEOR@${prefix}`))) {
  addAsyncTest(
    'Errors - Meteor._debug - preserve error thrown in Meteor.bindEnvironment',
    async function (test) {
      let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
      Kadira.enableErrorTracking();
      const error = new Error('test');

      const origLog = console.log;
      console.log = function (message, loggedError) {
        origLog.apply(console, arguments);
        console.log = origLog;
        test.equal(error.message, loggedError.message);
        test.equal(error.stack, loggedError.stack);
        _resetErrorTracking(originalErrorTrackingStatus);
      };

      Meteor.bindEnvironment(function () {
        throw error;
      })();
    }
  );

  addAsyncTest(
    'Errors - Meteor._debug - track Meteor Error thrown in Meteor.bindEnvironment',
    async function (test) {
      let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
      Kadira.enableErrorTracking();
      Kadira.models.error = new ErrorModel('foo');
      const error = new Meteor.Error('test');

      Meteor.bindEnvironment(function () {
        throw error;
      })();

      let payload = Kadira.models.error.buildPayload();

      let errorTrace = payload.errors[0];

      let expected = {
        appId: 'foo',
        name: 'Exception in callback of async function: [test]',
        subType: 'Meteor._debug',
        // startTime: 1408098721327,
        type: 'server-internal',
        trace: {
          type: 'server-internal',
          name: 'Exception in callback of async function: [test]',
          subType: 'Meteor._debug',
          errored: true,
          // at: 1408098721326,
          events: [
            ['start', 0, {}],
            ['error', 0, { error: { message: 'Exception in callback of async function: [test]', stack: error.stack } }]
          ],
          metrics: { total: 0 }
        },
        stacks: [{ stack: error.stack }],
        count: 1
      };

      delete errorTrace.startTime;
      delete errorTrace.trace.at;

      test.equal(expected, errorTrace);
      _resetErrorTracking(originalErrorTrackingStatus);
    }
  );
}

addAsyncTest(
  'Errors - unhandledRejection - track unhandledRejection',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');

    let error = new Error('rejected');

    Promise.reject(error);

    Meteor.defer(function () {
      let payload = Kadira.models.error.buildPayload();
      // eslint-disable-next-line no-shadow
      let error = payload.errors[0];

      test.equal(1, payload.errors.length);
      test.equal(error.type, 'server-internal');
      test.equal(error.subType, 'unhandledRejection');

      _resetErrorTracking(originalErrorTrackingStatus);
    });
  }
);

addAsyncTest(
  'Errors - unhandledRejection - undefined reason',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');
    Promise.reject(undefined);

    Meteor.defer(function () {
      let payload = Kadira.models.error.buildPayload();
      // eslint-disable-next-line no-shadow
      let error = payload.errors[0];

      test.equal(1, payload.errors.length);
      test.equal(error.name, 'unhandledRejection: undefined');
      test.equal(error.type, 'server-internal');
      test.equal(error.subType, 'unhandledRejection');

      _resetErrorTracking(originalErrorTrackingStatus);
    });
  }
);

addAsyncTest(
  'Errors - method error - track Meteor.Error',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    let methodId = registerMethod(function () {
      throw new Meteor.Error('ERR_CODE', 'reason');
    });

    try {
      await callAsync(methodId);
    } catch (ex) {
      let errorMessage = 'reason [ERR_CODE]';

      test.equal(ex.message, errorMessage);
      let payload = Kadira.models.error.buildPayload();
      let error = payload.errors[0];
      test.isTrue(error.stacks[0].stack.indexOf(errorMessage) >= 0);

      let lastEvent = error.trace.events[error.trace.events.length - 1];
      test.isTrue(lastEvent[2].error.message.indexOf(errorMessage) >= 0);
      test.isTrue(lastEvent[2].error.stack.indexOf(errorMessage) >= 0);
    }

    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

addAsyncTest(
  'Errors - method error - store error details property',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    let methodId = registerMethod(function () {
      throw new Meteor.Error('ERR_CODE', 'reason', 'details');
    });

    try {
      await callAsync(methodId);
    } catch (ex) {
      let errorMessage = 'reason [ERR_CODE]';
      test.equal(ex.message, errorMessage);
      let payload = Kadira.models.error.buildPayload();
      let error = payload.errors[0];
      test.isTrue(error.stacks[0].stack.indexOf(errorMessage) >= 0);

      let lastEvent = error.trace.events[error.trace.events.length - 1];
      console.dir(lastEvent);
      test.isTrue(lastEvent[2].error.message.indexOf(errorMessage) >= 0);
      test.isTrue(lastEvent[2].error.stack.indexOf(errorMessage) >= 0);
      test.equal(lastEvent[2].error.details, 'details');
    }

    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

addAsyncTest(
  'Errors - method error - track NodeJs Error',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    let methodId = RegisterMethod(function () {
      throw new Error('the-message');
    });

    try {
      await callAsync(methodId);
    } catch (ex) {
      let errorMessage = 'the-message';
      test.isTrue(ex.message.match(/Internal server error/));
      let payload = Kadira.models.error.buildPayload();
      let error = payload.errors[0];
      test.isTrue(error.stacks[0].stack.indexOf(errorMessage) >= 0);

      let lastEvent = error.trace.events[error.trace.events.length - 1];
      test.isTrue(lastEvent[2].error.message.indexOf(errorMessage) >= 0);
      test.isTrue(lastEvent[2].error.stack.indexOf(errorMessage) >= 0);
    }

    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

function _resetErrorTracking (status) {
  if (status) {
    Kadira.enableErrorTracking();
  } else {
    Kadira.disableErrorTracking();
  }
}
