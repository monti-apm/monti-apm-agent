import { TimeoutManager } from '../lib/hijack/timeout_manager';
import assert from 'assert';

Tinytest.add(
  'Method Timeout',
  function (test) {
    const oldTimeout = Kadira.options.stalledTimeout;

    Kadira.options.stalledTimeout = 250;

    let methodId = RegisterMethod(function () {
      Meteor._sleepForMs(500);

      return 'pong';
    });

    let client = GetMeteorClient();

    let error = null;

    Kadira.EventBus.once('method', 'timeout', (kadiraInfo, err) => {
      error = err;
    });

    const lastId = TimeoutManager.id;

    let result = client.call(methodId);

    assert(lastId < TimeoutManager.id, 'The timeout id must be incremented');
    assert(error && error.constructor.name === 'Error');
    assert(error && error.message === `Method "${methodId}" still running after 250ms`);

    test.equal(result, 'pong');

    Kadira.options.stalledTimeout = oldTimeout;
  }
);
