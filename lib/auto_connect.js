import { Meteor } from 'meteor/meteor';

Kadira._connectWithEnv = function () {
  const options = Kadira._parseEnv(process.env);
  if (options.appId && options.appSecret) {
    Kadira.connect(
      options.appId,
      options.appSecret,
      options
    );

    Kadira.connect = function () {
      throw new Error('Kadira has been already connected using credentials from Environment Variables');
    };
  }
};


Kadira._connectWithSettings = function () {
  const montiSettings = Meteor.settings.monti || Meteor.settings.kadira;

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
 *
 * Previously there was two log messages (one for instrumentation,
 * and another for connection), this way we merged both of them.
 */
Kadira._startInstrumenting(function () {
  Kadira._connectWithEnv();
  Kadira._connectWithSettings();
});
