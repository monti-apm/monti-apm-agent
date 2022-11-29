import { EventEmitter } from 'events';

function isNode () {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

function polyfillNow () {
  const [seconds, nanoseconds] = process.hrtime();

  return seconds * 1000 + nanoseconds / 1000000;
}

export class EventLoopMonitor extends EventEmitter {
  constructor (timeoutMillis) {
    super();
    this.timeoutMillis = timeoutMillis;
    this._watchLag = this._watchLag.bind(this);
    this._stopped = true;
    this._startTime = null;
    this._totalLag = 0;

    this._registerNowFunc();
  }

  start () {
    this._stopped = false;
    this._lastWatchTime = null;
    this._startTime = Date.now();
    this._totalLag = 0;

    this.on('lag', this._watchLag);
    this._detectLag();
  }

  stop () {
    this._stopped = true;
    this.removeAllListeners('lag');
  }

  status () {
    let pctBlock = 0;
    let elapsedTime = 0;
    if (!this._stopped && this._lastWatchTime) {
      elapsedTime = this._lastWatchTime - this._startTime;
      pctBlock = (this._totalLag / elapsedTime) * 100;
    }

    let statusObject = {
      pctBlock,
      elapsedTime,
      totalLag: this._totalLag
    };

    this._startTime = this._lastWatchTime;
    this._totalLag = 0;

    return statusObject;
  }

  _watchLag (lag) {
    this._lastWatchTime = Date.now();
    this._totalLag += lag;
  }

  _detectLag () {
    let self = this;
    let start = self._now();

    setTimeout(function () {
      let end = self._now();
      let elapsedTime = end - start;
      let realDiff = elapsedTime - self.timeoutMillis;
      let lag = Math.max(0, realDiff);

      if (!self._stopped) {
        self.emit('lag', lag);
        self._detectLag();
      }
    }, self.timeoutMillis);
  }

  _registerNowFunc () {
    if (isNode()) {
      const [major] = process.versions.node.split('.').map(Number);

      if (major < 8) {
        this._now = polyfillNow;
        return;
      }

      const {
        performance
      } = require('perf_hooks');
      this._now = performance.now;
      return;
    }

    if (typeof window !== 'undefined' && window.performance && window.performance.now) {
      this._now = window.performance.now;
      return;
    }

    this._now = Date.now;
  }
}
