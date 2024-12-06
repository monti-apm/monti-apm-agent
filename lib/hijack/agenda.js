import { checkModuleUsed } from './commonjs-utils';

const ScheduledSymbol = Symbol('monti:scheduled');

export function wrapAgenda () {
  Meteor.startup(() => {
    if (checkModuleUsed('@hokify/agenda')) {
      instrumentAgendaTs();
    }
    if (checkModuleUsed('agenda')) {
      instrumentAgenda();
    }
  });
}

function instrumentAgendaTs () {
  // eslint-disable-next-line global-require
  let agenda = require('@hokify/agenda');
  let Job = agenda.Job;

  instrumentJob(Job.prototype);
}

function instrumentAgenda () {
  // eslint-disable-next-line global-require
  let Job = require('agenda/dist/job').Job;
  instrumentJob(Job.prototype);
}

function instrumentJob (JobMethods) {
  let oldSaveJob = JobMethods.save;
  JobMethods.save = function () {
    let id = this.attrs._id;

    if (!id) {
      let name = this.attrs.name;
      Kadira.models.jobs.trackNewJob(name);
    }

    return oldSaveJob.apply(this, arguments);
  };

  let oldRun = JobMethods.run;
  JobMethods.run = function (...args) {
    let name = this.attrs.name;
    let waitTime = Date.now() - this.attrs.nextRunAt;
    let details = {
      name,
      waitTime,
      data: this.attrs.data
    };

    return Kadira.traceJob(details, () => oldRun.apply(this, args));
  };
}
