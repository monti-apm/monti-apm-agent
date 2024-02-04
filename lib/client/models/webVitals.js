import { getClientArchVersion } from '../../common/utils';
import { getClientArch, getBrowserInfo } from '../utils';
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';

export class WebVitalsModel {
  startTracking () {
    const sender = (metric) =>
      Kadira.send(
        this._buildPayload({
          metric: { value: metric.value, rating: metric.rating },
          metricName: metric.name,
        }),
        '/client-metrics'
      );
    onCLS(sender);
    onFCP(sender);
    onFID(sender);
    onINP(sender);
    onLCP(sender);
    onTTFB(sender);
  }
  constructor (options) {
    options = options || {};

    this.options = options;
  }
  _buildPayload = function ({ metric, metricName }) {
    const arch = getClientArch();
    const browserInfo = getBrowserInfo();

    return {
      host: Kadira.options.hostname,
      recordIPAddress: Kadira.options.recordIPAddress,
      metricName,
      metric,
      ...browserInfo,
      arch,
      legacy: arch.endsWith('.legacy'),
      cacheCleaned: !localStorage?.length && !sessionStorage?.length,
      archVersion: getClientArchVersion(arch),
    };
  };
}
