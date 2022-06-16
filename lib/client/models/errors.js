ErrorModel = function (options) {
  BaseErrorModel.call(this);
  options = options || {};
  options.maxErrorsPerInterval = options.maxErrorsPerInterval || 10;
  options.intervalInMillis = options.intervalInMillis || 1000 * 60 * 2; // 2 mins
  options.waitForNtpSyncInterval = options.waitForNtpSyncInterval || 0;
  let self = this;

  self.options = options;

  // errorsSentCount will be reseted at the start of the interval
  self.errorsSentCount = 0;
  self.errorsSent = Object.create(null);
  self.intervalTimeoutHandler = setInterval(function () {
    self.errorsSentCount = 0;
    self._flushErrors();
  }, self.options.intervalInMillis);
};

Object.assign(ErrorModel.prototype, BaseErrorModel.prototype);

ErrorModel.prototype.sendError = function (errorDef, err, force) {
  let self = this;
  if (!this.applyFilters('client', errorDef.name, err, errorDef.subType)) {
    return;
  }

  if (!this.canSendErrors()) {
    // reached maximum error count for this interval (1 min)
    return;
  }

  if (force) {
    sendError();
  } else if (Kadira.syncedDate.synced || self.options.waitForNtpSyncInterval == 0) {
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
      let payload = self._buildPayload([errorDef]);
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
  let arch = getClientArch();

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
  return !!this.errorsSent[name];
};

ErrorModel.prototype.increamentErrorCount = function (name) {
  let error = this.errorsSent[name];
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
