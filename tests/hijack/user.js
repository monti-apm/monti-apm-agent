import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, cleanTestData, getLastMethodEvents, registerMethod } from '../_helpers/helpers';
import { prettyLog } from '../_helpers/pretty-log';

addAsyncTest(
  'User - not logged in',
  async function (test) {
    let methodId = registerMethod(async function () {
      await TestData.insertAsync({aa: 10});

      return 'foo';
    });

    await callAsync(methodId);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insertAsync'}],
      ['complete']
    ];

    test.equal(events, expected);

    await cleanTestData();
  }
);
