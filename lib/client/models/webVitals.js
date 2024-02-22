import { Tracker } from 'meteor/tracker';
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';
import { getClientArchVersion } from '../../common/utils';
import { Ntp } from '../../ntp';
import { unwrapDynamicImport } from '../hijack/wrapDynamicImport';
import { unWrapLogin, wrapLogin } from '../hijack/wrapLogin';
import { unwrapMethodCall } from '../hijack/wrapMethodCall';
import { unwrapSubscription } from '../hijack/wrapSubscription';
import { getBrowserInfo, getClientArch } from '../utils';
const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length || 0;

export class WebVitalsModel {
  startTime = Ntp._now();
  connectionTime = 0;
  loggedIn = 0;
  importTime = [];
  methods = [];
  subs = [];
  queue = new Set();
  sent = false;
  pendingObjects = 0;
  completedObjects = 0;

  addToQueue (metric) {
    this.queue.add({ metric: metric.value, matricName: metric.name });
  }

  flushQueue () {
    if (this.sent) {
      return;
    }
    navigator.sendBeacon(`${Kadira.options.endpoint}/client-metrics`, this._buildPayload([...this.queue]));
    this.sent = true;
  }

  stopTracking () {
    unwrapDynamicImport();
    unwrapSubscription();
    unwrapMethodCall();
    unWrapLogin();
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
        this.connectionTime = Ntp._now();
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
        if (document.readyState === 'complete') {
          this.stopTracking();
        } else {
          addEventListener('readystatechange', () => {
            if (document.readyState === 'complete') {
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
    metricsArray.forEach(m => {
      metrics[m.metricName] = m.metric;
    });
    const arch = getClientArch();
    const browserInfo = getBrowserInfo();
    metrics.connectionTime = this.connectionTime;
    metrics.loginTime = this.loggedIn;
    metrics.dynamicImportTime = this.importTime;
    metrics.methods = average(this.methods);
    metrics.subs = this.subs;

    return {
      recordIPAddress: Kadira.options.recordIPAddress,
      metrics,
      ...browserInfo,
      commitHash: Meteor.gitCommitHash,
      cacheCleaned: !localStorage?.length && !sessionStorage?.length,
      archVersion: getClientArchVersion(arch),
      incompleteSession: this.pendingObjects > 0 && this.pendingObjects > this.completedObjects
    };
  };
}
