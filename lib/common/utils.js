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

// creates a stack trace, removing frames in montiapm:agent's code
CreateUserStack = function (error) {
  const stack = (error || new Error()).stack.split('\n');
  let toRemove = 1;

  // Find how many frames need to be removed
  // to make the user's code the first frame
  for (; toRemove < stack.length; toRemove++) {
    if (stack[toRemove].indexOf('montiapm:agent') === -1) {
      break;
    }
  }

  return stack.slice(toRemove).join('\n');
}


const createStackTrace = () => {
  let err = {};
  if (Error.captureStackTrace) {
    Error.captureStackTrace(err);
  } else {
    CreateUserStack(err);
  }
  return err.stack;
}

export const getErrorParameters = function () {
  let type = null;
  let message = null;
  let subType = null;
  let stack = null;
  const subTypeFallbackValue = Meteor.isClient ? 'Monti.trackError' : 'server';
  const typeFallbackValue = Meteor.isClient ? 'client' : 'server-internal';

  if (
    !(arguments[0] instanceof Error) &&
    typeof arguments[0] === 'string' &&
    typeof arguments[1] === 'string'
  ) {
    // Old usage
    // Monti.trackError('type', 'error message', { stacks: 'error stack' });
    // Kadira.trackError('type', 'msg');
    // { '0': 'type', '1': 'msg', '2': { subType: 'st', stacks: 's' } }
    type = Meteor.isClient ? 'client' : arguments[0];
    subType = Meteor.isClient? arguments[0] : (arguments[2] && arguments[2].subType || subTypeFallbackValue);
    message = arguments[1];
    stack = arguments[2] && arguments[2].stacks || createStackTrace();

  } else {
    // New usage
    // Monti.trackError(error, options);
    // Kadira.trackError(error, { type: 'job' });
    const error = arguments[0];
    const options = arguments[1];
    
    message = (typeof error === 'object' && error !== null) ? error.message : error;
    stack = error && error.stack || createStackTrace();
    type = Meteor.isClient ? 'client' : options && options.type || typeFallbackValue;
    subType = options && options.subType || subTypeFallbackValue;
  }

  return { type, message, subType, stack }
}