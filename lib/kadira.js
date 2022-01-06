import HttpModel from "./models/http";
import packageMap from './.meteor-package-versions';
import { getErrorParameters  } from "./common/utils";
import { WaitTimeBuilder } from "./wait_time_builder";

var hostname = Npm.require('os').hostname();
var logger = Npm.require('debug')('kadira:apm');
var Fibers = Npm.require('fibers');

var KadiraCore = Npm.require('monti-apm-core').Kadira;

Kadira.models = {};
Kadira.options = {};
Kadira.env = {
  currentSub: null, // keep current subscription inside ddp
  kadiraInfo: new Meteor.EnvironmentVariable(),
};
Kadira.waitTimeBuilder = new WaitTimeBuilder();
Kadira.errors = [];
Kadira.errors.addFilter = Kadira.errors.push.bind(Kadira.errors);

Kadira.models.methods = new MethodsModel();
Kadira.models.pubsub = new PubsubModel();
Kadira.models.system = new SystemModel();
Kadira.models.http = new HttpModel();
Kadira.docSzCache = new DocSzCache(100000, 10);
Kadira.syncedDate = new Ntp();

// If the agent is not connected, we still want to build the payload occasionally
// since building the payload does some cleanup to prevent memory leaks
// Once connected, this interval is cleared
let buildInterval = Meteor.setInterval(() => {
  Kadira._buildPayload();
}, 1000 * 60);


Kadira.connect = function(appId, appSecret, options) {
  options = options || {};
  options.appId = appId;
  options.appSecret = appSecret;
  options.payloadTimeout = options.payloadTimeout || 1000 * 20;
  options.endpoint = options.endpoint || "https://engine.montiapm.com";
  options.clientEngineSyncDelay = options.clientEngineSyncDelay || 10000;
  options.thresholds = options.thresholds || {};
  options.isHostNameSet = !!options.hostname;
  options.hostname = options.hostname || hostname;
  options.proxy = options.proxy || null;
  options.recordIPAddress = options.recordIPAddress || 'full';
  options.eventStackTrace = options.eventStackTrace || false;

  if(options.documentSizeCacheSize) {
    Kadira.docSzCache = new DocSzCache(options.documentSizeCacheSize, 10);
  }

  // remove trailing slash from endpoint url (if any)
  if(_.last(options.endpoint) === '/') {
    options.endpoint = options.endpoint.substr(0, options.endpoint.length - 1);
  }

  // error tracking is enabled by default
  if(options.enableErrorTracking === undefined) {
    options.enableErrorTracking = true;
  }

  // uploading sourcemaps is enabled by default in production
  if (options.uploadSourceMaps === undefined && Meteor.isProduction) {
    options.uploadSourceMaps = true;
  }

  Kadira.options = options;
  Kadira.options.authHeaders = {
    'KADIRA-APP-ID': Kadira.options.appId,
    'KADIRA-APP-SECRET': Kadira.options.appSecret
  };

  if (appId && appSecret) {
    options.appId = options.appId.trim();
    options.appSecret = options.appSecret.trim();

    Kadira.coreApi = new KadiraCore({
      appId: options.appId,
      appSecret: options.appSecret,
      endpoint: options.endpoint,
      hostname: options.hostname,
      agentVersion: packageMap['montiapm:agent'] || '<unknown>'
    });

    Kadira.coreApi._checkAuth()
      .then(function () {
        logger('connected to app: ', appId);
        console.log('Monti APM: Successfully connected');
        Kadira._sendAppStats();
        Kadira._schedulePayloadSend();
      })
      .catch(function (err) {
        if (err.message === "Unauthorized") {
          console.log('Monti APM: authentication failed - check your appId & appSecret')
        } else {
          console.log('Monti APM: unable to connect. ' + err.message);
        }
      });
  } else {
    throw new Error('Monti APM: required appId and appSecret');
  }

  Kadira.syncedDate = new Ntp(options.endpoint);
  Kadira.syncedDate.sync();
  Kadira.models.error = new ErrorModel(appId);

  // handle pre-added filters
  var addFilterFn = Kadira.models.error.addFilter.bind(Kadira.models.error);
  Kadira.errors.forEach(addFilterFn);
  Kadira.errors = Kadira.models.error;

  // setting runtime info, which will be sent to kadira
  __meteor_runtime_config__.kadira = {
    appId: appId,
    endpoint: options.endpoint,
    clientEngineSyncDelay: options.clientEngineSyncDelay,
    recordIPAddress: options.recordIPAddress,
  };

  if(options.enableErrorTracking) {
    Kadira.enableErrorTracking();
  } else {
    Kadira.disableErrorTracking();
  }

  // start tracking errors
  Meteor.startup(function () {
    TrackUncaughtExceptions();
    TrackUnhandledRejections();
    TrackMeteorDebug();
  })

  Meteor.publish(null, function () {
    var options = __meteor_runtime_config__.kadira;
    this.added('kadira_settings', Random.id(), options);
    this.ready();
  });

  // notify we've connected
  Kadira.connected = true;
};

//track how many times we've sent the data (once per minute)
Kadira._buildPayload = function () {
  var payload = {host: Kadira.options.hostname, clientVersions: getClientVersions()};
  var buildDetailedInfo = Kadira._isDetailedInfo();
  _.extend(payload, Kadira.models.methods.buildPayload(buildDetailedInfo));
  _.extend(payload, Kadira.models.pubsub.buildPayload(buildDetailedInfo));
  _.extend(payload, Kadira.models.system.buildPayload());
  _.extend(payload, Kadira.models.http.buildPayload());

  if(Kadira.options.enableErrorTracking) {
    _.extend(payload, Kadira.models.error.buildPayload());
  }

  return payload;
}

Kadira._countDataSent = 0;
Kadira._detailInfoSentInterval = Math.ceil((1000*60) / Kadira.options.payloadTimeout);
Kadira._isDetailedInfo = function () {
  return (Kadira._countDataSent++ % Kadira._detailInfoSentInterval) == 0;
}

Kadira._sendAppStats = function () {
  var appStats = {};
  appStats.release = Meteor.release;
  appStats.protocolVersion = '1.0.0';
  appStats.packageVersions = [];
  appStats.clientVersions = getClientVersions();

  _.each(Package, function (v, name) {
    appStats.packageVersions.push({
      name: name,
      version: packageMap[name] || null
    });
  });

  Kadira.coreApi.sendData({
    startTime: new Date(),
    appStats: appStats
  }).then(function(body) {
    handleApiResponse(body);
  }).catch(function(err) {
    console.error('Monti APM Error on sending appStats:', err.message);
  });
}

Kadira._schedulePayloadSend = function () {
  clearInterval(buildInterval);

  setTimeout(function () {
    Kadira._schedulePayloadSend();
    Kadira._sendPayload();
  }, Kadira.options.payloadTimeout);
}

Kadira._sendPayload = function () {
  new Fibers(function() {
    var payload = Kadira._buildPayload();
    Kadira.coreApi.sendData(payload)
      .then(function (body) {
        handleApiResponse(body);
      })
    .catch(function(err) {
        console.log('Monti APM Error:', err.message);
      });
  }).run();
}

// this return the __kadiraInfo from the current Fiber by default
// if called with 2nd argument as true, it will get the kadira info from
// Meteor.EnvironmentVariable
//
// WARNNING: returned info object is the reference object.
//  Changing it might cause issues when building traces. So use with care
Kadira._getInfo = function(currentFiber, useEnvironmentVariable) {
  currentFiber = currentFiber || Fibers.current;
  if(currentFiber) {
    if(useEnvironmentVariable) {
      return Kadira.env.kadiraInfo.get();
    }
    return currentFiber.__kadiraInfo;
  }
};

// this does not clone the info object. So, use with care
Kadira._setInfo = function(info) {
  Fibers.current.__kadiraInfo = info;
};

Kadira.startContinuousProfiling = function () {
  MontiProfiler.startContinuous(function onProfile({ profile, startTime, endTime }) {
    if (!Kadira.connected) {
      return;
    }

    Kadira.coreApi.sendData({ profiles: [{profile, startTime, endTime }]})
      .catch(e => console.log('Monti: err sending cpu profile', e));
  });
}

Kadira.enableErrorTracking = function () {
  __meteor_runtime_config__.kadira.enableErrorTracking = true;
  Kadira.options.enableErrorTracking = true;
};

Kadira.disableErrorTracking = function () {
  __meteor_runtime_config__.kadira.enableErrorTracking = false;
  Kadira.options.enableErrorTracking = false;
};

Kadira.trackError = function () {
  if (!Kadira.options.enableErrorTracking) {
    return;
  }

  const { message, subType, stack, type } = getErrorParameters(arguments);

  if (message) {
    var trace = {
      type: type || 'server-internal',
      subType: subType || 'server',
      name: message,
      errored: true,
      at: Kadira.syncedDate.getTime(),
      events: [['start', 0, {}], ['error', 0, { error: { message, stack } }]],
      metrics: { total: 0 }
    };

    Kadira.models.error.trackError({ message, stack }, trace);
  }
}

Kadira.ignoreErrorTracking = function (err) {
  err._skipKadira = true;
}

Kadira.startEvent = function (name, data = {}) {
  var kadiraInfo = Kadira._getInfo();
  if(kadiraInfo) {
    return Kadira.tracer.event(kadiraInfo.trace, 'custom', data, { name });
  }

  return false
}

Kadira.endEvent = function (event, data) {
  var kadiraInfo = Kadira._getInfo();

  // The event could be false if it could not be started.
  // Handle it here instead of requiring the app to.
  if (kadiraInfo && event) {
    Kadira.tracer.eventEnd(kadiraInfo.trace, event, data);
  }
}
