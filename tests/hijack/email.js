import { TestHelpers } from '../_helpers/helpers';

Tinytest.add(
  'Email - success',
  function (test) {
    TestHelpers.enableTrackingMethods();

    const Email = Package['email'].Email;

    const methodId = TestHelpers.registerMethod(function () {
      Email.send({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
    });

    const client = TestHelpers.getMeteorClient();

    client.call(methodId);

    const events = TestHelpers.getLastMethodEvents([0]);

    const expected = [
      ['start'],
      ['wait'],
      ['email'],
      ['complete']
    ];

    test.equal(events, expected);

    TestHelpers.cleanTestData();
  }
);
