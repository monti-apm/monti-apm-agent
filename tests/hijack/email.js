import { TestHelpers } from '../_helpers/helpers';

function sendTestEmailThroughMethod () {
  const Email = Package['email'].Email;

  const methodId = TestHelpers.registerMethod(function () {
    Email.send({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
  });

  const client = TestHelpers.getMeteorClient();

  client.call(methodId);
}

Tinytest.add(
  'Email - success',
  function (test) {
    TestHelpers.enableTrackingMethods();

    sendTestEmailThroughMethod();

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


Tinytest.add(
  'Email - nested ignore nested async call',
  function (test) {
    TestHelpers.enableTrackingMethods();

    sendTestEmailThroughMethod();

    const events = TestHelpers.getLatestEventsFromMethodStore();

    const emailEvent = events.find(e => e[0] === 'email');
    const data = emailEvent[3] || {};

    const nested = data.nested;

    test.equal(emailEvent[0], 'email');
    test.equal(typeof nested, 'undefined');

    TestHelpers.cleanTestData();
  }
);
