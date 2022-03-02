/* eslint-disable prefer-rest-params */
import { haveAsyncCallback } from '../utils';

if (Package['http']) {
  const HTTP = Package['http'].HTTP;
  const library = 'meteor/http';
  const originalCall = HTTP.call;

  HTTP.call = function (method, url) {
    const tracer = Kadira.tracer;
    const kadiraInfo = Kadira._getInfo();

    const event = kadiraInfo ? tracer.event(kadiraInfo.trace, 'http', {
      method,
      url,
      library,
    }) : null;

    if (!event) {
      return originalCall.apply(this, arguments);
    }

    try {
      const response = originalCall.apply(this, arguments);

      // If the user supplied an asyncCallback,
      // we don't have a response object and it handled asynchronously.
      // We need to track it down to prevent issues like: #3
      const endOptions = haveAsyncCallback(arguments) ? { async: true, library } : { statusCode: response.statusCode, library };

      tracer.eventEnd(kadiraInfo.trace, event, endOptions);

      return response;
    } catch (ex) {
      tracer.eventEnd(kadiraInfo.trace, event, { err: ex.message });

      throw ex;
    }
  };
}

if (Package['fetch']) {
  const library = 'meteor/fetch';
  const originalCall = Package['fetch'].fetch;
  const Request = Package['fetch'].Request;

  Package['fetch'].fetch = function (url, opts) {
    const request = new Request(url, opts);
    const tracer = Kadira.tracer;
    const kadiraInfo = Kadira._getInfo();

    const event = kadiraInfo ? tracer.event(kadiraInfo.trace, 'http', {
      method: request.method,
      url: request.url,
      library,
    }) : null;

    if (!event) {
      return originalCall.apply(this, arguments);
    }

    try {
      const response = originalCall.apply(this, arguments);

      const endOptions = { library };

       response
         .then((res) => {
           tracer.eventEnd(kadiraInfo.trace, event, endOptions);
         })
         .catch((ex) => {
           tracer.eventEnd(kadiraInfo.trace, event, { err: ex.message });
         });

      return response;
    } catch (ex) {
      tracer.eventEnd(kadiraInfo.trace, event, { err: ex.message });

      throw ex;
    }
  };
}
