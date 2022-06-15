import { _ } from 'meteor/underscore';
const { DDSketch } = require('monti-apm-sketches-js');

const METHOD_METRICS_FIELDS = ['db', 'http', 'email', 'async', 'compute', 'total', 'fs'];


const HttpModel = function () {
  this.metricsByMinute = Object.create(null);
  this.tracerStore = new TracerStore({
    interval: 1000 * 10,
    maxTotalPoints: 30,
    archiveEvery: 10
  });

  this.tracerStore.start();
};

_.extend(HttpModel.prototype, KadiraModel.prototype);

HttpModel.prototype.processRequest = function (trace, req, res) {
  const dateId = this._getDateId(trace.at);
  this._appendMetrics(dateId, trace, res);
  this.tracerStore.addTrace(trace);
};

HttpModel.prototype._getMetrics = function (timestamp, routeId) {
  const dateId = this._getDateId(timestamp);

  if (!this.metricsByMinute[dateId]) {
    this.metricsByMinute[dateId] = {
      routes: Object.create(null)
    };
  }

  const routes = this.metricsByMinute[dateId].routes;

  if (!routes[routeId]) {
    routes[routeId] = {
      histogram: new DDSketch({
        alpha: 0.02,
      }),
      count: 0,
      errors: 0,
      statusCodes: Object.create(null)
    };

    METHOD_METRICS_FIELDS.forEach(function (field) {
      routes[routeId][field] = 0;
    });
  }

  return this.metricsByMinute[dateId].routes[routeId];
};

HttpModel.prototype._appendMetrics = function (dateId, trace, res) {
  let requestMetrics = this._getMetrics(dateId, trace.name);

  if (!this.metricsByMinute[dateId].startTime) {
    this.metricsByMinute[dateId].startTime = trace.at;
  }

  // merge
  METHOD_METRICS_FIELDS.forEach(field => {
    let value = trace.metrics[field];
    if (value > 0) {
      requestMetrics[field] += value;
    }
  });

  const statusCode = res.statusCode;
  let statusMetric;

  if (statusCode < 200) {
    statusMetric = '1xx';
  } else if (statusCode < 300) {
    statusMetric = '2xx';
  } else if (statusCode < 400) {
    statusMetric = '3xx';
  } else if (statusCode < 500) {
    statusMetric = '4xx';
  } else if (statusCode < 600) {
    statusMetric = '5xx';
  }

  requestMetrics.statusCodes[statusMetric] = requestMetrics.statusCodes[statusMetric] || 0;
  requestMetrics.statusCodes[statusMetric] += 1;

  requestMetrics.count += 1;
  requestMetrics.histogram.add(trace.metrics.total);
  this.metricsByMinute[dateId].endTime = trace.metrics.at;
};

HttpModel.prototype.buildPayload = function () {
  let payload = {
    httpMetrics: [],
    httpRequests: []
  };

  let metricsByMinute = this.metricsByMinute;
  this.metricsByMinute = Object.create(null);

  for (let key in metricsByMinute) {
    const metrics = metricsByMinute[key];
    // convert startTime into the actual serverTime
    let startTime = metrics.startTime;
    metrics.startTime = Kadira.syncedDate.syncTime(startTime);

    for (let requestName in metrics.routes) {
      METHOD_METRICS_FIELDS.forEach(function (field) {
        metrics.routes[requestName][field] /= metrics.routes[requestName].count;
      });
    }

    payload.httpMetrics.push(metricsByMinute[key]);
  }

  payload.httpRequests = this.tracerStore.collectTraces();

  return payload;
};

export default HttpModel;
