// strip sensitive data sent to Monti APM engine.
// possible to limit types by providing an array of types to strip
// possible types are: "start", "db", "http", "email"
Tracer.stripSensitive = function stripSensitive(typesToStrip, receiverType, name) {
  typesToStrip =  typesToStrip || [];

  var strippedTypes = {};
  typesToStrip.forEach(function(type) {
    strippedTypes[type] = true;
  });

  return function (type, data, info) {
    if(typesToStrip.length > 0 && !strippedTypes[type])
      return data;

    if(receiverType && receiverType != info.type)
      return data;

    if(name && name != info.name)
      return data;

    if(type == "start") {
      if (data.params) {
        data.params = "[stripped]";
      }
      if (data.headers) {
        data.headers = "[stripped]";
      }
      if (data.body) {
        data.body = "[stripped]";
      }
    } else if(type == "db") {
      data.selector = "[stripped]";
    } else if(type == "http") {
      data.url = "[stripped]";
    } else if(type == "email") {
      ["from", "to", "cc", "bcc", "replyTo"].forEach(function(item) {
        if(data[item]) {
          data[item] = "[stripped]";
        }
      });
    }

    return data;
  };
};

// Strip sensitive data sent to Monti APM engine.
// In contrast to stripSensitive, this one has an allow list of what to keep
// to guard against forgetting to strip new fields
// In the future this one might replace Tracer.stripSensitive
// options
Tracer.stripSensitiveThorough = function stripSensitive() {
  return function (type, data) {
    let fieldsToKeep = [];

    if (type == "start") {
      fieldsToKeep = ['userId'];
    } else if (type === 'waitend') {
      fieldsToKeep = [ 'waitOn' ];
    } else if (type == "db") {
      fieldsToKeep = [
        'coll', 'func', 'cursor', 'limit', 'docsFetched', 'docSize', 'oplog',
        'fields', 'projection', 'wasMultiplexerReady', 'queueLength', 'elapsedPollingTime',
        'noOfCachedDocs'
      ];
    } else if (type == "http") {
      fieldsToKeep = ['method', 'statusCode'];
    } else if (type == "email") {
      fieldsToKeep = [];
    } else if (type === 'custom') {
      // This is supplied by the user so we assume they are only giving data that can be sent
      fieldsToKeep = Object.keys(data);
    } else if (type === 'error') {
      fieldsToKeep = ['error'];
    }

    Object.keys(data).forEach(key => {
      if (fieldsToKeep.indexOf(key) === -1) {
        data[key] = '[stripped]';
      }
    });

    return data;
  };
};

// strip selectors only from the given list of collection names
Tracer.stripSelectors = function stripSelectors(collectionList, receiverType, name) {
  collectionList = collectionList || [];

  var collMap = {};
  collectionList.forEach(function(collName) {
    collMap[collName] = true;
  });

  return function(type, data, info) {
    if(type != "db" || (data && !collMap[data.coll])) {
      return data
    }

    if(receiverType && receiverType != info.type)
      return data;

    if(name && name != info.name)
      return data;

    data.selector = "[stripped]";
    return data;
  };
}
