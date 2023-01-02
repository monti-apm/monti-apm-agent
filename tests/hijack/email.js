import { TestHelpers } from '../_helpers/helpers';
import { expect } from 'chai';

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
  function () {
    TestHelpers.enableTrackingMethods();

    sendTestEmailThroughMethod();

    const events = TestHelpers.getLatestEventsFromMethodStore();

    const emailEvent = events[2];
    const data = emailEvent[3] || {};

    const nested = data.nested;

    expect(emailEvent[0]).to.equal('email');
    expect(nested).to.be.undefined;

    console.log(events);

    TestHelpers.cleanTestData();
  }
);
