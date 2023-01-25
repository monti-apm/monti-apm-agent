import { Random } from 'meteor/random';
import { Tracker } from 'meteor/tracker';

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - afterFlush',
  TestWithErrorTrackingAsync(function (test, next) {
    Kadira._setupOnErrorReporter();
    hijackKadiraSendErrors(mockKadiraSendErrors);

    let message = Random.id();
    let error = new Error(message);
    let stack = error.stack;

    Tracker.afterFlush(() => {
      throw error;
    });

    function mockKadiraSendErrors (_error) {
      test.equal('string', typeof _error.appId);
      test.equal('object', typeof _error.info);
      test.equal(message, _error.name);
      test.equal('client', _error.type);
      test.equal(true, Array.isArray(JSON.parse(_error.stacks)));
      test.equal('number', typeof _error.startTime);
      test.equal('tracker.afterFlush', _error.subType);
      test.equal(JSON.parse(_error.stacks)[0].stack, stack);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - afterFlush with throwFirstError',
  TestWithErrorTrackingAsync(function (test, next) {
    let error = new Error(Random.id());
    let errorSent = false;

    hijackKadiraSendErrors(() => {
      errorSent = true;
    });
    Tracker.afterFlush(() => {
      throw error;
    });

    try {
      Tracker.flush({_throwFirstError: true});
    } catch (e) {
      test.equal(e.message, error.message);
      test.equal(e.stack, error.stack);
      test.equal(errorSent, false);
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - autorun',
  TestWithErrorTrackingAsync(function (test, next) {
    Kadira._setupOnErrorReporter();
    hijackKadiraSendErrors(mockKadiraSendErrors);

    let message = Random.id();
    let error = new Error(message);
    let stack = error.stack;
    let firstRun = true;

    let computation = Tracker.autorun(() => {
      if (!firstRun) {
        throw error;
      }
      firstRun = false;
    });

    computation.invalidate();

    function mockKadiraSendErrors (_error) {
      test.equal('string', typeof _error.appId);
      test.equal('object', typeof _error.info);
      test.equal(message, _error.name);
      test.equal('client', _error.type);
      test.equal(true, Array.isArray(JSON.parse(_error.stacks)));
      test.equal('number', typeof _error.startTime);
      test.equal('tracker.compute', _error.subType);
      test.equal(JSON.parse(_error.stacks)[0].stack, stack);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - autorun first run',
  TestWithErrorTrackingAsync(function (test, next) {
    let error = new Error(Random.id());
    let errorSent = false;

    hijackKadiraSendErrors(() => {
      errorSent = true;
    });

    try {
      Tracker.autorun(() => {
        throw error;
      });
    } catch (e) {
      test.equal(e.message, error.message);
      test.equal(e.stack, error.stack);
      test.equal(errorSent, false);
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
