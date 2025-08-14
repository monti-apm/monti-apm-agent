import { PubsubModel } from '../../lib/models/pubsub';
import { Ntp } from '../../lib/ntp';
import { sleep } from '../../lib/utils';
import {
  addAsyncTest,
  addTestWithRoundedTime,
  cleanTestData,
  CleanTestData,
  closeClient,
  FindMetricsForPub,
  getMeteorClient,
  getPubSubPayload,
  registerMethod,
  releaseParts,
  subscribeAndWait,
  subscribePromise,
  waitForConnection,
  withDocCacheGetSize,
} from '../_helpers/helpers';
import { TestData } from '../_helpers/globals';

addTestWithRoundedTime(
  'Models - PubSub - Metrics - same date',
  async function (test) {
    let pub = 'postsList';
    let d = new Date('2013 Dec 10 20:30').getTime();
    let model = new PubsubModel();
    model._getMetrics(d, pub).subs++;
    model._getMetrics(d, pub).subs++;
    let metrics = model._getMetrics(d, pub);
    test.equal(metrics.subs, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Metrics - multi date',
  async function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let d2 = new Date('2013 Dec 11 20:31:10').getTime();
    let model = new PubsubModel();
    model._getMetrics(d1, pub).subs++;
    model._getMetrics(d1, pub).subs++;
    model._getMetrics(d2, pub).subs++;
    let metrics = [
      model._getMetrics(d1, pub),
      model._getMetrics(d2, pub)
    ];
    test.equal(metrics[0].subs, 2);
    test.equal(metrics[1].subs, 1);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Metrics - same minute',
  function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let d2 = new Date('2013 Dec 10 20:31:40').getTime();
    let model = new PubsubModel();
    model._getMetrics(d1, pub).subs++;
    model._getMetrics(d1, pub).subs++;
    model._getMetrics(d2, pub).subs++;
    let metrics = [
      model._getMetrics(d1, pub),
      model._getMetrics(d2, pub)
    ];
    test.equal(metrics[0].subs, 3);
    test.equal(metrics[1].subs, 3);
    test.equal(metrics[0], metrics[1]);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - subs',
  async function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let model = new PubsubModel();
    model._getMetrics(d1, pub).subs++;
    model._getMetrics(d1, pub).subs++;
    model._getMetrics(d1, pub).subs++;
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.subs, 3);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - routes',
  async function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let route = 'route1';
    let model = new PubsubModel();
    model._getMetrics(d1, pub).subRoutes = {};
    model._getMetrics(d1, pub).subRoutes[route] = 0;
    model._getMetrics(d1, pub).subRoutes[route]++;
    model._getMetrics(d1, pub).subRoutes[route]++;
    model._getMetrics(d1, pub).subRoutes[route]++;
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.subRoutes['route1'], 3);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - response time',
  async function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let model = new PubsubModel();
    let metrics = model._getMetrics(d1, pub);
    metrics.resTime = 3000;
    metrics.subs = 3;
    metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.resTime, 1000);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - lifetime',
  async function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let model = new PubsubModel();
    let metrics = model._getMetrics(d1, pub);
    metrics.lifeTime = 4000;
    metrics.unsubs = 2;
    metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.lifeTime, 2000);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - multiple publications',
  function (test) {
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let model = new PubsubModel();
    model._getMetrics(d1, 'postsList').subs = 2;
    model._getMetrics(d1, 'singlePost').subs++;
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.subs, 2);
    test.equal(metrics[0].pubMetrics[0].pubs.singlePost.subs, 1);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - multiple dates',
  async function (test) {
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let d2 = new Date('2013 Dec 11 20:31:12').getTime();
    let model = new PubsubModel();
    model._getMetrics(d1, 'postsList').subs = 2;
    model._getMetrics(d2, 'postsList').subs++;
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.subs, 2);
    test.equal(metrics[0].pubMetrics[1].pubs.postsList.subs, 1);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - multiple subscriptions and dates',
  async function (test) {
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let d2 = new Date('2013 Dec 11 20:31:12').getTime();
    let model = new PubsubModel();
    model._getMetrics(d1, 'postsList').subs = 2;
    model._getMetrics(d2, 'singlePost').subs++;
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.subs, 2);
    test.equal(metrics[0].pubMetrics[1].pubs.singlePost.subs, 1);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observer Cache - no cache',
  async function (test) {
    let original = Kadira.syncedDate.getTime;
    let dates = [
      new Date('2013 Dec 10 20:31:12').getTime(),
      new Date('2013 Dec 10 20:31:22').getTime()
    ];
    Kadira.syncedDate.getTime = function () {
      return dates.pop();
    };
    let model = new PubsubModel();
    model.incrementHandleCount({name: 'postsList'}, false);
    model.incrementHandleCount({name: 'postsList'}, false);
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.totalObservers, 2);
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.cachedObservers, 0);
    Kadira.syncedDate.getTime = original;
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observer Cache - single cache',
  async function (test) {
    let original = Kadira.syncedDate.getTime;
    let dates = [
      new Date('2013 Dec 10 20:31:12').getTime(),
      new Date('2013 Dec 10 20:31:22').getTime()
    ];
    Kadira.syncedDate.getTime = function () {
      return dates.pop();
    };
    let model = new PubsubModel();
    model.incrementHandleCount({name: 'postsList'}, false);
    model.incrementHandleCount({name: 'postsList'}, true);
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.totalObservers, 2);
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.cachedObservers, 1);
    Kadira.syncedDate.getTime = original;
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observer Cache - multiple dates',
  async function (test) {
    let original = Date.now;
    let dates = [
      new Date('2013 Dec 10 20:31:12').getTime(),
      new Date('2013 Dec 12 20:31:22').getTime()
    ];
    Date.now = function () {
      return dates.pop();
    };
    let model = new PubsubModel();
    model.incrementHandleCount({name: 'postsList'}, false);
    model.incrementHandleCount({name: 'postsList'}, true);
    let metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.totalObservers, 1);
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.cachedObservers, 0);
    test.equal(metrics[0].pubMetrics[1].pubs.postsList.totalObservers, 1);
    test.equal(metrics[0].pubMetrics[1].pubs.postsList.cachedObservers, 1);
    Date.now = original;
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - simple',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    await subscribeAndWait(client, 'tinytest-data');

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 3);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - docs added',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    await subscribeAndWait(client, 'tinytest-data');

    await TestData.insertAsync({data: 'data4'});

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 4);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - docs removed',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    await subscribeAndWait(client, 'tinytest-data');

    await TestData.removeAsync({data: 'data3'});

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - unsub before payload',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    const sub = await subscribeAndWait(client, 'tinytest-data');

    sub.stop();

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 0);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - close before payload',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    const sub = await subscribeAndWait(client, 'tinytest-data');
    sub.stop();

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 0);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Multiple Subs - simple',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    await subscribeAndWait(client, 'tinytest-data');
    await subscribeAndWait(client, 'tinytest-data');
    await subscribeAndWait(client, 'tinytest-data');

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 9);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Multiple Subs - sub and unsub',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    let h1 = await subscribeAndWait(client, 'tinytest-data');
    await subscribeAndWait(client, 'tinytest-data');
    await subscribeAndWait(client, 'tinytest-data');

    // Stop early
    h1.stop();

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 6);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - simple',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].createdObservers, 1);
    test.equal(payload[0].pubs['tinytest-data'].deletedObservers, 0);

    h1.stop();

    await sleep(200);

    payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].deletedObservers, 1);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - polledDocuments with oplog',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await subscribeAndWait(client, 'tinytest-data');

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].polledDocuments, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - oplogInsertedDocuments with oplog',
  async function (test, client) {
    await subscribeAndWait(client, 'tinytest-data');

    await sleep(50);

    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(100);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].oplogInsertedDocuments, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - oplogDeletedDocuments with oplog',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(50);

    await subscribeAndWait(client, 'tinytest-data');

    await sleep(200);

    await TestData.removeAsync({});

    await sleep(100);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].oplogDeletedDocuments, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - oplogUpdatedDocuments with oplog',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await subscribeAndWait(client, 'tinytest-data');

    await sleep(200);

    await TestData.updateAsync({}, {$set: {kk: 20}}, {multi: true});

    await sleep(100);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].oplogUpdatedDocuments, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - polledDocuments with no oplog',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await subscribeAndWait(client, 'tinytest-data-with-no-oplog');

    await sleep(200);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data-with-no-oplog'].polledDocuments, 2);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - initiallyAddedDocuments',
  async function (test, client) {
    // This will create two observers
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(50);

    await subscribeAndWait(client, 'tinytest-data-random');
    await subscribeAndWait(client, 'tinytest-data-random');

    await sleep(100);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data-random'].initiallyAddedDocuments, 4);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveAddedDocuments',
  async function (test, client) {
    // This will create two observers
    await subscribeAndWait(client, 'tinytest-data-random');
    await subscribeAndWait(client, 'tinytest-data-random');

    await sleep(50);

    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(100);

    let payload = getPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].liveAddedDocuments, 4);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveChangedDocuments',
  async function (test, client) {
    // This will create two observers
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(50);

    await subscribeAndWait(client, 'tinytest-data-random');
    await subscribeAndWait(client, 'tinytest-data-random');

    await sleep(100);

    await TestData.updateAsync({}, {$set: {kk: 20}}, {multi: true});

    await sleep(50);

    let payload = getPubSubPayload();

    if (!payload[0].pubs['tinytest-data-random']) {
      console.log(JSON.stringify(payload, null, 2));
    }

    test.equal(payload[0].pubs['tinytest-data-random'].liveChangedDocuments, 4);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveRemovedDocuments',
  async function (test, client) {
    // This will create two observers
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await subscribeAndWait(client, 'tinytest-data-random');
    await subscribeAndWait(client, 'tinytest-data-random');

    await sleep(100);
    await TestData.removeAsync({});
    await sleep(50);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data-random'].liveRemovedDocuments, 4);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - initiallySentMsgSize',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(50);
    await subscribeAndWait(client, 'tinytest-data-random');

    await sleep(100);

    let payload = getPubSubPayload();

    let templateMsg = '{"msg":"added","collection":"tinytest-data","id":"17digitslongidxxx","fields":{"aa":10}}';
    let expectedMsgSize = templateMsg.length * 2;

    test.equal(payload[0].pubs['tinytest-data-random'].initiallySentMsgSize, expectedMsgSize);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveSentMsgSize',
  async function (test, client) {
    await subscribeAndWait(client, 'tinytest-data-random');

    await sleep(50);

    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(100);

    let payload = getPubSubPayload();

    let templateMsg = '{"msg":"added","collection":"tinytest-data","id":"17digitslongidxxx","fields":{"aa":10}}';
    let expectedMsgSize = templateMsg.length * 2;

    test.equal(payload[0].pubs['tinytest-data-random'].liveSentMsgSize, expectedMsgSize);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - initiallyFetchedDocSize',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});
    await sleep(100);

    await withDocCacheGetSize(async function () {
      await subscribeAndWait(client, 'tinytest-data-random');
      await sleep(200);
    }, 30);

    let payload = getPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].initiallyFetchedDocSize, 60);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveFetchedDocSize',
  async function (test, client) {
    await withDocCacheGetSize(async function () {
      await subscribeAndWait(client, 'tinytest-data-random');
      await sleep(100);
      await TestData.insertAsync({aa: 10});
      await TestData.insertAsync({aa: 20});
      await sleep(200);
    }, 25);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data-random'].liveFetchedDocSize, 50);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - fetchedDocSize',
  async function (test, client) {
    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});
    await withDocCacheGetSize(async function () {
      await subscribeAndWait(client, 'tinytest-data-cursor-fetch');
      await sleep(200);
    }, 30);
    let payload = getPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-cursor-fetch'].fetchedDocSize, 60);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - polledDocSize',
  async function (test, client) {
    await cleanTestData();

    await TestData.insertAsync({aa: 10});
    await TestData.insertAsync({aa: 20});

    await sleep(100);

    await withDocCacheGetSize(async function () {
      await subscribeAndWait(client, 'tinytest-data-with-no-oplog');
      await sleep(200);
    }, 30);

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data-with-no-oplog'].polledDocSize, 60);
    closeClient(client);
  }
);


addAsyncTest('Models - PubSub - Wait Time - track wait time', async (test, client) => {
  CleanTestData();

  await TestData.insertAsync({aa: 10});
  await TestData.insertAsync({aa: 20});

  await waitForConnection(client);

  let slowMethod = registerMethod(async function () {
    await sleep(50);
  });

  client.call(slowMethod, () => {});

  const pubName = 'tinytest-waited-on';
  await subscribeAndWait(client, pubName);

  await sleep(100);

  const metrics = FindMetricsForPub(pubName);

  test.isTrue(metrics.waitTime > 0, `${metrics.waitTime} should be greater than 0`);
  closeClient(client);
});

addAsyncTest('Models - PubSub - Waited On - track wait time of queued messages', async (test, client) => {
  CleanTestData();

  await TestData.insertAsync({aa: 10});
  await TestData.insertAsync({aa: 20});

  await waitForConnection(client);

  const pubName = 'tinytest-waited-on-short';

  let promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(subscribePromise(client, pubName));
  }

  await Promise.all(promises);

  const metrics = FindMetricsForPub(pubName);

  test.isTrue(metrics.waitedOn > 150, `${metrics.waitedOn} should be greater than 150`);
  closeClient(client);
});

Meteor.publish('tinytest-unblock-fast', function () {
  console.log('unblock-fast-pub');
  this.unblock();
  Meteor._sleepForMs(100);
  this.ready();
});

Tinytest.addAsync('Models - PubSub - Waited On - track waitedOn without wait time', async (test, done) => {
  await CleanTestData();

  let slowMethod = registerMethod(async function () {
    console.log('slow method start');
    await sleep(100);
    console.log('slow method end');
  });
  let fastMethod = registerMethod(function async () {
    console.log('fastMethod');
  });


  let client = getMeteorClient();

  // subscriptions and method calls made before connected are not run in order
  await waitForConnection(client);

  const pubName = 'tinytest-unblock-fast';
  client.call(slowMethod, () => {});
  client.subscribe(pubName);
  await new Promise(r => client.call(fastMethod, () => r()));

  const metrics = FindMetricsForPub(pubName);

  test.isTrue(metrics.waitedOn < 10 && metrics.waitedOn >= 0, `${metrics.waitedOn} should be less than 10`);
  closeClient(client);

  done();
});

Tinytest.addAsync('Models - PubSub - Waited On - track waited on time of next message', async (test) => {
  CleanTestData();
  let fastMethod = registerMethod(function () {
    console.log('fastMethod');
  });
  let client = getMeteorClient();

  // If we subscribe and call before connected
  // Meteor sends the messages in the wrong order
  await waitForConnection(client);

  client.subscribe('tinytest-waited-on');
  await client.callAsync(fastMethod);

  const metrics = FindMetricsForPub('tinytest-waited-on');

  if (metrics.waitedOn === 0) {
    console.dir(metrics);
  }

  test.isTrue(metrics.waitedOn > 10, `${metrics.waitedOn} should be greater than 10`);
  closeClient(client);
});

addAsyncTest('Models - PubSub - Waited On - track wait when unblock', async (test, client) => {
  CleanTestData();
  let fastMethod = registerMethod(function () {
    console.log('fastMethod');
  });


  // If we subscribe and call before connected
  // Meteor sends the messages in the wrong order
  await waitForConnection(client);

  client.subscribe('tinytest-waited-on2');
  client.call(fastMethod);

  await sleep(200);
  const metrics = Kadira.models.pubsub._getMetrics(Ntp._now(), 'tinytest-waited-on2');

  test.isTrue(metrics.waitedOn > 5, `${metrics.waitedOn} should be greater than 5`);

  // this.unblock is provided on Meteor >= 2.3, so we expect bigger delays below this version
  if (releaseParts[0] > 2 || (releaseParts[0] === 2 && releaseParts[1] >= 3)) {
    test.isTrue(metrics.waitedOn <= 12, 'waitedOn should be less or equal than 12');
  } else {
    test.isTrue(metrics.waitedOn <= 150, 'waitedOn should be less or equal than 150');
  }

  closeClient(client);
});
