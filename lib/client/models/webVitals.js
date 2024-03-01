import { Tracker } from 'meteor/tracker';
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';
import { getClientArchVersion } from '../../common/utils';
import { Ntp } from '../../ntp';
import { unwrapDynamicImport, wrapDynamicImport } from '../hijack/wrapDynamicImport';
import { wrapLogin } from '../hijack/wrapLogin';
import { unwrapMethodCall, wrapMethodCall } from '../hijack/wrapMethodCall';
import { unwrapSubscription, wrapSubscription } from '../hijack/wrapSubscription';
import { getBrowserInfo, getClientArch } from '../utils';

function calculateTimeframe (array) {
  const {lastEnd, firstStart} = array.reduce((acc, current) => {
    if (current.end > acc.lastEnd) {
      acc.lastEnd = current.end;
    }
    if (current.start < acc.firstStart) {
      acc.firstStart = current.start;
    }
    return acc;
  }, { lastEnd: 0, firstStart: Number.MAX_SAFE_INTEGER });
  return {lastEnd, firstStart};
}
export class WebVitalsModel {
  startTime = window.performance.timeOrigin;
  connectionTime = 0;
  loginEnd = 0;
  loginStart = 0;
  importTime = [];
  methods = [];
  subs = [];
  queue = new Set();
  sent = false;
  pendingObjects = 0;
  completedObjects = 0;
  dynamicImportTransferedSize = 0;

  addToQueue (metric) {
    this.queue.add({ metric: metric.value, metricName: metric.name });
  }

  flushQueue () {
    if (this.sent) {
      return;
    }
    const payload = this._buildPayload([...this.queue]);
    navigator.sendBeacon(`${Kadira.options.endpoint}/client-metrics`, JSON.stringify(payload));
    this.sent = true;
  }

  stopTracking () {
    unwrapDynamicImport();
    this.dynamicImportTransferedSize = performance.getEntriesByType('resource')
      .filter(b => b.name.includes('/__meteor__/dynamic-import/fetch'))
      .reduce((acc, cur) => {
        acc += cur.transferSize;
        return acc;
      }, 0);
    unwrapSubscription();
    unwrapMethodCall();
    if (this.pendingObjects > 0 && this.pendingObjects === this.completedObjects) this.flushQueue();
  }

  startTracking () {
    // this.queue.add({ metric: window.performance.timing.responseStart, metricName: metric.name });


    const bindedAddToQueue = this.addToQueue.bind(this);
    wrapLogin();
    wrapDynamicImport();
    wrapMethodCall();
    wrapSubscription();
    onFCP(bindedAddToQueue);
    onFID(bindedAddToQueue);
    onINP(bindedAddToQueue);
    onLCP(bindedAddToQueue);
    onTTFB(bindedAddToQueue);
    onCLS(bindedAddToQueue);

    Tracker.autorun((computation) => {
      const {connected} = Meteor.status();
      if (connected) {
        this.connectionTime = Ntp._now();
        computation.stop();
      }
    });


    // startup hooks run after the page is loaded
    Meteor.startup(() => {
      // wait until all startup hooks called (they're called synchronously all at once on the client)
      setTimeout(() => {
        /* calling unwrap before the document readyState is complete
         is not the best for react based apps as it's not guaranteed the components are mounted
         and hooks are called making the subscription */

        if (document.readyState === 'complete') {
          this.stopTracking();
        } else {
          document.addEventListener('readystatechange', () => {
            if (document.readyState === 'complete') {
              console.log('COMPLETE');
              /* stop tracking new dynamic imports/methods/publications */
              this.stopTracking();
            }
          });
        }

        // lets wait for the page hide
        if (this.pendingObjects > 0 && this.pendingObjects > this.completedObjects) return;
        // otherwise we are good to go
        this.flushQueue();
      });
    });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushQueue();
      }
    });

    // NOTE: Safari does not reliably fire the `visibilitychange` event when the
    // page is being unloaded.
    addEventListener('pagehide', this.flushQueue.bind(this));
  }

  constructor (options) {
    options = options || {};

    this.options = options;
  }
  _buildPayload = function (metricsArray) {
    const metrics = {};
    const performanceMetrics = performance.toJSON();

    const {timing: { requestStart, responseStart, responseEnd }} = performanceMetrics;
    // connection time
    metrics.connectionTimeStart = 0;
    metrics.connectionTimeEnd = responseStart - this.startTime;
    // html response
    metrics.htmlResponseTimeStart = requestStart - this.startTime;
    metrics.htmlResponseTimeEnd = responseEnd - this.startTime;
    // resources
    const resources = performance.getEntriesByType('resource');
    const {totalSize, cachedSize, lastResponseEnd, firstStartTime} = resources.reduce((acc, current) => {
      acc.totalSize += current.encodedBodySize || current.decodedBodySize;
      acc.totalDuration += current.duration;
      if (current.deliveryType === 'cache') {
        acc.cachedSize += current.encodedBodySize || current.decodedBodySize;
      }
      // resources are fetched in parallel so we cant sum up durations
      if (current.responseEnd > acc.lastResponseEnd) {
        acc.lastResponseEnd = current.responseEnd;
      }
      if (current.startTime < acc.firstStartTime) {
        acc.firstStartTime = current.startTime;
      }
      return acc;
    }, {totalSize: 0, cachedSize: 0, lastResponseEnd: 0, firstStartTime: Number.MAX_SAFE_INTEGER });

    metrics.resourcesTotalSize = totalSize;
    metrics.cachedResourcesTotalSize = cachedSize;
    // resources timeline
    metrics.resourcesRequestStart = firstStartTime;
    metrics.resourcesResponseEnd = lastResponseEnd;


    metricsArray.forEach(m => {
      metrics[m.metricName] = m.metric;
    });
    const arch = getClientArch();
    const browserInfo = getBrowserInfo();
    // TODO: have a way to get initial connection attempt
    // metrics.connectionTimeStart = metrics.resourcesResponseEnd;
    metrics.connectionTimeEnd = this.connectionTime - this.startTime;
    metrics.loginTimeStart = this.loginStart - this.startTime;
    metrics.loginTimeEnd = this.loginEnd - this.startTime;

    // dynamic import time is an array
    metrics.dynamicImportTime = this.importTime;
    metrics.dynamicImportTransferedSize = this.dynamicImportTransferedSize;
    // aggregate dynamic import metrics
    if (this.importTime.length) {
      const {lastEnd: importsEnd, firstStart: importsStart} = calculateTimeframe(this.importTime);
      metrics.importsStart = importsStart - this.startTime;
      metrics.importsEnd = importsEnd - this.startTime;
    }

    // aggregate methods metrics
    if (this.methods.length) {
      const {lastEnd: methodsEnd, firstStart: methodsStart} = calculateTimeframe(this.methods);
      metrics.methodsStart = methodsStart - this.startTime;
      metrics.methodsEnd = methodsEnd - this.startTime;
    }

    // aggregate subs metrics
    if (this.subs.length) {
      const {lastEnd: subsEnd, firstStart: subsStart} = calculateTimeframe(this.subs);
      metrics.subsStart = subsStart - this.startTime;
      metrics.subsEnd = subsEnd - this.startTime;
    }
    const payload = {
      recordIPAddress: Kadira.options.recordIPAddress,
      // round all metrics to the nearest integer
      metrics: Object.entries(metrics).reduce((acc,[key, value]) => {
        acc[key] = Math.round(value);
        return acc;
      },{}),
      ...browserInfo,
      commitHash: Meteor.gitCommitHash,
      cacheCleaned: !localStorage?.length && !sessionStorage?.length,
      archVersion: getClientArchVersion(arch),
      incompleteSession: this.pendingObjects > 0 && this.pendingObjects > this.completedObjects
    };
    return payload;
  };
}
