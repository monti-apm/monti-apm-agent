import {getClientArchVersion} from './common/utils';

const { DDSketch } = require('monti-apm-sketches-js');

export function haveAsyncCallback (args) {
  const lastArg = args[args.length - 1];

  return typeof lastArg === 'function';
}

class UniqueId {
  constructor () {
    this.id = 0;
  }

  get () {
    return `${this.id++}`;
  }
}

export const DefaultUniqueId = new UniqueId();

// creates a stack trace, removing frames in montiapm:agent's code
export function CreateUserStack (error) {
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

// Optimized version of apply which tries to call as possible as it can
// Then fall back to apply
// This is because, v8 is very slow to invoke apply.
export function OptimizedApply (context, fn, args) {
  let a = args;
  switch (a.length) {
    case 0:
      return fn.call(context);
    case 1:
      return fn.call(context, a[0]);
    case 2:
      return fn.call(context, a[0], a[1]);
    case 3:
      return fn.call(context, a[0], a[1], a[2]);
    case 4:
      return fn.call(context, a[0], a[1], a[2], a[3]);
    case 5:
      return fn.call(context, a[0], a[1], a[2], a[3], a[4]);
    default:
      return fn.apply(context, a);
  }
}

export function getClientVersions () {
  return {
    'web.cordova': getClientArchVersion('web.cordova'),
    'web.browser': getClientArchVersion('web.browser'),
    'web.browser.legacy': getClientArchVersion('web.browser.legacy')
  };
}

// Returns number of keys of an object, or size of a Map or Set
export function countKeys (obj) {
  if (obj instanceof Map || obj instanceof Set) {
    return obj.size;
  }

  return Object.keys(obj).length;
}

// Iterates objects and maps.
// Callback is called with a value and key
export function iterate (obj, callback) {
  if (obj instanceof Map) {
    return obj.forEach(callback);
  }

  for (let key in obj) {
    let value = obj[key];
    callback(value, key);
  }
}

// Returns a property from an object, or an entry from a map
export function getProperty (obj, key) {
  if (obj instanceof Map) {
    return obj.get(key);
  }

  return obj[key];
}

export function createHistogram () {
  return new DDSketch({
    alpha: 0.02
  });
}

export function pick (obj, keys) {
  return keys.reduce((result, key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
    return result;
  }, {});
}

export function cloneDeep (obj) {
  return JSON.parse(JSON.stringify(obj));
}
