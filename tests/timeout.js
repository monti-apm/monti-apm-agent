import { TimeoutManager } from '../lib/hijack/timeout_manager';
import assert from 'assert';
import { addAsyncTest, callAsync, registerMethod } from './_helpers/helpers';
import { sleep } from '../lib/utils';

addAsyncTest(
  'Stalled - Method Timeout',
  async function (test) {
    const oldTimeout = Kadira.options.stalledTimeout;

    Kadira.options.stalledTimeout = 250;

    const methodId = registerMethod(async function () {
      await sleep(500);

      return 'pong';
    });

    let error = null;

    Kadira.EventBus.once('method', 'timeout', (kadiraInfo, err) => {
      error = err;
    });

    const lastId = TimeoutManager.id;

    let result = await callAsync(methodId);

    assert(lastId < TimeoutManager.id, 'The timeout id must be incremented');
    assert(error && error.constructor.name === 'Error');
    assert(error && error.message === `Method "${methodId}" still running after 250ms`);

    test.equal(result, 'pong');

    Kadira.options.stalledTimeout = oldTimeout;
  }
);
