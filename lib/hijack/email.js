import { _ } from 'meteor/underscore';

const supportsAsyncHooks = !!process.moduleLoadList.find((item) => item.includes('async_hooks'));

console.log({ supportsAsyncHooks });

const CAPTURED_OPTIONS = ['from', 'to', 'cc', 'bcc', 'replyTo', 'messageId'];

function wrapper (originalSend, options) {
  let eventId;
  const kadiraInfo = Kadira._getInfo();

  if (kadiraInfo) {
    const data = _.pick(options, ...CAPTURED_OPTIONS);
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
}

if (Package['email']) {
  const { Email } = Package['email'];

  Email.send = _.wrap(Email.send, wrapper);

  if (Email.sendAsync) {
    Email.sendAsync = _.wrap(Email.sendAsync, wrapper);
  }
}
