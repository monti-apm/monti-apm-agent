import { EJSON } from 'meteor/ejson';
import { JobsModel } from '../../lib/models/jobs';
import { cleanTestData, CleanTestData } from '../_helpers/helpers';
import { MontiAsyncStorage } from '../../lib/async/als';
import { sleep } from '../../lib/utils';

const model = new JobsModel();

Tinytest.addAsync(
  'Models - Jobs - buildPayload simple',
  async function (test) {
    createCompletedJob('hello', 100, 5);
    createCompletedJob('hello', 800, 10);

    let payload = model.buildPayload();
    payload.jobRequests = [];

    let expected = {
      jobMetrics: [
        {
          startTime: 100,
          jobs: {
            hello: {
              count: 2,
              added: 0,
              errors: 0,
              wait: 0,
              db: 0,
              http: 0,
              email: 0,
              async: 0,
              compute: 7.5,
              total: 7.5,
              fetchedDocSize: 0,
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
      jobRequests: []
    };

    let startTime = expected.jobMetrics[0].startTime;
    expected.jobMetrics[0].startTime = Kadira.syncedDate.syncTime(startTime);
    // TODO comparing without parsing and stringifing fails
    test.equal(EJSON.parse(EJSON.stringify(payload)), EJSON.parse(EJSON.stringify(expected)));
    await CleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - track new jobs',
  async function (test) {
    model.trackNewJob('analyze');
    model.trackNewJob('analyze');
    model.trackNewJob('analyze');

    let payload = model.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.analyze.added, 3);
    await CleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - track active jobs',
  async function (test) {
    model.activeJobCounts.clear();
    model.trackActiveJobs('analyze', 1);
    model.trackActiveJobs('analyze', 1);

    let payload = model.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.analyze.active, 2);

    model.trackActiveJobs('analyze', -1);

    payload = model.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.analyze.active, 1);

    await CleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - Monti.recordNewJob',
  async function (test) {
    Kadira.recordNewJob('hello');
    let payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.hello.added, 1);
    await CleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - Monti.recordPendingJobs',
  async function (test) {
    Kadira.recordPendingJobs('hello', 5);
    let payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.hello.pending, 5);

    Kadira.recordPendingJobs('hello', 0);
    payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics.length, 0);
    await CleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - return sync value',
  async function (test) {
    let result = runTraceJob({ name: 'hello' }, () => 5);

    test.equal(result, 5);
    await cleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - return async value',
  async function (test, done) {
    let result = await runTraceJob({ name: 'hello' }, () => Promise.resolve(5));

    test.equal(result, 5);
    await cleanTestData();
    done();
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - track sync processor',
  async function (test) {
    await cleanTestData();

    runTraceJob({ name: 'hello' }, () => {
      let now = Date.now();
      while (Date.now() - 5 < now) {
        // nothing
      }
    });

    let payload = Kadira.models.jobs.buildPayload();

    test.equal(payload.jobMetrics[0].jobs.hello.count, 1);
    test.isTrue(payload.jobMetrics[0].jobs.hello.total > 0);
    test.isTrue(payload.jobMetrics[0].jobs.hello.compute > 0);
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - track async time',
  async function (test) {
    await runTraceJob({ name: 'hello' }, async () => {
      await sleep(10);
    });

    let payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.hello.count, 1);
    test.isTrue(payload.jobMetrics[0].jobs.hello.total > 0);
    test.isTrue(payload.jobMetrics[0].jobs.hello.async > 1);
    await cleanTestData();
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - track active status',
  async function (test, done) {
    model.activeJobCounts.clear();

    let resolver;
    let promise = new Promise(resolve => {
      resolver = resolve;
    });

    let jobPromise = runTraceJob({ name: 'hello' }, async () => {
      await promise;
    });

    let payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.hello.active, 1);
    test.equal(payload.jobMetrics[0].jobs.hello.count, 0);

    resolver();
    await jobPromise;

    payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.hello.active, undefined);
    test.equal(payload.jobMetrics[0].jobs.hello.count, 1);

    await CleanTestData();
    done();
  }
);

function createCompletedJob (jobName, startTime, totalTime = 5) {
  let method = { type: 'job', name: jobName, events: [] };
  method.events.push({ type: 'start', at: startTime });
  method.events.push({ type: 'complete', at: startTime + totalTime });
  method = Kadira.tracer.buildTrace(method);
  model.processJob(method);
}

function runTraceJob (options, fn) {
  return MontiAsyncStorage.run(null, () => {
    return Monti.traceJob(options, fn);
  });
}
