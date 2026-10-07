import { Random } from 'meteor/random';
import { ErrorModel } from '../../../lib/client/models/errors';

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onerror - with all args',
  TestWithErrorTrackingAsync(function (test, next) {
    Kadira._setupOnErrorReporter();
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof window.onerror, 'function');
    let error = new Error('test-error');
    let message = Random.id();
    window.onerror(message, '_url', 1, 1, error);

    function mockKadiraSendErrors (_error) {
      test.equal('string', typeof _error.appId);
      test.equal('object', typeof _error.info);
      test.equal(message, _error.name);
      test.equal('client', _error.type);
      test.equal(true, Array.isArray(JSON.parse(_error.stacks)));
      test.equal('number', typeof _error.startTime);
      test.equal('window.onerror', _error.subType);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onerror - without error',
  TestWithErrorTrackingAsync(function (test, next) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof window.onerror, 'function');
    let message = Random.id();
    window.onerror(message, '_url', 1, 1);

    function mockKadiraSendErrors (error) {
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('window.onerror', error.subType);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onerror - respects disableClientErrorTracking',
  TestWithErrorTrackingAsync(function (test, next) {
    let prevEnabled = Kadira.options.enableErrorTracking;
    let prevClientDisable = Kadira.options.disableClientErrorTracking;
    let prevErrors = Kadira.errors;

    Kadira.options.disableClientErrorTracking = true;
    Kadira._initializeErrorTracking();

    // Use a fresh model so the rate limit and ntp-sync deferral
    // from previous tests don't delay sending past this test
    Kadira.errors = new ErrorModel({ waitForNtpSyncInterval: 0 });

    // Mock below sendError so this works no matter where
    // disableClientErrorTracking is checked
    let sendCalled = false;
    let originalSend = Kadira.send;
    Kadira.send = function () {
      sendCalled = true;
    };

    window.onerror(Random.id(), '_url', 1, 1, new Error('test-error'));

    setTimeout(function () {
      Kadira.send = originalSend;
      Kadira.errors.close();
      Kadira.errors = prevErrors;
      Kadira.options.enableErrorTracking = prevEnabled;
      Kadira.options.disableClientErrorTracking = prevClientDisable;

      test.equal(sendCalled, false, 'client errors should not be sent when disableClientErrorTracking is enabled');
      next();
    }, 100);
  })
);

// --------------------------------------------------------------------------\\

let originalKadiraSendError;

function hijackKadiraSendErrors (mock) {
  originalKadiraSendError = Kadira.errors.sendError;
  Kadira.errors.sendError = mock;
}

function restoreKadiraSendErrors () {
  Kadira.errors.sendError = originalKadiraSendError;
}

function TestWithErrorTrackingAsync (testFunction) {
  return function (test, next) {
    let status = Kadira.options.enableErrorTracking;
    let appId = Kadira.options.appId;
    Kadira.options.appId = 'app';
    Kadira.enableErrorTracking();
    testFunction(test, function () {
      Kadira.options.appId = appId;
      if (status) {
        Kadira.enableErrorTracking();
      } else {
        Kadira.disableErrorTracking();
      }
      next();
    });
  };
}
