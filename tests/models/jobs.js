import { EJSON } from 'meteor/ejson';
import { JobsModel } from '../../lib/models/jobs';
import { CleanTestData } from '../_helpers/helpers';
import { TestData } from '../_helpers/globals';

const model = new JobsModel();

Tinytest.add(
  'Models - Jobs - buildPayload simple',
  function (test) {
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
    CleanTestData();
  }
);

Tinytest.add(
  'Models - Jobs - traceJob - return sync value',
  function (test) {
    let result = Kadira._traceJob({ name: 'hello' }, () => 5);

    test.equal(result, 5);
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - return async value',
  async function (test) {
    let result = await Kadira._traceJob({ name: 'hello' }, () => Promise.resolve(5));

    test.equal(result, 5);
  }
);

Tinytest.addAsync(
  'Models - Jobs - traceJob - track sync processor',
  async function (test) {
    Kadira._traceJob({ name: 'hello' }, () => {
      TestData.find().fetch();
    });

    let payload = Kadira.models.jobs.buildPayload();
    test.equal(payload.jobMetrics[0].jobs.hello.count, 1);
    test.ok(payload.jobMetrics[0].jobs.hello.total > 0);
    test.ok(payload.jobMetrics[0].jobs.hello.db > 0);
  }
);

function createCompletedJob (jobName, startTime, totalTime = 5) {
  let method = { type: 'job', name: jobName, events: [] };
  method.events.push({ type: 'start', at: startTime });
  method.events.push({ type: 'complete', at: startTime + totalTime });
  method = Kadira.tracer.buildTrace(method);
  model.processJob(method);
}
