import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod } from '../_helpers/helpers';
import { asyncMeteorHttpGet, asyncNodeHttpGet } from '../_helpers/http';
import http from 'http';

/**
 * @warning Every HTTP call should be async since Release 3.0
 */
addAsyncTest('HTTP - meteor/http - call a server', async function (test) {
  const methodId = registerMethod(async function () {
    const result = await asyncMeteorHttpGet('http://localhost:3301');
    return result.statusCode;
  });

  const result = await callAsync(methodId);

  const events = getLastMethodEvents([0, 2, 3]);

  const expected = [
    ['start',{userId: null,params: '[]'}],
    ['wait',{waitOn: []},{at: 1,endAt: 1}],
    ['http',{method: 'GET',url: 'http://localhost:3301',library: 'meteor/http',statusCode: 1,async: true},{at: 1,endAt: 1}],
    ['complete']
  ];

  test.stableEqual(events, expected);
  test.equal(result, 200);
});

const server = http.createServer((req, res) => {
  res.end('done');
}).listen();

addAsyncTest('HTTP - node:http - client request', async function (test) {
  const { port } = server.address();

  const methodId = registerMethod(async function () {
    await asyncNodeHttpGet(`http://localhost:${port}`);
  });

  await callAsync(methodId);

  const events = getLastMethodEvents([0, 2, 3]);

  test.stableEqual(events, [
    ['start',{userId: null,params: '[]'}],
    ['wait',{waitOn: []},{at: 1,endAt: 1}],
    ['http',{method: 'GET',url: `http://localhost:${port}/`,library: 'node:http',statusCode: 1},{at: 1,endAt: 1}],
    ['complete']
  ]);
});

addAsyncTest('HTTP - node:http - request failure', async function (test) {
  const methodId = registerMethod(async function () {
    try {
      await asyncNodeHttpGet('http://localhost:9999');
    } catch (error) {
      return error;
    }
  });

  await callAsync(methodId);

  const events = getLastMethodEvents([0, 2, 3]);

  test.stableEqual(events, [
    ['start',{userId: null,params: '[]'}],
    ['wait',{waitOn: []},{at: 1,endAt: 1}],
    ['http',{method: 'GET',url: 'http://localhost:9999/',library: 'node:http',err: 'connect ECONNREFUSED 127.0.0.1:9999'},{at: 1,endAt: 1}],
    ['complete']
  ]);
});
