import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod } from '../_helpers/helpers';
import { asyncHttpGet } from '../_helpers/http';

/**
 * @warning Every HTTP call should be async since Release 3.0
 */
addAsyncTest('HTTP - meteor/http - call a server', async function (test) {
  const methodId = registerMethod(async function () {
    const result = await asyncHttpGet('http://localhost:3301');
    return result.statusCode;
  });

  const result = await callAsync(methodId);

  const events = getLastMethodEvents([0, 2]);

  const expected = [
    ['start', undefined, { userId: null, params: '[]' }],
    ['wait', undefined, { waitOn: [] }],
    ['http', undefined, { url: 'http://localhost:3301', method: 'GET', statusCode: 200, async: true, library: 'meteor/http' }],
    ['complete']
  ];

  test.equal(events, expected);
  test.equal(result, 200);
});
