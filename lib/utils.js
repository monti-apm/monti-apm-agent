import { getClientArchVersion } from './common/utils';
import { Ntp } from './ntp';

const { DDSketch } = require('monti-apm-sketches-js');

export function haveAsyncCallback (args) {
  const lastArg = args[args.length - 1];

  return typeof lastArg === 'function';
}

export class UniqueId {
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
export function optimizedApply (context, fn, args) {
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

  // eslint-disable-next-line guard-for-in
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
  if (!obj) {
    return obj;
  }

  const result = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
}

export function omit (obj, keys) {
  const keySet = new Set(keys);
  const result = {};
  for (let key in obj) {
    if (!keySet.has(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function first (arr) {
  return arr[0];
}

export function last (arr) {
  return arr[arr.length - 1];
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const deferrable = () => {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject
  };
};

export const defer = fn => setTimeout(fn, 0);

export const isPromise = obj => obj && typeof obj.then === 'function';

const ignoredStackFrames = [/\(internal\/async_hooks.js/, /^\s+at AsyncHook\.init/];

export function stackTrace () {
  const restoreLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 10;

  const obj = {};
  Error.captureStackTrace(obj, stackTrace);
  const structuredStackTrace = obj.stack;

  Error.stackTraceLimit = restoreLimit;

  return deleteLinesWhichMatchAnyOf(structuredStackTrace, ignoredStackFrames);
}

export function deleteLinesWhichMatchAnyOf (string, regexes) {
  return string.split('\n').filter(line => !regexes.some(regex => regex.test(line))).join('\n');
}

export const isPlainObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);

export const cloneDeep = obj => JSON.parse(JSON.stringify(obj));

export const cleanTrailingNilValues = arr => {
  while (arr.length > 0 && last(arr) === null || last(arr) === undefined) {
    arr.pop();
  }
};

export function calculateWaitedOnTime (messageQueue, startedTime) {
  let waitedOnTime = 0;

  const now = Ntp._now();

  if (messageQueue)
    messageQueue.toArray().forEach(function (msg) {
      if (msg._waitEventId) {
        waitedOnTime += now - msg._waitEventId.at;
        if (msg._waitEventId.at < startedTime) {
          waitedOnTime -= startedTime - msg._waitEventId.at;
        }
      }
    });

  return waitedOnTime;
}

export function waitForPackage(name, fn) {
  if (Package[name]) {
    fn(Package[name]);
  } else {
    Package._promise(name)
      .catch(() => { /* it rejects if the package is not used */ })
      .finally(() => {
        if (Package[name]) {
          fn(Package[name]);
        }
      });
  }
}
