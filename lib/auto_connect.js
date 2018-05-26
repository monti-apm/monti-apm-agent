Kadira._connectWithEnv = function() {
  if(process.env.KADIRA_APP_ID && process.env.KADIRA_APP_SECRET) {
    var options = Kadira._parseEnv(process.env);

    Kadira.connect(
      process.env.KADIRA_APP_ID,
      process.env.KADIRA_APP_SECRET,
      options
    );

    Kadira.connect = function() {
      throw new Error('Kadira has been already connected using credentials from Environment Variables');
    };
  }
};


Kadira._connectWithSettings = function () {
  var montiSettings = Meteor.settings.monti || Meteor.settings.kadira

  if(
    montiSettings &&
    montiSettings.appId &&
    montiSettings.appSecret
  ) {
    Kadira.connect(
      montiSettings.appId,
      montiSettings.appSecret,
      montiSettings.options || {}
    );

    Kadira.connect = function() {
      throw new Error('Kadira has been already connected using credentials from Meteor.settings');
    };
  }
};


// Try to connect automatically
Kadira._connectWithEnv();
Kadira._connectWithSettings();
