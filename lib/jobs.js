import { JobType } from './constants';

let Jobs = Kadira.Jobs = {};

Jobs.getAsync = function (id, callback) {
  Kadira.coreApi.getJob(id)
    .then(function (data) {
      callback(null, data);
    })
    .catch(function (err) {
      callback(err);
    });
};


Jobs.setAsync = function (id, changes, callback) {
  Kadira.coreApi.updateJob(id, changes)
    .then(function (data) {
      callback(null, data);
    })
    .catch(function (err) {
      callback(err);
    });
};

Jobs.set = Meteor.wrapAsync(Jobs.setAsync);
Jobs.get = Meteor.wrapAsync(Jobs.getAsync);


let queuePromise = Promise.resolve();

export function queueJob (job) {
  queuePromise = queuePromise.finally(() => runJob(job));

  return queuePromise;
}

async function runJob (job) {
  if (!job || !job._id) {
    // eslint-disable-next-line no-console
    console.log(`Monti APM: Invalid job: ${JSON.stringify(job)}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log('Monti APM: Starting job', job.type, job.id);

  try {
    if (!job.type) {
      throw new Error('Invalid job: missing type');
    }

    let runner = JobRunners[job.type];

    if (!runner) {
      throw new Error(`Unrecognized job type: ${job.type}. You might need to update montiapm:agent`);
    }

    await runner(job);

    // eslint-disable-next-line no-console
    console.log('Monti APM: Finished job', job.type, job._id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`Monti APM: Error while running job: ${error}`);
    Jobs.set(job._id, { state: 'errored', data: { errorMessage: error.message || 'Unknown error' } });
  }
}

const JobRunners = {
  [JobType.CPU_PROFILE] (job) {
    const ProfilerPackage = Package['montiapm:profiler'];

    if (!ProfilerPackage) {
      throw new Error('Please install the montiapm:profiler package');
    }

    const MontiProfiler = ProfilerPackage.MontiProfiler;

    if (!MontiProfiler || !MontiProfiler._remoteCpuProfile) {
      throw new Error('Please update the montiapm:profiler package');
    }

    const {_id, data} = job;

    return MontiProfiler._remoteCpuProfile(data.duration, _id);
  },
  async [JobType.HEAP_SNAPSHOT] (job) {
    const ProfilerPackage = Package['montiapm:profiler'];

    if (!ProfilerPackage) {
      throw new Error('Please install the montiapm:profiler package');
    }

    if (!ProfilerPackage.MontiProfiler._remoteHeapSnapshot) {
      throw new Error('Please update montiapm:profiler package');
    }

    await ProfilerPackage.MontiProfiler._remoteHeapSnapshot(job._id);
  }
};
