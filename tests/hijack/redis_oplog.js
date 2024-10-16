import { sleep } from '../../lib/utils';
import { TestData, TestDataRedis, TestDataRedisNoRaceProtection } from '../_helpers/globals';
import { subscribeAndWait, addTestWithRoundedTime, getMeteorClient, registerMethod, registerPublication, FindMetricsForPub } from '../_helpers/helpers';

/**
 * We only track the observers coming from subscriptions (which have `ownerInfo`)
 */
addTestWithRoundedTime('Database - Redis Oplog - Added', async function (test) {
  const pub = registerPublication(() => TestData.find({}));

  await TestData.removeAsync({});

  await TestData.insertAsync({ name: 'test1' });
  await TestData.insertAsync({ name: 'test2' });
  await TestData.insertAsync({ name: 'test3' });
  await TestData.insertAsync({ name: 'test4' });

  const client = getMeteorClient();
  const sub = await subscribeAndWait(client, pub);

  await TestData.insertAsync({ name: 'test5' });
  await TestData.insertAsync({ name: 'test6' });
  await TestData.insertAsync({ name: 'test7' });

  await sleep(100);

  const metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 4);
  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.oplogInsertedDocuments, 3);
  test.equal(metrics.liveAddedDocuments, 3);

  sub.stop();
  await TestData.removeAsync({});

  await sleep(100);
});

addTestWithRoundedTime('Database - Redis Oplog - Added with limit/skip', async function (test) {
  const pub = registerPublication(() => TestData.find({name: 'test'}, {limit: 2, skip: 0}));

  await TestData.removeAsync({});

  await TestData.insertAsync({ name: 'test' });

  const client = getMeteorClient();
  const sub = await subscribeAndWait(client, pub);
  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.polledDocuments, 1);

  await TestData.insertAsync({ name: 'test' });
  await sleep(100);
  // as the selector IS matched, redis-oplog triggers a requery
  metrics = FindMetricsForPub(pub);
  // 1 from initial subscription, 1 findOne + requery(2)
  test.equal(metrics.polledDocuments, 4);

  await TestData.insertAsync({ name: 'doesnt-match-cursor' });
  // as the selector IS NOT matched, redis-oplog does not trigger a requery

  await sleep(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.oplogInsertedDocuments, 2);
  test.equal(metrics.liveAddedDocuments, 1);
  // 4 from before + 1 findOne from the unmatched document
  test.equal(metrics.polledDocuments, 5);


  sub.stop();
  await TestData.removeAsync({});

  await sleep(100);
});
addTestWithRoundedTime('Database - Redis Oplog - With protect against race condition - Check Trace', async function (test) {
  // in this case, the mutator will refetch the doc when publishing it
  const methodId = registerMethod(() => TestDataRedis.update({name: 'test'}, {$set: {name: 'abv'}}));

  await TestDataRedis.removeAsync({});

  await TestDataRedis.insertAsync({ name: 'test' });

  const client = getMeteorClient();
  await client.callAsync(methodId);
  Meteor._sleepForMs(1000);

  let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];
  const dbEvents = trace.events.filter((o) => o[0] === 'db');
  test.equal(dbEvents.length, 2);

  await TestDataRedis.removeAsync({});

  await sleep(100);
});
addTestWithRoundedTime('Database - Redis Oplog - With protect against race condition - check for finds after receiving the msg', async function (test) {
  // in this case, every subscriber will refetch the doc once when receiving it
  const pub = registerPublication(() => TestDataRedis.find({name: 'test'}));

  await TestDataRedis.removeAsync({});

  await TestDataRedis.insertAsync({ name: 'test' });

  const client = getMeteorClient();
  const client2 = getMeteorClient();
  const sub = await subscribeAndWait(client, pub);
  const sub2 = await subscribeAndWait(client2, pub);
  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.polledDocuments, 1);

  await TestDataRedis.insertAsync({ name: 'test' });
  await sleep(100);

  metrics = FindMetricsForPub(pub);
  test.equal(metrics.polledDocuments, 2);

  await sleep(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 2);
  test.equal(metrics.oplogInsertedDocuments, 1);
  test.equal(metrics.liveAddedDocuments, 1);
  test.equal(metrics.polledDocuments, 2);


  sub.stop();
  sub2.stop();
  await TestDataRedis.removeAsync({});

  await sleep(100);
});

addTestWithRoundedTime('Database - Redis Oplog - Without protect against race condition - no extraneous finds', async function (test) {
  // in this case, no subscriber will refetch the doc when receiving it
  const pub = registerPublication(() => TestDataRedisNoRaceProtection.find({}));

  await TestDataRedisNoRaceProtection.removeAsync({});

  await TestDataRedisNoRaceProtection.insertAsync({ name: 'test' });

  const client = getMeteorClient();
  const sub = await subscribeAndWait(client, pub);
  const sub2 = await subscribeAndWait(client, pub);
  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.polledDocuments, 1);

  await TestDataRedisNoRaceProtection.insertAsync({ name: 'test' });
  await sleep(100);

  metrics = FindMetricsForPub(pub);
  test.equal(metrics.polledDocuments, 1);

  await sleep(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.initiallyAddedDocuments, 1);
  test.equal(metrics.totalObservers, 2);
  test.equal(metrics.oplogInsertedDocuments, 1);
  test.equal(metrics.liveAddedDocuments, 1);
  test.equal(metrics.polledDocuments, 1);


  sub.stop();
  sub2.stop();
  await TestDataRedisNoRaceProtection.removeAsync({});

  await sleep(100);
});
addTestWithRoundedTime('Database - Redis Oplog - Without protect against race condition - Check Trace', async function (test) {
  // in this case, the mutator will refetch the doc when publishing it
  const methodId = registerMethod(() => TestDataRedisNoRaceProtection.update({name: 'test'}, {$set: {name: 'abv'}}));

  await TestDataRedisNoRaceProtection.removeAsync({});

  await TestDataRedisNoRaceProtection.insertAsync({ name: 'test' });

  const client = getMeteorClient();
  await client.callAsync(methodId);
  Meteor._sleepForMs(1000);

  let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];
  const dbEvents = trace.events.filter((o) => o[0] === 'db');
  test.equal(dbEvents.length, 3);
  test.equal(dbEvents[2][2].func, 'fetch');

  await TestDataRedisNoRaceProtection.removeAsync({});

  await sleep(100);
});

addTestWithRoundedTime('Database - Redis Oplog - Removed', async function (test) {
  const pub = registerPublication(() => TestData.find({}));

  await TestData.removeAsync({});

  const client = getMeteorClient();
  const sub = await subscribeAndWait(client, pub);

  await TestData.insertAsync({ name: 'test1' });
  await TestData.insertAsync({ name: 'test2' });
  await TestData.insertAsync({ name: 'test3' });

  await sleep(100);

  await TestData.removeAsync({ name: 'test2' });

  await sleep(100);

  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveRemovedDocuments, 1);

  await TestData.removeAsync({});

  await sleep(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveRemovedDocuments, 3);

  sub.stop();
  await TestData.removeAsync({});

  await sleep(100);
});

addTestWithRoundedTime('Database - Redis Oplog - Changed', async function (test) {
  const pub = registerPublication(() => TestData.find({}));

  await TestData.removeAsync({});

  const client = getMeteorClient();
  const sub = await subscribeAndWait(client, pub);

  await TestData.insertAsync({ name: 'test1' });
  await TestData.insertAsync({ name: 'test2' });
  await TestData.insertAsync({ name: 'test3' });

  await sleep(100);

  TestData.update({ name: 'test2' }, { $set: { name: 'test4' } });

  await sleep(100);

  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveChangedDocuments, 1);

  TestData.update({}, { $set: { name: 'test5' } }, { multi: true });

  await sleep(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1);
  test.equal(metrics.liveChangedDocuments, 4);

  sub.stop();
  await TestData.removeAsync({});

  await sleep(100);
});

addTestWithRoundedTime('Database - Redis Oplog - Remove with limit', async function (test) {
  const pub = registerPublication(() => TestData.find({}, { limit: 100 }));
  await TestData.removeAsync({});
  const client = getMeteorClient();

  const sub = await subscribeAndWait(client, pub);

  TestData.insert({ name: 'test1' });
  TestData.insert({ name: 'test2' });
  TestData.insert({ name: 'test3' });

  await sleep(100);
  await TestData.removeAsync({ name: 'test2' });

  await sleep(100);

  let metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1, 'observers');
  test.equal(metrics.liveRemovedDocuments, 1, 'removed');

  await TestData.removeAsync({});

  await sleep(100);

  metrics = FindMetricsForPub(pub);

  test.equal(metrics.totalObservers, 1, 'observers');
  test.equal(metrics.liveRemovedDocuments, 3, 'removed');

  sub.stop();
});
