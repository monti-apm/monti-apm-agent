import { fetch } from 'meteor/fetch';
import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod, } from '../_helpers/helpers';

addAsyncTest('HTTP - meteor/fetch - async call', async function (test) {
  const methodId = registerMethod(async function () {
    const result = await fetch('http://localhost:3301/');

    return result.status;
  });

  const result = await callAsync(methodId);

  const events = getLastMethodEvents([0, 2]);

  const expected = [
    ['start', { userId: null, params: '[]' }],
    ['wait', { waitOn: [] }],
    ['http', { method: 'GET', url: 'http://localhost:3301/', library: 'meteor/fetch' }],
    ['complete']
  ];

  test.stableEqual(events, expected);
  test.equal(result, 200);
});

addAsyncTest('HTTP - meteor/fetch - trace error', async function (test) {
  const methodId = registerMethod(async function () {
    try {
      await fetch('http://localhost:9999/');
    } catch (error) {
      return error;
    }
  });

  const result = await callAsync(methodId);
  const events = getLastMethodEvents([0, 2]);

  const isIpv6 = result.message.includes('::1');

  const expected = [
    ['start', { userId: null, params: '[]' }],
    ['wait', { waitOn: [] }],
    [
      'http',
      {
        method: 'GET',
        url: 'http://localhost:9999/',
        library: 'meteor/fetch',
        err: `request to http://localhost:9999/ failed, reason: connect ECONNREFUSED ${isIpv6 ? '::1' : '127.0.0.1'}:9999`,
      },
    ],
    ['complete'],
  ];

  test.equal(events, expected);

  test.equal(result, {
    message:
        `request to http://localhost:9999/ failed, reason: connect ECONNREFUSED ${isIpv6 ? '::1' : '127.0.0.1'}:9999`,
    type: 'system',
    errno: 'ECONNREFUSED',
    code: 'ECONNREFUSED',
  });
});
