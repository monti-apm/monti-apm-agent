Package.describe({
  "summary": "Performance Monitoring for Meteor",
  "version": "2.46.1",
  "git": "https://github.com/monti-apm/monti-apm-agent.git",
  "name": "montiapm:agent"
});

var npmModules = {
  "debug": "0.8.1",
  "monti-apm-core": "1.7.5",
  "evloop-monitor": "0.1.0",
  "lru-cache": "4.1.5",
  "json-stringify-safe": "5.0.1",
  "monti-apm-sketches-js": "0.0.3",

  // parseurl is also used by WebApp.
  // Since it caches the parsed url on
  // `req`, we should make sure we use a
  // version that is compatible with the version
  // used by WebApp.
  "parseurl": "1.3.3"
};

Npm.depends(npmModules);

Package.onUse(function (api) {
  configurePackage(api, false);
  api.export(['Kadira', 'Monti']);
});

Package.onTest(function (api) {
  configurePackage(api, true);
  api.use([
    'tinytest',
    'test-helpers',
  ], ['client', 'server']);

  // common before
  api.addFiles([
    'tests/models/base_error.js'
  ], ['client', 'server']);

  // common server
  api.addFiles([
    'tests/utils.js',
    'tests/ntp.js',
    'tests/jobs.js',
    'tests/_helpers/globals.js',
    'tests/_helpers/helpers.js',
    'tests/_helpers/init.js',
    'tests/ping.js',
    'tests/hijack/info.js',
    'tests/hijack/user.js',
    'tests/hijack/email.js',
    'tests/hijack/base.js',
    'tests/hijack/async.js',
    'tests/hijack/webapp.js',
    'tests/hijack/http.js',
    'tests/hijack/db.js',
    'tests/hijack/subscriptions.js',
    'tests/hijack/error.js',
    'tests/hijack/mongo_driver_events.js',
    'tests/models/methods.js',
    'tests/models/pubsub.js',
    'tests/models/system.js',
    'tests/models/errors.js',
    'tests/tracer/tracer_store.js',
    'tests/tracer/tracer.js',
    'tests/tracer/default_filters.js',
    'tests/check_for_oplog.js',
    'tests/error_tracking.js',
    'tests/wait_time_builder.js',
    'tests/hijack/set_labels.js',
    'tests/environment_variables.js',
    'tests/docsize_cache.js',
  ], 'server');

  if (canRunTestsWithFetch()) {
    api.addFiles(['tests/hijack/http_fetch.js'], 'server');
  }

  // common client
  api.addFiles([
    'tests/client/utils.js',
    'tests/client/error_tracking.js',
    'tests/client/models/errors.js',
    'tests/client/error_reporters/window_error.js',
    'tests/client/error_reporters/unhandled_rejection.js',
    'tests/client/error_reporters/zone.js',
    'tests/client/error_reporters/meteor_debug.js',
    'tests/client/error_reporters/tracker.js',
  ], 'client');

  // common after
  api.addFiles([
    'tests/common/default_error_filters.js',
    'tests/common/send.js'
  ], ['client', 'server']);
});

// use meteor/fetch in tests only for NodeJS 8.11+ (Meteor 1.7+)
function canRunTestsWithFetch() {
  const nums = process.versions.node.split(".").map(Number);

  const major = nums[0];
  const minor = nums[1];

  if (major < 8) return false;

  if (major > 8) return true;

  //major === 8 and ...
  return minor >= 11;
}

function configurePackage(api, isTesting) {
  api.versionsFrom('METEOR@1.4');
  api.use('montiapm:meteorx@2.2.0', ['server']);
  api.use('meteorhacks:zones@1.2.1', { weak: true });
  api.use('simple:json-routes@2.1.0', { weak: true });
  api.use('zodern:meteor-package-versions@0.2.0');

  api.use([
    'minimongo', 'mongo', 'ddp', 'ejson', 'ddp-common',
    'underscore', 'random', 'webapp', 'ecmascript'
  ], ['server']);
  api.use(['http@1.0.0||2.0.0', 'email@1.0.0||2.0.0'], 'server', { weak: !isTesting });

  api.use('fetch@0.1.0', 'server', {
    weak: !(isTesting && canRunTestsWithFetch()),
  });

  api.use(['random', 'ecmascript', 'tracker'], ['client']);

  // common before
  api.addFiles([
    'lib/common/utils.js',
    'lib/common/unify.js',
    'lib/models/base_error.js'
  ], ['client', 'server']);

  // only server
  api.addFiles([
    'lib/jobs.js',
    'lib/retry.js',
    'lib/utils.js',
    'lib/ntp.js',
    'lib/sourcemaps.js',
    'lib/wait_time_builder.js',
    'lib/check_for_oplog.js',
    'lib/tracer/tracer.js',
    'lib/tracer/default_filters.js',
    'lib/tracer/tracer_store.js',
    'lib/models/0model.js',
    'lib/models/methods.js',
    'lib/models/pubsub.js',
    'lib/models/system.js',
    'lib/models/errors.js',
    'lib/docsize_cache.js',
    'lib/kadira.js',
    'lib/hijack/wrap_server.js',
    'lib/hijack/wrap_session.js',
    'lib/hijack/wrap_subscription.js',
    'lib/hijack/wrap_observers.js',
    'lib/hijack/wrap_ddp_stringify.js',
    'lib/hijack/instrument.js',
    'lib/hijack/db.js',
    'lib/hijack/http.js',
    'lib/hijack/email.js',
    'lib/hijack/async.js',
    'lib/hijack/error.js',
    'lib/hijack/set_labels.js',
    'lib/environment_variables.js',
    'lib/auto_connect.js',
    'lib/conflicting_agents.js',
  ], 'server');

  // only client
  api.addFiles([
    'lib/retry.js',
    'lib/ntp.js',
    'lib/client/utils.js',
    'lib/client/models/errors.js',
    'lib/client/error_reporters/zone.js',
    'lib/client/error_reporters/window_error.js',
    'lib/client/error_reporters/meteor_debug.js',
    'lib/client/error_reporters/unhandled_rejection.js',
    'lib/client/error_reporters/tracker.js',
    'lib/client/kadira.js'
  ], 'client');

  api.addFiles([
    // It's possible to remove this file after some since this just contains
    // a notice to the user.
    // Actual implementation is in the montiapm:profiler package
    'lib/profiler/client.js',
  ], 'client');

  // common after
  api.addFiles([
    'lib/common/default_error_filters.js',
    'lib/common/send.js'
  ], ['client', 'server']);
}
