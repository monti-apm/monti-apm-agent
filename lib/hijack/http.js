/* eslint-disable prefer-rest-params */
import { haveAsyncCallback } from '../utils';
import { EventType } from '../constants';
import { getTrace } from '../async/async-hook';
import { getStore, mergeEnterWith } from '../async/als';

if (Package['http']) {
  const HTTP = Package['http'].HTTP;
  const library = 'meteor/http';
  const originalCall = HTTP.call;

  HTTP.call = function (method, url) {
    const tracer = Kadira.tracer;
    const kadiraInfo = Kadira._getInfo();

    const event = kadiraInfo ? tracer.event(kadiraInfo.trace, EventType.HTTP, {
      method,
      url,
      library,
    }) : null;

    if (!event) {
      return originalCall.apply(this, arguments);
    }

    mergeEnterWith({ isHttpAlreadyTracked: true });

    try {
      if (haveAsyncCallback(arguments)) {
        const originalCallback = arguments[arguments.length - 1];

        arguments[arguments.length - 1] = function (err, response) {
          if (err) {
            tracer.eventEnd(kadiraInfo.trace, event, { err: err.message });
          } else {
            tracer.eventEnd(kadiraInfo.trace, event, { statusCode: response.statusCode, async: true });
          }

          originalCallback.apply(this, arguments);
        };

        return originalCall.apply(this, arguments);
      }

      const response = originalCall.apply(this, arguments);

      const endOptions = { statusCode: response.statusCode };

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

    const event = kadiraInfo ? tracer.event(kadiraInfo.trace, EventType.HTTP, {
      method: request.method,
      url: request.url,
      library,
    }) : null;

    if (!event) {
      return originalCall.apply(this, arguments);
    }

    mergeEnterWith({ isHttpAlreadyTracked: true });

    try {
      const response = originalCall.apply(this, arguments);

      response
        .then(() => {
          tracer.eventEnd(kadiraInfo.trace, event, { });
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

const { Agent } = require('_http_agent');

const originalAddRequest = Agent.prototype.addRequest;

Agent.prototype.addRequest = function () {
  const request = arguments[0];
  const options = arguments[1];
  const port = options?.port ?? arguments[2];

  const trace = getTrace();

  const { isHttpAlreadyTracked } = getStore();

  if (!trace || isHttpAlreadyTracked) return originalAddRequest.apply(this, arguments);

  const method = request.method;
  const host = request.host;
  const path = request.path;
  const protocol = request.protocol;
  const url = `${protocol}//${host}:${port}${path}`;

  const event = Kadira.tracer.event(trace, EventType.HTTP, {
    method,
    url,
    library: 'node:http',
  });

  request.once('response', (response) => {
    const { statusCode } = response;

    Kadira.tracer.eventEnd(trace, event, { statusCode });
  });

  return originalAddRequest.apply(this, arguments);
};
