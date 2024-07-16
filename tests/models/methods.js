import { MethodsModel } from '../../lib/models/methods';
import { Ntp } from '../../lib/ntp';
import { sleep } from '../../lib/utils';
import { TestData } from '../_helpers/globals';
import { CleanTestData, addAsyncTest, callAsync, clientCallAsync, closeClient, findMetricsForMethod, getMeteorClient, registerMethod, waitForConnection, withDocCacheGetSize } from '../_helpers/helpers';

addAsyncTest(
  'Models - Method - buildPayload simple',
  async function (test) {
    createMethodCompleted('aa', 'hello', 1, 100, 5);
    createMethodCompleted('aa', 'hello', 2, 800 , 10);

    let payload = model.buildPayload();
    payload.methodRequests = [];

    let expected = {
      methodMetrics: [
        {
          startTime: 100,
          methods: {
            hello: {
              count: 2,
              errors: 0,
              wait: 0,
              waitedOn: 0,
              db: 0,
              http: 0,
              email: 0,
              async: 0,
              compute: 7.5,
              total: 7.5,
              fetchedDocSize: 0,
              sentMsgSize: 0,
              histogram: {
                alpha: 0.02,
                bins: {
                  41: 1,
                  58: 1
                },
                maxNumBins: 2048,
                n: 2,
                gamma: 1.0408163265306123,
                numBins: 2
              }
            }
          }
        }
      ],
      methodRequests: []
    };

    expected.methodMetrics[0].startTime = payload.methodMetrics[0].startTime;

    test.stableEqual(payload, expected);
  }
);

addAsyncTest(
  'Models - Method - buildPayload with errors',
  async function (test) {
    createMethodCompleted('aa', 'hello', 1, 100, 5);
    createMethodErrored('aa', 'hello', 2, 'the-error', 800, 10);
    let payload = model.buildPayload();
    let expected = [{
      startTime: 100,
      methods: {
        hello: {
          count: 2,
          errors: 1,
          wait: 0,
          waitedOn: 0,
          db: 0,
          http: 0,
          email: 0,
          async: 0,
          compute: 7.5,
          total: 7.5,
          fetchedDocSize: 0,
          sentMsgSize: 0,
          histogram: {
            alpha: 0.02,
            bins: {
              41: 1,
              58: 1
            },
            maxNumBins: 2048,
            n: 2,
            gamma: 1.0408163265306123,
            numBins: 2
          }
        }
      }
    }];
    expected[0].startTime = payload.methodMetrics[0].startTime;
    test.stableEqual(payload.methodMetrics,expected);
  }
);

addAsyncTest(
  'Models - Method - Metrics - fetchedDocSize',
  async function (test) {
    let docs = [{data: 'data1'}, {data: 'data2'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    let methodId = registerMethod(async function () {
      return TestData.find({}).fetchAsync();
    });

    await withDocCacheGetSize(async function () {
      await callAsync(methodId);
    }, 30);


    let payload = Kadira.models.methods.buildPayload();

    let index = payload.methodMetrics.findIndex(methodMetrics => methodId in methodMetrics.methods);

    test.equal(payload.methodMetrics[index].methods[methodId].fetchedDocSize, 60);
  }
);

addAsyncTest(
  'Models - Method - Metrics - sentMsgSize',
  async function (test, client) {
    let docs = [{data: 'data1'}, {data: 'data2'}];

    for (const doc of docs) {
      await TestData.insertAsync(doc);
    }

    const returnValue = 'Some return value';

    const methodId = registerMethod(async function () {
      await TestData.find({}).fetchAsync();
      return returnValue;
    });

    // Needs to call a client isolated from other tests for reliability
    await clientCallAsync(client, methodId);
    await sleep(100);

    let payload = Kadira.models.methods.buildPayload();

    let expected = (JSON.stringify({ msg: 'updated', methods: ['1'] }) +
        JSON.stringify({ msg: 'result', id: '1', result: returnValue })).length;
    test.equal(payload.methodMetrics[0].methods[methodId].sentMsgSize, expected);
  }
);

addAsyncTest(
  'Models - Method - Trace - filter params',
  async function (test) {
    Kadira.tracer.redactField('__test1');

    let methodId = registerMethod(function () {});

    await callAsync(methodId, { __test1: 'value', abc: true }, { xyz: false, __test1: 'value2' });

    let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];

    let expected = JSON.stringify([{ __test1: 'Monti: redacted', abc: true }, { xyz: false, __test1: 'Monti: redacted'}]);

    test.equal(trace.events[0][2].params, expected);
  }
);

addAsyncTest(
  'Models - Method - Trace - filter params with null',
  async function (test) {
    Kadira.tracer.redactField('__test1');

    let methodId = registerMethod(function () {});

    await callAsync(methodId, { __test1: 'value', abc: true }, null, { xyz: false, __test1: 'value2' });

    let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];

    let expected = JSON.stringify([{ __test1: 'Monti: redacted', abc: true }, null, { xyz: false, __test1: 'Monti: redacted' }]);

    test.equal(trace.events[0][2].params, expected);
    CleanTestData();
  }
);

Tinytest.addAsync('Models - Method - Waited On - track wait time of queued messages', async (test, done) => {
  let methodId = registerMethod( async function (id) {
    await sleep(25);
    return id;
  });

  let client = getMeteorClient();

  for (let i = 0; i < 10; i++) {
    client.call(methodId, i, () => {});
  }

  await sleep(1000);

  const metrics = findMetricsForMethod(methodId);

  test.isTrue(metrics.waitedOn > 25, `${metrics.waitedOn} should be greater than 25`);
  test.isTrue(metrics.waitedOn <= 6000, `${metrics.waitedOn} should be less than 6k`);
  console.log(metrics.waitedOn);
  done();
});


Tinytest.addAsync('Models - Method - Waited On - track waitedOn without wait time', async (test, done) => {
  CleanTestData();

  let slowMethod = registerMethod(async function () {
    console.log('slow method start');
    await sleep(100);
    console.log('slow method end');
  });
  let unblockedMethod = registerMethod(async function () {
    this.unblock();
    await sleep(100);
    console.log('slow method end');
  });
  let fastMethod = registerMethod(function () {
    console.log('fastMethod');
  });


  let client = getMeteorClient();

  // subscriptions and method calls made before connected are not run in order
  await waitForConnection(client);

  client.call(slowMethod, () => {});
  client.call(unblockedMethod, () => {});
  await new Promise(r => client.call(fastMethod, () => r()));

  const metrics = findMetricsForMethod(unblockedMethod);

  test.isTrue(metrics.waitedOn < 10, `${metrics.waitedOn} should be less than 10`);
  closeClient(client);

  done();
});
Tinytest.addAsync('Models - Method - Waited On - check unblock time', async (test, done) => {
  let methodId = registerMethod( async function (id) {
    this.unblock();
    await sleep(25);
    return id;
  });

  let client = getMeteorClient();

  for (let i = 0; i < 10; i++) {
    client.call(methodId, i, () => {});
  }

  await sleep(1000);

  const metrics = findMetricsForMethod(methodId);

  test.isTrue(metrics.waitedOn <= 1, 'waitedOn should be less or equal than 1');

  done();
});

Tinytest.addAsync('Models - Method - Waited On - track wait time of next message', async (test, done) => {
  let slowMethod = registerMethod( async function () {
    await sleep(25);
  });
  let fastMethod = registerMethod( function () {});

  let client = getMeteorClient();

  client.call(slowMethod, () => {});
  client.call(fastMethod, () => {});

  await sleep(200);

  const metrics = findMetricsForMethod(slowMethod);
  test.isTrue(metrics.waitedOn >= 20, `${metrics.waitedOn} should be greater than 20`);

  done();
});

export const model = new MethodsModel();

function createMethodCompleted (sessionName, methodName, methodId, startTime, methodDelay) {
  methodDelay = methodDelay || 5;
  let method = {session: sessionName, name: methodName, id: methodId, events: []};
  method.events.push({type: 'start', at: Ntp._now() - startTime});
  method.events.push({type: 'complete', at: Ntp._now() - startTime + methodDelay});
  method = Kadira.tracer.buildTrace(method);
  model.processMethod(method);
}

function createMethodErrored (sessionName, methodName, methodId, errorMessage, startTime, methodDelay) {
  methodDelay = methodDelay || 5;
  let method = {session: sessionName, name: methodName, id: methodId, events: []};
  method.events.push({type: 'start', at: Ntp._now() - startTime});
  method.events.push({type: 'error',
    at: Ntp._now() - startTime + methodDelay,
    endAt: Ntp._now() - startTime + methodDelay,
    data: {error: errorMessage}});
  method = Kadira.tracer.buildTrace(method);
  model.processMethod(method);
}
