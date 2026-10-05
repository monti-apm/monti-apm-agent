import { Meteor } from 'meteor/meteor';
import { CreateUserStack } from '../utils';

export const KeepProcessAlive = Symbol('MontiKeepProcessAlive');

function shouldExitOnUncaughtException (err) {
  return !err[KeepProcessAlive];
}

export function TrackUncaughtExceptions () {
  process.on('uncaughtException', function handleUncaughtException (err) {
    if (err === undefined || err === null) {
      let type = err === null ? 'null' : 'undefined';
      err = new Error(`uncaught exception: ${type}`);
    }

    let shouldThrow = shouldExitOnUncaughtException(err);
    let track = true;

    // skip errors with `_skipKadira` flag
    if (err._skipKadira) {
      track = false;
    }

    // let the server crash normally if error tracking is disabled
    if (!Kadira.options.enableErrorTracking) {
      track = false;
    }

    if (track) {
      let trace = getTrace(err, 'server-crash', 'uncaughtException');
      Kadira.models.error.trackError(err, trace);
    }

    // Even if we don't track this error, make sure all of the latest data
    // is pushed to Monti before we exit
    if (Kadira.connected && shouldThrow) {
      let timer = setTimeout(function () {
        performDefaultBehavior(err);
      }, 1000 * 10);

      Kadira._sendPayload()
        .then(function () {
          clearTimeout(timer);
          performDefaultBehavior(err);
        });
    } else {
      performDefaultBehavior(err);
    }

    // Tries to reimplement node's default behavior for uncaught exceptions,
    // or does nothing and leaves the process running if configured by the user
    function performDefaultBehavior (_err) {
      if (!shouldThrow) {
        // TODO: should we log here?
        return;
      }

      printErrorAndKill(_err);
    }
  });

  function printErrorAndKill (err) {
    // since we are capturing error, we are also on the error message.
    // so developers think we are also responsible for the error.
    // But we are not. This will fix that.
    // eslint-disable-next-line no-console
    console.error(err.stack);
    process.exit(7);
  }
}

export function TrackUnhandledRejections () {
  process.on('unhandledRejection', function (reason) {
    // skip errors with `_skipKadira` flag
    if (
      reason &&
      reason._skipKadira ||
      !Kadira.options.enableErrorTracking
    ) {
      return;
    }

    if (reason === undefined) {
      reason = new Error('unhandledRejection: undefined');
    } else if (reason === null) {
      reason = new Error('unhandledRejection: null');
    }

    let trace = getTrace(reason, 'server-internal', 'unhandledRejection');
    Kadira.models.error.trackError(reason, trace);

    // TODO: we should respect the --unhandled-rejections option
    // message taken from
    // https://github.com/nodejs/node/blob/f4797ff1ef7304659d747d181ec1e7afac408d50/lib/internal/process/promises.js#L243-L248
    const message =
      'This error originated either by ' +
      'throwing inside of an async function without a catch block, ' +
      'or by rejecting a promise which was not handled with .catch().' +
      ' The promise rejected with the reason: ';

    // We could emit a warning instead like Node does internally
    // but it requires Node 8 or newer
    // eslint-disable-next-line no-console
    console.warn(message);
    // eslint-disable-next-line no-console
    console.error(reason && reason.stack ? reason.stack : reason);
  });
}

export function TrackMeteorDebug () {
  let originalMeteorDebug = Meteor._debug;
  Meteor._debug = function (message, stack) {
    // Sometimes Meteor calls Meteor._debug with no arguments
    // to log an empty line
    const isArgs = message !== undefined || stack !== undefined;

    // only send to the server if connected to kadira
    if (
      Kadira.options.enableErrorTracking &&
      isArgs &&
      Kadira.connected &&
      !isTrackedMethodOrSubError(message, stack)
    ) {
      let errorMessage = message;

      if (typeof message === 'string' && stack instanceof Error) {
        const separator = message.endsWith(':') ? '' : ':';
        errorMessage = `${message}${separator} ${stack.message}`;
      }

      let error = new Error(errorMessage);
      if (stack instanceof Error) {
        error.stack = stack.stack;
      } else if (stack) {
        error.stack = stack;
      } else {
        error.stack = CreateUserStack(error);
      }
      let trace = getTrace(error, 'server-internal', 'Meteor._debug');
      Kadira.models.error.trackError(error, trace);
    }

    return originalMeteorDebug.apply(this, arguments);
  };
}

// We track the full error for methods and subs when they complete
// We don't want to track when Meteor logs the error with _debug.
function isTrackedMethodOrSubError (message, stack) {
  if (
    typeof message !== 'string' ||
    !(
      message.startsWith('Exception while invoking method ') ||
      message.startsWith('Exception from sub ')
    )
  ) {
    return false;
  }

  let currentError = Kadira._getInfo()?.currentError;

  return !!currentError && stack === currentError.stack;
}

function getTrace (err, type, subType) {
  return {
    type,
    subType,
    name: err.message,
    errored: true,
    at: Kadira.syncedDate.getTime(),
    events: [
      ['start', 0, {}],
      ['error', 0, {error: {message: err.message, stack: err.stack}}]
    ],
    metrics: {
      total: 0
    }
  };
}
