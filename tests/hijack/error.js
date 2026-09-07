import { Meteor } from 'meteor/meteor';
import sinon from 'sinon';
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

addAsyncTest(
  'Errors - method error - preserve async method promise',
  async function (test) {
    let methodPromise;

    let methodId = RegisterMethod(function () {
      methodPromise = Promise.resolve('result');
      return methodPromise;
    });

    let returnedPromise = Meteor.server.method_handlers[methodId]();

    test.isTrue(
      returnedPromise === methodPromise,
      'the method wrapper should return the original promise'
    );
    test.equal(await returnedPromise, 'result');
  }
);

addAsyncTest(
  'Errors - method error - track NodeJs Error thrown in async method',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');

    let methodId = RegisterMethod(async function () {
      await Promise.resolve();
      throw new Error('async-the-message');
    });

    let hadError = false;

    try {
      await callAsync(methodId);
    } catch (ex) {
      hadError = true;
      test.isTrue(ex.message.match(/Internal server error/), `client should see the sanitized error: ${ex.message}`);
    }

    test.isTrue(hadError, 'the method should have thrown');

    let payload = Kadira.models.error.buildPayload();

    let trackedErrors = payload.errors.map(e => [e.type, e.subType, e.name]);
    test.equal(payload.errors.length, 1, `the error should be tracked exactly once: ${JSON.stringify(trackedErrors)}`);

    let error = payload.errors[0];
    test.equal(error.type, 'method');
    test.equal(error.subType, methodId);
    test.isTrue(error.name.indexOf('async-the-message') >= 0, `error name should have the real message: ${error.name}`);
    test.isTrue(error.stacks[0].stack.indexOf('async-the-message') >= 0, 'error stack should be the real stack');

    let lastEvent = error.trace.events[error.trace.events.length - 1];
    test.isTrue(
      lastEvent[2].error.message.indexOf('async-the-message') >= 0,
      `trace error event should have the real message: ${JSON.stringify(lastEvent[2])}`
    );

    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

addAsyncTest(
  'Errors - unhandledRejection - null reason',
  async function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel('foo');

    let threw = false;

    try {
      process.emit('unhandledRejection', null, Promise.resolve());
    } catch (ex) {
      threw = true;
    }

    test.equal(threw, false);

    let payload = Kadira.models.error.buildPayload();

    test.equal(payload.errors.length, 1);
    test.equal(payload.errors[0] && payload.errors[0].subType, 'unhandledRejection');

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

function emitKadiraUncaughtException (err) {
  process.listeners('uncaughtException')
    .filter(listener => listener.name === 'handleUncaughtException')
    .forEach(listener => listener(err));
}

async function waitForUncaughtHandler () {
  await Promise.resolve();
  await new Promise(resolve => process.nextTick(resolve));
}

addAsyncTest(
  'Errors - uncaughtException - exits with code 7',
  async function (test) {
    const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    const originalExitOn = Kadira.options.exitOnUncaughtException;
    const originalSendPayload = Kadira._sendPayload;
    const originalError = console.error;
    Kadira.enableErrorTracking();
    Kadira.options.exitOnUncaughtException = true;
    Kadira.models.error = new ErrorModel('foo');
    Kadira._sendPayload = function () {
      return Promise.resolve();
    };
    console.error = function () {};
    const exitStub = sinon.stub(process, 'exit');
    try {
      emitKadiraUncaughtException(new Error('uncaught-default'));
      await waitForUncaughtHandler();
      test.isTrue(exitStub.calledWith(7));
    } finally {
      exitStub.restore();
      Kadira._sendPayload = originalSendPayload;
      console.error = originalError;
      Kadira.options.exitOnUncaughtException = originalExitOn;
      _resetErrorTracking(originalErrorTrackingStatus);
    }
  }
);

addAsyncTest(
  'Errors - uncaughtException - keepProcessAlive tracks and does not exit',
  async function (test) {
    const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    const originalExitOn = Kadira.options.exitOnUncaughtException;
    const originalSendPayload = Kadira._sendPayload;
    const originalError = console.error;
    Kadira.enableErrorTracking();
    Kadira.options.exitOnUncaughtException = true;
    Kadira.models.error = new ErrorModel('foo');
    Kadira._sendPayload = function () {
      return Promise.resolve();
    };
    console.error = function () {};
    const exitStub = sinon.stub(process, 'exit');
    try {
      const err = new Error('uncaught-keep-alive');
      Monti.keepProcessAlive(err);
      emitKadiraUncaughtException(err);
      await waitForUncaughtHandler();
      test.isFalse(exitStub.called);
      const error = Kadira.models.error.buildPayload().errors[0];
      test.equal(error.type, 'server-crash');
      test.equal(error.subType, 'uncaughtException');
      test.equal(error.name, 'uncaught-keep-alive');
    } finally {
      exitStub.restore();
      Kadira._sendPayload = originalSendPayload;
      console.error = originalError;
      Kadira.options.exitOnUncaughtException = originalExitOn;
      _resetErrorTracking(originalErrorTrackingStatus);
    }
  }
);

addAsyncTest(
  'Errors - uncaughtException - ignoreErrorTracking skips track and exit',
  async function (test) {
    const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    const originalExitOn = Kadira.options.exitOnUncaughtException;
    const originalError = console.error;
    Kadira.enableErrorTracking();
    Kadira.options.exitOnUncaughtException = true;
    Kadira.models.error = new ErrorModel('foo');
    console.error = function () {};
    const exitStub = sinon.stub(process, 'exit');
    try {
      const err = new Error('uncaught-ignored');
      Monti.ignoreErrorTracking(err);
      emitKadiraUncaughtException(err);
      await waitForUncaughtHandler();
      test.isFalse(exitStub.called);
      test.equal(Kadira.models.error.buildPayload().errors.length, 0);
    } finally {
      exitStub.restore();
      console.error = originalError;
      Kadira.options.exitOnUncaughtException = originalExitOn;
      _resetErrorTracking(originalErrorTrackingStatus);
    }
  }
);

addAsyncTest(
  'Errors - uncaughtException - exitOnUncaughtException false tracks and does not exit',
  async function (test) {
    const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    const originalExitOn = Kadira.options.exitOnUncaughtException;
    const originalSendPayload = Kadira._sendPayload;
    const originalError = console.error;
    Kadira.enableErrorTracking();
    Kadira.options.exitOnUncaughtException = false;
    Kadira.models.error = new ErrorModel('foo');
    Kadira._sendPayload = function () {
      return Promise.resolve();
    };
    console.error = function () {};
    const exitStub = sinon.stub(process, 'exit');
    try {
      emitKadiraUncaughtException(new Error('uncaught-no-exit-option'));
      await waitForUncaughtHandler();
      test.isFalse(exitStub.called);
      const error = Kadira.models.error.buildPayload().errors[0];
      test.equal(error.type, 'server-crash');
      test.equal(error.subType, 'uncaughtException');
    } finally {
      exitStub.restore();
      Kadira._sendPayload = originalSendPayload;
      console.error = originalError;
      Kadira.options.exitOnUncaughtException = originalExitOn;
      _resetErrorTracking(originalErrorTrackingStatus);
    }
  }
);

addAsyncTest(
  'Errors - uncaughtException - ignoreErrorTracking clears kill timer',
  async function (test) {
    const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    const originalExitOn = Kadira.options.exitOnUncaughtException;
    const originalError = console.error;
    Kadira.enableErrorTracking();
    Kadira.options.exitOnUncaughtException = true;
    Kadira.models.error = new ErrorModel('foo');
    console.error = function () {};
    const exitStub = sinon.stub(process, 'exit');
    const clock = sinon.useFakeTimers();
    try {
      const err = new Error('uncaught-ignored-timer');
      Monti.ignoreErrorTracking(err);
      emitKadiraUncaughtException(err);
      clock.tick(10000);
      test.isFalse(exitStub.called);
      test.equal(Kadira.models.error.buildPayload().errors.length, 0);
    } finally {
      clock.restore();
      exitStub.restore();
      console.error = originalError;
      Kadira.options.exitOnUncaughtException = originalExitOn;
      _resetErrorTracking(originalErrorTrackingStatus);
    }
  }
);
