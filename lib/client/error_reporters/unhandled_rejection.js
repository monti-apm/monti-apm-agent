window.addEventListener("unhandledrejection", function(e) {
  // TODO: support errors from bluebird

  if (!Kadira.options.enableErrorTracking) {
    return
  }

  var message = e.reason
  var stack = ''

  if (message instanceof Error) {
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
    stacks: JSON.stringify([{at: now, events: [], stack: stack}])
  });
});