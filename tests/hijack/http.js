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
    ['start',null,{userId: null,params: '[]'}],
    ['wait',null,{waitOn: []},{at: 1,endAt: 1}],
    ['async',null,{},{
      nested: [
        ['http',null,{method: 'GET',url: 'http://localhost:3301',library: 'meteor/http',statusCode: 1,async: true},{at: 1,endAt: 1}],
        ['async',null,{},{at: 1,endAt: 1}]
      ],
      at: 1,
      endAt: 1
    }],
    ['complete']]
  ;

  test.stableEqual(events, expected);
  test.equal(result, 200);
});
