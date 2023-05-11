import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod } from '../_helpers/helpers';
import { prettyLog } from '../_helpers/pretty-log';


addAsyncTest(
  'Base - method params',
  async function (test) {
    let info;

    let methodId = registerMethod(async function () {
      await TestData.insertAsync({aa: 10});
      info = Kadira._getInfo();
    });

    await callAsync(methodId, 10, 'abc');

    prettyLog(info);

    let events = getLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined, {userId: null, params: '[10,"abc"]'}],
      ['wait',undefined, {waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'insertAsync'}],
      ['complete']
    ];

    test.equal(events, expected);
  }
);
