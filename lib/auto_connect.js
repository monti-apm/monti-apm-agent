Kadira._connectWithEnv = function () {
  let options = Kadira._parseEnv(process.env);
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
  let montiSettings = Meteor.settings.monti || Meteor.settings.kadira;

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


// Try to connect automatically
Kadira._connectWithEnv();
Kadira._connectWithSettings();
