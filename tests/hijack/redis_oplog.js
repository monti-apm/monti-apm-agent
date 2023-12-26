import { TestData } from '../_helpers/globals';
import { GetMeteorClient, RegisterPublication, SubscribeAndWait } from '../_helpers/helpers';

/**
 * We only track the observers coming from subscriptions (which have `ownerInfo`)
 */
Tinytest.add('Database - Redis Oplog - Added', function (test) {
  const pub = RegisterPublication(() => TestData.find({}));

  TestData.remove({});

  TestData.insert({ name: 'test1' });
  TestData.insert({ name: 'test2' });
  TestData.insert({ name: 'test3' });
  TestData.insert({ name: 'test4' });

  const client = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);

  TestData.insert({ name: 'test5' });
  TestData.insert({ name: 'test6' });
  TestData.insert({ name: 'test7' });

  Meteor._sleepForMs(100);

  const metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.initiallyAddedDocuments, 4);
  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.oplogInsertedDocuments, 3);
  test.equal(metrics.liveAddedDocuments, 3);

  sub.stop();
  TestData.remove({});

  Meteor._sleepForMs(100);
});

Tinytest.add('Database - Redis Oplog - Added with limit/skip', function (test) {
  const pub = RegisterPublication(() => TestData.find({name: 'test'}, {limit: 2, skip: 0}));

  TestData.remove({});

  TestData.insert({ name: 'test' });

  const client = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);
  let metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.polledDocuments, 1);

  TestData.insert({ name: 'test' });
  metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);
  test.equal(metrics.polledDocuments, 1);

  TestData.insert({ name: 'doesnt-match-cursor' });
  // as the selector is not matched, redis-oplog triggers a requery

  Meteor._sleepForMs(100);

  metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.oplogInsertedDocuments, 2);
  test.equal(metrics.liveAddedDocuments, 1);
  // 1 from initial poll + 3 from last requery
  test.equal(metrics.polledDocuments, 4);


  sub.stop();
  TestData.remove({});

  Meteor._sleepForMs(100);
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

  Meteor._sleepForMs(100);
});

Tinytest.add('Database - Redis Oplog - Changed', function (test) {
  const pub = RegisterPublication(() => TestData.find({}));

  TestData.remove({});

  const client = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);

  TestData.insert({ name: 'test1' });
  TestData.insert({ name: 'test2' });
  TestData.insert({ name: 'test3' });

  Meteor._sleepForMs(100);

  TestData.update({ name: 'test2' }, { $set: { name: 'test4' } });

  Meteor._sleepForMs(100);

  let metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveChangedDocuments, 1);

  TestData.update({}, { $set: { name: 'test5' } }, { multi: true });

  Meteor._sleepForMs(100);

  metrics = Kadira.models.pubsub._getMetrics(new Date(), pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveChangedDocuments, 4);

  sub.stop();
  TestData.remove({});

  Meteor._sleepForMs(100);
});
