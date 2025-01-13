import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { DDP } from 'meteor/ddp';
import { MethodStore, TestData } from './globals';
import { EJSON } from 'meteor/ejson';
import { EventType } from '../../lib/constants';
import { cleanTrailingNilValues, cloneDeep, isPlainObject, last, sleep } from '../../lib/utils';
import { isNumber } from '../../lib/common/utils';
import { diffObjects } from './pretty-log';
import util from 'util';

const _client = DDP.connect(Meteor.absoluteUrl(), {retry: false});

export const callAsync = async (method, ...args) => _client.callAsync(method, ...args);
export const clientCallAsync = async (client, method, ...args) => client.callAsync(method, ...args);

export const getMeteorClient = function (_url) {
  const url = _url || Meteor.absoluteUrl();
  return DDP.connect(url, {retry: false, });
};

export const waitForConnection = async function (client) {
  let timeout = Date.now() + 1000;
  while (Date.now() < timeout) {
    let status = client.status();
    if (status.connected) {
      return;
    }

    await sleep(50);
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

export const registerMethod = RegisterMethod;

export const registerPublication = function (func) {
  const id = `test_${Random.id()}`;
  Meteor.publish(id, func);
  return id;
};

export const EnableTrackingMethods = function () {
  // var original = Kadira.models.methods.processMethod;
  // Kadira.models.methods.processMethod = function(method) {
  //   MethodStore.push(method);
  //   original.call(Kadira.models.methods, method);
  // };
};

export const getLastMethodTrace = () => {
  if (MethodStore.length < 1) {
    return [];
  }
  return MethodStore[MethodStore.length - 1];
};


export const getMethodEvents = () => last(MethodStore).events;

export function getLastMethodEvents (indices = [0], keysToPreserve = []) {
  if (MethodStore.length < 1) {
    return [];
  }

  let events = last(MethodStore).events;

  events = Array.prototype.slice.call(events, 0);
  events = events.filter(isNotCompute).filter(isNotEmptyAsync);
  events = events.map(filterFields);

  return events;

  function isNotCompute (event) {
    return event[0] !== EventType.Compute;
  }

  function isNotEmptyAsync (event) {
    return event[0] !== EventType.Async || event[3]?.nested?.length > 0;
  }

  function clean (_data) {
    if (isNumber(_data)) {
      return 0;
    }

    if (!isPlainObject(_data)) {
      return _data;
    }

    const data = cloneDeep(_data);

    const rejectedKeys = [
      'stack'
    ];

    for ( const [key, value] of Object.entries(data)) {
      if (rejectedKeys.includes(key)) {
        delete data[key];
        continue;
      }

      if (key === 'nested' && value?.length) {
        data[key] = value.filter(isNotCompute).filter(isNotEmptyAsync).map(filterFields);
      }

      if (key === 'err' && value?.startsWith('E11000')) {
        data[key] = 'E11000';
      }

      // In tests, we can't use numbers like timestamps,
      // but it is still useful to know if a number is positive or negative
      // i.e. when an interval subtraction when awry
      if (isNumber(value) && !keysToPreserve.includes(key)) {
        if (value > 0) {
          data[key] = 1;
        } else if (value < 0) {
          data[key] = -1;
        } else {
          data[key] = 0;
        }
      }
    }

    return data;
  }

  function filterFields (event) {
    let filteredEvent = indices.map((index) => clean(event[index]));
    cleanTrailingNilValues(filteredEvent);

    return filteredEvent;
  }
}

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
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

export const CleanTestData = async function () {
  MethodStore.length = 0;
  await TestData.removeAsync({});
  Kadira.models.pubsub.metricsByMinute = {};
  Kadira.models.pubsub.subscriptions = {};
  Kadira.models.jobs.jobMetricsByMinute = {};
  Kadira.models.jobs.activeJobCounts.clear();
};

export const cleanTestData = CleanTestData;

export const subscribeAndWait = function (client, name, args) {
  return new Promise((resolve, reject) => {
    let sub = null;

    args = Array.prototype.splice.call(arguments, 1);

    args.push({
      onError (err) {
        reject(err);
      },
      onReady () {
        resolve(sub);
      }
    });

    sub = client.subscribe(...args);
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

export const closeClient = function (client) {
  return new Promise((resolve) => {
    let sessionId = client._lastSessionId;

    Object.entries(client._subscriptions).forEach(([, sub]) => {
      sub?.stop();
    });

    client.disconnect();

    function checkClientExistence (_sessionId) {
      let sessionExists;
      if (Meteor.server.sessions instanceof Map) {
        // Meteor 1.8.1 and newer
        sessionExists = Meteor.server.sessions.has(_sessionId);
      } else {
        sessionExists = Meteor.server.sessions[_sessionId];
      }

      if (sessionExists) {
        setTimeout(function () {
          checkClientExistence(_sessionId);
        }, 20);
      } else {
        resolve();
      }
    }

    checkClientExistence(sessionId);
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

// Meteor.release is none when running from checkout
let release = Meteor.release === 'none' ? 'METEOR@2.5.0' : Meteor.release;
export const releaseParts = release.split('METEOR@')[1].split('.').map(num => parseInt(num, 10));


const asyncTest = fn => async (test, done) => {
  await cleanTestData();

  const client = getMeteorClient();

  test.stableEqual = (a, b) => {
    const _a = EJSON.parse(EJSON.stringify(a));
    const _b = EJSON.parse(EJSON.stringify(b));

    if (!util.isDeepStrictEqual(_a, _b)) {
      dumpEvents(a);

      diffObjects(a, b);
    }

    test.equal(_a, _b);
  };

  // Cleans stuff from the test engine.
  Kadira._setInfo(null);

  await fn(test, client);

  await closeClient(client);

  await cleanTestData();

  done();
};

export const withRoundedTime = (fn) => async (test, done) => {
  const date = new Date();
  date.setSeconds(0,0);
  const timestamp = date.getTime();

  const old = Date.now;

  Date.now = () => timestamp;

  await asyncTest(fn)(test, () => {});

  Date.now = old;

  done();
};

export function addTestWithRoundedTime (name, fn) {
  Tinytest.addAsync(name, withRoundedTime(fn));
}

addTestWithRoundedTime.only = function (name, fn) {
  Tinytest.onlyAsync(name, withRoundedTime(fn));
};

addTestWithRoundedTime.skip = function () {};

export function addAsyncTest (name, fn) {
  Tinytest.addAsync(name, asyncTest(fn));
}

addAsyncTest.only = function (name, fn) {
  Tinytest.onlyAsync(name, asyncTest(fn));
};

addAsyncTest.skip = function () {};

export function cleanTrace (trace) {
  delete trace.rootAsyncId;

  cleanEvents(trace.events);
}

export function cleanEvents (events) {
  events?.forEach(function (event) {
    if (event.endAt > event.at) {
      event.endAt = 10;
    } else if (event.endAt) {
      delete event.endAt;
    }

    delete event.at;
    delete event._id;
    delete event.asyncId;
    delete event.triggerAsyncId;
    delete event.level;
    delete event.duration;

    if (event.nested?.length === 0) {
      delete event.nested;
    } else {
      cleanEvents(event.nested);
    }
  });
}

export function cleanBuiltEvents (events, roundTo = 10) {
  return events
    .filter(event => event[0] !== 'compute' || event[1] > 5)
    .map(event => {
      let [, duration, , details] = event;
      if (typeof duration === 'number') {
        // round down to nearest 10
        event[1] = Math.floor(duration / roundTo) * roundTo;
      }

      if (details) {
        delete details.at;
        delete details.endAt;
        if (details.nested) {
          details.nested = cleanBuiltEvents(details.nested, roundTo);
        }

        // We only care about the properties that survive being stringified
        // (are not undefined)
        event[3] = JSON.parse(JSON.stringify(details));
        if (event[3].offset) {
          // round down to nearest 10
          event[3].offset = Math.floor(event[3].offset / roundTo) * roundTo;
        }
      }

      return event;
    });
}

export const dumpEvents = (events) => {
  console.log(JSON.stringify(events));
};

export function deepFreeze (obj) {
  if (Array.isArray(obj)) {
    obj.forEach(val => {
      if (!Object.isFrozen(val)) {
        deepFreeze(val);
      }
    });
  } else {
    Object.values(obj).forEach(val => {
      if (!Object.isFrozen(val)) {
        deepFreeze(val);
      }
    });
  }

  Object.freeze(obj);
}

addTestWithRoundedTime.only = (name, fn) => {
  Tinytest.only(name, withRoundedTime(fn), true);
};

export const isRedisOplogEnabled = !!process.env.REDIS_OPLOG_SETTINGS;

export const TestHelpers = {
  methodStore: MethodStore,
  getLatestEventsFromMethodStore: () => MethodStore[MethodStore.length - 1].events,
  getMeteorClient,
  registerMethod: RegisterMethod,
  registerPublication,
  enableTrackingMethods: EnableTrackingMethods,
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
