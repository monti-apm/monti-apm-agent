import { Meteor } from 'meteor/meteor';
import { CreateUserStack } from '../utils';

export const MeteorDebugIgnore = Symbol('MontiMeteorDebugIgnore');

export function TrackUncaughtExceptions () {
  process.on('uncaughtException', function (err) {
    const timer = setTimeout(function () {
      throwError(err);
    }, 1000 * 10);

    // skip errors with `_skipKadira` flag
    if (err._skipKadira) {
      return;
    }

    // let the server crash normally if error tracking is disabled
    if (!Kadira.options.enableErrorTracking) {
      printErrorAndKill(err);
    }

    // looking for already tracked errors and throw them immediately
    // throw error immediately if kadira is not ready
    if (err._tracked || !Kadira.connected) {
      printErrorAndKill(err);
    }

    let trace = getTrace(err, 'server-crash', 'uncaughtException');
    Kadira.models.error.trackError(err, trace);
    Kadira._sendPayload(function () {
      clearTimeout(timer);
      throwError(err);
    });


    function throwError (_err) {
      // sometimes error came back from a fiber.
      // But we don't fibers to track that error for us
      // That's why we throw the error on the nextTick
      process.nextTick(function () {
        // we need to mark this error where we really need to throw
        _err._tracked = true;
        printErrorAndKill(_err);
      });
    }
  });

  function printErrorAndKill (err) {
    // since we are capturing error, we are also on the error message.
    // so developers think we are also reponsible for the error.
    // But we are not. This will fix that.
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

    if (!reason) {
      reason = new Error('unhandledRejection: reason undefined');
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
    console.warn(message);
    console.error(reason && reason.stack ? reason.stack : reason);
  });
}

export function TrackMeteorDebug () {
  let originalMeteorDebug = Meteor._debug;
  Meteor._debug = function (message, stack) {
    // Sometimes Meteor calls Meteor._debug with no arguments
    // to log an empty line
    const isArgs = message !== undefined || stack !== undefined;

    // We've changed `stack` into an object at method and sub handlers so we can
    // detect the error here. These errors are already tracked so don't track them again.
    let alreadyTracked = false;

    // Some Meteor versions pass the error, and other versions pass the error stack
    // Restore so origionalMeteorDebug shows the stack as a string instead as an object
    if (stack && stack[MeteorDebugIgnore]) {
      alreadyTracked = true;
      arguments[1] = stack.stack;
    } else if (stack && stack.stack && stack.stack[MeteorDebugIgnore]) {
      alreadyTracked = true;
      arguments[1] = stack.stack.stack;
    }

    // only send to the server if connected to kadira
    if (
      Kadira.options.enableErrorTracking &&
      isArgs &&
      !alreadyTracked &&
      Kadira.connected
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
