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


Tinytest.add(
  'Async - end event on throwInto',
  function (test) {
    const methodId = RegisterMethod(function () {
      try {
        Promise.await(
          new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Fake Error'));
            }, 100);
          }),
        );
      } catch (err) {
        return Kadira._getInfo();
      }
    });


    let client = GetMeteorClient();
    let result = client.call(methodId);

    const events = result.trace.events.reduce((acc, [type, duration]) => {
      acc[type] = duration;
      return acc;
    }, {});

    test.isTrue(events.compute > 0);
    test.isTrue(events.async >= 100 && events.async <= 102);
  }
);
