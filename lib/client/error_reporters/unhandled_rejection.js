window.addEventListener("unhandledrejection", function(e) {
  if (!Kadira.options.enableErrorTracking) {
    return;
  }

  var message = e.reason;
  var stack = '';

  if (typeof message === 'object' && message !== null) {
    stack = message.stack
    message = message.message
  }

  var now = (new Date().getTime());

  Kadira.errors.sendError({
    appId: Kadira.options.appId,
    name: message,
    type: 'client',
    startTime: now,
    subType: 'window.onunhandledrejection',
    info: getBrowserInfo(),
    _internalDetails: {
      origError: {
        reason: e.reason,
      }
    },
    stacks: JSON.stringify([{at: now, events: [], stack: stack}])
  });
});
