
Tinytest.add(
  'Errors - enableErrorTracking',
  function (test) {
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    test.equal(Kadira.options.enableErrorTracking, true);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - disableErrorTracking',
  function (test) {
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.disableErrorTracking();
    test.equal(Kadira.options.enableErrorTracking, false);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - simple',
  function (test) {
    var originalTrackError = Kadira.models.error.trackError;
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err.message, 'msg');
      test.equal(err.stack.includes('tinytest.js'), true);
      delete trace.at;
      test.equal(trace, {
        type: 'type',
        subType: 'server',
        name: 'msg',
        errored: true,
        // at: 123,
        events: [
          ['start', 0, {}],
          ['error', 0, {error: {message: 'msg', stack: err.stack}}]
        ],
        metrics: {total: 0}
      });
    }
    Kadira.trackError('type', 'msg');
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - with all values',
  function (test) {
    var originalTrackError = Kadira.models.error.trackError;
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err, {message: 'msg', stack: 's'});
      delete trace.at;
      test.equal(trace, {
        type: 'type',
        subType: 'st',
        name: 'msg',
        errored: true,
        // at: 123,
        events: [
          ['start', 0, {}],
          ['error', 0, {error: {message: 'msg', stack: 's'}}]
        ],
        metrics: {total: 0}
      });
    }
    Kadira.trackError('type', 'msg', {subType: 'st', stacks: 's'});
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error object',
  function (test) {
    var originalTrackError = Kadira.models.error.trackError;
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    var error = new Error('test');
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err, {message: 'test', stack: error.stack});
      delete trace.at;
      test.equal(trace, {
        type: 'server-internal',
        subType: 'server',
        name: 'test',
        errored: true,
        // at: 123,
        events: [
          ['start', 0, {}],
          ['error', 0, {error: {message: 'test', stack: error.stack}}]
        ],
        metrics: {total: 0}
      });
    }
    Kadira.trackError(error);
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error object with options',
  function (test) {
    var originalTrackError = Kadira.models.error.trackError;
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    var error = new Error('error-message')
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err, {message: 'error-message', stack: error.stack});
      delete trace.at;
      test.equal(trace, {
        type: 'server-internal',
        subType: 'custom',
        name: 'error-message',
        errored: true,
        // at: 123,
        events: [
          ['start', 0, {}],
          ['error', 0, {error: {message: 'error-message', stack: error.stack}}]
        ],
        metrics: {total: 0}
      });
    }
    Kadira.trackError(error, { subType: 'custom' });
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error object with type',
  function (test) {
    var originalTrackError = Kadira.models.error.trackError;
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    var error = new Error('error-message')
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err, {message: 'error-message', stack: error.stack});
      delete trace.at;
      test.equal(trace, {
        type: 'job',
        subType: 'server',
        name: 'error-message',
        errored: true,
        // at: 123,
        events: [
          ['start', 0, {}],
          ['error', 0, {error: {message: 'error-message', stack: err.stack}}]
        ],
        metrics: {total: 0}
      });
    }
    Kadira.trackError(error, { type: 'job' });
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error message with type',
  function (test) {
    var originalTrackError = Kadira.models.error.trackError;
    var originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err.message, 'error-message');
      test.equal(err.stack.includes('tinytest.js'), true);
      delete trace.at;
      test.equal(trace, {
        type: 'job',
        subType: 'server',
        name: 'error-message',
        errored: true,
        // at: 123,
        events: [
          ['start', 0, {}],
          ['error', 0, {error: {message: 'error-message', stack: err.stack}}]
        ],
        metrics: {total: 0}
      });
    }
    Kadira.trackError('error-message', { type: 'job' });
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

function _resetErrorTracking (status) {
  if(status) {
    Kadira.enableErrorTracking();
  } else {
    Kadira.disableErrorTracking();
  }
}
