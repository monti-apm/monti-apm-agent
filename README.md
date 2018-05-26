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
export KADIRA_APP_ID=<appId>
export KADIRA_APP_SECRET=<appSecret>
````

### Error Tracking

Monti APM comes with built in error tracking solution for Meteor apps. It has been enabled by default.
For more information, please visit our [docs](http://support.kadira.io/knowledgebase/topics/62637-error-tracking) on [error tracking](http://support.kadira.io/knowledgebase/topics/62637-error-tracking).
