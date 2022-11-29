import { PubsubModel } from '../../lib/models/pubsub';
import { addTestWithRoundedTime } from '../_helpers/helpers';

addTestWithRoundedTime(
  'Models - PubSub - Metrics - same date',
  function (test) {
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
  function (test) {
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
  function (test) {
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
  function (test) {
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
  function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let model = new PubsubModel();
    var metrics = model._getMetrics(d1, pub);
    metrics.resTime = 3000;
    metrics.subs = 3;
    var metrics = [
      model.buildPayload(),
      model.metricsByMinute
    ];
    test.equal(metrics[0].pubMetrics[0].pubs.postsList.resTime, 1000);
    test.equal(metrics[1], {});
  }
);

addTestWithRoundedTime(
  'Models - PubSub - BuildPayload - lifetime',
  function (test) {
    let pub = 'postsList';
    let d1 = new Date('2013 Dec 10 20:31:12').getTime();
    let model = new PubsubModel();
    var metrics = model._getMetrics(d1, pub);
    metrics.lifeTime = 4000;
    metrics.unsubs = 2;
    var metrics = [
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
  function (test) {
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
  function (test) {
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
  function (test) {
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
  function (test) {
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
  function (test) {
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
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 3);
    h1.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - docs added',
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    TestData.insert({data: 'data4'});
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 4);
    h1.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - docs removed',
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    TestData.remove({data: 'data3'});
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 2);
    h1.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - unsub before payload',
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    h1.stop();
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 0);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Single Sub - close before payload',
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    CloseClient(client);
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 0);
    h1.stop();
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Multiple Subs - simple',
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    let h2 = SubscribeAndWait(client, 'tinytest-data');
    let h3 = SubscribeAndWait(client, 'tinytest-data');
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 9);
    h1.stop();
    h2.stop();
    h3.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - ActiveDocs - Multiple Subs - sub and unsub',
  function (test) {
    CleanTestData();
    let docs = [{data: 'data1'}, {data: 'data2'}, {data: 'data3'}];
    docs.forEach(function (doc) { TestData.insert(doc); });
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    let h2 = SubscribeAndWait(client, 'tinytest-data');
    let h3 = SubscribeAndWait(client, 'tinytest-data');
    h1.stop();
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].activeDocs, 6);
    h2.stop();
    h3.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - simple',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    Wait(200);
    var payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].createdObservers, 1);
    test.equal(payload[0].pubs['tinytest-data'].deletedObservers, 0);
    h1.stop();
    Wait(200);
    var payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].deletedObservers, 1);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - polledDocuments with oplog',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].polledDocuments, 2);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - oplogInsertedDocuments with oplog',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    Wait(50);
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(100);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].oplogInsertedDocuments, 2);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - oplogDeletedDocuments with oplog',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(50);
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    Wait(200);
    TestData.remove({});
    Wait(100);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].oplogDeletedDocuments, 2);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - oplogUpdatedDocuments with oplog',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    let h1 = SubscribeAndWait(client, 'tinytest-data');
    Wait(200);
    TestData.update({}, {$set: {kk: 20}}, {multi: true});
    Wait(100);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data'].oplogUpdatedDocuments, 2);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - polledDocuments with no oplog',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    let h1 = SubscribeAndWait(client, 'tinytest-data-with-no-oplog');
    Wait(200);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-with-no-oplog'].polledDocuments, 2);
    h1.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - initiallyAddedDocuments',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    // This will create two observers
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(50);
    let h1 = SubscribeAndWait(client, 'tinytest-data-random');
    let h2 = SubscribeAndWait(client, 'tinytest-data-random');
    Wait(100);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].initiallyAddedDocuments, 4);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveAddedDocuments',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    // This will create two observers
    let h1 = SubscribeAndWait(client, 'tinytest-data-random');
    let h2 = SubscribeAndWait(client, 'tinytest-data-random');
    Wait(50);
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(100);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].liveAddedDocuments, 4);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveChangedDocuments',
  function (test) {
    CleanTestData();

    let client = GetMeteorClient();

    // This will create two observers
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});

    Wait(50);

    let h1 = SubscribeAndWait(client, 'tinytest-data-random');
    let h2 = SubscribeAndWait(client, 'tinytest-data-random');

    Wait(100);

    TestData.update({}, {$set: {kk: 20}}, {multi: true});

    Wait(50);

    let payload = GetPubSubPayload();

    if (!payload[0].pubs['tinytest-data-random']) {
      console.log(JSON.stringify(payload, null, 2));
    }

    test.equal(payload[0].pubs['tinytest-data-random'].liveChangedDocuments, 4);

    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveRemovedDocuments',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    // This will create two observers
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    let h1 = SubscribeAndWait(client, 'tinytest-data-random');
    let h2 = SubscribeAndWait(client, 'tinytest-data-random');
    Wait(100);
    TestData.remove({});
    Wait(50);
    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].liveRemovedDocuments, 4);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - initiallySentMsgSize',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(50);
    let h1 = SubscribeAndWait(client, 'tinytest-data-random');
    Wait(100);
    let payload = GetPubSubPayload();

    let templateMsg = '{"msg":"added","collection":"tinytest-data","id":"17digitslongidxxx","fields":{"aa":10}}';
    let expectedMsgSize = templateMsg.length * 2;

    test.equal(payload[0].pubs['tinytest-data-random'].initiallySentMsgSize, expectedMsgSize);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveSentMsgSize',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    let h1 = SubscribeAndWait(client, 'tinytest-data-random');
    Wait(50);
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(100);
    let payload = GetPubSubPayload();

    let templateMsg = '{"msg":"added","collection":"tinytest-data","id":"17digitslongidxxx","fields":{"aa":10}}';
    let expectedMsgSize = templateMsg.length * 2;

    test.equal(payload[0].pubs['tinytest-data-random'].liveSentMsgSize, expectedMsgSize);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - initiallyFetchedDocSize',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(100);

    WithDocCacheGetSize(function () {
      let h1 = SubscribeAndWait(client, 'tinytest-data-random');
      Wait(200);
    }, 30);

    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].initiallyFetchedDocSize, 60);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - liveFetchedDocSize',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();

    WithDocCacheGetSize(function () {
      let h1 = SubscribeAndWait(client, 'tinytest-data-random');
      Wait(100);
      TestData.insert({aa: 10});
      TestData.insert({aa: 20});
      Wait(200);
    }, 25);

    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-random'].liveFetchedDocSize, 50);
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - fetchedDocSize',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});

    let h1;
    WithDocCacheGetSize(function () {
      h1 = SubscribeAndWait(client, 'tinytest-data-cursor-fetch');
      Wait(200);
    }, 30);

    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-cursor-fetch'].fetchedDocSize, 60);
    h1.stop();
    CloseClient(client);
  }
);

addTestWithRoundedTime(
  'Models - PubSub - Observers - polledDocSize',
  function (test) {
    CleanTestData();
    let client = GetMeteorClient();
    TestData.insert({aa: 10});
    TestData.insert({aa: 20});
    Wait(100);

    let h1;
    WithDocCacheGetSize(function () {
      h1 = SubscribeAndWait(client, 'tinytest-data-with-no-oplog');
      Wait(200);
    }, 30);

    let payload = GetPubSubPayload();
    test.equal(payload[0].pubs['tinytest-data-with-no-oplog'].polledDocSize, 60);
    h1.stop();
    CloseClient(client);
  }
);
