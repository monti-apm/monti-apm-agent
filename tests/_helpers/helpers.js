import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { DDP } from 'meteor/ddp';
import { MethodStore, TestData } from './globals';

const Future = Npm.require('fibers/future');

export const GetMeteorClient = function (_url) {
  const url = _url || Meteor.absoluteUrl();
  return DDP.connect(url, {retry: false, });
};

export const waitForConnection = function (client) {
  let timeout = Date.now() + 1000;
  while (Date.now() < timeout) {
    let status = client.status();
    if (status.connected) {
      return;
    }

    Meteor._sleepForMs(50);
  }

  throw new Error('timed out waiting for connection');
};

export const RegisterMethod = function (F) {
  const id = `test_${Random.id()}`;
  let methods = {};
  methods[id] = F;
  Meteor.methods(methods);
  return id;
};

export const RegisterPublication = function (F) {
  let id = `test_${Random.id()}`;
  Meteor.publish(id, F);
  return id;
};

export const EnableTrackingMethods = function () {
  // var original = Kadira.models.methods.processMethod;
  // Kadira.models.methods.processMethod = function(method) {
  //   MethodStore.push(method);
  //   original.call(Kadira.models.methods, method);
  // };
};

export const GetLastMethodEvents = function (_indices, ignore = []) {
  if (MethodStore.length < 1) {
    return [];
  }
  let indices = _indices || [0];
  let events = MethodStore[MethodStore.length - 1].events;
  events = Array.prototype.slice.call(events, 0);
  events = events.filter(isNotCompute);
  events = events.map(filterFields);
  return events;

  function isNotCompute (event) {
    return event[0] !== 'compute' && !ignore.includes(event[0]);
  }

  function filterFields (event) {
    let filteredEvent = [];
    indices.forEach(function (index) {
      if (event[index]) {
        filteredEvent[index] = event[index];
      }
    });
    return filteredEvent;
  }
};

export const GetPubSubMetrics = function () {
  let metricsArr = [];
  // eslint-disable-next-line guard-for-in
  for (let dateId in Kadira.models.pubsub.metricsByMinute) {
    metricsArr.push(Kadira.models.pubsub.metricsByMinute[dateId]);
  }
  return metricsArr;
};

export const FindMetricsForPub = function (pubname) {
  let metrics = GetPubSubMetrics();
  let candidates = [];
  for (let lc = 0; lc < metrics.length; lc++) {
    let pm = metrics[lc].pubs[pubname];
    if (pm) {
      candidates.push(pm);
    }
  }

  return candidates[candidates.length - 1];
};

export const GetPubSubPayload = function (detailInfoNeeded) {
  return Kadira.models.pubsub.buildMetricsPayload(detailInfoNeeded);
};

export function findMetricsForMethod (name) {
  let metrics = Object.values(Kadira.models.methods.methodMetricsByMinute);

  let candidates = [];

  metrics.forEach(metric => {
    if (metric.methods[name]) {
      candidates.push(metric.methods[name]);
    }
  });

  return candidates[candidates.length - 1];
}

export const Wait = function (time) {
  let f = new Future();
  Meteor.setTimeout(function () {
    f.return();
  }, time);
  f.wait();
};

export const CleanTestData = function () {
  MethodStore.length = 0;
  TestData.remove({});
  Kadira.models.pubsub.metricsByMinute = {};
  Kadira.models.pubsub.subscriptions = {};
  Kadira.models.jobs.jobMetricsByMinute = {};
  Kadira.models.jobs.activeJobCounts.clear();
};

export const SubscribeAndWait = function (client, name, args) {
  let f = new Future();
  args = Array.prototype.splice.call(arguments, 1);
  args.push({
    onError (err) {
      f.return(err);
    },
    onReady () {
      f.return();
    }
  });

  // eslint-disable-next-line prefer-spread
  let handler = client.subscribe.apply(client, args);
  let error = f.wait();

  if (error) {
    throw error;
  } else {
    return handler;
  }
};

export const callPromise = function (client, ...args) {
  return new Promise((resolve, reject) => {
    client.call(...args, (err, result) => {
      if (err) {
        return reject(err);
      }

      resolve(result);
    });
  });
};

export const subscribePromise = function (client, ...args) {
  return new Promise((resolve, reject) => {
    client.subscribe(...args, {
      onError (err) {
        reject(err);
      },
      onReady () {
        resolve();
      }
    });
  });
};

export function compareNear (v1, v2, maxDifference) {
  maxDifference = maxDifference || 30;
  let diff = Math.abs(v1 - v2);

  const isNear = diff < maxDifference;

  if (!isNear) {
    console.log(`Expected ${v1} to be near ${v2}, with a max difference of ${maxDifference}`);
  }

  return isNear;
}

export const CloseClient = function (client) {
  let sessionId = client._lastSessionId;
  client.disconnect();
  let f = new Future();
  function checkClientExtence (_sessionId) {
    let sessionExists;
    if (Meteor.server.sessions instanceof Map) {
      // Meteor 1.8.1 and newer
      sessionExists = Meteor.server.sessions.has(_sessionId);
    } else {
      sessionExists = Meteor.server.sessions[_sessionId];
    }

    if (sessionExists) {
      setTimeout(function () {
        checkClientExtence(_sessionId);
      }, 20);
    } else {
      f.return();
    }
  }
  checkClientExtence(sessionId);
  return f.wait();
};

export const WithDocCacheGetSize = function (fn, patchedSize) {
  let original = Kadira.docSzCache.getSize;

  Kadira.docSzCache.getSize = function () {
    return patchedSize;
  };

  try {
    fn();
  } finally {
    Kadira.docSzCache.getSize = original;
  }
};

// Meteor.release is none when running from checkout
let release = Meteor.release === 'none' ? 'METEOR@2.5.0' : Meteor.release;
export const releaseParts = release.split('METEOR@')[1].split('.').map(num => parseInt(num, 10));

export const withRoundedTime = (fn) => (test) => {
  const date = new Date();
  date.setSeconds(0,0);
  const timestamp = date.getTime();

  const old = Date.now;

  Date.now = () => timestamp;

  fn(test);

  Date.now = old;
};

export function addTestWithRoundedTime (name, fn) {
  Tinytest.add(name, withRoundedTime(fn));
}

addTestWithRoundedTime.only = (name, fn) => {
  Tinytest.only(name, withRoundedTime(fn), true);
};

export const isRedisOplogEnabled = !!process.env.REDIS_OPLOG_SETTINGS;

export const TestHelpers = {
  methodStore: MethodStore,
  getLatestEventsFromMethodStore: () => MethodStore[MethodStore.length - 1].events,
  getMeteorClient: GetMeteorClient,
  registerMethod: RegisterMethod,
  registerPublication: RegisterPublication,
  enableTrackingMethods: EnableTrackingMethods,
  getLastMethodEvents: GetLastMethodEvents,
  getPubSubMetrics: GetPubSubMetrics,
  findMetricsForPub: FindMetricsForPub,
  getPubSubPayload: GetPubSubPayload,
  wait: Wait,
  cleanTestData: CleanTestData,
  subscribeAndWait: SubscribeAndWait,
  compareNear,
  closeClient: CloseClient,
  withDocCacheGetSize: WithDocCacheGetSize,
  withRoundedTime,
  addTestWithRoundedTime,
};
