import { _ } from 'meteor/underscore';
import { KadiraModel } from './0model';
import { TracerStore } from '../tracer/tracer_store';
import { Ntp } from '../ntp';

const { DDSketch } = require('monti-apm-sketches-js');

const JOB_METRICS_FIELDS = ['wait', 'db', 'http', 'email', 'async', 'compute', 'total'];

export function JobsModel (metricsThreshold) {
  this.jobMetricsByMinute = Object.create(null);
  this.errorMap = Object.create(null);

  this._metricsThreshold = _.extend({
    db: 100,
    http: 1000,
    email: 100,
    async: 100,
    compute: 100,
    total: 200
  }, metricsThreshold || Object.create(null));

  // store max time elapsed methods for each job, event(metrics-field)
  this.maxEventTimesForJobs = Object.create(null);

  this.tracerStore = new TracerStore({
    // process traces every minute
    interval: 1000 * 60,
    // for 30 minutes
    maxTotalPoints: 30,
    // always trace for every 5 minutes
    archiveEvery: 5
  });

  // Not part of the jobMetricsByMinute since we don't want to
  // reset these metrics each minute
  this.activeJobCounts = new Map();
  this.pendingJobCounts = new Map();

  this.tracerStore.start();
}

_.extend(JobsModel.prototype, KadiraModel.prototype);

JobsModel.prototype._getMetrics = function (timestamp, jobName) {
  const dateId = this._getDateId(timestamp);

  if (!this.jobMetricsByMinute[dateId]) {
    this.jobMetricsByMinute[dateId] = {
      jobs: Object.create(null),
    };
  }

  let jobs = this.jobMetricsByMinute[dateId].jobs;

  // initialize method
  if (!jobs[jobName]) {
    jobs[jobName] = {
      count: 0,
      errors: 0,
      fetchedDocSize: 0,
      added: 0,
      histogram: new DDSketch({
        alpha: 0.02
      })
    };

    JOB_METRICS_FIELDS.forEach(function (field) {
      jobs[jobName][field] = 0;
    });
  }

  return this.jobMetricsByMinute[dateId].jobs[jobName];
};

JobsModel.prototype.trackNewJob = function (jobName) {
  const timestamp = Ntp._now();
  const dateId = this._getDateId(timestamp);

  let jobMetrics = this._getMetrics(dateId, jobName);
  jobMetrics.added += 1;
};

JobsModel.prototype.trackActiveJobs = function (jobName, diff) {
  let updatedValue = (this.activeJobCounts.get(jobName) || 0) + diff;

  if (updatedValue === 0) {
    this.activeJobCounts.delete(jobName);
  } else {
    this.activeJobCounts.set(jobName, updatedValue);
  }

  // Ensure there's an entry for this date id so it is included in the payload
  const timestamp = Ntp._now();
  const dateId = this._getDateId(timestamp);
  this._getMetrics(dateId, jobName);
};

JobsModel.prototype.trackPendingJobs = function (jobName, pendingCount) {
  if (pendingCount === 0) {
    this.pendingJobCounts.delete(jobName);
  } else {
    // Ensure there's an entry for this date id so it is included in the payload
    const timestamp = Ntp._now();
    const dateId = this._getDateId(timestamp);
    this._getMetrics(dateId, jobName);
    this.pendingJobCounts.set(jobName, pendingCount);
  }
};

JobsModel.prototype.processJob = function (jobTrace, waitTime) {
  const dateId = this._getDateId(jobTrace.at);

  // append metrics to previous values
  this._appendMetrics(dateId, jobTrace, waitTime);
  if (jobTrace.errored) {
    this.jobMetricsByMinute[dateId].jobs[jobTrace.name].errors++;
  }

  this.tracerStore.addTrace(jobTrace);
};

JobsModel.prototype._appendMetrics = function (id, jobTrace, waitTime = 0) {
  const jobMetrics = this._getMetrics(id, jobTrace.name);

  // startTime needs to be converted into serverTime before sending
  if (!this.jobMetricsByMinute[id].startTime) {
    this.jobMetricsByMinute[id].startTime = jobTrace.at;
  }

  // merge
  JOB_METRICS_FIELDS.forEach(function (field) {
    let value = jobTrace.metrics[field];
    if (value > 0) {
      jobMetrics[field] += value;
    }
  });

  jobMetrics.wait += waitTime;
  jobMetrics.count++;
  jobMetrics.histogram.add(jobTrace.metrics.total);
  this.jobMetricsByMinute[id].endTime = jobTrace.metrics.at;
};

/*
  There are two types of data

  1. jobMetrics - metrics about the jobs (for every 20 secs)
  2. jobRequests - raw job request. normally max, min for every 1 min and errors always
*/
JobsModel.prototype.buildPayload = function () {
  const payload = {
    jobMetrics: [],
    jobRequests: []
  };

  // handling metrics
  let jobMetricsByMinute = this.jobMetricsByMinute;
  this.jobMetricsByMinute = Object.create(null);

  // create final payload for jobMetrics
  for (let key in jobMetricsByMinute) {
    const jobMetrics = jobMetricsByMinute[key];
    // converting startTime into the actual serverTime
    let startTime = jobMetrics.startTime;
    jobMetrics.startTime = Kadira.syncedDate.syncTime(startTime);

    for (let jobName in jobMetrics.jobs) {
      JOB_METRICS_FIELDS.forEach(function (field) {
        jobMetrics.jobs[jobName][field] /=
          jobMetrics.jobs[jobName].count;
      });
    }

    this.activeJobCounts.forEach((value, jobName) => {
      if (value === 0) {
        return;
      }

      if (!jobMetrics.jobs[jobName]) {
        jobMetrics.jobs[jobName] = {};
      }

      jobMetrics.jobs[jobName].active = value;
    });

    this.pendingJobCounts.forEach((value, jobName) => {
      if (value === 0) {
        return;
      }

      if (!jobMetrics.jobs[jobName]) {
        jobMetrics.jobs[jobName] = {};
      }

      jobMetrics.jobs[jobName].pending = value;
    });

    payload.jobMetrics.push(jobMetricsByMinute[key]);
  }

  // collect traces and send them with the payload
  payload.jobRequests = this.tracerStore.collectTraces();

  return payload;
};
