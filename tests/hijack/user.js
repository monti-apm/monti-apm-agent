
Tinytest.add(
  'User - not logged in',
  function (test) {
    EnableTrackingMethods();
    let methodId = RegisterMethod(function () {
      TestData.insert({aa: 10});
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0, 2]);
    let expected = [
      ['start',,{userId: null, params: '[]'}],
      ['wait',,{waitOn: []}],
      ['db',,{coll: 'tinytest-data', func: 'insert'}],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);
