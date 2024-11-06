import { _ } from 'meteor/underscore';
import { KadiraModel } from './0model';
import { TracerStore } from '../tracer/tracer_store';

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

JobsModel.prototype.processJob = function (jobTrace) {
  const dateId = this._getDateId(jobTrace.at);

  // append metrics to previous values
  this._appendMetrics(dateId, jobTrace);
  if (jobTrace.errored) {
    this.jobMetricsByMinute[dateId].jobs[jobTrace.name].errors++;
  }

  this.tracerStore.addTrace(jobTrace);
};

JobsModel.prototype._appendMetrics = function (id, jobTrace) {
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

    payload.jobMetrics.push(jobMetricsByMinute[key]);
  }

  // collect traces and send them with the payload
  payload.jobRequests = this.tracerStore.collectTraces();

  return payload;
};
