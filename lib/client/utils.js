getBrowserInfo = function () {
  return {
    browser: window.navigator.userAgent,
    userId: Meteor.userId && Meteor.userId(),
    url: location.href,
    resolution: getResolution(),
    clientArch: getClientArch(),
  };
}

getResolution = function () {
  if(screen && screen.width && screen.height) {
    var resolution = screen.width + 'x' + screen.height;
    return resolution;
  }
}

const toArray = (...args) => args;

getErrorStack = function (zone, callback) {
  var trace = [];
  var eventMap = zone.eventMap || {};
  var infoMap = zone.infoMap || {};

  trace.push({
    at: (new Date().getTime()),
    stack: zone.erroredStack.get()
  });

  processZone();
  function processZone() {
    // we assume, first two zones are not interesting
    // bacause, they are some internal meteor loading stuffs
    if(zone && zone.depth > 2) {
      var stack = "";
      if(zone.currentStack) {
        stack = zone.currentStack.get();
      }

      var events = eventMap[zone.id] || [];
      var info = getInfoArray(infoMap[zone.id]);
      var ownerArgsEvent = events && events[0] && events[0].type == 'owner-args' && events.shift();
      var runAt = (ownerArgsEvent)? ownerArgsEvent.at : zone.runAt;
      var ownerArgs = (ownerArgsEvent)? toArray.apply(null, ownerArgsEvent.args) : [];

      // limiting
      events = events.slice(-5).map(checkSizeAndPickFields(100));
      info = info.slice(-5).map(checkSizeAndPickFields(100));
      ownerArgs = checkSizeAndPickFields(200)(ownerArgs.slice(0,5));

      zone.owner && delete zone.owner.zoneId;

      trace.push({
        createdAt: zone.createdAt,
        runAt: runAt,
        stack: stack,
        owner: zone.owner,
        ownerArgs: ownerArgs,
        events: events,
        info: info,
        zoneId: zone.id
      });
      zone = zone.parent;

      setTimeout(processZone, 0);
    } else {
      callback(trace);
    }
  }
}

getInfoArray = function (info = {}) {
  return Object.keys(info)
    .map(function (key, type) {
      const value = info[key];
      value.type = type;
      return value;
    });
}

getTime = function () {
  if(Kadira && Kadira.syncedDate) {
    return Kadira.syncedDate.getTime();
  } else {
    return (new Date().getTime());
  }
}

getClientArch = function () {
  if (Meteor.isCordova) {
    return 'cordova.web';
  } else if (typeof Meteor.isModern === 'undefined' || Meteor.isModern) {
    return 'web.browser'
  } else {
    return 'web.browser.legacy'
  }
}

checkSizeAndPickFields = function(maxFieldSize) {
  return function(obj) {
    maxFieldSize = maxFieldSize || 100;
    for(var key in obj) {
      var value = obj[key];
      try {
        var valueStringified = JSON.stringify(value);
        if(valueStringified.length > maxFieldSize) {
          obj[key] = valueStringified.substr(0, maxFieldSize) + " ...";
        } else {
          obj[key] = value;
        }
      } catch(ex) {
        obj[key] = 'Error: cannot stringify value';
      }
    }
    return obj;
  }
}

httpRequest = function (method, url, options, callback) {
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
    var xdr = new XDomainRequest();
    url = matchPageProtocol(url);

    xdr.onload = function () {
      var headers = { 'Content-Type': xdr.contentType };
      var data = {};
      try {
        data = JSON.parse(xdr.responseText);
      } catch (e) {}

      callback(null, { content: xdr.responseText, data: data, headers: headers, statusCode: 200 });
    }

    xdr.onerror = function () {
      callback({ statusCode: 404 });
    };
    xdr.onprogress = function () {
      // onprogress must be set. Otherwise, ie doesn't handle duplicate requests
      // correctly.
    };

    xdr.open(method, url);

    setTimeout(() => {
      var content = options.content;
      if (typeof content === 'object') {
        content = JSON.stringify(content);
      }
      // delaying send fixes issues when multiple xdr requests are made
      // at the same time.
      xdr.send(options.content || null);
    }, 0)

    function matchPageProtocol (endpoint) {
      var withoutProtocol = endpoint.substr(endpoint.indexOf(':') + 1);
      return window.location.protocol + withoutProtocol;
    }
  } else {
    // Based on Meteor's HTTP package. Uses XMLHttpRequest
    var content = options.content;

    // wrap callback to add a 'response' property on an error, in case
    // we have both (http 4xx/5xx error, which has a response payload)
    callback = (function (callback) {
      var called = false;
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
      if (typeof XMLHttpRequest === "undefined") {
        throw new Error("Can't create XMLHttpRequest");
      }
      
      var xhr = new XMLHttpRequest();

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
            callback(new Error("Connection lost"));
          } else {
            var response = {};
            response.statusCode = xhr.status;
            response.content = xhr.responseText;

            // Read Content-Type header, up to a ';' if there is one.
            // A typical header might be "application/json; charset=utf-8"
            // or just "application/json".
            var contentType = (xhr.getResponseHeader('content-type') || ';').split(';')[0];

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

            var error = null;
            if (response.statusCode >= 400) {
              var message = "failed [" + response.statusCode + "]";

              if (response.content) {
                var stringContent = typeof response.content == "string" ?
                  response.content : response.content.toString();
                stringContent = stringContent.replace(/\n/g, ' ');
                stringContent = stringContent.length > 500 ? stringContent.slice(0, length) + '...' : stringContent;
                message += ' ' + stringContent;
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
};
