import { TestData } from '../_helpers/globals';
import {
  CleanTestData,
  EnableTrackingMethods,
  GetLastMethodEvents,
  GetMeteorClient,
  RegisterMethod
} from '../_helpers/helpers';

Tinytest.add(
  'User - not logged in',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      TestData.insert({aa: 10});
    });
    let client = GetMeteorClient();

    client.call(methodId);

    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',undefined,{userId: null, params: '[]'}],
      ['wait',undefined,{waitOn: []}],
      ['db',undefined,{coll: 'tinytest-data', func: 'insert'}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);
