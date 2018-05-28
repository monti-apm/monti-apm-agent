Kadira.send = function (payload, path, callback) {
  if(!Kadira.connected)  {
    throw new Error("You need to connect with Kadira first, before sending messages!");
  }

  path = (path.substr(0, 1) != '/')? "/" + path : path;
  var endpoint = Kadira.options.endpoint + path;
  var retryCount = 0;
  var retry = new Retry({
    minCount: 1,
    minTimeout: 0,
    baseTimeout: 1000*5,
    maxTimeout: 1000*60,
  });

  var sendFunction = Kadira._getSendFunction();
  tryToSend();

  function tryToSend(err) {
    if(retryCount < 5) {
      retry.retryLater(retryCount++, send);
    } else {
      console.warn('Error sending error traces to Monti APM server');
      if(callback) callback(err);
    }
  }

  function send() {
    sendFunction(endpoint, payload, function(err, res) {
      if(err && !res) {
        tryToSend(err);
      } else if(res.statusCode == 200) {
        if(callback) callback(null, res.data);
      } else {
        if(callback) callback(new Meteor.Error(res.statusCode, res.content));
      }
    });
  }
};

Kadira._getSendFunction = function() {
  return (Meteor.isServer)? Kadira._serverSend : Kadira._clientSend;
};

Kadira._clientSend = function (endpoint, payload, callback) {
  httpRequest('POST', endpoint, {
    headers: {
      'Content-Type': 'application/json'
    },
    content: JSON.stringify(payload)
  }, callback);
}

Kadira._serverSend = function (endpoint, payload, callback) {
  callback = callback || function() {};
  var Fiber = Npm.require('fibers');
  new Fiber(function() {
    var httpOptions = {
      data: payload,
      headers: Kadira.options.authHeaders
    };

    HTTP.call('POST', endpoint, httpOptions, callback);
}).run();
}
