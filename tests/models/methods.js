import { EJSON } from 'meteor/ejson';
import { MethodsModel } from '../../lib/models/methods';
import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, clientCallAsync, registerMethod, withDocCacheGetSize } from '../_helpers/helpers';
import { sleep } from '../../lib/utils';

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

    let startTime = expected.methodMetrics[0].startTime;
    expected.methodMetrics[0].startTime = Kadira.syncedDate.syncTime(startTime);

    // TODO comparing without parsing and stringifing fails
    test.equal(EJSON.parse(EJSON.stringify(payload)), EJSON.parse(EJSON.stringify(expected)));
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
    // TODO comparing without stringify fails
    expected[0].startTime = Kadira.syncedDate.syncTime(expected[0].startTime);
    test.equal(EJSON.parse(EJSON.stringify(payload.methodMetrics)), EJSON.parse(EJSON.stringify(expected)));
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
      TestData.find({}).fetchAsync();
    });

    await withDocCacheGetSize(async function () {
      await callAsync(methodId);
    }, 30);

    await sleep(100);

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
  }
);

export const model = new MethodsModel();

function createMethodCompleted (sessionName, methodName, methodId, startTime, methodDelay) {
  methodDelay = methodDelay || 5;
  let method = {session: sessionName, name: methodName, id: methodId, events: []};
  method.events.push({type: 'start', at: startTime});
  method.events.push({type: 'complete', at: startTime + methodDelay});
  method = Kadira.tracer.buildTrace(method);
  model.processMethod(method);
}

function createMethodErrored (sessionName, methodName, methodId, errorMessage, startTime, methodDelay) {
  methodDelay = methodDelay || 5;
  let method = {session: sessionName, name: methodName, id: methodId, events: []};
  method.events.push({type: 'start', at: startTime});
  method.events.push({type: 'error', at: startTime + methodDelay, data: {error: errorMessage}});
  method = Kadira.tracer.buildTrace(method);
  model.processMethod(method);
}
