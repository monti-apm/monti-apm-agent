import { Meteor } from 'meteor/meteor';

const envOptions = Kadira._parseEnv(process.env);
const montiSettings = Meteor.settings.monti || Meteor.settings.kadira;

Kadira._connectWithEnv = function () {
  if (envOptions.appId && envOptions.appSecret) {
    Kadira.connect(
      envOptions.appId,
      envOptions.appSecret,
      envOptions
    );

    Kadira.connect = function () {
      throw new Error('Kadira has been already connected using credentials from Environment Variables');
    };
  }
};


Kadira._connectWithSettings = function () {
  if (
    montiSettings &&
    montiSettings.appId &&
    montiSettings.appSecret
  ) {
    Kadira.connect(
      montiSettings.appId,
      montiSettings.appSecret,
      montiSettings.options || {}
    );

    Kadira.connect = function () {
      throw new Error('Kadira has been already connected using credentials from Meteor.settings');
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

Kadira._connectWithEnv();
Kadira._connectWithSettings();
