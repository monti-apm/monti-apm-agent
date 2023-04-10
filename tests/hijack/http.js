import { HTTP } from 'meteor/http';
import {
  callAsync,
  cleanTestData,
  getLastMethodEvents,
  GetLastMethodEvents,
  RegisterMethod
} from '../_helpers/helpers';

Tinytest.addAsync('HTTP - meteor/http - call a server', async function (test, done) {
  const methodId = RegisterMethod(function () {
    const result = HTTP.get('http://localhost:3301');
    return result.statusCode;
  });

  const result = await callAsync(methodId);

  const events = getLastMethodEvents([0, 2]);

  const expected = [
    ['start', undefined, { userId: null, params: '[]' }],
    ['wait', undefined, { waitOn: [] }],
    ['http', undefined, { url: 'http://localhost:3301', method: 'GET', statusCode: 200, library: 'meteor/http' }],
    ['complete']
  ];

  test.equal(events, expected);
  test.equal(result, 200);

  await cleanTestData();

  done();
}
);

Tinytest.addAsync('HTTP - meteor/http - async callback', async function (test, done) {
  const methodId = RegisterMethod(function () {
    const result = HTTP.get('http://localhost:3301');
    return result.statusCode;
  });

  const result = await callAsync(methodId);
  const events = GetLastMethodEvents([0, 2]);

  const expected = [
    ['start', undefined, { userId: null, params: '[]' }],
    ['wait', undefined, { waitOn: [] }],
    ['http', undefined, { url: 'http://localhost:3301', method: 'GET', async: true, library: 'meteor/http' }],
    ['async', undefined, {}],
    ['complete']
  ];

  test.equal(events, expected);
  test.equal(result, 200);

  await cleanTestData();
  done();
}
);
