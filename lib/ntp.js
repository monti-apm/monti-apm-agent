import { Meteor } from 'meteor/meteor';
import { Retry } from './retry';

const logger = getLogger();

export class Ntp {
  constructor (options) {
    const {endpoint, disableNtp} = options || {};

    this.isDisabled = disableNtp;
    this.path = '/simplentp/sync';
    this.setEndpoint(endpoint);
    this.diff = 0;
    this.synced = false;
    this.reSyncCount = 0;
    this.reSync = new Retry({
      baseTimeout: 1000 * 60,
      maxTimeout: 1000 * 60 * 10,
      minCount: 0
    });
  }

  static _now () {
    const now = Date.now();
    if (typeof now === 'number') {
      return now;
    } else if (now instanceof Date) {
      // some extenal JS libraries override Date.now and returns a Date object
      // which directly affect us. So we need to prepare for that
      return now.getTime();
    }
    // trust me. I've seen now === undefined
    return new Date().getTime();
  }

  setEndpoint (endpoint) {
    this.endpoint = endpoint ? endpoint + this.path : null;
  }

  getTime () {
    return Ntp._now() + Math.round(this.diff);
  }

  syncTime (localTime) {
    return localTime + Math.ceil(this.diff);
  }

  sync () {
    if (this.endpoint === null || this.isDisabled) {
      return;
    }

    logger('init sync');
    let self = this;
    let retryCount = 0;

    let retry = new Retry({
      baseTimeout: 1000 * 20,
      maxTimeout: 1000 * 60,
      minCount: 1,
      minTimeout: 0
    });

    syncTime();

    function syncTime () {
      if (retryCount < 5) {
        logger('attempt time sync with server', retryCount);
        // if we send 0 to the retryLater, cacheDns will run immediately
        retry.retryLater(retryCount++, cacheDns);
      } else {
        logger('maximum retries reached');
        self.reSync.retryLater(self.reSyncCount++, function () {
          let args = [].slice.call(arguments);
          self.sync(...args);
        });
      }
    }

    // first attempt is to cache dns. So, calculation does not
    // include DNS resolution time
    function cacheDns () {
      self.getServerTime(function (err) {
        if (!err) {
          calculateTimeDiff();
        } else {
          syncTime();
        }
      });
    }

    function calculateTimeDiff () {
      let clientStartTime = new Date().getTime();
      self.getServerTime(function (err, serverTime) {
        if (!err && serverTime) {
          // (Date.now() + clientStartTime)/2 : Midpoint between req and res
          let networkTime = (new Date().getTime() - clientStartTime) / 2;
          let serverStartTime = serverTime - networkTime;
          self.diff = serverStartTime - clientStartTime;
          self.synced = true;
          // we need to send 1 into retryLater.
          self.reSync.retryLater(self.reSyncCount++, function () {
            let args = [].slice.call(arguments);
            self.sync(...args);
          });
          logger('successfully updated diff value', self.diff);
        } else {
          syncTime();
        }
      });
    }
  }

  getServerTime (callback) {
    let self = this;

    if (self.endpoint === null) {
      throw new Error('getServerTime requires the endpoint to be set');
    }

    if (self.isDisabled) {
      throw new Error('getServerTime requires NTP to be enabled');
    }

    if (Meteor.isServer) {
      Kadira.coreApi.get(self.path, {noRetries: true}).then(content => {
        let serverTime = parseInt(content, 10);
        callback(null, serverTime);
      })
        .catch(err => {
          callback(err);
        });
    } else {
      Kadira._makeHttpRequest('GET', `${self.endpoint}?noCache=${new Date().getTime()}-${Math.random()}`, function (err, res) {
        if (err) {
          callback(err);
        } else {
          let serverTime = parseInt(res.content, 10);
          callback(null, serverTime);
        }
      });
    }
  }
}

function getLogger () {
  if (Meteor.isServer) {
    return Npm.require('debug')('kadira:ntp');
  }

  return function (message) {
    let canLog = false;
    try {
      canLog = global.localStorage.getItem('LOG_KADIRA') !== null && typeof console !== 'undefined';
      // eslint-disable-next-line no-empty
    } catch (e) { } // older browsers can sometimes throw because of getItem

    if (!canLog) {
      return;
    }

    if (message) {
      message = `kadira:ntp ${message}`;
      arguments[0] = message;
    }

    // eslint-disable-next-line no-console
    console.log(...arguments);
  };
}
