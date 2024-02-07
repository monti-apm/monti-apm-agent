import { getClientArchVersion } from '../../common/utils';
import { getClientArch, getBrowserInfo } from '../utils';
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';

export class WebVitalsModel {
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
    // Report all available metrics whenever the page is backgrounded or unloaded.
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushQueue();
      }
    });

    // NOTE: Safari does not reliably fire the `visibilitychange` event when the
    // page is being unloaded. If Safari support is needed, you should also flush
    // the queue in the `pagehide` event.
    addEventListener('pagehide', () => this.flushQueue());
  }
  constructor (options) {
    options = options || {};

    this.options = options;
  }
  _buildPayload = function (metrics) {
    const arch = getClientArch();
    const browserInfo = getBrowserInfo();

    return {
      host: Kadira.options.hostname,
      recordIPAddress: Kadira.options.recordIPAddress,
      metrics,
      ...browserInfo,
      arch,
      legacy: arch.endsWith('.legacy'),
      cacheCleaned: !localStorage?.length && !sessionStorage?.length,
      archVersion: getClientArchVersion(arch),
    };
  };
}
