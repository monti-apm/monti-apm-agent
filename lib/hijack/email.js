import { _ } from 'meteor/underscore';

if (Package['email']) {
  const Email = Package['email'].Email;

  let originalSend = Email.send;

  Email.send = function (options) {
    let kadiraInfo = Kadira._getInfo();
    if (kadiraInfo) {
      let data = _.pick(options, 'from', 'to', 'cc', 'bcc', 'replyTo');
      var eventId = Kadira.tracer.event(kadiraInfo.trace, 'email', data);
    }
    try {
      let ret = originalSend.call(this, options);
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
}
