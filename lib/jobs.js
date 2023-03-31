import { JobType } from './constants';
import { handleCpuProfileJob } from './profiler/profile-jobs';

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


export const JobQueue = [];

export function handleJobAdded (job) {
  if (!job) return;

  JobQueue.push(job);
}

export function jobExecutor (core) {
  let jobRunning = false;

  Meteor.setInterval(() => {
    if (jobRunning) return;

    jobRunning = true;

    const job = JobQueue.shift();

    if (!job) return;

    switch (job.type) {
      case JobType.CPU_PROFILE:
        handleCpuProfileJob(job, core);
        break;
      default:
        console.log('Unknown job type:', job.type);
    }

    jobRunning = false;
  }, 1000);
}
