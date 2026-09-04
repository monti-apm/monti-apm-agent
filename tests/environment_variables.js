Tinytest.add(
  'AutoConnect - connect with environment variables',
  function (test) {
    let originalEnv = process.env;
    let originalConnect = Kadira.connect;

    process.env = {
      KADIRA_APP_ID: 'rcZSEaSgMaxH4c2df',
      KADIRA_APP_SECRET: '9af3daf3-64f3-4448-8b1e-4286fdf5f499',
      KADIRA_OPTIONS_CLIENT_ENGINE_SYNC_DELAY: '123',
      KADIRA_OPTIONS_ERROR_DUMP_INTERVAL: '234',
      KADIRA_OPTIONS_MAX_ERRORS_PER_INTERVAL: '345',
      KADIRA_OPTIONS_COLLECT_ALL_STACKS: 'true',
      KADIRA_OPTIONS_ENABLE_ERROR_TRACKING: 'false',
      KADIRA_OPTIONS_ENDPOINT: 'https://engine.kadira.io',
      KADIRA_OPTIONS_HOSTNAME: 'my-hostname',
      KADIRA_OPTIONS_PAYLOAD_TIMEOUT: '456',
      KADIRA_OPTIONS_PROXY: 'http://localhost:3128',
      KADIRA_OPTIONS_LIVE_QUERY_POLLING_WINDOW_MS: '600000',
      KADIRA_OPTIONS_LIVE_QUERY_POLLING_MIN_CYCLES: '4',
      KADIRA_OPTIONS_LIVE_QUERY_POLLING_DOCUMENT_BUDGET: '30000',
    };

    let connectArgs;
    Kadira.connect = function () {
      connectArgs = Array.prototype.slice.call(arguments);
    };

    Kadira._connectWithEnv(Kadira._parseEnv(process.env));

    test.equal(connectArgs[0], 'rcZSEaSgMaxH4c2df');
    test.equal(connectArgs[1], '9af3daf3-64f3-4448-8b1e-4286fdf5f499');
    test.equal(connectArgs[2], {
      appId: 'rcZSEaSgMaxH4c2df',
      appSecret: '9af3daf3-64f3-4448-8b1e-4286fdf5f499',
      clientEngineSyncDelay: 123,
      errorDumpInterval: 234,
      maxErrorsPerInterval: 345,
      collectAllStacks: true,
      enableErrorTracking: false,
      endpoint: 'https://engine.kadira.io',
      hostname: 'my-hostname',
      payloadTimeout: 456,
      proxy: 'http://localhost:3128',
      liveQueryPollingWindowMs: 600000,
      liveQueryPollingMinCycles: 4,
      liveQueryPollingDocumentBudget: 30000,
    });

    process.env = originalEnv;
    Kadira.connect = originalConnect;
  }
);

Tinytest.add(
  'Agent options - repeated polling defaults',
  function (test) {
    test.equal(Kadira.options.liveQueryPollingWindowMs, 900000);
    test.equal(Kadira.options.liveQueryPollingMinCycles, 3);
    test.equal(Kadira.options.liveQueryPollingDocumentBudget, 25000);
  }
);
