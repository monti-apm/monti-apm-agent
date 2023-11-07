import { pick } from '../utils';

const CAPTURED_OPTIONS = ['from', 'to', 'cc', 'bcc', 'replyTo', 'messageId'];

const getWrapper = (originalSend, eventName = 'email') => function wrapper (options) {
  const data = pick(options, CAPTURED_OPTIONS);

  return Kadira.tracer.asyncEvent(eventName, data, null, () => originalSend.call(this, options));
};

if (Package['email']) {
  const { Email } = Package['email'];

  Email.send = getWrapper(Email.send, 'email');

  if (Email.sendAsync) {
    Email.sendAsync = getWrapper(Email.sendAsync, 'email');
  }
}
