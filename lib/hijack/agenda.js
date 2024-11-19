import { checkModuleUsed, tryResolve } from './commonjs-utils';


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

  let oldRunJob = Job.prototype.run;
  Job.prototype.run = async function (...args) {
    let name = this.attrs.name;

    return Kadira._traceJob({ name }, () => oldRunJob.apply(this, args));
  };
}
