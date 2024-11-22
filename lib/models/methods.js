import { _ } from 'meteor/underscore';
import { KadiraModel } from './0model';
import { TracerStore } from '../tracer/tracer_store';
import { Ntp } from '../ntp';
import { calculateWaitedOnTime } from '../utils';

const { DDSketch } = require('monti-apm-sketches-js');

const METHOD_METRICS_FIELDS = ['wait', 'db', 'http', 'email', 'async', 'compute', 'total'];

export function MethodsModel (metricsThreshold) {
  this.methodMetricsByMinute = Object.create(null);
  this.errorMap = Object.create(null);

  this._metricsThreshold = _.extend({
    wait: 100,
    db: 100,
    http: 1000,
    email: 100,
    async: 100,
    compute: 100,
    total: 200
  }, metricsThreshold || Object.create(null));

  // store max time elapsed methods for each method, event(metrics-field)
  this.maxEventTimesForMethods = Object.create(null);

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

_.extend(MethodsModel.prototype, KadiraModel.prototype);

MethodsModel.prototype._getMetrics = function (timestamp, method) {
  const dateId = this._getDateId(timestamp);

  if (!this.methodMetricsByMinute[dateId]) {
    this.methodMetricsByMinute[dateId] = {
      methods: Object.create(null),
    };
  }

  let methods = this.methodMetricsByMinute[dateId].methods;

  // initialize method
  if (!methods[method]) {
    methods[method] = {
      count: 0,
      errors: 0,
      fetchedDocSize: 0,
      sentMsgSize: 0,
      waitedOn: 0,
      histogram: new DDSketch({
        alpha: 0.02
      })
    };

    METHOD_METRICS_FIELDS.forEach(function (field) {
      methods[method][field] = 0;
    });
  }

  return this.methodMetricsByMinute[dateId].methods[method];
};

MethodsModel.prototype.processMethod = function (methodTrace) {
  const dateId = this._getDateId(methodTrace.at);

  // append metrics to previous values
  this._appendMetrics(dateId, methodTrace);
  if (methodTrace.errored) {
    this.methodMetricsByMinute[dateId].methods[methodTrace.name].errors++;
  }

  this.tracerStore.addTrace(methodTrace);
};

MethodsModel.prototype._appendMetrics = function (id, methodTrace) {
  const methodMetrics = this._getMetrics(id, methodTrace.name);

  // startTime needs to be converted into serverTime before sending
  if (!this.methodMetricsByMinute[id].startTime) {
    this.methodMetricsByMinute[id].startTime = methodTrace.at;
  }

  // merge
  METHOD_METRICS_FIELDS.forEach(function (field) {
    let value = methodTrace.metrics[field];
    if (value > 0) {
      methodMetrics[field] += value;
    }
  });

  methodMetrics.count++;
  methodMetrics.histogram.add(methodTrace.metrics.total);
  this.methodMetricsByMinute[id].endTime = methodTrace.metrics.at;
};

MethodsModel.prototype.trackDocSize = function (method, size) {
  const timestamp = Ntp._now();
  const dateId = this._getDateId(timestamp);

  let methodMetrics = this._getMetrics(dateId, method);
  methodMetrics.fetchedDocSize += size;
};

MethodsModel.prototype.trackMsgSize = function (method, size) {
  const timestamp = Ntp._now();
  const dateId = this._getDateId(timestamp);

  let methodMetrics = this._getMetrics(dateId, method);
  methodMetrics.sentMsgSize += size;
};

MethodsModel.prototype.trackWaitedOn = function (method, messageQueue, started) {
  const timestamp = Ntp._now();
  const dateId = this._getDateId(timestamp);

  let methodMetrics = this._getMetrics(dateId, method);
  methodMetrics.waitedOn += calculateWaitedOnTime(messageQueue, started);
};

MethodsModel.prototype.buildMetricsPayload = function () {
  let metrics = [];

  // handling metrics
  let methodMetricsByMinute = this.methodMetricsByMinute;
  this.methodMetricsByMinute = Object.create(null);

  // create final payload for methodMetrics
  for (let key in methodMetricsByMinute) {
    const methodMetrics = methodMetricsByMinute[key];
    // converting startTime into the actual serverTime
    let startTime = methodMetrics.startTime;
    methodMetrics.startTime = Kadira.syncedDate.syncTime(startTime);

    for (let methodName in methodMetrics.methods) {
      METHOD_METRICS_FIELDS.forEach(function (field) {
        methodMetrics.methods[methodName][field] /=
          methodMetrics.methods[methodName].count;
      });
    }

    metrics.push(methodMetricsByMinute[key]);
  }

  return metrics;
};


MethodsModel.prototype.buildTracesPayload = function () {
  return this.tracerStore.collectTraces();
};
