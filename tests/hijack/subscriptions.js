import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import {
  addAsyncTest,
  FindMetricsForPub,
  getMeteorClient,
  GetPubSubMetrics,
  getPubSubPayload,
  registerPublication,
  subscribeAndWait,
  subscribeAndWaitForError,
  TestHelpers,
  waitForConnection,
  waitForPubMetric
} from '../_helpers/helpers';
import { sleep } from '../../lib/utils';

addAsyncTest(
  'Subscriptions - Sub/Unsub - subs for non-existent pubs are cleaned up',
  async function (test, client) {
    await subscribeAndWaitForError(client, 'this-publication-does-not-exist');

    let timeout = Date.now() + 1000;
    let retained;

    retained = Object.values(Kadira.models.pubsub.subscriptions)
      .filter((sub) => sub.publication === 'this-publication-does-not-exist');
    test.equal(retained.length, 0);
  }
);

addAsyncTest(
  'Subscriptions - Sub/Unsub - subscribe only',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let h2 = await subscribeAndWait(client, 'tinytest-data');

    let metrics = GetPubSubMetrics();

    test.equal(metrics.length, 1);
    test.equal(metrics[0].pubs['tinytest-data'].subs, 2);

    h1.stop();
    h2.stop();
  }
);


addAsyncTest(
  'Subscriptions - Sub/Unsub - subscribe and unsubscribe',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let h2 = await subscribeAndWait(client, 'tinytest-data');

    h1.stop();
    h2.stop();

    await sleep(100);

    let metrics = GetPubSubMetrics();

    test.equal(metrics.length, 1);
    test.equal(metrics[0].pubs['tinytest-data'].subs, 2);
    test.equal(metrics[0].pubs['tinytest-data'].unsubs, 2);
  }
);

addAsyncTest(
  'Subscriptions - Response Time - single',
  async function (test, client) {
    let pubName = `pub-${Random.id()}`;

    Meteor.publish(pubName, async function () {
      await sleep(50);
      this.ready();
    });

    let h1 = await subscribeAndWait(client, pubName);

    let metrics = FindMetricsForPub(pubName);

    test.isTrue(TestHelpers.compareNear(metrics.resTime, 50, 20));

    h1.stop();
  }
);

// Tinytest.add(
//   'Subscriptions - Response Time - multiple',
//   function (test) {
//     EnableTrackingMethods();
//     var client = getMeteorClient();
//     var Future = require('fibers/future');
//     var f = new Future();
//     var h1, h2;
//     h1 = client.subscribe('tinytest-data-multi', function() {
//       console.log('+++++++')
//       f.return();
//     });
//     f.wait();
//     var metrics = getPubSubPayload();
//     var resTimeOne = metrics[0].pubs['tinytest-data-multi'].resTime;
//     Wait(700);
//     var H2_SUB;
//     h2 = client.subscribe('tinytest-data-multi');
//     Wait(300);
//     var metrics2 = getPubSubPayload();
//     var resTimeTwo = metrics2[0].pubs['tinytest-data-multi'].resTime;
//     test.isTrue(resTimeTwo == 0);
//     h1.stop();
//     h2.stop();
//     console.log('---------', resTimeTwo);
//     CleanTestData();
//   }
// );

addAsyncTest(
  'Subscriptions - Lifetime - sub',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');

    await sleep(50);

    h1.stop();

    let metrics = FindMetricsForPub('tinytest-data');

    test.isTrue(TestHelpers.compareNear(metrics.lifeTime, 50, 75));
  }
);

// // Tinytest.add(
// //   'Subscriptions - Lifetime - null sub',
// //   function (test) {
// //     // test.fail('no pubs for null(autopublish)');
// //     // EnableTrackingMethods();
// //     // var client = getMeteorClient();
// //     // var Future = require('fibers/future');
// //     // var f = new Future();
// //     // var interval = setInterval(function () {
// //     //   if (client.status().connected) {
// //     //     clearInterval(interval);
// //     //     f.return();
// //     //   };
// //     // }, 50);
// //     // f.wait();
// //     // Wait(600);
// //     // client.disconnect();
// //     // var metrics = GetPubSubMetrics();
// //     // test.equal(metrics[0].pubs['null(autopublish)'].lifeTime > 600, true);
// //     // CleanTestData();
// //   }
// // );

addAsyncTest(
  'Subscriptions - ObserverLifetime - sub',
  async function (test) {
    TestHelpers.cleanTestData();

    TestHelpers.enableTrackingMethods();

    let client = TestHelpers.getMeteorClient();

    await waitForConnection(client);

    let start = Date.now();
    let st = Date.now();
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let elapsedTime = Date.now() - st;
    console.log('elapsed 1', elapsedTime);

    await sleep(100);

    Kadira.EventBus.once('pubsub', 'observerDeleted', (ownerInfo) => console.log('on sub stop:', Date.now(), JSON.stringify(ownerInfo)));

    st = Date.now();
    h1.stop();

    await waitForPubMetric('tinytest-data', 'observerLifetime', 50);
    elapsedTime += Date.now() - st;
    console.log('elapsed 2', Date.now() - st);
    console.log('elapsed total', Date.now() - start);

    let metrics = TestHelpers.findMetricsForPub('tinytest-data');

    test.isTrue(TestHelpers.compareNear(metrics.observerLifetime, 120, 60));
  }
);


addAsyncTest(
  'Subscriptions - active subs',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let h2 = await subscribeAndWait(client, 'tinytest-data');
    let h3 = await subscribeAndWait(client, 'tinytest-data-2');

    let payload = getPubSubPayload();

    test.equal(payload[0].pubs['tinytest-data'].activeSubs === 2, true);
    test.equal(payload[0].pubs['tinytest-data-2'].activeSubs === 1, true);

    h1.stop();
    h2.stop();
    h3.stop();
  }
);

addAsyncTest(
  'Subscriptions - avoiding multiple ready',
  async function (test, client) {
    let ReadyCounts = 0;

    let pubId = registerPublication(function () {
      this.ready();
      this.ready();
    });

    let original = Kadira.models.pubsub._trackReady;

    Kadira.models.pubsub._trackReady = function (session, sub) {
      if (sub._name === pubId) {
        ReadyCounts++;
      }
    };

    await subscribeAndWait(client, pubId);

    test.equal(ReadyCounts, 1);
    Kadira.models.pubsub._trackReady = original;
  }
);

addAsyncTest(
  'Subscriptions - _trackUnsub - redundant deactivation does not double count',
  async function (test, client) {
    let serverSub = null;
    let resolveStopped;
    let stopped = new Promise((resolve) => {
      resolveStopped = resolve;
    });

    let pubId = registerPublication(function () {
      serverSub = this;
      this.onStop(() => resolveStopped());
      this.ready();
    });

    let handle = await subscribeAndWait(client, pubId);

    // Stop the sub to trigger _deactivate
    handle.stop();
    await stopped;

    // Trigger deactivate a second time.
    // Meteor can in rare situations can call it twice
    // The second time should not throw (such as from session being null)
    // and should not count as a second unsub
    let error = null;
    try {
      serverSub._deactivate();
    } catch (e) {
      error = e;
    }

    let metrics = FindMetricsForPub(pubId);

    test.equal(error, null, error && `redundant deactivation threw: ${error.message}`);
    test.equal(metrics.subs, 1);
    test.equal(metrics.unsubs, 1);
  }
);

addAsyncTest(
  'Subscriptions - Observer Cache - single publication and single subscription',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');

    await sleep(100);

    let metrics = getPubSubPayload();

    test.equal(metrics[0].pubs['tinytest-data'].totalObservers, 1);
    test.equal(metrics[0].pubs['tinytest-data'].cachedObservers, 0);
    test.equal(metrics[0].pubs['tinytest-data'].avgObserverReuse, 0);

    h1.stop();
  }
);

addAsyncTest(
  'Subscriptions - Observer Cache - single publication and multiple subscriptions',
  async function (test, client) {
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let h2 = await subscribeAndWait(client, 'tinytest-data');

    await sleep(100);

    let metrics = getPubSubPayload();
    test.equal(metrics[0].pubs['tinytest-data'].totalObservers, 2);
    test.equal(metrics[0].pubs['tinytest-data'].cachedObservers, 1);
    test.equal(metrics[0].pubs['tinytest-data'].avgObserverReuse, 0.5);
    h1.stop();
    h2.stop();
  }
);

addAsyncTest(
  'Subscriptions - Observer Cache - multiple publication and multiple subscriptions',
  async function (test) {
    let client = getMeteorClient();
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let h2 = await subscribeAndWait(client, 'tinytest-data-2');

    await sleep(100);

    let metrics = getPubSubPayload();

    test.equal(metrics[0].pubs['tinytest-data'].totalObservers, 1);
    test.equal(metrics[0].pubs['tinytest-data'].cachedObservers, 0);
    test.equal(metrics[0].pubs['tinytest-data'].avgObserverReuse, 0);

    test.equal(metrics[0].pubs['tinytest-data-2'].totalObservers, 1);
    test.equal(metrics[0].pubs['tinytest-data-2'].cachedObservers, 1);
    test.equal(metrics[0].pubs['tinytest-data-2'].avgObserverReuse, 1);

    h1.stop();
    h2.stop();
  }
);
