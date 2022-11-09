/* global Zone */

import { Meteor } from 'meteor/meteor';
import { getErrorParameters } from '../common/utils';
import { ErrorModel } from './models/errors';

Kadira.enableErrorTracking = function () {
  Kadira.options.enableErrorTracking = true;
};

Kadira.disableErrorTracking = function () {
  Kadira.options.enableErrorTracking = false;
};

Kadira.trackError = function () {
  if (!Kadira.options.enableErrorTracking) {
    return;
  }

  const { message, subType, stack } = getErrorParameters(arguments);

  if (message) {
    let now = new Date().getTime();

    Kadira.errors.sendError({
      appId: Kadira.options.appId,
      name: message,
      startTime: now,
      type: 'client',
      subType: subType || 'Monti.trackError',
      info: getBrowserInfo(),
      stacks: JSON.stringify([{ at: now, events: [], stack }]),
    });
  }
};

// Create new NTP object and error model immediately so it can be used
// endpoints is set later using __meteor_runtime_config__ or publication
Kadira.syncedDate = new Ntp(null);
Kadira.errors = new ErrorModel({
  waitForNtpSyncInterval: 1000 * 5, // 5 secs
  intervalInMillis: 1000 * 60 * 1, // 1minutes
  maxErrorsPerInterval: 5
});

let initialized = false;
function initialize (options = {}) {
  if (initialized) { return; }
  initialized = true;

  Kadira.options = {
    errorDumpInterval: 1000 * 60,
    maxErrorsPerInterval: 10,
    collectAllStacks: false,
    enableErrorTracking: false,
    ...options,
  };

  if (Kadira.options.appId && Kadira.options.endpoint) {
    // update endpoint after receiving correct data
    Kadira.syncedDate.setEndpoint(Kadira.options.endpoint);
    Kadira.syncedDate.isDisabled = Kadira.options.disableNtp;

    Kadira.connected = true;
    Meteor.startup(function () {
      // if we don't do this might block the initial rendering
      // or, it will show up bottom of the page, which is not cool
      setTimeout(function () {
        Kadira.syncedDate.sync();
      }, Kadira.options.clientEngineSyncDelay);
    });
  }

  if (Kadira.connected && Kadira.options.enableErrorTracking) {
    Kadira.enableErrorTracking();
  }

  if (window.Zone && Zone.inited) {
    Zone.collectAllStacks = Kadira.options.collectAllStacks;
  }
}

// __meteor_runtime_config__ cannot be dynamically set for cordova apps
// using a null subscription to send required options to client
if (Meteor.isCordova) {
  let SettingsCollection = new Meteor.Collection('kadira_settings');
  SettingsCollection.find().observe({ added: initialize });
} else {
  // eslint-disable-next-line camelcase
  initialize(__meteor_runtime_config__.kadira);
}
