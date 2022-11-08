import { TimeoutManager } from '../lib/hijack/timeout_manager';
import assert from 'assert';

Tinytest.add(
  'Method Timeout',
  function (test) {
    const oldTimeout = Kadira.options.trackingTimeout;

    Kadira.options.trackingTimeout = 250;

    let methodId = RegisterMethod(function () {
      Meteor._sleepForMs(500);

      return 'pong';
    });

    let client = GetMeteorClient();

    let error = null;

    TimeoutManager.bus.once('timeout', (kadiraInfo, err) => {
      error = err;
    });

    const lastId = TimeoutManager.id;

    let result = client.call(methodId);

    assert(lastId < TimeoutManager.id, 'The timeout id must be incremented');
    assert(error.constructor.name === 'Error');
    assert(error.message === `Method Timeout (250ms): ${methodId}`);

    test.equal(result, 'pong');

    Kadira.options.trackingTimeout = oldTimeout;
  }
);
