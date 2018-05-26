function removePrefix (name) {
  if (name.indexOf('KADIRA_') === 0) {
    return name.slice('KADIRA_'.length);
  } else if (name.indexOf('MONTI_') === 0) {
    return name.slice('MONTI_'.length);
  }

  return name;
}

Kadira._parseEnv = function (env) {
  var options = {};
  for(var name in env) {
    var unprefixedName = removePrefix(name);
    var info = Kadira._parseEnv._options[unprefixedName];
    var value = env[name];

    if(info && value) {
      options[info.name] = info.parser(value);
    }
  }

  return options;
};


Kadira._parseEnv.parseInt = function (str) {
  var num = parseInt(str);
  if(num || num === 0) return num;
  throw new Error('Kadira: Match Error: "'+num+'" is not a number');
};


Kadira._parseEnv.parseBool = function (str) {
  str = str.toLowerCase();
  if(str === 'true') return true;
  if(str === 'false') return false;
  throw new Error('Kadira: Match Error: '+str+' is not a boolean');
};


Kadira._parseEnv.parseUrl = function (str) {
  return str;
};


Kadira._parseEnv.parseString = function (str) {
  return str;
};


Kadira._parseEnv._options = {
  // auth
  APP_ID: {
    name: 'appId',
    parser: Kadira._parseEnv.parseString
  },
  APP_SECRET: {
    name: 'appSecret',
    parser: Kadira._parseEnv.parseString
  },
  // delay to send the initial ping to the kadira engine after page loads
  OPTIONS_CLIENT_ENGINE_SYNC_DELAY: {
    name: 'clientEngineSyncDelay',
    parser: Kadira._parseEnv.parseInt,
  },
  // time between sending errors to the engine
  OPTIONS_ERROR_DUMP_INTERVAL: {
    name: 'errorDumpInterval',
    parser: Kadira._parseEnv.parseInt,
  },
  // no of errors allowed in a given interval
  OPTIONS_MAX_ERRORS_PER_INTERVAL: {
    name: 'maxErrorsPerInterval',
    parser: Kadira._parseEnv.parseInt,
  },
  // a zone.js specific option to collect the full stack trace(which is not much useful)
  OPTIONS_COLLECT_ALL_STACKS: {
    name: 'collectAllStacks',
    parser: Kadira._parseEnv.parseBool,
  },
  // enable error tracking (which is turned on by default)
  OPTIONS_ENABLE_ERROR_TRACKING: {
    name: 'enableErrorTracking',
    parser: Kadira._parseEnv.parseBool,
  },
  // kadira engine endpoint
  OPTIONS_ENDPOINT: {
    name: 'endpoint',
    parser: Kadira._parseEnv.parseUrl,
  },
  // define the hostname of the current running process
  OPTIONS_HOSTNAME: {
    name: 'hostname',
    parser: Kadira._parseEnv.parseString,
  },
  // interval between sending data to the kadira engine from the server
  OPTIONS_PAYLOAD_TIMEOUT: {
    name: 'payloadTimeout',
    parser: Kadira._parseEnv.parseInt,
  },
  // set HTTP/HTTPS proxy
  OPTIONS_PROXY: {
    name: 'proxy',
    parser: Kadira._parseEnv.parseUrl,
  },
  // number of items cached for tracking document size
  OPTIONS_DOCUMENT_SIZE_CACHE_SIZE: {
    name: 'documentSizeCacheSize',
    parser: Kadira._parseEnv.parseInt,
  },
};
