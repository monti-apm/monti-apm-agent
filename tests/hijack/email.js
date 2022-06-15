Tinytest.add(
  'Email - success',
  function (test) {
    EnableTrackingMethods();
    const Email = Package['email'].Email;
    let methodId = RegisterMethod(function () {
      Email.send({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    let events = GetLastMethodEvents([0]);
    let expected = [
      ['start'],
      ['wait'],
      ['email'],
      ['complete']
    ];
    test.equal(events, expected);
    CleanTestData();
  }
);
