import { Meteor } from 'meteor/meteor';

Tinytest.add(
  'Info - Meteor.EnvironmentVariable',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(testMethod);
    let client = GetMeteorClient();
    let result = client.call(methodId, 10, 'abc');
    CleanTestData();


    function testMethod () {
      Meteor.setTimeout(function () {
        let kadirainfo = Kadira._getInfo(null, true);
        test.equal(Boolean(kadirainfo), true);
      }, 0);
    }
  }
);
