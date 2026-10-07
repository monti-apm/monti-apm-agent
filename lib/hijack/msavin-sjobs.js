import { jobLogger } from '../models/jobs';

export function wrapMsavinSjobs () {
  Meteor.startup(() => {
    let pkg = Package['msavin:sjobs'];

    if (!pkg || !pkg.Jobs) {
      jobLogger('msavin:sjobs not being used');
      return;
    }

    jobLogger('msavin:sjobs being used - instrumenting');
    instrumentMsavinSjobs(pkg.Jobs, pkg.JobsInternal);
  });
}

function wrapJobFn (name, fn) {
  if (typeof fn !== 'function' || fn._kadiraWrapped) {
    return fn;
  }

  let wrapped = function (...args) {
    let doc = this && this.document;
    let details = {
      name: (doc && doc.name) || name,
    };

    if (doc) {
      if (doc.due) {
        details.waitTime = Date.now() - new Date(doc.due).getTime();
      }

      details.data = {
        arguments: doc.arguments,
        data: doc.data,
      };

      details._attributes = {
        jobId: doc._id,
        priority: doc.priority,
        created: doc.created,
        due: doc.due,
        state: doc.state,
      };
    }

    return Kadira.traceJob(details, () => fn.apply(this, args));
  };

  wrapped._kadiraWrapped = true;
  return wrapped;
}

function instrumentMsavinSjobs (Jobs, JobsInternal) {
  let oldRegister = Jobs.register;
  Jobs.register = function (jobs) {
    let wrapped = {};
    Object.keys(jobs).forEach(name => {
      wrapped[name] = wrapJobFn(name, jobs[name]);
    });
    return oldRegister.call(this, wrapped);
  };

  let registry = JobsInternal && JobsInternal.Utilities &&
    JobsInternal.Utilities.registry;
  if (registry && registry.data) {
    Object.keys(registry.data).forEach(name => {
      registry.data[name] = wrapJobFn(name, registry.data[name]);
    });
  }

  let helpers = JobsInternal && JobsInternal.Utilities &&
    JobsInternal.Utilities.helpers;
  if (helpers && helpers.generateJobDoc) {
    let oldGenerate = helpers.generateJobDoc;
    helpers.generateJobDoc = function () {
      let doc = oldGenerate.apply(this, arguments);
      if (doc && doc.name) {
        Kadira.models.jobs.trackNewJob(doc.name);
      }
      return doc;
    };
  }
}
