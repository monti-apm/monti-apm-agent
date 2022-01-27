## [Monti APM - Performance Monitoring for Meteor](https://montiapm.com)

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/monti-apm/monti-apm-agent/Test?style=flat-square)

[![Monti APM - Performance Monitoring for Meteor](https://docs.montiapm.com/images/overview-2.png)](https://montiapm.com)

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

### Compatibility

`montiapm:agent` is compatible with:

- Meteor 1.4.3.2 and newer
- Internet Explorer 9 and newer web browsers
- Can be used with [Monti APM](https://montiapm.com/) or the open sourced version of Kadira, though many new features are not supported by Kadira

Features that require a newer version of Meteor are only enabled when using a supported version. For example, monitoring incoming HTTP requests is automatically enabled when the app uses Meteor 1.7 or newer.

### Auto Connect

Your app can connect to Monti APM using environment variables or [`Meteor.settings`](http://docs.meteor.com/#meteor_settings).

#### Using Meteor.settings

Use the following `settings.json` file with your app:

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

```bash
export MONTI_APP_ID=<appId>
export MONTI_APP_SECRET=<appSecret>
````

### Error Tracking

Monti APM comes with built in error tracking solution for Meteor apps. It has been enabled by default. Uncaught errors, unhandled promise rejections and errors logged by Meteor are automatically tracked.

To manually track an error, you can use `Monti.trackError`:

```js
try {
  functionThatCouldFail();
} catch (err) {
  Monti.trackError(err);
}
```

Monti APM can use source maps to show where in the original code the error occurred. Learn more in our [docs](https://docs.montiapm.com/source-maps).

### Options

The Monti APM agent can be configured by

- environment variables, prefixed with either `MONTI_` or `KADIRA_`
- settings.json in the `monti` or `kadira` object. Options other than `appId` and `appSecret` should be in `monti.options` or `kadira.options`.
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
| eventStackTrace | EVENT_STACK_TRACE | false | If true, records a stack trace when an event starts. Slightly decreases server performance. |

### Traces

The agent collects traces of methods and publish functions. Every minute, it sends the outlier traces to Monti APM for you to view.

By default, it tracks events for:

- method/pubsub start
- wait time
- uncaught errors
- db
- http
- email
- async (time between the fiber yielding and running again)
- method/pubsub complete

Time between an event ending and the next event starting becomes a `compute` event.

The agent records up to one level of nested events.

You can add custom events to the traces to time specific code or events, or to provide more details to the trace.

```js
const event = Monti.startEvent('event name', {
  details: true
});

// After code runs or event happens
Monti.endEvent(event, {
  additionalDetails: true
});
```

You can use any name you want. The second parameter is an object with data that is shown to you in the Monti APM UI. The data objects from starting and ending the event are merged together.

Please note that the total size of all traces uploaded per server every 20 seconds is limited (usually around 5mb), and if it is too large the traces and metrics are not stored. Avoid having 1,000's of custom events per trace or adding very large data objects.

#### Filtering Trace Data

The agent stores user ids, queries, arguments, and other data with each trace to help you fix performance issues and errors. If your app deals with sensitive information, you can use filters to limit what is sent.

Add a filter with:

```js
Monti.tracer.addFilter((eventType, data, { type: traceType, name: traceName }) => {
  if (
    // traceType can be 'method', 'sub', or 'http'
    traceType === 'method' &&
    // traceName has the method or publication name. For http traces
    // it is '<http method>-<route name>', for example 'POST-/user/:id'.
    traceName === 'account.setPassword' &&
    // The eventType can be start, db, http, email, wait, async,
    // custom, fs, error, or complete.
    eventType === 'start'
  ) {
    // data is the object shown in Monti APM when clicking "Show More" in a trace.
    // What is in data depends on the event type.
    delete data.params;
  }

  return data;
});

Monti.tracer.addFilter((eventType, data) => {
  if (eventType === 'db') {
    delete data.selector;
  }

  return data;
});
```

### Development

#### Tests:

```
npm run test

# Run tests for specific Meteor version
npm run test -- --release 1.8.1
```

#### Lint

Make sure you install the dev dependencies first with `npm install`.

```
npm run lint
```
