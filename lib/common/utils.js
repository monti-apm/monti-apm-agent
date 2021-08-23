getClientArchVersion = function (arch) {
  const autoupdate = __meteor_runtime_config__.autoupdate

  if (autoupdate) {
    return autoupdate.versions[arch] ? autoupdate.versions[arch].version : 'none';
  }

  // Meteor 1.7 and older did not have an `autoupdate` object.
  switch (arch) {
    case 'cordova.web':
      return __meteor_runtime_config__.autoupdateVersionCordova;
    case 'web.browser':
    case 'web.browser.legacy':
      // Meteor 1.7 always used the web.browser.legacy version
      return __meteor_runtime_config__.autoupdateVersion;

    default:
      return 'none';
  }
}

getErrorParameters = function () {
  let type = null;
  let message = null;
  let subType = null;
  let stack = null;
  let subTypeFallbackValue = Meteor.isClient ? 'Monti.trackError' : 'server';
  let typeFallbackValue = Meteor.isClient ? 'client' : 'server-internal';

  if (
    !(arguments[0] instanceof Error) &&
    typeof arguments[0] === 'string' &&
    typeof arguments[1] === 'string'
  ) {
    // Old usage
    // Monti.trackError('type', 'error message', { stacks: 'error stack' });
    type = arguments[0] || typeFallbackValue;
    message = arguments[1];
    subType = arguments[2] && arguments[2].subType || subTypeFallbackValue;
    stack = arguments[2] && arguments[2].stacks || '';
  } else {
    // New usage
    // Monti.trackError(error, options);
    const error = arguments[0];
    const options = arguments[1];

    message = error && error.message;
    stack = error && error.stack || '';
    type = options && options.type || typeFallbackValue;
    subType = options && options.subType || subTypeFallbackValue;
  }

  return { type, message, subType, stack }

}