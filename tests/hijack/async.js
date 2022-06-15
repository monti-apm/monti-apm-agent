import { Meteor } from 'meteor/meteor';

Tinytest.add(
  'Async - track with Meteor._wrapAsync',
  function (test) {
    EnableTrackingMethods();
    const methodId = RegisterMethod(function () {
      const wait = Meteor._wrapAsync(function (waitTime, callback) {
        setTimeout(callback, waitTime);
      });
      wait(100);
    });
    const client = GetMeteorClient();
    const result = client.call(methodId);
    const events = GetLastMethodEvents([0]);
    const expected = [
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
    const methodId = RegisterMethod(function () {
      const wait = Meteor._wrapAsync(function (waitTime, callback) {
        setTimeout(function () {
          callback(new Error('error'));
        }, waitTime);
      });
      try {
        wait(100);
      } catch (ex) {

      }
    });
    const client = GetMeteorClient();
    const result = client.call(methodId);
    const events = GetLastMethodEvents([0]);
    const expected = [
      ['start'],
      ['wait'],
      ['async'],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);
