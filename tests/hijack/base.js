import { TestData } from '../_helpers/globals';
import { addAsyncTest, callAsync, GetLastMethodEvents, registerMethod } from '../_helpers/helpers';
import { prettyLog } from '../_helpers/pretty-log';


addAsyncTest.only(
  'Base - method params',
  async function (test) {
    let info;

    let methodId = registerMethod(async function () {
      info = Kadira._getInfo();
      await TestData.insertAsync({aa: 10});
    });


    await callAsync(methodId, 10, 'abc');

    prettyLog(info?._traces);

    let events = GetLastMethodEvents([0, 2]);

    let expected = [
      ['start',undefined, {userId: null, params: '[10,"abc"]'}],
      ['wait',undefined, {waitOn: []}],
      ['db',undefined, {coll: 'tinytest-data', func: 'insertAsync'}],
      ['complete']
    ];

    test.equal(events, expected);
  }
);
