import { pick } from '../utils';

const CAPTURED_OPTIONS = ['from', 'to', 'cc', 'bcc', 'replyTo', 'messageId'];

const getWrapper = (originalSend, func) => function wrapper (options) {
  let eventId;
  const kadiraInfo = Kadira._getInfo();

  if (kadiraInfo) {
    const data = pick(options, CAPTURED_OPTIONS);
    data.func = func;

    eventId = Kadira.tracer.event(kadiraInfo.trace, 'email', data);
  }

  try {
    const ret = originalSend.call(this, options);
    if (eventId) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, eventId);
    }
    return ret;
  } catch (ex) {
    if (eventId) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, eventId, {err: ex.message});
    }
    throw ex;
  }
};

if (Package['email']) {
  const { Email } = Package['email'];

  Email.send = getWrapper(Email.send, 'email');

  if (Email.sendAsync) {
    Email.sendAsync = getWrapper(Email.sendAsync, 'emailAsync');
  }
}
