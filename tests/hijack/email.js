import { callAsync, cleanTestData, getLastMethodEvents, registerMethod } from '../_helpers/helpers';

async function sendTestEmailThroughMethod () {
  const Email = Package['email'].Email;

  const methodId = registerMethod(async function () {
    Email.send({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
  });

  await callAsync(methodId);
}

Tinytest.addAsync(
  'Email - success',
  async function (test, done) {
    await sendTestEmailThroughMethod();

    const events = getLastMethodEvents([0]);

    const expected = [
      ['start'],
      ['wait'],
      ['email'],
      ['complete']
    ];

    test.equal(events, expected);

    await cleanTestData();

    done();
  }
);
