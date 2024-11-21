import { checkModuleUsed, tryResolve } from './commonjs-utils';

const ScheduledSymbol = Symbol('monti:scheduled');

export function wrapAgenda () {
  Meteor.startup(() => {
    if (checkModuleUsed('@hokify/agenda')) {
      instrumentAgenda(tryResolve('@hokify/agenda'));
    }
  });
}

function instrumentAgenda () {
  // eslint-disable-next-line global-require
  let agenda = require('@hokify/agenda');
  let Job = agenda.Job;

  // Track new jobs
  let oldSaveJob = Job.prototype.save;
  Job.prototype.save = function () {
    let name = this.attrs.name;
    Kadira.models.jobs.trackNewJob(name);

    return oldSaveJob.apply(this, arguments);
  };

  let oldRun = Job.prototype.run;
  Job.prototype.run = function () {
    let shouldRun = this.attrs.nextRunAt;
    this.attrs[ScheduledSymbol] = shouldRun;

    return oldRun.apply(this, arguments);
  };

  let oldRunJob = Job.prototype.runJob;
  Job.prototype.runJob = async function (...args) {
    let name = this.attrs.name;
    let waitTime = Date.now() - this.attrs[ScheduledSymbol];
    let details = {
      name,
      waitTime,
      data: this.attrs.data
    };

    return Kadira._traceJob(details, () => oldRunJob.apply(this, args));
  };
}
