/* global Kadira */

import { DDSketch } from 'monti-apm-sketches-js';
import { _ } from 'meteor/underscore';
import { KadiraModel } from './0model';
import { TracerStore } from '../tracer/tracer_store';

const METHOD_METRICS_FIELDS = ['db', 'http', 'email', 'async', 'compute', 'total', 'fs'];

export function HttpModel () {
  this.metricsByMinute = Object.create(null);
  this.tracerStore = new TracerStore({
    interval: 1000 * 10,
    maxTotalPoints: 30,
    archiveEvery: 10
  });

  this.tracerStore.start();
}

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
  const requestMetrics = this._getMetrics(dateId, trace.name);

  if (!this.metricsByMinute[dateId].startTime) {
    this.metricsByMinute[dateId].startTime = trace.at;
  }

  // merge
  METHOD_METRICS_FIELDS.forEach(field => {
    const value = trace.metrics[field];
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
  const payload = {
    httpMetrics: [],
    httpRequests: []
  };

  const metricsByMinute = this.metricsByMinute;
  this.metricsByMinute = Object.create(null);

  // eslint-disable-next-line guard-for-in
  for (let key in metricsByMinute) {
    const metrics = metricsByMinute[key];
    // convert startTime into the actual serverTime
    const startTime = metrics.startTime;
    metrics.startTime = Kadira.syncedDate.syncTime(startTime);

    // eslint-disable-next-line guard-for-in
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
