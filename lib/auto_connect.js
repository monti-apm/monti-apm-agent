import { Meteor } from 'meteor/meteor';

const envOptions = Kadira._parseEnv(process.env);
const montiSettings = Meteor.settings.monti || Meteor.settings.kadira;

Kadira._connectWithEnv = function (env) {
  if (env.appId && env.appSecret) {
    Kadira.connect(
      env.appId,
      env.appSecret,
      env
    );

    Kadira.connect = function () {
      throw new Error('Monti APM: already connected using credentials from Environment Variables');
    };
  }
};


Kadira._connectWithSettings = function (settings) {
  if (
    settings &&
    settings.appId &&
    settings.appSecret
  ) {
    Kadira.connect(
      settings.appId,
      settings.appSecret,
      settings.options || {}
    );

    Kadira.connect = function () {
      throw new Error('Monti APM: already connected using credentials from Meteor.settings');
    };
  }
};

/**
 * We need to instrument this right away, and it's okay
 * One reason for this is to call `setLabels()` function
 * Otherwise, CPU profile can't see all our custom labeling
 */
let settingsOptions = montiSettings && montiSettings.options || {};
if (
  envOptions.disableInstrumentation || settingsOptions.disableInstrumentation
) {
  // eslint-disable-next-line no-console
  console.log('Monti APM: Instrumentation is disabled. Metrics and traces will not be recorded.');
} else {
  Kadira._startInstrumenting();
}

Kadira._connectWithEnv(envOptions);
Kadira._connectWithSettings(settingsOptions);
