import { TestData } from '../_helpers/globals';
import { callAsync, cleanTestData, getLastMethodEvents, registerMethod } from '../_helpers/helpers';

Tinytest.onlyAsync(
  'User - not logged in',
  async function (test, done) {
    let methodId = registerMethod(async function () {
      console.log(await TestData.insertAsync({aa: 10}));

      return 'foo';
    });

    console.log(await callAsync(methodId));

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insertAsync'}],
      ['complete']
    ];

    test.equal(events, expected);

    await cleanTestData();

    done();
  }
);
