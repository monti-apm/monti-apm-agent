/* global Kadira */

import { _ } from 'meteor/underscore';

if (Package['email']) {
  const Email = Package['email'].Email;

  const originalSend = Email.send;

  Email.send = function (options) {
    const kadiraInfo = Kadira._getInfo();
    let eventId;
    if (kadiraInfo) {
      const data = _.pick(options, 'from', 'to', 'cc', 'bcc', 'replyTo');
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
}
