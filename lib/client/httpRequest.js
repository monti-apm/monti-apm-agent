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
    let xdr = new window.XDomainRequest();
    url = matchPageProtocol(url);

    xdr.onload = function () {
      let headers = { 'Content-Type': xdr.contentType };
      let data = {};
      try {
        data = JSON.parse(xdr.responseText);
        // eslint-disable-next-line no-empty
      } catch (e) {}

      callback(null, { content: xdr.responseText, data, headers, statusCode: 200 });
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
                const MAX_LENGTH = 500;
                let stringContent = typeof response.content === 'string' ?
                  response.content : response.content.toString();
                stringContent = stringContent.replace(/\n/g, ' ');
                stringContent = stringContent.length > MAX_LENGTH ? `${stringContent.slice(0, MAX_LENGTH)}...` : stringContent;
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
