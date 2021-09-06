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
let type = null;
let message = null;
let subType = null;
let stack = null;
const subTypeFallbackValue = Meteor.isClient ? 'Monti.trackError' : 'server';
const typeFallbackValue = Meteor.isClient ? 'client' : 'server-internal';
const createStackTrace = () => {
  if (Error.captureStackTrace) {
    return Error.captureStackTrace({});
  }
  return '';
}

const processClientSideErrors = function () {
  if (
    !(arguments[0] instanceof Error) &&
    typeof arguments[0] === 'string' &&
    typeof arguments[1] === 'string'
  ) {
    // Old usage
    // Monti.trackError('type', 'error message', { stacks: 'error stack' });
    // Kadira.trackError('type', 'msg');
    type = typeFallbackValue;
    subType = arguments[0] || subTypeFallbackValue;
    message = arguments[1];
    stack = arguments[2] && arguments[2].stacks || '';
  } else {
    // New usage
    // Monti.trackError(error, options);
    // Kadira.trackError(error, { type: 'job' });
    const error = arguments[0];
    const options = arguments[1];

    message = (typeof error === 'object' && error !== null) ? error.message : error;
    stack = error && error.stack || '';
    type = typeFallbackValue;
    subType = options && options.subType || subTypeFallbackValue;
  }
}

const processServerSideErrors = function () {
  if (
    !(arguments[0] instanceof Error) &&
    typeof arguments[0] === 'string' &&
    typeof arguments[1] === 'string'
  ) {
    // Old usage
    // Monti.trackError('type', 'error message', { stacks: 'error stack' });
    // Kadira.trackError('type', 'msg');
    type = typeFallbackValue;
    subType = arguments[0] || subTypeFallbackValue;
    message = arguments[1];
    stack = arguments[2] && arguments[2].stacks || '';
  } else {
    // New usage
    // Monti.trackError(error, options);
    // Kadira.trackError(error, { type: 'job' });
    const error = arguments[0];
    const options = arguments[1];

    message = (typeof error === 'object' && error !== null) ? error.message : error;
    stack = error && error.stack || '';
    type = typeFallbackValue;
    subType = options && options.subType || subTypeFallbackValue;
  }
}

export const getErrorParameters = function () {

  if (Meteor.isClient) {
    processClientSideErrors()
  } else {
    processServerSideErrors();
  }
  
  return { type, message, subType, stack }

}