import { jobLogger } from '../models/jobs';
import { checkModuleUsed, tryResolve } from './commonjs-utils';

export function wrapBullMQ () {
  Meteor.startup(() => {
    if (checkModuleUsed('bullmq')) {
      jobLogger('bullmq being used - instrumenting');
      instrumentBullMQ(tryResolve('bullmq'));
    } else {
      jobLogger('bullmq not being used');
    }
  });
}

function instrumentBullMQ (modulePath) {
  let bullMq = Npm.require(modulePath);

  let oldAdd = bullMq.Queue.prototype.addJob;
  bullMq.Queue.prototype.addJob = function () {
    jobLogger(`bullmq - addJob (${this.name})`)
    Kadira.models.jobs.trackNewJob(this.name);
    return oldAdd.apply(this, arguments);
  };

  let oldAddBulk = bullMq.Queue.prototype.addJobs;
  bullMq.Queue.prototype.addJobs = function (jobs) {
    jobLogger(`bullmq - addJobs (${this.name})`)

    let count = jobs && jobs.length || 0;

    Kadira.models.jobs.trackNewJob(this.name, count);

    return oldAddBulk.apply(this, arguments);
  };

  let oldProcessJob = bullMq.Worker.prototype.callProcessJob;
  bullMq.Worker.prototype.callProcessJob = function (...args) {
    jobLogger(`bullmq - callProcessJob (${this.name})`)

    let job = args[0];
    let name = this.name;

    return Kadira.traceJob({
      name,
      waitTime: Date.now() - (job.timestamp + (job.delay || 0)),
      _attributes: {
        jobId: job.id,
        jobName: job.name,
        jobCreated: new Date(job.timestamp),
        jobDelay: job.delay || 0,
        queueName: job.queueName,
        attemptsMade: job.attemptsMade,
      },
      data: job.data
    }, () => oldProcessJob.apply(this, args));
  };
}
