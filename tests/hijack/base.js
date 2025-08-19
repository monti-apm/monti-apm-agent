import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod } from '../_helpers/helpers';


addAsyncTest(
  'Base - method params',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.insertAsync({ aa: 10 });
    });

    await callAsync(methodId, 10, 'abc');

    let events = getLastMethodEvents([0, 2, 3]);

    let expected = [
      ['start',{userId: null,params: '[10,"abc"]'}],
      ['wait',{waitOn: []}],
      ['db',{coll: 'tinytest-data',func: 'insertAsync'}],
      ['complete']
    ];

    test.stableEqual(events, expected);
  }
);
