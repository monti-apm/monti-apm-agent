/* global Kadira */
import { Meteor } from 'meteor/meteor';
import { DDP } from 'meteor/ddp';
import { Random } from 'meteor/random';
import Future from 'fibers/future';

GetMeteorClient = function (_url) {
  const url = _url || Meteor.absoluteUrl();
  return DDP.connect(url, {retry: false});
};

RegisterMethod = function (F) {
  const id = `test_${Random.id()}`;
  const methods = {};
  methods[id] = F;
  Meteor.methods(methods);
  return id;
};

RegisterPublication = function (F) {
  const id = `test_${Random.id()}`;
  Meteor.publish(id, F);
  return id;
};

EnableTrackingMethods = function () {
  // var original = Kadira.models.methods.processMethod;
  // Kadira.models.methods.processMethod = function(method) {
  //   MethodStore.push(method);
  //   original.call(Kadira.models.methods, method);
  // };
};

GetLastMethodEvents = function (_indices) {
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
      if (event[index]) { filteredEvent[index] = event[index]; }
    });
    return filteredEvent;
  }
};

GetPubSubMetrics = function () {
  let metricsArr = [];
  for (let dateId in Kadira.models.pubsub.metricsByMinute) {
    metricsArr.push(Kadira.models.pubsub.metricsByMinute[dateId]);
  }
  return metricsArr;
};

FindMetricsForPub = function (pubname) {
  const metrics = GetPubSubMetrics();
  const candidates = [];
  for (let lc = 0; lc < metrics.length; lc++) {
    const pm = metrics[lc].pubs[pubname];
    if (pm) {
      candidates.push(pm);
    }
  }

  return candidates[candidates.length - 1];
};

GetPubSubPayload = function (detailInfoNeeded) {
  return Kadira.models.pubsub.buildPayload(detailInfoNeeded).pubMetrics;
};

export function Wait (time) {
  const f = new Future();
  Meteor.setTimeout(function () {
    f.return();
  }, time);
  f.wait();
}

CleanTestData = function () {
  MethodStore = [];
  TestData.remove({});
  Kadira.models.pubsub.metricsByMinute;
  Kadira.models.pubsub.metricsByMinute = {};
  Kadira.models.pubsub.subscriptions = {};
};

SubscribeAndWait = function (client, name, args) {
  let f = new Future();
  var args = Array.prototype.splice.call(arguments, 1);
  args.push({
    onError (err) {
      f.return(err);
    },
    onReady () {
      f.return();
    }
  });

  let handler = client.subscribe.apply(client, args);
  let error = f.wait();

  if (error) {
    throw error;
  } else {
    return handler;
  }
};

CompareNear = function (v1, v2, maxDifference) {
  maxDifference = maxDifference || 30;
  let diff = Math.abs(v1 - v2);
  return diff < maxDifference;
};

CloseClient = function (client) {
  const sessionId = client._lastSessionId;
  client.disconnect();
  let f = new Future();
  function checkClientExtence (sId) {
    const sessions = Meteor.server.sessions;
    let sessionExists;
    if (sessions instanceof Map) {
      // Meteor 1.8.1 and newer
      sessionExists = sessions.has(sId);
    } else {
      sessionExists = sessions[sId];
    }

    if (sessionExists) {
      setTimeout(function () {
        checkClientExtence(sId);
      }, 20);
    } else {
      f.return();
    }
  }
  checkClientExtence(sessionId);
  return f.wait();
};

WithDocCacheGetSize = function (fn, patchedSize) {
  const original = Kadira.docSzCache.getSize;
  Kadira.docSzCache.getSize = function () {
    return patchedSize;
  };
  try {
    fn();
  } finally {
    Kadira.docSzCache.getSize = original;
  }
};

export const releaseParts = Meteor.release.split('METEOR@')[1].split('.').map(num => parseInt(num, 10));
