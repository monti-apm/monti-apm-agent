import { addAsyncTest } from './_helpers/helpers';

Tinytest.add(
  'Errors - enableErrorTracking',
  function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    test.equal(Kadira.options.enableErrorTracking, true);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - disableErrorTracking',
  function (test) {
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.disableErrorTracking();
    test.equal(Kadira.options.enableErrorTracking, false);
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

addAsyncTest(
  'Errors - Custom Errors - simple',
  async function (test) {
    let originalTrackError = Kadira.models.error.trackError;

    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;

    Kadira.enableErrorTracking();

    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err.message, 'msg');
      test.equal(err.stack.includes('error_tracking.js'), true);

      delete trace.at;

      const expected = {
        type: 'type',
        subType: 'server',
        name: 'msg',
        errored: true,
        // at: 123,
        events: [
          ['start'],
          ['error', 0, {error: {message: 'msg', stack: err.stack}}]
        ],
        metrics: {total: 0}
      };

      test.equal(trace, expected);
    };

    Kadira.trackError('type', 'msg');

    Kadira.models.error.trackError = originalTrackError;

    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - with all values',
  function (test) {
    let originalTrackError = Kadira.models.error.trackError;
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
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
          ['start'],
          ['error', 0, {error: {message: 'msg', stack: 's'}}]
        ],
        metrics: {total: 0}
      });
    };
    Kadira.trackError('type', 'msg', {subType: 'st', stacks: 's'});
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

addAsyncTest(
  'Errors - Custom Errors - error object',
  function (test) {
    let originalTrackError = Kadira.models.error.trackError;
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    let error = new Error('test');
    Kadira.models.error.trackError = function (err, trace) {
      test.equal(err, {message: 'test', stack: error.stack});
      delete trace.at;

      const expected = {
        type: 'server-internal',
        subType: 'server',
        name: 'test',
        errored: true,
        // at: 123,
        events: [
          ['start'],
          ['error', 0, {error: {message: 'test', stack: error.stack}}]
        ],
        metrics: {total: 0}
      };

      test.equal(trace, expected);
    };
    Kadira.trackError(error);
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error object with options',
  function (test) {
    let originalTrackError = Kadira.models.error.trackError;
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    let error = new Error('error-message');
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
          ['start'],
          ['error', 0, {error: {message: 'error-message', stack: error.stack}}]
        ],
        metrics: {total: 0}
      });
    };
    Kadira.trackError(error, { subType: 'custom' });
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error object with type',
  function (test) {
    let originalTrackError = Kadira.models.error.trackError;
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    let error = new Error('error-message');
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
          ['start'],
          ['error', 0, {error: {message: 'error-message', stack: err.stack}}]
        ],
        metrics: {total: 0}
      });
    };
    Kadira.trackError(error, { type: 'job' });
    Kadira.models.error.trackError = originalTrackError;
    _resetErrorTracking(originalErrorTrackingStatus);
  }
);

Tinytest.add(
  'Errors - Custom Errors - error message with type',
  function (test) {
    let originalTrackError = Kadira.models.error.trackError;
    let originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
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
          ['start'],
          ['error', 0, {error: {message: 'error-message', stack: err.stack}}]
        ],
        metrics: {total: 0}
      });
    };
    Kadira.trackError('error-message', { type: 'job' });
    Kadira.models.error.trackError = originalTrackError;
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
