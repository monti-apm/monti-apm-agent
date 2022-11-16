import { Meteor } from 'meteor/meteor';

getClientArchVersion = function (arch) {
  const autoupdate = __meteor_runtime_config__.autoupdate;

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
};

const createStackTrace = () => {
  if (Error.captureStackTrace) {
    let err = {};
    Error.captureStackTrace(err, Kadira.trackError);
    return err.stack;
  }

  const stack = new Error().stack.split('\n');
  let toRemove = 0;

  // Remove frames starting from when trackError was called
  for (; toRemove < stack.length; toRemove++) {
    if (stack[toRemove].indexOf('trackError') > -1) {
      toRemove += 1;
      break;
    }
  }

  return stack.slice(toRemove).join('\n');
};

export const getErrorParameters = function (args) {
  let type = null;
  let message = null;
  let subType = null;
  let stack = null;
  let kadiraInfo = null;

  if (
    !(args[0] instanceof Error) &&
    typeof args[0] === 'string' &&
    typeof args[1] === 'string'
  ) {
    // Old usage:
    // Monti.trackError(
    //   'type', 'error message', { stacks: 'error stack', subType: 'sub type }
    // );

    const options = args[2] || {};

    type = args[0];
    subType = Meteor.isClient ? args[0] : options.subType;
    message = args[1];
    stack = options.stacks || createStackTrace();
    kadiraInfo = options.kadiraInfo;
  } else {
    // New usage:
    // Monti.trackError(error, { type: 'type', subType: 'subType' });
    const error = args[0];
    const options = args[1] || {};
    const isErrorObject = typeof error === 'object' && error !== null;

    message = isErrorObject ? error.message : error;
    stack = isErrorObject && error.stack || createStackTrace();
    type = options.type;
    subType = options.subType;
    kadiraInfo = options.kadiraInfo;
  }

  return { type, message, subType, stack, kadiraInfo };
};

/**
 * @param {Object} obj The object to check.
 * @returns {boolean} True if the object has set any data which is not `null`, `undefined` or an empty string.
 */
export const objectHasData = function (obj) {
  return Object.values(obj).some(val => ![null, undefined, ''].includes(val));
};

/**
 * @param {Number} milliseconds The number of milliseconds.
 * @returns {string} A human-readable representation of the given milliseconds.
 */
export const millisToHuman = function (milliseconds) {
  const millis = milliseconds % 1000;
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const builder = [];

  if (days > 0) {
    builder.push(`${days}d`);
  }

  if (hours > 0) {
    builder.push(`${hours % 24}h`);
  }

  if (minutes > 0) {
    builder.push(`${minutes % 60}m`);
  }

  if (seconds > 0) {
    builder.push(`${seconds % 60}s`);
  }

  if (millis > 0) {
    builder.push(`${millis}ms`);
  }

  return builder.join(' ');
};
