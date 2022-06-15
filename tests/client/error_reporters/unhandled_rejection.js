import { Random } from 'meteor/random';

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onunhandledrejection - error object',
  TestWithErrorTrackingAsync(function (test, next) {
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    let message = Random.id();
    let error = new Error(message);
    let timeout = setTimeout(() => {
      test.equal('false', 'browser supports onunhandledrejection');
      next();
    }, 500);
    Promise.reject(error);

    function mock_KadiraSendErrors (error) {
      clearTimeout(timeout);
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('window.onunhandledrejection', error.subType);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onunhandledrejection - string',
  TestWithErrorTrackingAsync(function (test, next) {
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    let message = Random.id();
    let timeout = setTimeout(() => {
      test.equal('false', 'browser supports onunhandledrejection');
      next();
    }, 500);
    Promise.reject(message);

    function mock_KadiraSendErrors (error) {
      clearTimeout(timeout);
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('window.onunhandledrejection', error.subType);
      restoreKadiraSendErrors();
      next();
    }
  })
);

let original_KadiraSendErrors;

function hijackKadiraSendErrors (mock) {
  original_KadiraSendErrors = Kadira.errors.sendError;
  Kadira.errors.sendError = mock;
}

function restoreKadiraSendErrors () {
  Kadira.errors.sendError = original_KadiraSendErrors;
}

function TestWithErrorTrackingAsync (testFunction) {
  return function (test, next) {
    let status = Kadira.options.enableErrorTracking;
    let appId = Kadira.options.appId;
    Kadira.options.appId = 'app';
    Kadira.enableErrorTracking();
    testFunction(test, function () {
      Kadira.options.appId = appId;
      status ? Kadira.enableErrorTracking() : Kadira.disableErrorTracking();
      next();
    });
  };
}
