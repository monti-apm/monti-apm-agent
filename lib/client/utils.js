/* global window, screen */

import { Meteor } from 'meteor/meteor';
import { getLocalTime } from '../common/utils';

export function getBrowserInfo () {
  return {
    browser: window.navigator.userAgent,
    userId: Meteor.userId && Meteor.userId(),
    url: window.location.href,
    resolution: getResolution(),
    clientArch: getClientArch(),
  };
}

function getResolution () {
  if (screen && screen.width && screen.height) {
    return `${screen.width}x${screen.height}`;
  }
}

const toArray = (...args) => args;

export function getErrorStack (zone, callback) {
  const trace = [];
  const eventMap = zone.eventMap || {};
  const infoMap = zone.infoMap || {};

  trace.push({
    at: getLocalTime(),
    stack: zone.erroredStack.get()
  });

  processZone();
  function processZone () {
    // we assume, first two zones are not interesting
    // bacause, they are some internal meteor loading stuffs
    if (zone && zone.depth > 2) {
      let stack = '';
      if (zone.currentStack) {
        stack = zone.currentStack.get();
      }

      let events = eventMap[zone.id] || [];
      let info = getInfoArray(infoMap[zone.id]);
      let ownerArgsEvent = events && events[0] && events[0].type == 'owner-args' && events.shift();
      let runAt = ownerArgsEvent ? ownerArgsEvent.at : zone.runAt;
      let ownerArgs = ownerArgsEvent ? toArray.apply(null, ownerArgsEvent.args) : [];

      // limiting
      events = events.slice(-5).map(checkSizeAndPickFields(100));
      info = info.slice(-5).map(checkSizeAndPickFields(100));
      ownerArgs = checkSizeAndPickFields(200)(ownerArgs.slice(0,5));

      zone.owner && delete zone.owner.zoneId;

      trace.push({
        createdAt: zone.createdAt,
        runAt,
        stack,
        owner: zone.owner,
        ownerArgs,
        events,
        info,
        zoneId: zone.id
      });
      zone = zone.parent;

      setTimeout(processZone, 0);
    } else {
      callback(trace);
    }
  }
}

function getInfoArray (info = {}) {
  return Object.keys(info)
    .map(function (key, type) {
      const value = info[key];
      value.type = type;
      return value;
    });
}

getTime = function () {
  if (Kadira && Kadira.syncedDate) {
    return Kadira.syncedDate.getTime();
  }
  return getLocalTime();
};

export function getClientArch () {
  if (Meteor.isCordova) {
    return 'cordova.web';
  }
  if (typeof Meteor.isModern === 'undefined' || Meteor.isModern) {
    return 'web.browser';
  }
  return 'web.browser.legacy';
}

export function checkSizeAndPickFields (maxFieldSize) {
  return function (obj) {
    maxFieldSize = maxFieldSize || 100;
    for (let key in obj) {
      const value = obj[key];
      try {
        const valueStringified = JSON.stringify(value);
        if (valueStringified.length > maxFieldSize) {
          obj[key] = `${valueStringified.substr(0, maxFieldSize)} ...`;
        } else {
          obj[key] = value;
        }
      } catch (ex) {
        obj[key] = 'Error: cannot stringify value';
      }
    }
    return obj;
  };
}

export function httpRequest (method, url, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  /**
   * IE8 and IE9 does not support CORS with the usual XMLHttpRequest object
   * If XDomainRequest exists, use it to send errors.
   * XDR can POST data to HTTPS endpoints only if current page uses HTTPS
   */
  if (window.XDomainRequest) {
    let xdr = new XDomainRequest();
    url = matchPageProtocol(url);

    xdr.onload = function () {
      let headers = { 'Content-Type': xdr.contentType };
      let data = {};
      try {
        data = JSON.parse(xdr.responseText);
      } catch (e) {}

      callback(null, {
        content: xdr.responseText,
        data,
        headers,
        statusCode: 200
      });
    };

    xdr.onerror = function () {
      callback({ statusCode: 404 });
    };
    xdr.onprogress = function () {
      // onprogress must be set. Otherwise, ie doesn't handle duplicate requests
      // correctly.
    };

    xdr.open(method, url);

    setTimeout(() => {
      let content = options.content;
      if (typeof content === 'object') {
        content = JSON.stringify(content);
      }
      // delaying send fixes issues when multiple xdr requests are made
      // at the same time.
      xdr.send(options.content || null);
    }, 0);

    function matchPageProtocol (endpoint) {
      let withoutProtocol = endpoint.substr(endpoint.indexOf(':') + 1);
      return window.location.protocol + withoutProtocol;
    }
  } else {
    // Based on Meteor's HTTP package. Uses XMLHttpRequest
    let content = options.content;

    // wrap callback to add a 'response' property on an error, in case
    // we have both (http 4xx/5xx error, which has a response payload)
    callback = (function (callback) {
      let called = false;
      return function (error, response) {
        if (!called) {
          called = true;
          if (error && response) {
            error.response = response;
          }
          callback(error, response);
        }
      };
    })(callback);

    try {
      if (typeof XMLHttpRequest === 'undefined') {
        throw new Error("Can't create XMLHttpRequest");
      }

      let xhr = new XMLHttpRequest();

      xhr.open(method, url, true);

      if (options.headers) {
        Object.keys(options.headers).forEach(function (key) {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) { // COMPLETE
          if (!xhr.status) {
            // no HTTP response
            callback(new Error('Connection lost'));
          } else {
            let response = {};
            response.statusCode = xhr.status;
            response.content = xhr.responseText;

            // Read Content-Type header, up to a ';' if there is one.
            // A typical header might be "application/json; charset=utf-8"
            // or just "application/json".
            let contentType = (xhr.getResponseHeader('content-type') || ';').split(';')[0];

            // Only try to parse data as JSON if server sets correct content type.
            if (['application/json',
              'text/javascript',
              'application/javascript',
              'application/x-javascript',
            ].indexOf(contentType) >= 0) {
              try {
                response.data = JSON.parse(response.content);
              } catch (err) {
                response.data = null;
              }
            } else {
              response.data = null;
            }

            let error = null;
            if (response.statusCode >= 400) {
              let message = `failed [${response.statusCode}]`;

              if (response.content) {
                let stringContent = typeof response.content === 'string' ?
                  response.content : response.content.toString();
                stringContent = stringContent.replace(/\n/g, ' ');
                stringContent = stringContent.length > 500 ? `${stringContent.slice(0, length)}...` : stringContent;
                message += ` ${stringContent}`;
              }

              error = new Error(message);
            }

            callback(error, response);
          }
        }
      };

      xhr.send(content);
    } catch (err) {
      callback(err);
    }
  }
}
