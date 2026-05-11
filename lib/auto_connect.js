import { Meteor } from 'meteor/meteor';
import { connectLogger } from './logger';

const envOptions = Kadira._parseEnv(process.env);
const montiSettings = Meteor.settings.monti || Meteor.settings.kadira;

Kadira._connectWithEnv = function (env) {
  connectLogger(`Checking env: id: "${env.appId}", secret: "${env.appSecret}"`);
  if (env.appId && env.appSecret) {
    connectLogger('Auto-connecting with env');
    Kadira.connect(
      env.appId,
      env.appSecret,
      env
    );

    Kadira.connect = function () {
      throw new Error('Monti APM: already connected using credentials from Environment Variables');
    };
  } else {
    connectLogger('Not auto-connecting with env');
  }
};


Kadira._connectWithSettings = function (settings) {
  connectLogger(`Checking settings: id: "${settings?.appId}", secret: "${settings?.appSecret}"`);

  if (
    settings &&
    settings.appId &&
    settings.appSecret
  ) {
    connectLogger('Auto-connecting with settings');
    Kadira.connect(
      settings.appId,
      settings.appSecret,
      settings.options || {}
    );

    Kadira.connect = function () {
      throw new Error('Monti APM: already connected using credentials from Meteor.settings');
    };
  } else {
    connectLogger('Not auto-connecting with settings');
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
Kadira._connectWithSettings(montiSettings);
