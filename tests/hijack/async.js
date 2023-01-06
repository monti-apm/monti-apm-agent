import { Meteor } from 'meteor/meteor';
import { TestData } from '../_helpers/globals';
import {
  CleanTestData,
  EnableTrackingMethods,
  GetLastMethodEvents,
  GetMeteorClient,
  RegisterMethod
} from '../_helpers/helpers';

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
    client.call(methodId);
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
      } catch (ex) { /* empty */ }
    });
    let client = GetMeteorClient();
    client.call(methodId);
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
        TestData.find({});

        return Kadira._getInfo();
      }
    });


    let client = GetMeteorClient();
    let result = client.call(methodId);
    const events = result.trace.events.filter(event => event[0] !== 'compute');

    // remove complete event
    events.pop();

    const dbEvent = events.pop();
    const asyncEvent = events.pop();

    // If the async event was not ended in throwInto,
    // the db event will be nested in the async event
    test.equal(asyncEvent[0], 'async');
    // If there are nested events or forcedEnd is true, then [3] will be an object
    test.equal(asyncEvent[3], undefined);

    test.equal(dbEvent[0], 'db');
  }
);
