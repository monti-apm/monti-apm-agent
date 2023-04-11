import { Meteor } from 'meteor/meteor';
import { CleanTestData, EnableTrackingMethods, getMeteorClient, RegisterMethod } from '../_helpers/helpers';

Tinytest.add(
  'Info - Meteor.EnvironmentVariable',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(testMethod);
    let client = getMeteorClient();

    client.call(methodId, 10, 'abc');

    CleanTestData();

    function testMethod () {
      Meteor.setTimeout(function () {
        let kadirainfo = Kadira._getInfo(true);
        test.equal(!!kadirainfo, true);
      }, 0);
    }
  }
);
