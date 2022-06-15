/* eslint-disable valid-jsdoc */
/* global Kadira */

import { getClientArch } from '../utils';
import { getClientArchVersion } from '../../common/utils';
import { BaseErrorModel } from '../../models/base_error';

/**
 * @param { Object } [options] - options
 * @param { number } [options.maxErrorsPerInterval=10]
 * @param { number } [options.intervalInMillis=120000]
 * @param { number} [options.waitForNtpSyncInterval=0]
 * @constructor
 */
export function ErrorModel (options) {
  BaseErrorModel.call(this);
  options = options || {};
  options.maxErrorsPerInterval = options.maxErrorsPerInterval || 10;
  options.intervalInMillis = options.intervalInMillis || 1000 * 60 * 2;
  options.waitForNtpSyncInterval = options.waitForNtpSyncInterval || 0;

  this.options = options;

  // errorsSentCount will be reseted at the start of the interval
  this.errorsSentCount = 0;
  this.errorsSent = Object.create(null);

  const self = this;
  this.intervalTimeoutHandler = setInterval(function () {
    self.errorsSentCount = 0;
    self._flushErrors();
  }, this.options.intervalInMillis);
}

Object.assign(ErrorModel.prototype, BaseErrorModel.prototype);

ErrorModel.prototype.sendError = function (errorDef, err, force) {
  const self = this;
  if (!this.applyFilters('client', errorDef.name, err, errorDef.subType)) {
    return;
  }

  if (!this.canSendErrors()) {
    // reached maximum error count for this interval (1 min)
    return;
  }

  if (force) {
    sendError();
  } else if (Kadira.syncedDate.synced || self.options.waitForNtpSyncInterval === 0) {
    sendError();
  } else {
    setTimeout(forceSendError, self.options.waitForNtpSyncInterval);
  }

  function forceSendError () {
    self.sendError(errorDef, err, true);
  }

  function sendError () {
    if (!self.errorsSent[errorDef.name]) {
      // sync time with the server
      if (errorDef.startTime) {
        errorDef.startTime = Kadira.syncedDate.syncTime(errorDef.startTime);
      }
      errorDef.count = 1;
      const payload = self._buildPayload([errorDef]);
      Kadira.send(payload, '/errors');

      self.errorsSent[errorDef.name] = { ...errorDef };
      self.errorsSent[errorDef.name].count = 0;
      self.errorsSentCount++;
    } else {
      self.increamentErrorCount(errorDef.name);
    }
  }
};

ErrorModel.prototype._buildPayload = function (errors) {
  const arch = getClientArch();

  return {
    host: Kadira.options.hostname,
    recordIPAddress: Kadira.options.recordIPAddress,
    errors,
    arch,
    archVersion: getClientArchVersion(arch)
  };
};

ErrorModel.prototype._flushErrors = function () {
  const errors = Object.values(this.errorsSent).filter(e => e.count > 0);

  if (errors.length > 0) {
    Kadira.send(this._buildPayload(errors), '/errors');
  }

  this.errorsSent = Object.create(null);
};

ErrorModel.prototype.isErrorExists = function (name) {
  return Boolean(this.errorsSent[name]);
};

ErrorModel.prototype.increamentErrorCount = function (name) {
  const error = this.errorsSent[name];
  if (error) {
    error.count++;
  }
};

ErrorModel.prototype.canSendErrors = function () {
  return this.errorsSentCount < this.options.maxErrorsPerInterval;
};

ErrorModel.prototype.close = function () {
  clearTimeout(this.intervalTimeoutHandler);
};
