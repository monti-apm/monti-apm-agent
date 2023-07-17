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

    mergeEnterWith({ isMeteorHttp: true });

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

  const trace = getTrace();

  const { isMeteorHttp } = getStore();

  if (!trace || isMeteorHttp) return originalAddRequest.apply(this, arguments);

  const method = request.method;

  const event = Kadira.tracer.event(trace, EventType.HTTP, {
    method,
    library: 'node:http',
  });

  request.once('response', (response) => {
    const host = request.host;
    const path = request.path;
    const protocol = request.protocol;
    const port = request.socket?.localPort;
    const url = `${protocol}//${host}:${port}${path}`;

    console.log('HTTP request completed', method, url);

    Kadira.tracer.eventEnd(trace, event, { url, statusCode: response.statusCode });
  });

  return originalAddRequest.apply(this, arguments);
};
