## [Monti APM - Performance Monitoring for Meteor](https://montiapm.com)

![Github Workflow Status](https://img.shields.io/github/actions/workflow/status/monti-apm/monti-apm-agent/test.yml?branch=master&style=flat-square)


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

- Meteor 1.4.3.2 and newer, including Meteor 3. Meteor will install the correct version of `montiapm:agent` for the version of Meteor.
- Internet Explorer 9 and newer web browsers
- Can be used with [Monti APM](https://montiapm.com/) or the open sourced version of Kadira, though many new features are not supported by Kadira

Some features have a higher minimum version of Meteor, and are disabled in older Meteor versions.  For example, monitoring incoming HTTP requests is enabled for apps using Meteor 1.7 or newer.

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

| Name                       | Environment Variable                  | Default                     | Description                                                                                                                                                                                             |
|----------------------------|---------------------------------------|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| appId                      | APP_ID                                | none                        |                                                                                                                                                                                                         |
| appSecret                  | APP_SECRET                            | none                        |                                                                                                                                                                                                         |
| enableErrorTracking        | OPTIONS_ENABLE_ERROR_TRACKING         | true                        | Enable sending errors to Monti APM                                                                                                                                                                      |
| disableClientErrorTracking | OPTIONS_DISABLE_CLIENT_ERROR_TRACKING | false                       | Disable sending client errors to Monti APM                                                                                                                                                              |
| endpoint                   | OPTIONS_ENDPOINT                      | https://engine.montiapm.com | Monti / Kadira engine url                                                                                                                                                                               |
| hostname                   | OPTIONS_HOSTNAME                      | Server's hostname           | What the instance is named in Monti APM                                                                                                                                                                 |
| uploadSourceMaps           | UPLOAD_SOURCE_MAPS                    | true                        | Enables sending source maps to Monti APM to improve error stack traces                                                                                                                                  |
| recordIPAddress            | RECORD_IP_ADDRESS                     | 'full'                      | Set to 'full' to record IP Address, 'anonymized' to anonymize last octet of address, or 'none' to not record an IP Address for client errors                                                            |
| eventStackTrace            | EVENT_STACK_TRACE                     | false                       | If true, records a stack trace when an event starts. Slightly decreases server performance.                                                                                                             |
| disableNtp                 | OPTIONS_DISABLE_NTP                   | false                       | Disable NTP time synchronization used to get the accurate time in case the server or client's clock is wrong                                                                                            |
| stalledTimeout             | STALLED_TIMEOUT                       | 1800000 (30m)               | Timeout used to detect when methods and subscriptions might be stalled (have been running for a long time and might never return). The value is in milliseconds, and can be disabled by setting it to 0 |
| proxy                      | MONTI_OPTIONS_PROXY                   | none                        | Allows you to connect to Monti APM using a proxy                                                                                                                                                        |
| disableInstrumentation | DISABLE_INSTRUMENTATION | false                     | Disables recording most metrics and traces. Can be configured using Meteor.settings, or by env variable |


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
Monti.event('event name', {
  // This object can have any details you want to store
  // The object is optional
  userId: userId
}, async () => {
  // do the work inside the event
  // the event will automatically end when this function returns
});

// Older api. Not recommended since it doesn't nest child events in Meteor 3
const event = Monti.startEvent('event name', {
  // This object can have any details you want
  organization: organizationId
});

// After code runs or event happens
Monti.endEvent(event, {
  // This object can have any details you want
  // It is merged with the object created when starting the event
  organizationMembers: 10
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

Some objects are turned into a JSON string before being stored in the trace. To remove the content of a field from these objects, you can use:

```
Monti.tracer.redactField('apiKey');

Monti.tracer.redactField('authorization');
```

The value of the field is changed to `Monti: redacted`.

The fields are redacted from:
- headers in traces for incoming HTTP requests
- params sent when calling a method or subscribing to a publication
- body of incoming http requests, when the body is JSON

By default, the `password` field is redacted.

## Job Monitoring

### Custom Traces

You can create custom traces for any block of code. The code will be traced as a job, and appear in the Jobs dashboard in Monti APM.

```js

Monti.traceJob(options, functionToTrace);

Monti.traceJob({ name: 'job name' }, () => {
  // ... code to trace
});
```

Options can have these properties. `name` is the only property required.
- `name`, which is the name of the trace or job. It is used to group metrics and traces together for the same job.
- `waitTime`, which is how long the job waited to run after it was scheduled to run. Shown in Monti APM as the job delay
- `data`, which can have the job data or any other details you want to store in the trace. It is shown under the `Start` event in the trace.

The `functionToTrace` is called immediately, and it's return value is returned by `Monti.traceJob`.

When `Monti.traceJob` is called inside a trace, it does nothing and simply runs `functionToTrace`.

We recommend not using more than a few dozen names for custom traces.

### Pending Jobs

Monti APM does not automatically track pending jobs to avoid causing performance issues.
However, your app can report the metric to Monti APM.

The pending metric is intended for job queues to know how many jobs are waiting to be processed. We recommend reporting the metric within 20 seconds of the app starting, and every 10 - 50 seconds afterwards.

```js
async function reportPending() {
  // How you get the pending count depends on the job queue library
  // This is one way you can with BullMQ.
  let counts = await queue.getJobCounts('wait');

  Monti.recordPendingJobs('job name', counts.wait);
}

// Report the count when the app starts
reportPending();

// Update the count every 20 seconds
setInterval(() => reportPending(), 1000 * 20);
```

### New Jobs

When using `Monti.traceJob`, the `added` metric for the job is not recorded. This metric is intended for job queues to track how many new jobs were created, to understand how the rate of new jobs and completed jobs compares. You can manually record new jobs with:

```js
Monti.recordNewJob('job name');
```

Each time the function is called, it increments the `added` metric by 1.

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
