const { DDSketch } = require('monti-apm-sketches-js');

HaveAsyncCallback = function(args) {
  var lastArg = args[args.length -1];
  return (typeof lastArg) == 'function';
};

UniqueId = function(start) {
  this.id = 0;
}

UniqueId.prototype.get = function() {
  return "" + this.id++;
};

DefaultUniqueId = new UniqueId();

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

// Optimized version of apply which tries to call as possible as it can
// Then fall back to apply
// This is because, v8 is very slow to invoke apply.
OptimizedApply = function OptimizedApply(context, fn, args) {
  var a = args;
  switch(a.length) {
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

getClientVersions = function () {
  return {
    'web.cordova': getClientArchVersion('web.cordova'),
    'web.browser': getClientArchVersion('web.browser'),
    'web.browser.legacy': getClientArchVersion('web.browser.legacy')
  }
}

// Returns number of keys of an object, or size of a Map or Set
countKeys = function (obj) {
  if (obj instanceof Map || obj instanceof Set) {
    return obj.size;
  }

  return Object.keys(obj).length;
}

// Iterates objects and maps.
// Callback is called with a value and key
iterate = function (obj, callback) {
  if (obj instanceof Map) {
    return obj.forEach(callback);
  }

  for (var key in obj) {
    var value = obj[key];
    callback(value, key);
  }
}

// Returns a property from an object, or an entry from a map
getProperty = function (obj, key) {
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
