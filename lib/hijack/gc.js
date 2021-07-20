let PerformanceObserver;
let constants;
let performance;

try {
  // Only available in Node 8.5 and newer
  ({
    PerformanceObserver,
    constants,
    performance
  } = require('perf_hooks'));
} catch (e) {}

export default class GCMetrics {
  constructor() {
    this._observer = null;
    this.started = false;
    this.metrics = {};

    this.reset();
  }

  start() {
    if (this.started) {
      return false;
    }

    if (!PerformanceObserver || !constants) {
      // The node version is too old to have PerformanceObserver
      return false;
    }

    this.started = true;

    this.observer = new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        let metric = this._mapKindToMetric(entry.kind);
        this.metrics[metric] += entry.duration;
      });

      // The function was removed in Node 10 since it stopped storing old
      // entries
      if (typeof performance.clearGC === 'function') {
        performance.clearGC();
      }
    });

    this.observer.observe({ entryTypes: ['gc'], buffered: false });
  }

  _mapKindToMetric(gcKind) {
    switch(gcKind) {
      case constants.NODE_PERFORMANCE_GC_MAJOR:
        return 'gcMajor';
      case constants.NODE_PERFORMANCE_GC_MINOR:
        return 'gcMinor';
      case constants.NODE_PERFORMANCE_GC_INCREMENTAL:
        return 'gcIncremental';
      case constants.NODE_PERFORMANCE_GC_WEAKCB:
        return 'gcWeakCB';
      default:
        console.log(`Monti APM: Unrecognized GC Kind: ${gcKind}`);
    }
  }

  reset() {
    this.metrics = {
      gcMajor: 0,
      gcMinor: 0,
      gcIncremental: 0,
      gcWeakCB: 0
    };
  }
}
