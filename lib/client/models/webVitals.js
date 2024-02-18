import { Tracker } from 'meteor/tracker';
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';
import { getClientArchVersion } from '../../common/utils';
import { Ntp } from '../../ntp';
import { unwrapDynamicImport } from '../hijack/wrapDynamicImport';
import { unwrapMethodCall } from '../hijack/wrapMethodCall';
import { unwrapSubscription } from '../hijack/wrapSubscription';
import { getBrowserInfo, getClientArch } from '../utils';
import { unWrapLogin, wrapLogin } from '../hijack/wrapLogin';
const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length || 0;

export class WebVitalsModel {
  startTime = Ntp._now();
  connectionTime = 0;
  loggedIn = 0;
  importTime = [];
  methods = [];
  subs = [];
  queue = new Set();

  addToQueue (metric) {
    this.queue.add({ metric: metric.value, matricName: metric.name });
  }

  flushQueue () {
    if (this.queue.size > 0) {
      Kadira.send(this._buildPayload([...this.queue]), '/client-metrics');
      this.queue.clear();
    }
  }

  startTracking () {
    const bindedAddToQueue = this.addToQueue.bind(this);
    onFCP(bindedAddToQueue);
    onFID(bindedAddToQueue);
    onINP(bindedAddToQueue);
    onLCP(bindedAddToQueue);
    onTTFB(bindedAddToQueue);
    onCLS(bindedAddToQueue);

    Tracker.autorun((computation) => {
      const {connected} = Meteor.status();
      if (connected) {
        this.connectionTime = Ntp._now() - this.startTime;
        computation.stop();
      }
    });


    // startup hooks run after the page is loaded
    Meteor.startup(() => {
      wrapLogin();

      // wait until all startup hooks called (they're called synchronously all at once on the client)
      setTimeout(() => {
        /* calling unwrap before the document readyState is complete
         is not the best for react based apps as it's not guaranteed the components are mounted
         and hooks are called making the subscription */
        document.onreadystatechange = function () {
          if (document.readyState === 'complete') {
            /* stop tracking new dynamic imports/methods/publications */
            unwrapDynamicImport();
            unwrapSubscription();
            unwrapMethodCall();
            unWrapLogin();
          }
        };
      });
    });
    // Report all available metrics whenever the page is backgrounded or unloaded.
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushQueue();
      }
    });

    // NOTE: Safari does not reliably fire the `visibilitychange` event when the
    // page is being unloaded. If Safari support is needed, you should also flush
    // the queue in the `pagehide` event.
    addEventListener('pagehide', this.flushQueue.bind(this));
  }

  constructor (options) {
    options = options || {};

    this.options = options;
  }
  _buildPayload = function (metrics) {
    const arch = getClientArch();
    const browserInfo = getBrowserInfo();
    metrics.push({
      metric: this.connectionTime,
      metricName: 'connectionTime'
    });
    metrics.push({
      metric: this.loggedIn,
      metricName: 'loginTime'
    });
    metrics.push({
      metric: average(this.importTime),
      metricName: 'dynamicImportTime'
    });
    metrics.push({
      metric: average(this.methods),
      metricName: 'methods'
    });
    metrics.push({
      metric: average(this.subs),
      metricName: 'subs'
    });

    return {
      host: Kadira.options.hostname,
      recordIPAddress: Kadira.options.recordIPAddress,
      metrics,
      ...browserInfo,
      arch,
      legacy: arch.endsWith('.legacy'),
      commitHash: Meteor.gitCommitHash,
      cacheCleaned: !localStorage?.length && !sessionStorage?.length,
      archVersion: getClientArchVersion(arch),
    };
  };
}
