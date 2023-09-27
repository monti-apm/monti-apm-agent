import { Random } from 'meteor/random';

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onunhandledrejection - error object',
  TestWithErrorTrackingAsync(function (test, next) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    let message = Random.id();
    let error = new Error(message);
    let timeout = setTimeout(() => {
      test.equal('false', 'browser supports onunhandledrejection');
      next();
    }, 500);
    Promise.reject(error);

    function mockKadiraSendErrors (_error) {
      clearTimeout(timeout);
      test.equal('string', typeof _error.appId);
      test.equal('object', typeof _error.info);
      test.equal(message, _error.name);
      test.equal('client', _error.type);
      test.equal(true, Array.isArray(JSON.parse(_error.stacks)));
      test.equal('number', typeof _error.startTime);
      test.equal('window.onunhandledrejection', _error.subType);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - window.onunhandledrejection - string',
  TestWithErrorTrackingAsync(function (test, next) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    let message = Random.id();
    let timeout = setTimeout(() => {
      test.equal('false', 'browser supports onunhandledrejection');
      next();
    }, 500);
    Promise.reject(message);

    function mockKadiraSendErrors (error) {
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
