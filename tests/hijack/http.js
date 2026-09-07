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

  const events = getLastMethodEvents([0, 2, 3]);

  const expected = [
    ['start',{userId: null,params: '[]'}],
    ['wait',{waitOn: []}],
    ['http',{method: 'GET',url: 'http://localhost:3301',library: 'meteor/http',statusCode: 1,async: true}],
    ['http',{method: 'GET', url: 'http://localhost:3301/',library: 'meteor/fetch',}, {offset: 1}],
    ['complete']
  ];

  test.stableEqual(events, expected);
  test.equal(result, 200);
});

addAsyncTest('HTTP - meteor/http - support promise', async function (test) {
  const HTTP = Package['http'].HTTP;

  const methodId = registerMethod(async function () {
    const result = await HTTP.call('GET', 'http://localhost:3301');
    return result.statusCode;
  });

  const result = await callAsync(methodId);

  const events = getLastMethodEvents([0, 2]);
  const httpEvent = events.find((event) => event[0] === 'http' && event[1] && event[1].library === 'meteor/http');

  test.equal(result, 200);
  test.equal(httpEvent[1].statusCode, 1, `statusCode should be recorded for the promise form of HTTP.call: ${JSON.stringify(httpEvent)}`);
});
