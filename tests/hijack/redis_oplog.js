import { TestData } from '../_helpers/globals';
import { GetMeteorClient, RegisterPublication, SubscribeAndWait } from '../_helpers/helpers';

/**
 * We only track the observers coming from subscriptions (which have `ownerInfo`)
 */
Tinytest.add('Database - Redis Oplog - Added', function (test) {
  const pub = RegisterPublication(() => TestData.find({}));

  TestData.remove({});

  const client = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);

  TestData.insert({ name: 'test1' });
  TestData.insert({ name: 'test2' });
  TestData.insert({ name: 'test3' });

  Meteor._sleepForMs(100);

  const metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.oplogInsertedDocuments, 3);
  test.equal(metrics.liveAddedDocuments, 3);

  sub.stop();
  TestData.remove({});
});

Tinytest.add('Database - Redis Oplog - Removed', function (test) {
  const pub = RegisterPublication(() => TestData.find({}));

  TestData.remove({});

  const client = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);

  TestData.insert({ name: 'test1' });
  TestData.insert({ name: 'test2' });
  TestData.insert({ name: 'test3' });

  Meteor._sleepForMs(100);

  TestData.remove({ name: 'test2' });

  Meteor._sleepForMs(100);

  let metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveRemovedDocuments, 1);

  TestData.remove({});

  Meteor._sleepForMs(100);

  metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveRemovedDocuments, 3);

  sub.stop();
  TestData.remove({});
});
