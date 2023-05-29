import { addAsyncTest, callAsync, getLastMethodEvents, registerMethod } from '../_helpers/helpers';

async function sendTestEmailThroughMethod () {
  const Email = Package['email'].Email;

  const methodId = registerMethod(async function () {
    await Email.sendAsync({ from: 'arunoda@meteorhacks.com', to: 'hello@meteor.com' });
  });

  await callAsync(methodId);
}

addAsyncTest(
  'Email - success',
  async function (test) {
    await sendTestEmailThroughMethod();

    const events = getLastMethodEvents([0]);

    const expected = [
      ['start'],
      ['wait'],
      ['emailAsync'],
      ['complete']
    ];

    test.equal(events, expected);
  }
);
