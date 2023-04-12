import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import {
  addAsyncTest,
  FindMetricsForPub,
  getMeteorClient,
  GetPubSubMetrics,
  getPubSubPayload,
  RegisterPublication,
  subscribeAndWait,
  TestHelpers,
  Wait
} from '../_helpers/helpers';
import { sleep } from '../../lib/utils';

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

    Meteor.publish(pubName, function () {
      Wait(200);
      this.ready();
    });

    let h1 = await subscribeAndWait(client, pubName);

    let metrics = FindMetricsForPub(pubName);

    test.isTrue(TestHelpers.compareNear(metrics.resTime, 200, 100));

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
    let h1 = subscribeAndWait(client, 'tinytest-data');

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

/**
 * @flaky
 */
addAsyncTest(
  'Subscriptions - ObserverLifetime - sub',
  async function (test, client) {
    let st = Date.now();
    let h1 = await subscribeAndWait(client, 'tinytest-data');
    let elapsedTime = Date.now() - st;

    await sleep(100);

    Kadira.EventBus.once('pubsub', 'observerDeleted', (ownerInfo) => console.log('on sub stop:', JSON.stringify(ownerInfo)));

    st = Date.now();
    h1.stop();
    elapsedTime += Date.now() - st;

    await sleep(100);

    let metrics = TestHelpers.findMetricsForPub('tinytest-data');

    console.log({elapsedTime});
    test.isTrue(TestHelpers.compareNear(metrics.observerLifetime, 100 + elapsedTime, 60));
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

    let pubId = RegisterPublication(function () {
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
