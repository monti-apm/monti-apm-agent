
Tinytest.add(
  'Client Side - Error Manager - enableErrorTracking',
  function (test) {
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    test.equal(Kadira.options.enableErrorTracking, true);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Client Side - Error Manager - disableErrorTracking',
  function (test) {
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.disableErrorTracking();
    test.equal(Kadira.options.enableErrorTracking, false);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.addAsync(
  'Client Side - Error Manager - Custom Errors - simple',
  TestWithErrorTracking(function (test, done) {
    hijackSendErrorOnce(function (error) {
      test.equal(error.name, "msg");
      test.equal(error.type, "client");
      test.equal(error.subType, "type");
      test.equal(typeof error.appId, "string");
      test.equal(typeof error.startTime, "number");
      test.equal(typeof error.info, "object");
      test.equal(JSON.parse(error.stacks)[0].stack.includes('TestCase.func'), true);

      done();
    });

    Kadira.trackError('type', 'msg');
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Custom Errors - with all options',
  TestWithErrorTracking(function (test, done) {
    hijackSendErrorOnce(function (error) {
      test.equal(error.name, "msg");
      test.equal(error.type, "client");
      test.equal(error.subType, "type");
      test.equal(typeof error.appId, "string");
      test.equal(typeof error.startTime, "number");
      test.equal(typeof error.info, "object");
      test.equal(JSON.parse(error.stacks)[0].stack, "s");

      done();
    });
    Kadira.trackError('type', 'msg', {subType: 'st', stacks: 's'});
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Custom Errors - error object',
  TestWithErrorTracking(function (test, done) {
    var error = new Error('test');
    hijackSendErrorOnce(function (err) {
      test.equal(err.name, "test");
      test.equal(err.type, "client");
      test.equal(err.subType, "Monti.trackError");
      test.equal(typeof err.appId, "string");
      test.equal(typeof err.startTime, "number");
      test.equal(typeof err.info, "object");
      test.equal(JSON.parse(err.stacks)[0].stack, error.stack);

      done();
    });

    Kadira.trackError(error);
  }
));

Tinytest.addAsync(
  'Client Side - Error Manager - Custom Errors - error object with options',
  TestWithErrorTracking(function (test, done) {
    var error = new Error('error-message')
    hijackSendErrorOnce(function (err) {
      test.equal(err.name, "error-message");
      test.equal(err.type, "client");
      test.equal(err.subType, "custom");
      test.equal(typeof err.appId, "string");
      test.equal(typeof err.startTime, "number");
      test.equal(typeof err.info, "object");
      test.equal(JSON.parse(err.stacks)[0].stack, error.stack);

      done();
    });
    Kadira.trackError(error, { subType: 'custom' });
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Custom Errors - error object with type',
  TestWithErrorTracking(function (test, done) {
    var error = new Error('error-message')
    hijackSendErrorOnce(function (err) {
      test.equal(err.name, "error-message");
      test.equal(err.type, "client");
      test.equal(err.subType, "Monti.trackError");
      test.equal(typeof err.appId, "string");
      test.equal(typeof err.startTime, "number");
      test.equal(typeof err.info, "object");
      test.equal(JSON.parse(err.stacks)[0].stack, error.stack);

      done();
    });
    Kadira.trackError(error, { type: 'job' });
  })
);

Tinytest.addAsync(
  'Client Side - Error Manager - Custom Errors - error message with subType',
  TestWithErrorTracking(function (test, done) {
    hijackSendErrorOnce(function (err) {
      test.equal(err.name, "error-message");
      test.equal(err.type, "client");
      test.equal(err.subType, "job");
      test.equal(typeof err.appId, "string");
      test.equal(typeof err.startTime, "number");
      test.equal(typeof err.info, "object");
      console.log(JSON.parse(err.stacks)[0].stack)
      test.equal(JSON.parse(err.stacks)[0].stack.includes('TestCase.func'), true);

      done();
    });
    Kadira.trackError('error-message', { subType: 'job' });
  })
);

function hijackSendErrorOnce(sendError) {
  const origional = Kadira.errors.sendError;
  Kadira.errors.sendError = function () {
    sendError.apply(Kadira.errors, arguments);
    Kadira.errors.sendError = origional;
  }
}

function TestWithErrorTracking (testFunction) {
  return function (test, done) {
    var status = Kadira.options.enableErrorTracking;
    var appId = Kadira.options.appId;
    Kadira.options.appId = 'app';
    Kadira.enableErrorTracking();
    testFunction(test, () => {
      Kadira.options.appId = appId;
      _resetErrorTracking(status);
      done();
    });
  }
}

function _resetErrorTracking (status) {
  if(status) {
    Kadira.enableErrorTracking();
  } else {
    Kadira.disableErrorTracking();
  }
}
