/* eslint-disable prefer-rest-params */
import { haveAsyncCallback } from '../utils';

if (Package['http']) {
  const HTTP = Package['http'].HTTP;

  const originalCall = HTTP.call;

  HTTP.call = function (method, url) {
    const tracer = Kadira.tracer;
    const kadiraInfo = Kadira._getInfo();

    const event = kadiraInfo ? tracer.event(kadiraInfo.trace, 'http', {
      method,
      url,
    }) : null;

    if (!event) {
      return originalCall.apply(this, arguments);
    }

    try {
      const response = originalCall.apply(this, arguments);

      // If the user supplied an asyncCallback,
      // we don't have a response object and it handled asynchronously.
      // We need to track it down to prevent issues like: #3
      const endOptions = haveAsyncCallback(arguments) ? { async: true } : { statusCode: response.statusCode };

      tracer.eventEnd(kadiraInfo.trace, event, endOptions);

      return response;
    } catch (ex) {
      tracer.eventEnd(kadiraInfo.trace, event, { err: ex.message });

      throw ex;
    }
  };
}
