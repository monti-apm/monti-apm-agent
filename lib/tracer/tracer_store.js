import { _ } from 'meteor/underscore';
import { EJSON } from 'meteor/ejson';
let logger = Npm.require('debug')('kadira:ts');

export function TracerStore (options) {
  options = options || {};

  this.maxTotalPoints = options.maxTotalPoints || 30;
  this.interval = options.interval || 1000 * 60;
  this.archiveEvery = options.archiveEvery || this.maxTotalPoints / 6;

  // store max total on the past 30 minutes (or past 30 items)
  this.maxTotals = Object.create(null);
  // store the max trace of the current interval
  this.currentMaxTrace = Object.create(null);
  // archive for the traces
  this.traceArchive = [];

  this.processedCnt = Object.create(null);

  // group errors by messages between an interval
  this.errorMap = Object.create(null);
}

TracerStore.prototype.addTrace = function (trace) {
  let kind = [trace.type, trace.name].join('::');
  if (!this.currentMaxTrace[kind]) {
    this.currentMaxTrace[kind] = EJSON.clone(trace);
  } else if (this.currentMaxTrace[kind].metrics.total < trace.metrics.total) {
    this.currentMaxTrace[kind] = EJSON.clone(trace);
  } else if (trace.errored) {
    this._handleErrors(trace);
  }
};

TracerStore.prototype.collectTraces = function () {
  let traces = this.traceArchive;
  this.traceArchive = [];

  // convert at(timestamp) into the actual serverTime
  traces.forEach(function (trace) {
    trace.at = Kadira.syncedDate.syncTime(trace.at);
  });
  return traces;
};

TracerStore.prototype.start = function () {
  this._timeoutHandler = setInterval(this.processTraces.bind(this), this.interval);
};

TracerStore.prototype.stop = function () {
  if (this._timeoutHandler) {
    clearInterval(this._timeoutHandler);
  }
};

TracerStore.prototype._handleErrors = function (trace) {
  // sending error requests as it is
  let lastEvent = trace.events[trace.events.length - 1];
  if (lastEvent && lastEvent[2]) {
    let error = lastEvent[2].error;

    if (!error) {
      logger('trace does not have valid error', JSON.stringify(trace.events));
      return;
    }

    // grouping errors occured (reset after processTraces)
    let errorKey = [trace.type, trace.name, error.message].join('::');
    if (!this.errorMap[errorKey]) {
      let erroredTrace = EJSON.clone(trace);
      this.errorMap[errorKey] = erroredTrace;

      this.traceArchive.push(erroredTrace);
    }
  } else {
    logger('last events is not an error: ', JSON.stringify(trace.events));
  }
};

TracerStore.prototype.processTraces = function () {
  let self = this;

  let kinds = new Set();
  Object.keys(this.maxTotals).forEach(key => {
    kinds.add(key);
  });
  Object.keys(this.currentMaxTrace).forEach(key => {
    kinds.add(key);
  });

  for (const kind of kinds) {
    self.processedCnt[kind] = self.processedCnt[kind] || 0;
    let currentMaxTrace = self.currentMaxTrace[kind];
    let currentMaxTotal = currentMaxTrace ? currentMaxTrace.metrics.total : 0;

    self.maxTotals[kind] = self.maxTotals[kind] || [];
    // add the current maxPoint
    self.maxTotals[kind].push(currentMaxTotal);
    let exceedingPoints = self.maxTotals[kind].length - self.maxTotalPoints;
    if (exceedingPoints > 0) {
      self.maxTotals[kind].splice(0, exceedingPoints);
    }

    let archiveDefault = (self.processedCnt[kind] % self.archiveEvery) === 0;
    self.processedCnt[kind]++;

    let canArchive = archiveDefault ||
      self._isTraceOutlier(kind, currentMaxTrace);

    if (canArchive && currentMaxTrace) {
      self.traceArchive.push(currentMaxTrace);
    }

    // reset currentMaxTrace
    self.currentMaxTrace[kind] = null;
  }

  // reset the errorMap
  self.errorMap = Object.create(null);
};

TracerStore.prototype._isTraceOutlier = function (kind, trace) {
  if (trace) {
    let dataSet = this.maxTotals[kind];
    return this._isOutlier(dataSet, trace.metrics.total, 3);
  }
  return false;
};

/*
  Data point must exists in the dataSet
*/
TracerStore.prototype._isOutlier = function (dataSet, dataPoint, maxMadZ) {
  let median = this._getMedian(dataSet);
  let mad = this._calculateMad(dataSet, median);
  let madZ = this._funcMedianDeviation(median)(dataPoint) / mad;

  return madZ > maxMadZ;
};

TracerStore.prototype._getMedian = function (dataSet) {
  let sortedDataSet = _.clone(dataSet).sort(function (a, b) {
    return a - b;
  });
  return this._pickQuartile(sortedDataSet, 2);
};

TracerStore.prototype._pickQuartile = function (dataSet, num) {
  let pos = ((dataSet.length + 1) * num) / 4;
  if (pos % 1 === 0) {
    return dataSet[pos - 1];
  }
  pos -= pos % 1;
  return (dataSet[pos - 1] + dataSet[pos]) / 2;
};

TracerStore.prototype._calculateMad = function (dataSet, median) {
  let medianDeviations = _.map(dataSet, this._funcMedianDeviation(median));
  let mad = this._getMedian(medianDeviations);

  return mad;
};

TracerStore.prototype._funcMedianDeviation = function (median) {
  return function (x) {
    return Math.abs(median - x);
  };
};

TracerStore.prototype._getMean = function (dataPoints) {
  if (dataPoints.length > 0) {
    let total = 0;
    dataPoints.forEach(function (point) {
      total += point;
    });
    return total / dataPoints.length;
  }
  return 0;
};
