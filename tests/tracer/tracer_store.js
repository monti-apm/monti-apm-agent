import { TracerStore } from '../../lib/tracer/tracer_store';

Tinytest.add(
  'TracerStore - ._getMean',
  function (test) {
    let ts = new TracerStore();
    let mean = ts._getMean([10, 20, 30]);
    test.equal(mean, 20);
  }
);

Tinytest.add(
  'TracerStore - ._getMedian',
  function (test) {
    let ts = new TracerStore();
    let median = ts._getMedian([10, 20, 30, 40, 1, 3]);
    test.equal(median, 15);
  }
);

Tinytest.add(
  'TracerStore - ._calculateMad',
  function (test) {
    let ts = new TracerStore();
    let dataSet = [10, 20, 30, 40, 1, 3, 3];
    let median = ts._getMedian(dataSet);
    let mad = ts._calculateMad(dataSet, median);
    test.equal(mad, 9);
  }
);

Tinytest.add(
  'TracerStore - ._isOutlier',
  function (test) {
    let ts = new TracerStore();
    let dataSet = [10, 20, 30, 40, 1, 3, 3];
    let isOutlier = ts._isOutlier(dataSet, 40, 3);
    test.equal(isOutlier, true);
  }
);

Tinytest.add(
  'TracerStore - lower outlier',
  function (test) {
    let ts = new TracerStore();
    let dataSet = [10, 20, 30, 40, 20, 30, 30, 1];
    let isOutlier = ts._isOutlier(dataSet, 1, 3);
    test.equal(isOutlier, true);
  }
);

Tinytest.add(
  'TracerStore - addTrace - fresh add',
  function (test) {
    let ts = new TracerStore();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    let currentMaxTrace = ts.currentMaxTrace;
    test.equal(currentMaxTrace, {'method::one': {name: 'one', type: 'method', metrics: {total: 100}}});
  }
);

Tinytest.add(
  'TracerStore - addTrace - second time higher total',
  function (test) {
    let ts = new TracerStore();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    let currentMaxTrace = ts.currentMaxTrace;
    test.equal(currentMaxTrace, {'method::one': {name: 'one', type: 'method', metrics: {total: 200}}});
  }
);

Tinytest.add(
  'TracerStore - addTrace - second time lower total',
  function (test) {
    let ts = new TracerStore();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 20}});
    let currentMaxTrace = ts.currentMaxTrace;
    test.equal(currentMaxTrace, {'method::one': {name: 'one', type: 'method', metrics: {total: 100}}});
  }
);

Tinytest.add(
  'TracerStore - processTraces - process at first',
  function (test) {
    let ts = new TracerStore({archiveEvery: 3});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    test.equal(ts.currentMaxTrace, {'method::one': null});
    test.equal(ts.maxTotals, {'method::one': [100]});
    test.equal(ts.traceArchive, [{name: 'one', type: 'method', metrics: {total: 100}}]);
  }
);

Tinytest.add(
  'TracerStore - processTraces - no traces',
  function (test) {
    let ts = new TracerStore({maxTotalPoints: 3});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    ts.processTraces();
    test.equal(ts.maxTotals, {'method::one': [100, 0]});
    test.equal(ts.traceArchive, [{name: 'one', type: 'method', metrics: {total: 100}}]);
  }
);

Tinytest.add(
  'TracerStore - processTraces - maxTotalPoints',
  function (test) {
    let ts = new TracerStore({maxTotalPoints: 3});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 400}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 300}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    ts.processTraces();
    test.equal(ts.maxTotals, {'method::one': [400, 300, 200]});
  }
);

Tinytest.add(
  'TracerStore - processTraces - process three times: with new traces(no outliers)',
  function (test) {
    let ts = new TracerStore({archiveEvery: 20});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 150}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    ts.processTraces();
    test.equal(ts.currentMaxTrace, {'method::one': null});
    test.equal(ts.maxTotals, {'method::one': [100, 150, 200]});
    test.equal(ts.traceArchive, [{name: 'one', type: 'method', metrics: {total: 100}}]);
  }
);

Tinytest.add(
  'TracerStore - processTraces - process time times: with no new traces: with defaultArchive',
  function (test) {
    let ts = new TracerStore({archiveEvery: 3});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 150}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 180}});
    ts.processTraces();
    test.equal(ts.currentMaxTrace, {'method::one': null});
    test.equal(ts.maxTotals, {'method::one': [100, 150, 200, 180]});
    test.equal(ts.traceArchive, [
      {name: 'one', type: 'method', metrics: {total: 100}},
      {name: 'one', type: 'method', metrics: {total: 180}}
    ]);
  }
);

Tinytest.add(
  'TracerStore - processTraces - process three times: with one outlier',
  function (test) {
    let ts = new TracerStore({archiveEvery: 20});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 1500}});
    ts.processTraces();
    test.equal(ts.currentMaxTrace, {'method::one': null});
    test.equal(ts.maxTotals, {'method::one': [100, 200, 1500]});
    test.equal(ts.traceArchive, [
      {name: 'one', type: 'method', metrics: {total: 100}},
      {name: 'one', type: 'method', metrics: {total: 1500}}
    ]);
  }
);

Tinytest.add(
  'TracerStore - processTraces - process 5 times: two outlier',
  function (test) {
    let ts = new TracerStore({archiveEvery: 20});
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 100}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 150}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 200}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 1500}});
    ts.processTraces();
    ts.addTrace({name: 'one', type: 'method', metrics: {total: 1800}});
    ts.processTraces();
    test.equal(ts.currentMaxTrace, {'method::one': null});
    test.equal(ts.maxTotals, {'method::one': [100, 150, 200, 1500, 1800]});
    test.equal(ts.traceArchive, [
      {name: 'one', type: 'method', metrics: {total: 100}},
      {name: 'one', type: 'method', metrics: {total: 1500}},
      {name: 'one', type: 'method', metrics: {total: 1800}}
    ]);
  }
);

Tinytest.add(
  'TracerStore - _handleErrors - single error',
  function (test) {
    let trace = {name: 'one',
      type: 'method',
      events: [
        ['start'],
        ['end', 0, {error: {message: 'ERROR_MESSAGE'}}]
      ]};
    let ts = new TracerStore();
    ts._handleErrors(trace);
    test.equal(ts.traceArchive, [trace]);
  }
);

Tinytest.add(
  'TracerStore - _handleErrors - single error no data',
  function (test) {
    let trace = {name: 'one',
      type: 'method',
      events: [
        ['start'],
        ['end', 0]
      ]};
    const ts = new TracerStore();
    ts._handleErrors(trace);
    test.equal(ts.traceArchive, []);
  }
);

Tinytest.add(
  'TracerStore - _handleErrors - multiple error',
  function (test) {
    let trace = {name: 'one',
      type: 'method',
      events: [
        ['start'],
        ['end', 0, {error: {message: 'ERROR_MESSAGE'}}]
      ]};
    let ts = new TracerStore();
    ts._handleErrors(trace);
    ts._handleErrors(trace);
    ts._handleErrors(trace);
    test.equal(ts.traceArchive, [trace]);
  }
);

Tinytest.add(
  'TracerStore - _handleErrors - multiple different error',
  function (test) {
    let trace = {name: 'one',
      type: 'method',
      events: [
        ['start'],
        ['end', 0, {error: {message: 'ERROR_MESSAGE'}}]
      ]};
    let trace2 = {name: 'two',
      type: 'method',
      events: [
        ['start'],
        ['end', 0, {error: {message: 'ERROR_MESSAGE'}}]
      ]};
    let ts = new TracerStore();
    ts._handleErrors(trace);
    ts._handleErrors(trace);
    ts._handleErrors(trace2);
    test.equal(ts.traceArchive, [trace, trace2]);
  }
);

Tinytest.add(
  'TracerStore - _handleErrors - multiple errors after rest',
  function (test) {
    let trace = {name: 'one',
      type: 'method',
      events: [
        ['start'],
        ['end', 0, {error: {message: 'ERROR_MESSAGE'}}]
      ]};
    let ts = new TracerStore();
    ts._handleErrors(trace);
    ts._handleErrors(trace);
    ts._handleErrors(trace);
    ts.processTraces();
    ts._handleErrors(trace);
    ts._handleErrors(trace);
    test.equal(ts.traceArchive, [trace, trace]);
  }
);
