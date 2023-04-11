import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { DDP } from 'meteor/ddp';
import { MethodStore, TestData } from './globals';

const _client = DDP.connect(Meteor.absoluteUrl(), {retry: false});

export const callAsync = async (method, ...args) => _client.call(method, ...args).stubValuePromise;

export const getMeteorClient = function (_url) {
  const url = _url || Meteor.absoluteUrl();
  return DDP.connect(url, {retry: false});
};

export const RegisterMethod = function (F) {
  const id = `test_${Random.id()}`;
  let methods = {};
  methods[id] = F;
  Meteor.methods(methods);
  return id;
};

export const registerMethod = RegisterMethod;

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

export const GetLastMethodEvents = function (_indices) {
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
    return event[0] !== 'compute';
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

export const getLastMethodEvents = GetLastMethodEvents;

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

export const getPubSubPayload = function (detailInfoNeeded) {
  return Kadira.models.pubsub.buildPayload(detailInfoNeeded).pubMetrics;
};

export const Wait = function (time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

export const CleanTestData = async function () {
  MethodStore.length = 0;
  await TestData.removeAsync({});
  Kadira.models.pubsub.metricsByMinute = {};
  Kadira.models.pubsub.subscriptions = {};
};

export const cleanTestData = CleanTestData;

export const subscribeAndWait = function (client, name, args) {
  return new Promise((resolve, reject) => {
    args = Array.prototype.splice.call(arguments, 1);

    args.push({
      onError (err) {
        reject(err);
      },
      onReady () {
        resolve();
      }
    });

    client.subscribe(...args);
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

export const closeClient = function (client) {
  return new Promise((resolve) => {
    let sessionId = client._lastSessionId;
    client.disconnect();

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
        resolve();
      }
    }

    checkClientExtence(sessionId);
  });
};

export const withDocCacheGetSize = async function (fn, patchedSize) {
  let original = Kadira.docSzCache.getSize;

  Kadira.docSzCache.getSize = function () {
    return patchedSize;
  };

  try {
    await fn();
  } finally {
    Kadira.docSzCache.getSize = original;
  }
};

const releaseVer = Meteor.release.split('METEOR@')[1];

export const releaseParts = releaseVer && releaseVer.split('.').map(num => parseInt(num, 10)) || [0, 0, 0];

export const withRoundedTime = (fn) => async (test, done) => {
  const date = new Date();
  date.setSeconds(0,0);
  const timestamp = date.getTime();

  const old = Date.now;

  Date.now = () => timestamp;

  const client = getMeteorClient();

  await fn(test, client);

  await closeClient(client);

  Date.now = old;

  await cleanTestData();

  done();
};

export function addTestWithRoundedTime (name, fn) {
  Tinytest.addAsync(name, withRoundedTime(fn));
}

const asyncTest = fn => async (test, done) => {
  await fn(test);

  await cleanTestData();

  done();
};

export function addAsyncTest (name, fn) {
  Tinytest.addAsync(name, asyncTest(fn));
}

addAsyncTest.only = function (name, fn) {
  Tinytest.onlyAsync(name, asyncTest(fn));
};

export const TestHelpers = {
  methodStore: MethodStore,
  getLatestEventsFromMethodStore: () => MethodStore[MethodStore.length - 1].events,
  getMeteorClient,
  registerMethod: RegisterMethod,
  registerPublication: RegisterPublication,
  enableTrackingMethods: EnableTrackingMethods,
  getLastMethodEvents: GetLastMethodEvents,
  getPubSubMetrics: GetPubSubMetrics,
  findMetricsForPub: FindMetricsForPub,
  getPubSubPayload,
  wait: Wait,
  cleanTestData: CleanTestData,
  subscribeAndWait,
  compareNear,
  closeClient,
  withRoundedTime,
  addTestWithRoundedTime,
};


