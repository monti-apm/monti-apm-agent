import { _ } from 'meteor/underscore';

const CAPTURED_OPTIONS = ['from', 'to', 'cc', 'bcc', 'replyTo', 'messageId'];

function getStackTrace () {
  const obj = {};
  Error.captureStackTrace(obj, getStackTrace);
  return obj.stack;
}

function isNestedCall () {
  const stackTrace = getStackTrace();
  return stackTrace.includes('Object.sendAsync') && stackTrace.includes('Object.send');
}

const getWrapper = (eventName = 'email') => function wrapper (originalSend, options) {
  if (isNestedCall()) {
    return originalSend.call(this, options);
  }

  let eventId;
  const kadiraInfo = Kadira._getInfo();

  if (kadiraInfo) {
    const data = _.pick(options, ...CAPTURED_OPTIONS);

    eventId = Kadira.tracer.event(kadiraInfo.trace, eventName, data);
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

  Email.send = _.wrap(Email.send, getWrapper('email'));

  if (Email.sendAsync) {
    Email.sendAsync = _.wrap(Email.sendAsync, getWrapper('emailAsync'));
  }
}
