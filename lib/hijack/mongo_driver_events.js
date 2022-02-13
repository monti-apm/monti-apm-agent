var client;
var serverStatus = Object.create(null);

var otherCheckouts = 0;

// These metrics are only for the mongo pool for the primary Mongo server
var primaryCheckouts = 0;
var totalCheckoutTime = 0;
var maxCheckoutTime = 0;
var created = 0;
var measurementCount = 0;
var pendingTotal = 0;
var checkedOutTotal = 0;

setInterval(() => {
  let status = getServerStatus(getPrimary(), true);

  if (status) {
    pendingTotal += status.pending.length;
    checkedOutTotal += status.checkedOut.size;
    measurementCount += 1;
  }
}, 1000);

// Version 4 of the driver defaults to 100. Older versions used 10.
var DEFAULT_MAX_POOL_SIZE = 100;

function getPoolSize () {
  if (client && client.topology && client.topology.s && client.topology.s.options) {
    return client.topology.s.options.maxPoolSize || DEFAULT_MAX_POOL_SIZE;
  }

  return 0;
}

export function getMongoDriverStats () {
  return {
    poolSize: getPoolSize(),
    primaryCheckouts,
    otherCheckouts,
    checkoutTime: totalCheckoutTime,
    maxCheckoutTime,
    pending: pendingTotal ? pendingTotal / measurementCount : 0,
    checkedOut: checkedOutTotal ? checkedOutTotal / measurementCount : 0,
    created
  };
};

export function resetMongoDriverStats() {
  primaryCheckouts = 0;
  otherCheckouts = 0;
  totalCheckoutTime = 0;
  maxCheckoutTime = 0;
  pendingTotal = 0;
  checkedOutTotal = 0;
  measurementCount = 0;
  primaryCheckouts = 0;
  created = 0;
}

Meteor.startup(() => {
  let _client = MongoInternals.defaultRemoteCollectionDriver().mongo.client;

  if (!_client || !_client.s) {
    // Old version of agent
    return;
  }

  let options = _client.s.options || {};
  let versionParts = MongoInternals.NpmModules.mongodb.version.split('.')
    .map(part => parseInt(part, 10));

    // Version 4 of the driver removed the option and enabled it by default
  if (!options.useUnifiedTopology && versionParts[0] < 4) {
    // CMAP and topology monitoring requires useUnifiedTopology
    return;
  }

  // Meteor 1.9 enabled useUnifiedTopology, but CMAP events were only added
  // in version 3.5 of the driver.
  if (versionParts[0] === 3 && versionParts[1] < 5) {
    return;
  }

  client = _client;

  // Get the number of connections already created
  let primaryDescription = getServerDescription(getPrimary());
  if (primaryDescription && primaryDescription.s && primaryDescription.s.pool) {
    let pool = primaryDescription.s.pool;
    let totalConnections = pool.totalConnectionCount;
    let availableConnections = pool.availableConnectionCount;

    // totalConnectionCount counts available connections twice
    created += totalConnections - availableConnections;
  }

  client.on('connectionCreated', event => {
    let primary = getPrimary();
    if (primary === event.address) {
      created += 1;
    }
  });

  client.on('connectionClosed', event => {
    let status = getServerStatus(event.address, true);
    if (status) {
      status.checkedOut.delete(event.connectionId);
    }
  });

  client.on('connectionCheckOutStarted', event => {
    let status = getServerStatus(event.address);
    status.pending.push(event.time);
  });

  client.on('connectionCheckOutFailed', event => {
    let status = getServerStatus(event.address, true);
    if (status) {
      status.pending.shift();
    }
  });

  client.on('connectionCheckedOut', event => {
    let status = getServerStatus(event.address);
    let start = status.pending.shift();
    let primary = getPrimary();

    if (start && primary === event.address) {
      let checkoutDuration = event.time.getTime() - start.getTime();

      primaryCheckouts += 1;
      totalCheckoutTime += checkoutDuration;
      if (checkoutDuration > maxCheckoutTime) {
        maxCheckoutTime = checkoutDuration;
      }
    } else {
      otherCheckouts += 1;
    }

    status.checkedOut.add(event.connectionId);
  });

  client.on('connectionCheckedIn', event => {
    let status = getServerStatus(event.address, true);
    if (status) {
      status.checkedOut.delete(event.connectionId);
    }
  });

  client.on('serverClosed', function (event) {
    delete serverStatus[event.address];
  });
});

function getServerStatus(address, disableCreate) {
  if (typeof address !== 'string') {
    return null;
  }

  if (address in serverStatus) {
    return serverStatus[address];
  }

  if (disableCreate) {
    return null;
  }

  serverStatus[address] = {
    pending: [],
    checkedOut: new Set(),
  }

  return serverStatus[address];
}

function getPrimary() {
  if (!client || !client.topology) {
    return null;
  }
  // The driver renamed lastIsMaster in version 4.3.1 to lastHello
  let server = client.topology.lastIsMaster ?
    client.topology.lastIsMaster() :
    client.topology.lastHello();

  if (server.type === 'Standalone') {
    return server.address;
  }

  if (!server || !server.primary) {
    return null;
  }

  return server.primary;
}

function getServerDescription(address) {
  if (!client || !client.topology || !client.topology.s || !client.topology.s.servers) {
    return null;
  }
  let description = client.topology.s.servers.get(address);

  return description || null;
}
