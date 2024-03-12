import { TestHelpers } from '../_helpers/helpers';

const Email = Package['email'].Email;

function sendTestEmailThroughMethod (func) {
  const methodId = TestHelpers.registerMethod(function () {
    return Email[func]({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
  });

  const client = TestHelpers.getMeteorClient();

  client.call(methodId);
}

Tinytest.add(
  'Email - success',
  function (test) {
    TestHelpers.enableTrackingMethods();

    sendTestEmailThroughMethod('send');

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

if (Email.sendAsync) {
  Tinytest.add(
    'Email - sendAsync',
    function (test) {
      TestHelpers.enableTrackingMethods();

      sendTestEmailThroughMethod('sendAsync');

      const events = TestHelpers.getLastMethodEvents([0]);

      const expected = [
        ['start'],
        ['wait'],
        ['email'],
        ['async'],
        ['complete']
      ];

      test.equal(events, expected);

      TestHelpers.cleanTestData();
    }
  );
}
