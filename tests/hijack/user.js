import { TestData } from '../_helpers/globals';
import { callAsync, cleanTestData, getLastMethodEvents, registerMethod } from '../_helpers/helpers';

Tinytest.addAsync(
  'User - not logged in',
  async function (test, done) {
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

    done();
  }
);
