function normalizedPrefix (name) {
  return name.replace('KADIRA_', 'MONTI_');
}

Kadira._parseEnv = function (env) {
  let options = {};
  for (let name in env) {
    let value = env[name];
    let normalizedName = normalizedPrefix(name);
    let info = Kadira._parseEnv._options[normalizedName];

    if (info && value) {
      options[info.name] = info.parser(value);
    }
  }

  return options;
};


Kadira._parseEnv.parseInt = function (str) {
  let num = parseInt(str, 10);
  if (num || num === 0) { return num; }
  throw new Error(`Kadira: Match Error: "${num}" is not a number`);
};


Kadira._parseEnv.parseBool = function (str) {
  str = str.toLowerCase();
  if (str === 'true') { return true; }
  if (str === 'false') { return false; }
  throw new Error(`Kadira: Match Error: ${str} is not a boolean`);
};


Kadira._parseEnv.parseUrl = function (str) {
  return str;
};


Kadira._parseEnv.parseString = function (str) {
  return str;
};


Kadira._parseEnv._options = {
  // auth
  MONTI_APP_ID: {
    name: 'appId',
    parser: Kadira._parseEnv.parseString
  },
  MONTI_APP_SECRET: {
    name: 'appSecret',
    parser: Kadira._parseEnv.parseString
  },
  MONTI_OPTIONS_STALLED_TIMEOUT: {
    name: 'stalledTimeout',
    parser: Kadira._parseEnv.parseInt,
  },
  // delay to send the initial ping to the kadira engine after page loads
  MONTI_OPTIONS_CLIENT_ENGINE_SYNC_DELAY: {
    name: 'clientEngineSyncDelay',
    parser: Kadira._parseEnv.parseInt,
  },
  // time between sending errors to the engine
  MONTI_OPTIONS_ERROR_DUMP_INTERVAL: {
    name: 'errorDumpInterval',
    parser: Kadira._parseEnv.parseInt,
  },
  // no of errors allowed in a given interval
  MONTI_OPTIONS_MAX_ERRORS_PER_INTERVAL: {
    name: 'maxErrorsPerInterval',
    parser: Kadira._parseEnv.parseInt,
  },
  // a zone.js specific option to collect the full stack trace(which is not much useful)
  MONTI_OPTIONS_COLLECT_ALL_STACKS: {
    name: 'collectAllStacks',
    parser: Kadira._parseEnv.parseBool,
  },
  // enable error tracking (which is turned on by default)
  MONTI_OPTIONS_ENABLE_ERROR_TRACKING: {
    name: 'enableErrorTracking',
    parser: Kadira._parseEnv.parseBool,
  },
  // kadira engine endpoint
  MONTI_OPTIONS_ENDPOINT: {
    name: 'endpoint',
    parser: Kadira._parseEnv.parseUrl,
  },
  // define the hostname of the current running process
  MONTI_OPTIONS_HOSTNAME: {
    name: 'hostname',
    parser: Kadira._parseEnv.parseString,
  },
  // interval between sending data to the kadira engine from the server
  MONTI_OPTIONS_PAYLOAD_TIMEOUT: {
    name: 'payloadTimeout',
    parser: Kadira._parseEnv.parseInt,
  },
  // set HTTP/HTTPS proxy
  MONTI_OPTIONS_PROXY: {
    name: 'proxy',
    parser: Kadira._parseEnv.parseUrl,
  },
  // number of items cached for tracking document size
  MONTI_OPTIONS_DOCUMENT_SIZE_CACHE_SIZE: {
    name: 'documentSizeCacheSize',
    parser: Kadira._parseEnv.parseInt,
  },
  // enable uploading sourcemaps
  MONTI_UPLOAD_SOURCE_MAPS: {
    name: 'uploadSourceMaps',
    parser: Kadira._parseEnv.parseBool
  },
  MONTI_RECORD_IP_ADDRESS: {
    name: 'recordIPAddress',
    parser: Kadira._parseEnv.parseString,
  },
  MONTI_EVENT_STACK_TRACE: {
    name: 'eventStackTrace',
    parser: Kadira._parseEnv.parseBool,
  },
  MONTI_OPTIONS_DISABLE_NTP: {
    name: 'disableNtp',
    parser: Kadira._parseEnv.parseBool,
  }
};
