import { TestData, TestDataRedis, TestDataRedisNoRaceProtection } from '../_helpers/globals';
import { FindMetricsForPub, GetMeteorClient, RegisterMethod, RegisterPublication, SubscribeAndWait } from '../_helpers/helpers';

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

  const metrics = FindMetricsForPub(pub);

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
  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.polledDocuments, 1);

  TestData.insert({ name: 'test' });
  Meteor._sleepForMs(100);
  // as the selector IS matched, redis-oplog triggers a requery
  metrics = FindMetricsForPub(pub);
  // 1 from initial subscription, 1 findOne + requery(2)
  test.equal(metrics.polledDocuments, 4);

  TestData.insert({ name: 'doesnt-match-cursor' });
  // as the selector IS NOT matched, redis-oplog does not trigger a requery

  Meteor._sleepForMs(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.oplogInsertedDocuments, 2);
  test.equal(metrics.liveAddedDocuments, 1);
  // 4 from before + 1 findOne from the unmatched document
  test.equal(metrics.polledDocuments, 5);


  sub.stop();
  TestData.remove({});

  Meteor._sleepForMs(100);
});
Tinytest.add('Database - Redis Oplog - With protect against race condition - Check Trace', function (test) {
  // in this case, the mutator will refetch the doc when publishing it
  const methodId = RegisterMethod(() => TestDataRedis.update({name: 'test'}, {$set: {name: 'abv'}}));

  TestDataRedis.remove({});

  TestDataRedis.insert({ name: 'test' });

  const client = GetMeteorClient();
  client.call(methodId);
  Meteor._sleepForMs(1000);

  let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];
  const dbEvents = trace.events.filter((o) => o[0] === 'db');
  test.equal(dbEvents.length, 2);

  TestDataRedis.remove({});

  Meteor._sleepForMs(100);
});
Tinytest.add('Database - Redis Oplog - With protect against race condition - check for finds after receiving the msg', function (test) {
  // in this case, every subscriber will refetch the doc once when receiving it
  const pub = RegisterPublication(() => TestDataRedis.find({name: 'test'}));

  TestDataRedis.remove({});

  TestDataRedis.insert({ name: 'test' });

  const client = GetMeteorClient();
  const client2 = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);
  const sub2 = SubscribeAndWait(client2, pub);
  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.polledDocuments, 1);

  TestDataRedis.insert({ name: 'test' });
  Meteor._sleepForMs(100);

  metrics = FindMetricsForPub(pub);
  test.equal(metrics.polledDocuments, 2);

  Meteor._sleepForMs(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 2);
  test.equal(metrics.oplogInsertedDocuments, 1);
  test.equal(metrics.liveAddedDocuments, 1);
  test.equal(metrics.polledDocuments, 2);


  sub.stop();
  sub2.stop();
  TestDataRedis.remove({});

  Meteor._sleepForMs(100);
});

Tinytest.add('Database - Redis Oplog - Without protect against race condition - no extraneous finds', function (test) {
  // in this case, no subscriber will refetch the doc when receiving it
  const pub = RegisterPublication(() => TestDataRedisNoRaceProtection.find({}));

  TestDataRedisNoRaceProtection.remove({});

  TestDataRedisNoRaceProtection.insert({ name: 'test' });

  const client = GetMeteorClient();
  const sub = SubscribeAndWait(client, pub);
  const sub2 = SubscribeAndWait(client, pub);
  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.polledDocuments, 1);

  TestDataRedisNoRaceProtection.insert({ name: 'test' });
  Meteor._sleepForMs(100);

  metrics = FindMetricsForPub(pub);
  test.equal(metrics.polledDocuments, 1);

  Meteor._sleepForMs(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 2);
  test.equal(metrics.oplogInsertedDocuments, 1);
  test.equal(metrics.liveAddedDocuments, 1);
  test.equal(metrics.polledDocuments, 1);


  sub.stop();
  sub2.stop();
  TestDataRedisNoRaceProtection.remove({});

  Meteor._sleepForMs(100);
});
Tinytest.add('Database - Redis Oplog - Without protect against race condition - Check Trace', function (test) {
  // in this case, the mutator will refetch the doc when publishing it
  const methodId = RegisterMethod(() => TestDataRedisNoRaceProtection.update({name: 'test'}, {$set: {name: 'abv'}}));

  TestDataRedisNoRaceProtection.remove({});

  TestDataRedisNoRaceProtection.insert({ name: 'test' });

  const client = GetMeteorClient();
  client.call(methodId);
  Meteor._sleepForMs(1000);

  let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];
  const dbEvents = trace.events.filter((o) => o[0] === 'db');
  test.equal(dbEvents.length, 3);
  test.equal(dbEvents[2][2].func, 'fetch');

  TestDataRedisNoRaceProtection.remove({});

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

  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveRemovedDocuments, 1);

  TestData.remove({});

  Meteor._sleepForMs(100);

  metrics = FindMetricsForPub(pub);

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

  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveChangedDocuments, 1);

  TestData.update({}, { $set: { name: 'test5' } }, { multi: true });

  Meteor._sleepForMs(200);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveChangedDocuments, 4);

  sub.stop();
  TestData.remove({});

  Meteor._sleepForMs(100);
});
