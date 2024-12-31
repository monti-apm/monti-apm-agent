import { Meteor } from 'meteor/meteor';
import { addAsyncTest, callAsync, registerMethod } from '../_helpers/helpers';

addAsyncTest(
  'Info - Meteor.EnvironmentVariable',
  async function (test) {
    let methodId = registerMethod(testMethod);

    await callAsync(methodId, 10, 'abc');

    function testMethod () {
      Meteor.setTimeout(function () {
        let kadirainfo = Kadira._getInfo();
        test.equal(!!kadirainfo, true);
      }, 0);
    }
  }
);
