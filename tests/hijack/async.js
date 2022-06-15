import { Meteor } from 'meteor/meteor';

Tinytest.add(
  'Async - track with Meteor._wrapAsync',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      let wait = Meteor._wrapAsync(function (waitTime, callback) {
        setTimeout(callback, waitTime);
      });
      wait(100);
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0]);
    let expected = [
      ['start'],
      ['wait'],
      ['async'],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);

Tinytest.add(
  'Async - track with Meteor._wrapAsync with error',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      let wait = Meteor._wrapAsync(function (waitTime, callback) {
        setTimeout(function () {
          callback(new Error('error'));
        }, waitTime);
      });
      try {
        wait(100);
      } catch (ex) {

      }
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0]);
    let expected = [
      ['start'],
      ['wait'],
      ['async'],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);
