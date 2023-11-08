import { pick } from '../utils';
import { EventType } from '../constants';

const CAPTURED_OPTIONS = ['from', 'to', 'cc', 'bcc', 'replyTo', 'messageId'];

const getWrapper = (originalSend, func) => function wrapper (options) {
  const data = { ...pick(options, CAPTURED_OPTIONS), func };

  return Kadira.tracer.asyncEvent(EventType.Email, data, null, () => originalSend.call(this, options));
};

if (Package['email']) {
  const { Email } = Package['email'];

  Email.send = getWrapper(Email.send, 'email');

  if (Email.sendAsync) {
    Email.sendAsync = getWrapper(Email.sendAsync, 'emailAsync');
  }
}
