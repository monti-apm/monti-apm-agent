/* global Kadira, Npm */

import { Meteor } from 'meteor/meteor';
import { httpRequest } from './client/utils';
import { getLocalTime } from './common/utils';
import { Retry } from './retry';

const logger = getLogger();

export function Ntp (endpoint) {
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

Ntp.prototype.setEndpoint = function (endpoint) {
  this.endpoint = endpoint ? endpoint + this.path : null;
};

Ntp.prototype.getTime = function () {
  return getLocalTime() + Math.round(this.diff);
};

Ntp.prototype.syncTime = function (localTime) {
  return localTime + Math.ceil(this.diff);
};

Ntp.prototype.sync = function () {
  if (this.endpoint === null) {
    return;
  }

  logger('init sync');
  const self = this;
  let retryCount = 0;
  const retry = new Retry({
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
        const args = [].slice.call(arguments);
        // eslint-disable-next-line prefer-spread
        self.sync.apply(self, args);
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
    let clientStartTime = getLocalTime();
    self.getServerTime(function (err, serverTime) {
      if (!err && serverTime) {
        // (Date.now() + clientStartTime)/2 : Midpoint between req and res
        const networkTime = (getLocalTime() - clientStartTime) / 2;
        const serverStartTime = serverTime - networkTime;
        self.diff = serverStartTime - clientStartTime;
        self.synced = true;
        // we need to send 1 into retryLater.
        self.reSync.retryLater(self.reSyncCount++, function () {
          const args = [].slice.call(arguments);
          // eslint-disable-next-line prefer-spread
          self.sync.apply(self, args);
        });
        logger('successfully updated diff value', self.diff);
      } else {
        syncTime();
      }
    });
  }
};

Ntp.prototype.getServerTime = function (callback) {
  let self = this;

  if (self.endpoint === null) {
    throw new Error('getServerTime requires the endpoint to be set');
  }

  if (Meteor.isServer) {
    Kadira.coreApi.get(self.path, { noRetries: true }).then(content => {
      let serverTime = parseInt(content,10);
      callback(null, serverTime);
    })
      .catch(err => {
        callback(err);
      });
  } else {
    httpRequest('GET', `${self.endpoint}?noCache=${new Date().getTime()}-${Math.random()}`, function (err, res) {
      if (err) {
        callback(err);
      } else {
        let serverTime = parseInt(res.content,10);
        callback(null, serverTime);
      }
    });
  }
};

function getLogger () {
  if (Meteor.isServer) {
    return Npm.require('debug')('kadira:ntp');
  }

  return function (message) {
    let canLogKadira;
    try {
      canLogKadira = global.localStorage.getItem('LOG_KADIRA') !== null && typeof console !== 'undefined';
      // eslint-disable-next-line no-empty
    } catch (e) { } // older browsers can sometimes throw because of getItem
    if (canLogKadira) {
      if (message) {
        message = `kadira:ntp ${message}`;
        arguments[0] = message;
      }
      // eslint-disable-next-line prefer-spread
      console.log.apply(console, arguments);
    }
  };
}
