import { EJSON } from 'meteor/ejson';
import { MethodsModel } from '../../lib/models/methods';
import { TestData } from '../_helpers/globals';
import {
  addAsyncTest,
  callAsync,
  CleanTestData,
  getMeteorClient,
  registerMethod,
  RegisterMethod,
  withDocCacheGetSize
} from '../_helpers/helpers';
import { sleep } from '../../lib/utils';
import { prettyLog } from '../_helpers/pretty-log';

Tinytest.add(
  'Models - Method - buildPayload simple',
  function (test) {
    CreateMethodCompleted('aa', 'hello', 1, 100, 5);
    CreateMethodCompleted('aa', 'hello', 2, 800 , 10);

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
    CleanTestData();
  }
);

Tinytest.add(
  'Models - Method - buildPayload with errors',
  function (test) {
    CreateMethodCompleted('aa', 'hello', 1, 100, 5);
    CreateMethodErrored('aa', 'hello', 2, 'the-error', 800, 10);
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
    CleanTestData();
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

    prettyLog(payload.methodMetrics[index].methods[methodId]);

    test.equal(payload.methodMetrics[index].methods[methodId].fetchedDocSize, 60);
  }
);

Tinytest.add(
  'Models - Method - Metrics - sentMsgSize',
  function (test) {
    let docs = [{data: 'data1'}, {data: 'data2'}];
    docs.forEach(function (doc) {
      TestData.insert(doc);
    });

    let returnValue = 'Some return value';
    let methodId = RegisterMethod(function () {
      TestData.find({}).fetch();
      return returnValue;
    });

    let client = getMeteorClient();
    client.call(methodId);

    let payload = Kadira.models.methods.buildPayload();

    let expected = (JSON.stringify({ msg: 'updated', methods: ['1'] }) +
        JSON.stringify({ msg: 'result', id: '1', result: returnValue })).length;

    test.equal(payload.methodMetrics[0].methods[methodId].sentMsgSize, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Models - Method - Trace - filter params',
  function (test) {
    Kadira.tracer.redactField('__test1');
    let methodId = RegisterMethod(function () {
    });

    let client = getMeteorClient();
    client.call(methodId, { __test1: 'value', abc: true }, { xyz: false, __test1: 'value2' });

    let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];

    let expected = JSON.stringify([{ __test1: 'Monti: redacted', abc: true }, { xyz: false, __test1: 'Monti: redacted'}]);
    test.equal(trace.events[0][2].params, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Models - Method - Trace - filter params with null',
  function (test) {
    Kadira.tracer.redactField('__test1');
    let methodId = RegisterMethod(function () {
    });

    let client = getMeteorClient();
    client.call(methodId, { __test1: 'value', abc: true }, null, { xyz: false, __test1: 'value2' });

    let trace = Kadira.models.methods.tracerStore.currentMaxTrace[`method::${methodId}`];

    let expected = JSON.stringify([{ __test1: 'Monti: redacted', abc: true }, null, { xyz: false, __test1: 'Monti: redacted' }]);
    test.equal(trace.events[0][2].params, expected);
    CleanTestData();
  }
);

export const model = new MethodsModel();

function CreateMethodCompleted (sessionName, methodName, methodId, startTime, methodDelay) {
  methodDelay = methodDelay || 5;
  let method = {session: sessionName, name: methodName, id: methodId, events: []};
  method.events.push({type: 'start', at: startTime});
  method.events.push({type: 'complete', at: startTime + methodDelay});
  method = Kadira.tracer.buildTrace(method);
  model.processMethod(method);
}

function CreateMethodErrored (sessionName, methodName, methodId, errorMessage, startTime, methodDelay) {
  methodDelay = methodDelay || 5;
  let method = {session: sessionName, name: methodName, id: methodId, events: []};
  method.events.push({type: 'start', at: startTime});
  method.events.push({type: 'error', at: startTime + methodDelay, data: {error: errorMessage}});
  method = Kadira.tracer.buildTrace(method);
  model.processMethod(method);
}
