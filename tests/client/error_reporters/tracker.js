
Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - afterFlush',
  TestWithErrorTrackingAsync(function (test, next) {
    Kadira._setupOnErrorReporter();
    hijackKadiraSendErrors(mock_KadiraSendErrors);

    var message = Random.id();
    var error = new Error(message);
    var stack = error.stack;

    Tracker.afterFlush(() => {
      throw error;
    })

    function mock_KadiraSendErrors(error) {
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('tracker.afterFlush', error.subType);
      test.equal(JSON.parse(error.stacks)[0].stack, stack);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - afterFlush with throwFirstError',
  TestWithErrorTrackingAsync(function (test, next) {
    var error = new Error(Random.id());
    var errorSent = false;

    hijackKadiraSendErrors(() => {
      errorSent = true;
    });
    Tracker.afterFlush(() => {
        throw error;
    })

    try {
      Tracker.flush({_throwFirstError: true})
    } catch (e) {
      test.equal(e.message, error.message);
      test.equal(e.stack, error.stack);
      test.equal(errorSent, false)
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - autorun',
  TestWithErrorTrackingAsync(function (test, next) {
    Kadira._setupOnErrorReporter();
    hijackKadiraSendErrors(mock_KadiraSendErrors);

    var message = Random.id();
    var error = new Error(message);
    var stack = error.stack;
    let firstRun = true

    var computation = Tracker.autorun(() => {
      if (!firstRun) {
        throw error;
      }
      firstRun = false
    });

    computation.invalidate();

    function mock_KadiraSendErrors(error) {
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('tracker.compute', error.subType);
      test.equal(JSON.parse(error.stacks)[0].stack, stack);
      restoreKadiraSendErrors();
      next();
    }
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Reporters - tracker - autorun first run',
  TestWithErrorTrackingAsync(function (test, next) {
    var error = new Error(Random.id());
    var errorSent = false;

    hijackKadiraSendErrors(() => {
      errorSent = true;
    });

    try {
      Tracker.autorun(() => {
          throw error;
      })
    } catch (e) {
      test.equal(e.message, error.message);
      test.equal(e.stack, error.stack);
      test.equal(errorSent, false)
      next();
    }
  })
);

var original_KadiraSendErrors;

function hijackKadiraSendErrors(mock) {
  original_KadiraSendErrors = Kadira.errors.sendError
  Kadira.errors.sendError = mock;
}

function restoreKadiraSendErrors() {
  Kadira.errors.sendError = original_KadiraSendErrors;
}

function TestWithErrorTrackingAsync (testFunction) {
  return function (test, next) {
    var status = Kadira.options.enableErrorTracking;
    var appId = Kadira.options.appId;
    Kadira.options.appId = 'app';
    Kadira.enableErrorTracking();
    testFunction(test, function () {
      Kadira.options.appId = appId;
      status ? Kadira.enableErrorTracking() : Kadira.disableErrorTracking();
      next();
    });
  }
}
