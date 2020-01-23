export const MeteorDebugIgnore = Symbol()

TrackUncaughtExceptions = function () {
  process.on('uncaughtException', function (err) {
    // skip errors with `_skipKadira` flag
    if(err._skipKadira) {
      return;
    }

    // let the server crash normally if error tracking is disabled
    if(!Kadira.options.enableErrorTracking) {
      printErrorAndKill(err);
    }

    // looking for already tracked errors and throw them immediately
    // throw error immediately if kadira is not ready
    if(err._tracked || !Kadira.connected) {
      printErrorAndKill(err);
    }

    var trace = getTrace(err, 'server-crash', 'uncaughtException');
    Kadira.models.error.trackError(err, trace);
    Kadira._sendPayload(function () {
      clearTimeout(timer);
      throwError(err);
    });

    var timer = setTimeout(function () {
      throwError(err);
    }, 1000*10);

    function throwError(err) {
      // sometimes error came back from a fiber.
      // But we don't fibers to track that error for us
      // That's why we throw the error on the nextTick
      process.nextTick(function() {
        // we need to mark this error where we really need to throw
        err._tracked = true;
        printErrorAndKill(err);
      });
    }
  });

  function printErrorAndKill(err) {
    // since we are capturing error, we are also on the error message.
    // so developers think we are also reponsible for the error.
    // But we are not. This will fix that.
    console.error(err.stack);
    process.exit(7);
  }
}

TrackUnhandledRejections = function () {
  process.on('unhandledRejection', function (reason) {
    // skip errors with `_skipKadira` flag
    if(
      reason._skipKadira ||
      !Kadira.options.enableErrorTracking
    ) {
      return;
    }

    var trace = getTrace(reason, 'server-internal', 'unhandledRejection');
    Kadira.models.error.trackError(reason, trace);
  });
}

TrackMeteorDebug = function () {
  var originalMeteorDebug = Meteor._debug;
  Meteor._debug = function (message, stack) {
    // Sometimes Meteor calls Meteor._debug with no arguments
    // to log an empty line
    const isArgs = message !== undefined || stack !== undefined;

    // We've changed `stack` into an object at method and sub handlers so we can
    // detect the error here. These errors are already tracked so don't track them again.
    var alreadyTracked = false;

    // Some Meteor versions pass the error, and other versions pass the error stack
    if (stack && stack[MeteorDebugIgnore]) {
      alreadyTracked = true;
    } else if (stack && stack.stack && stack.stack[MeteorDebugIgnore]) {
      alreadyTracked = true;
    }

    if (alreadyTracked) {
      // Restore so origionalMeteorDebug shows the stack as a string instead as an object
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

      if (typeof message == 'string' && stack instanceof Error) {
        const separator = message.endsWith(':') ? '' : ':'
        errorMessage = `${message}${separator} ${stack.message}`
      }

      let error = new Error(errorMessage);
      if (stack instanceof Error) {
        error.stack = stack.stack;
      } else if (stack) {
        error.stack = stack;
      } else {
        error.stack = CreateUserStack(error);
      }
      var trace = getTrace(error, 'server-internal', 'Meteor._debug');
      Kadira.models.error.trackError(error, trace);
    }

    return originalMeteorDebug.apply(this, arguments);
  }
}

function getTrace(err, type, subType) {
  return {
    type: type,
    subType: subType,
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
