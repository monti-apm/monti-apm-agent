## [Monti APM - Performance Monitoring for Meteor](https://montiapm.com)

[![Travis](https://img.shields.io/travis/monti-apm/monti-apm-agent.svg?style=flat-square)](https://travis-ci.org/monti-apm/monti-apm-agent)

[![Monti APM - Performance Monitoring for Meteor](https://i.cloudup.com/LwrCCa_RRE.png)](https://montiapm.com)

This package is based on [meteorhacks/kadira](https://atmospherejs.com/meteorhacks/kadira).

### Getting started

1. Create an account at <https://montiapm.com>
2. From the UI, create an app. You'll get an `AppId` and an `AppSecret`.
3. Run `meteor add montiapm:agent` in your project
4. Configure your Meteor app with the `AppId` and `AppSecret` by adding the following code snippet to a `server/monti.js` file:

```js
Meteor.startup(function() {
  Monti.connect('<AppId>', '<AppSecret>');
});
```

Now you can deploy your application and it will send information to Monti APM. Wait up to one minute and you'll see data appearing in the Monti APM Dashboard.


### Auto Connect

Your app can connect to Monti APM using environment variables or [`Meteor.settings`](http://docs.meteor.com/#meteor_settings).

#### Using Meteor.settings
Use the followng `settings.json` file with your app:

```js
{
  ...
  "monti": {
    "appId": "<appId>",
    "appSecret": "<appSecret>"
  }
  ...
}
```

The run your app with `meteor --settings=settings.json`.

#### Using Environment Variables

Export the following environment variables before running or deploying your app:

```
export MONTI_APP_ID=<appId>
export MONTI_APP_SECRET=<appSecret>
````

### Error Tracking

Monti APM comes with built in error tracking solution for Meteor apps. It has been enabled by default.
For more information, please visit our [docs](http://support.kadira.io/knowledgebase/topics/62637-error-tracking) on [error tracking](http://support.kadira.io/knowledgebase/topics/62637-error-tracking).

### Options

The Monti APM agent can be configured by

- environment variables, prefixed with either `MONTI_` or `KADIRA_`
- settings.json in the `monti` or `kadira` object
- code with `Monti.connect('app id', 'app secret', options)`

You should use the same method that you used to give the agent the app id and secret.

#### List of Options

| name | env variable | default | description |
|------|--------------|---------|-------------|
| appId | APP_ID | none | |
| appSecret | APP_SECRET | none | |
| enableErrorTracking | OPTIONS_ENABLE_ERROR_TRACKING | true | enable sending errors to Monti APM |
| endpoint | OPTIONS_ENDPOINT | https://engine.montiapm.com | Monti / Kadira engine url |
| hostname | OPTIONS_HOSTNAME | Server's hostname | What the instance is named in Monti APM |
| uploadSourceMaps | UPLOAD_SOURCE_MAPS | true | Enables sending source maps to Monti APM to improve error stack traces |
| recordIPAddress | RECORD_IP_ADDRESS | 'full' | Set to 'full' to record IP Address, 'anonymized' to anonymize last octet of address, or 'none' to not record an IP Address for client errors |
