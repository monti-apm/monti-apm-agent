/* eslint-disable no-console */
/* global MontiProfiler */

import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { _ } from 'meteor/underscore';
import { ErrorModel } from './models/errors';
import { HttpModel } from './models/http';
import { MethodsModel } from './models/methods';
import { PubsubModel } from './models/pubsub';
import { SystemModel } from './models/system';
import packageMap from './.meteor-package-versions';
import { getErrorParameters } from './common/utils';
import { WaitTimeBuilder } from './wait_time_builder';
import { DocSzCache } from './docsize_cache';
import { Ntp } from './ntp';
import { getClientVersions } from './utils';
import { handleApiResponse } from './sourcemaps';
import { TrackMeteorDebug, TrackUncaughtExceptions, TrackUnhandledRejections } from './hijack/error';
import { queueJob } from './jobs';
import { jobLogger, JobsModel } from './models/jobs';
import TraceAggregator from './tracer/trace_aggregator';

const hostname = Npm.require('os').hostname();
const logger = Npm.require('debug')('kadira:apm');
const Fibers = Npm.require('fibers');
const { CoreEvent, Kadira: KadiraCore, Feature } = Npm.require('monti-apm-core');

const DEBUG_PAYLOAD_SIZE = process.env.MONTI_DEBUG_PAYLOAD_SIZE === 'true';

// The Meteor versions with Node 4 did not support promise.finally
const WEBSOCKETS_SUPPORTED = parseInt(process.versions.node.split('.')[0], 10) > 4;

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
Kadira.models.jobs = new JobsModel();
Kadira.docSzCache = new DocSzCache(100000, 10);
Kadira.syncedDate = new Ntp();

Kadira._traceAggregator = new TraceAggregator();

Kadira._traceAggregator.registerModel(Kadira.models.methods, 'methodRequests');
Kadira._traceAggregator.registerModel(Kadira.models.pubsub, 'pubRequests');
Kadira._traceAggregator.registerModel(Kadira.models.http, 'httpRequests');
Kadira._traceAggregator.registerModel(Kadira.models.jobs, 'jobRequests');

// If the agent is not connected, we still want to build the payload occasionally
// since building the payload does some cleanup to prevent memory leaks
// Once connected, this interval is cleared
let buildInterval = Meteor.setInterval(() => {
  Kadira._buildPayload();
}, 1000 * 60);


Kadira.connect = function (appId, appSecret, options) {
  if (Kadira.connected) {
    console.log('Monti APM: Already Connected');
    return;
  }

  options = options || {};
  options.appId = appId;
  options.appSecret = appSecret;
  options.payloadTimeout = options.payloadTimeout || 1000 * 20;
  options.endpoint = options.endpoint || 'https://engine.montiapm.com';
  options.clientEngineSyncDelay = options.clientEngineSyncDelay || 10000;
  options.thresholds = options.thresholds || {};
  options.isHostNameSet = !!options.hostname;
  options.hostname = options.hostname || hostname;
  options.proxy = options.proxy || null;
  options.recordIPAddress = options.recordIPAddress || 'full';
  options.eventStackTrace = options.eventStackTrace || false;
  options.stalledTimeout = options.stalledTimeout || 1000 * 60 * 30;
  options.disableClientErrorTracking = options.disableClientErrorTracking || false;

  if (options.documentSizeCacheSize) {
    Kadira.docSzCache = new DocSzCache(options.documentSizeCacheSize, 10);
  }

  // remove trailing slash from endpoint url (if any)
  if (_.last(options.endpoint) === '/') {
    options.endpoint = options.endpoint.substr(0, options.endpoint.length - 1);
  }

  // error tracking is enabled by default
  if (options.enableErrorTracking === undefined) {
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

    Kadira.coreApi._headers['METEOR-RELEASE'] = Meteor.release.replace('METEOR@', '');

    Kadira.coreApi._checkAuth()
      .then(function () {
        logger('connected to app: ', appId);
        console.log('Monti APM: Connected');
        Kadira._sendAppStats();
        Kadira._schedulePayloadSend();

        if (
          WEBSOCKETS_SUPPORTED &&
          Kadira.coreApi.featureSupported(Feature.WEBSOCKETS)
        ) {
          logger('websockets supported');
          Kadira.coreApi._initWebSocket();

          Kadira.coreApi.on(CoreEvent.JOB_CREATED, Meteor.bindEnvironment(job => {
            queueJob(job);
          }));
        } else {
          logger('websockets not supported');
        }
      })
      .catch(function (err) {
        if (err.message === 'Unauthorized') {
          console.log('Monti APM: Authentication failed, check your "appId" & "appSecret"');
        } else {
          console.log(`Monti APM: Unable to connect. ${err.message}`);
        }
      });
  } else {
    throw new Error('Monti APM: required appId and appSecret');
  }

  Kadira.syncedDate = new Ntp(options);
  Kadira.syncedDate.sync();
  Kadira.models.error = new ErrorModel(appId);

  // handle pre-added filters
  let addFilterFn = Kadira.models.error.addFilter.bind(Kadira.models.error);
  Kadira.errors.forEach(addFilterFn);
  Kadira.errors = Kadira.models.error;

  // setting runtime info, which will be sent to kadira
  __meteor_runtime_config__.kadira = {
    appId,
    endpoint: options.endpoint,
    clientEngineSyncDelay: options.clientEngineSyncDelay,
    recordIPAddress: options.recordIPAddress,
    disableNtp: options.disableNtp,
    disableClientErrorTracking: options.disableClientErrorTracking,
  };

  if (options.enableErrorTracking) {
    Kadira.enableErrorTracking();
  } else {
    Kadira.disableErrorTracking();
  }

  // start tracking errors
  Meteor.startup(function () {
    TrackUncaughtExceptions();
    TrackUnhandledRejections();
    TrackMeteorDebug();
  });

  Meteor.publish(null, function () {
    let _options = __meteor_runtime_config__.kadira;
    this.added('kadira_settings', Random.id(), _options);
    this.ready();
  });

  // notify we've connected
  Kadira.connected = true;
};

// track how many times we've sent the data (once per minute)
Kadira._buildPayload = function () {
  let payload = { host: Kadira.options.hostname, clientVersions: getClientVersions() };

  _.extend(payload, Kadira.models.methods.buildPayload());
  _.extend(payload, Kadira.models.pubsub.buildPayload());
  _.extend(payload, Kadira.models.system.buildPayload());
  _.extend(payload, Kadira.models.jobs.buildPayload());
  _.extend(payload, Kadira.models.http.buildPayload());

  if (!Kadira.coreApi.featureSupported(Feature.JSON_LINE_TRACES)) {
    logger('sending normal trace payload');
    _.extend(payload, Kadira._traceAggregator.buildPayload());
  }

  if (Kadira.options.enableErrorTracking) {
    _.extend(payload, Kadira.models.error.buildPayload());
  }

  return payload;
};

Kadira._sendAppStats = function () {
  let appStats = {};
  appStats.release = Meteor.release;
  appStats.protocolVersion = '1.0.0';
  appStats.packageVersions = [];
  appStats.clientVersions = getClientVersions();

  _.each(Package, function (v, name) {
    appStats.packageVersions.push({
      name,
      version: packageMap[name] || null
    });
  });

  Kadira.coreApi.sendData({
    startTime: new Date(),
    appStats
  }).then(function (body) {
    handleApiResponse(body);
  }).catch(function (err) {
    console.error('Monti APM Error on sending appStats:', err.message);
  });
};

Kadira._schedulePayloadSend = function () {
  clearInterval(buildInterval);

  setTimeout(function () {
    Kadira._schedulePayloadSend();
    Kadira._sendPayload();
  }, Kadira.options.payloadTimeout);
};

function logPayload (payload) {
  let largestTrace = {
    size: 0,
    content: ''
  };

  // eslint-disable-next-line no-inner-declarations
  function countBreakdowns (breakdowns, field) {
    let result = 0;
    breakdowns.forEach(entry => {
      result += Object.keys(entry[field]).length;
    });

    return result;
  }

  // eslint-disable-next-line no-inner-declarations
  function sizeTraces (traces) {
    let histogram = Object.create(null);
    let total = 0;
    traces.forEach(trace => {
      const stringified = JSON.stringify(trace);
      let length = stringified.length;
      total += length;

      if (length > largestTrace.size) {
        largestTrace = { size: length, content: stringified };
      }

      let normalized = length - (length % 500);
      histogram[normalized] = histogram[normalized] || 0;
      histogram[normalized] += 1;
    });

    histogram.total = total;

    let histogramResult = Object.entries(histogram).map(([k, v]) => `${k}: ${v}`).join(', ');
    return `C: ${traces.length}; ${histogramResult}`;
  }

  console.log('------- APM Payload Metrics -------');
  console.log(`methods: ${countBreakdowns(payload.methodMetrics, 'methods')}`);
  console.log(`pubs: ${countBreakdowns(payload.pubMetrics, 'pubs')}`);
  console.log(`routes: ${countBreakdowns(payload.httpMetrics, 'routes')}`);
  console.log(`errors: ${payload.errors.length}`);
  console.log('Method trace sizes:', sizeTraces(payload.methodRequests || []));
  console.log('Pub trace sizes:', sizeTraces(payload.pubRequests || []));
  console.log('HTTP trace sizes:', sizeTraces(payload.httpRequests || []));
  console.log('Error trace sizes:', sizeTraces(payload.errors));
  console.log('Largest trace:', largestTrace);
  console.log('------- ------------------- -------');
}

Kadira._sendPayload = function () {
  new Fibers(function () {
    let payload = Kadira._buildPayload();

    if (DEBUG_PAYLOAD_SIZE) {
      logPayload(payload);
    }

    function logErr (err) {
      console.log('Monti APM Error:', 'while sending payload to Monti APM:', err.message);
    }

    Kadira.coreApi.sendData(payload)
      .then(body => {
        handleApiResponse(body);
      })
      .catch(logErr);

    if (Kadira.coreApi.featureSupported(Feature.JSON_LINE_TRACES)) {
      logger('sending separate trace payload');
      let tracePayload = Kadira._traceAggregator.collectTraces();
      Kadira.coreApi.sendTraces(tracePayload).catch(logErr);
    }
  }).run();
};

// this return the __kadiraInfo from the current Fiber by default
// if called with 2nd argument as true, it will get the kadira info from
// Meteor.EnvironmentVariable
//
// WARNNING: returned info object is the reference object.
//  Changing it might cause issues when building traces. So use with care
Kadira._getInfo = function (currentFiber, useEnvironmentVariable) {
  currentFiber = currentFiber || Fibers.current;
  if (currentFiber) {
    if (useEnvironmentVariable) {
      return Kadira.env.kadiraInfo.get();
    }
    return currentFiber.__kadiraInfo;
  }
};

// this does not clone the info object. So, use with care
Kadira._setInfo = function (info) {
  Fibers.current.__kadiraInfo = info;
};

Kadira.startContinuousProfiling = function () {
  MontiProfiler.startContinuous(function onProfile ({ profile, startTime, endTime }) {
    if (!Kadira.connected) {
      return;
    }

    Kadira.coreApi.sendData({ profiles: [{ profile, startTime, endTime }] })
      .catch(e => console.log('Monti: err sending cpu profile', e));
  });
};

/**
 * @warning Mutating the `__meteor_runtime_config__` object does not propagate in real-time to the client, only if the
 * version changes and the client refreshes it seems. In the future we might want to change that into a reactive approach.
 */

Kadira.enableErrorTracking = function () {
  __meteor_runtime_config__.kadira.enableErrorTracking = true;
  Kadira.options.enableErrorTracking = true;
};

Kadira.disableErrorTracking = function () {
  __meteor_runtime_config__.kadira.enableErrorTracking = false;
  Kadira.options.enableErrorTracking = false;
};

Kadira.disableClientErrorTracking = function () {
  __meteor_runtime_config__.kadira.disableClientErrorTracking = Kadira.options.disableClientErrorTracking = true;
};

Kadira.enableClientErrorTracking = function () {
  __meteor_runtime_config__.kadira.disableClientErrorTracking = Kadira.options.disableClientErrorTracking = false;
};

Kadira.trackError = function () {
  if (!Kadira.options.enableErrorTracking) {
    return;
  }

  const {
    message,
    subType,
    stack,
    type,
    kadiraInfo = Kadira._getInfo(),
  } = getErrorParameters(arguments);

  const now = Ntp._now();

  const previousEvents =
    kadiraInfo && kadiraInfo.trace ?
      kadiraInfo.trace.events :
      [{ type: 'start', at: now, endAt: now }];

  const events = Kadira.tracer
    .optimizeEvents(previousEvents)
    .concat([['error', 0, { error: { message, stack } }]]);

  if (message) {
    let trace = {
      type: type || 'server-internal',
      subType: subType || 'server',
      name: message,
      errored: true,
      at: Kadira.syncedDate.getTime(),
      events,
      metrics: { total: 0 },
    };

    Kadira.models.error.trackError({ message, stack }, trace);
  }
};

Kadira.ignoreErrorTracking = function (err) {
  err._skipKadira = true;
};

Kadira.startEvent = function (name, data = {}) {
  let kadiraInfo = Kadira._getInfo();
  if (kadiraInfo) {
    return Kadira.tracer.event(kadiraInfo.trace, 'custom', data, { name });
  }

  return false;
};

Kadira.event = function (name, data, fn) {
  if (typeof data === 'function') {
    fn = data;
    data = undefined;
  }

  let info = Kadira._getInfo();

  if (typeof name !== 'string') {
    throw new Error('Monti APM: Monti.event requires an event name');
  }

  if (typeof fn !== 'function') {
    throw new Error('Monti APM: Monti.event requires a function');
  }

  if (info) {
    const event = Kadira.tracer.event(info.trace, 'custom', data, { name });

    try {
      let result = fn();
      return result;
    } finally {
      Kadira.tracer.eventEnd(info.trace, event);
    }
  }

  return fn();
};

Kadira.endEvent = function (event, data) {
  let kadiraInfo = Kadira._getInfo();

  // The event could be false if it could not be started.
  // Handle it here instead of requiring the app to.
  if (kadiraInfo && event) {
    Kadira.tracer.eventEnd(kadiraInfo.trace, event, data);
  }
};

Kadira.traceJob = function (details, processor) {
  let info = Kadira._getInfo();

  if (info || !details) {
    if (info) {
      jobLogger('traceJob - skipping: has info');
    } else {
      jobLogger('traceJob - skipping: no details');
    }

    return processor.apply(this, arguments);
  }

  if (!Fibers.current) {
    jobLogger('traceJob - wrapping in fiber');
    return Fibers(function () {
      return Kadira.traceJob(details, processor);
    }).run();
  }

  let wait = details.waitTime || 0;

  let data = details.data;
  if (typeof data === 'object' && data !== null) {
    data = Kadira.tracer._applyObjectFilters(data);
  }

  let stringifiedParams = JSON.stringify(data);

  let trace = Kadira.tracer.start(details.name, 'job');

  let startData = {
    waitTime: wait,
    data: stringifiedParams
  };

  if (details._attributes) {
    Object.assign(startData, details._attributes);
  }

  jobLogger(`traceJob - starting ${details.name}`);

  Kadira.tracer.event(trace, 'start', startData);

  Kadira._setInfo({ trace });
  Kadira.models.jobs.trackActiveJobs(details.name, 1);

  let ended = false;
  function end (err) {
    if (ended) {
      throw new Error('Monti APM: Job ended more than once');
    }

    ended = true;
    jobLogger(`traceJob - ended ${details.name} - errored: ${!!err}`);

    Kadira.tracer.endLastEvent(trace);

    let cleanError;

    if (err) {
      cleanError = _.pick(err, ['message', 'stack', 'details']);
      Kadira.tracer.event(trace, 'error', { error: cleanError });
    } else {
      Kadira.tracer.event(trace, 'complete');
    }

    let built = Kadira.tracer.buildTrace(trace);
    Kadira.models.jobs.processJob(built, wait);
    Kadira.models.jobs.trackActiveJobs(details.name, -1);

    if (cleanError && Kadira.options.enableErrorTracking) {
      Kadira.models.error.trackError(cleanError, trace);
    }
  }

  let result;
  try {
    result = processor.apply(this, arguments);

    if (result && typeof result.then === 'function') {
      result.then(() => end(), err => end(err));
    } else {
      end();
    }
  } catch (err) {
    end(err);
    throw err;
  } finally {
    // Synchronously reset info so outside code doesn't see it.
    // It'll still be set in any child fibers if the processor uses promises
    Kadira._setInfo(null);
  }

  return result;
};

Kadira.recordNewJob = function (jobName) {
  Kadira.models.jobs.trackNewJob(jobName);
};

Kadira.recordPendingJobs = function (jobName, count) {
  Kadira.models.jobs.trackPendingJobs(jobName, count);
};
