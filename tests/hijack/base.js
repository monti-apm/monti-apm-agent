import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, GetLastMethodEvents, registerMethod } from '../_helpers/helpers';


addAsyncTest(
  'Base - method params',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.insertAsync({aa: 10});
    });

    await callAsync(methodId, 10, 'abc');

    let events = GetLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined, {userId: null, params: '[10,"abc"]'}],
      ['wait',undefined, {waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'insert'}],
      ['complete']
    ];

    test.equal(events, expected);
  }
);
