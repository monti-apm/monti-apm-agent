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

function createJobName (queueName, jobName) {
  return jobName ? `${queueName} (${jobName})` : queueName;
}

function instrumentBullMQ (modulePath) {
  let bullMq = Npm.require(modulePath);

  let oldAdd = bullMq.Queue.prototype.addJob;
  bullMq.Queue.prototype.addJob = function (name) {
    let jobName = createJobName(this.name, typeof name === 'string' ? name : null);

    Kadira.models.jobs.trackNewJob(jobName);
    return oldAdd.apply(this, arguments);
  };

  let oldAddBulk = bullMq.Queue.prototype.addBulk;
  bullMq.Queue.prototype.addBulk = function (jobs) {
    jobLogger(`bullmq - addJobs (${this.name})`);

    jobs.forEach(job => {
      let name = createJobName(this.name, job.name);
      Kadira.models.jobs.trackNewJob(name, 1);
    });


    return oldAddBulk.apply(this, arguments);
  };

  let oldProcessJob = bullMq.Worker.prototype.callProcessJob;
  bullMq.Worker.prototype.callProcessJob = function (...args) {
    jobLogger(`bullmq - callProcessJob (${this.name})`);

    let job = args[0];
    let queueName = this.name;
    let jobName = job.name;

    return Kadira.traceJob({
      name: createJobName(queueName, jobName),
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
