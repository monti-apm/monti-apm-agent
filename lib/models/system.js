var os = Npm.require('os');
var EventLoopMonitor = Npm.require('evloop-monitor');

SystemModel = function () {
  this.startTime = Ntp._now();
  this.newSessions = 0;
  this.sessionTimeout = 1000 * 60 * 30; //30 min

  this.usageLookup = Kadira._wrapAsync(usage.stat.bind(usage));
  this.evloopMonitor = new EventLoopMonitor(200);
  this.evloopMonitor.start();
  this.showedUsageError = false;

  this.cpuTime = process.hrtime();
  this.previousCpuUsage = process.cpuUsage();
  this.cpuHistory = [];

  setInterval(() => {
    this.cpuUsage();
  }, 2000);
}

_.extend(SystemModel.prototype, KadiraModel.prototype);

SystemModel.prototype.buildPayload = function() {
  var metrics = {};
  var now = Ntp._now();
  metrics.startTime = Kadira.syncedDate.syncTime(this.startTime);
  metrics.endTime = Kadira.syncedDate.syncTime(now);
  metrics.sessions = countKeys(Meteor.default_server.sessions);

  let memoryUsage = process.memoryUsage();
  metrics.memory = memoryUsage.rss / (1024*1024);
  metrics.memoryArrayBuffers = (memoryUsage.arrayBuffers || 0) / (1024*1024);
  metrics.memoryExternal = memoryUsage.external / (1024*1024);
  metrics.memoryHeapUsed = memoryUsage.heapUsed / (1024*1024);
  metrics.memoryHeapTotal = memoryUsage.heapTotal / (1024*1024);

  metrics.newSessions = this.newSessions;
  this.newSessions = 0;

  // track eventloop blockness
  metrics.pctEvloopBlock = this.evloopMonitor.status().pctBlock;

  metrics.pcpu = 0;
  metrics.pcpuUser = 0;
  metrics.pcpuSystem = 0;

  if (this.cpuHistory.length > 0) {
    let lastCpuUsage = this.cpuHistory[this.cpuHistory.length - 1];
    metrics.pcpu = lastCpuUsage.usage * 100;
    metrics.pcpuUser = lastCpuUsage.user * 100;
    metrics.pcpuSystem = lastCpuUsage.sys * 100;
  }

  metrics.cpuHistory = this.cpuHistory.map(entry => {
    return {
      time: Kadira.syncedDate.syncTime(entry.time),
      usage: entry.usage
    };
  });

  this.cpuHistory = [];
  this.startTime = now;
  return {systemMetrics: [metrics]};
};

function hrtimeToMS(hrtime) {
  return hrtime[0] * 1000 + hrtime[1] / 1000000;
}

SystemModel.prototype.cpuUsage = function() {
  var elapTimeMS = hrtimeToMS(process.hrtime(this.cpuTime));
  var elapUsage = process.cpuUsage(this.previousCpuUsage);
  var elapUserMS = elapUsage.user / 1000;
  var elapSystMS = elapUsage.system / 1000;
  var totalUsageMS = elapUserMS + elapSystMS;
  var totalUsagePercent = totalUsageMS / elapTimeMS;

  this.cpuHistory.push({
    time: Ntp._now(),
    usage: totalUsagePercent,
    user: elapUserMS / elapTimeMS,
    sys: elapSystMS / elapUsage.system
  });

  Kadira.docSzCache.setPcpu(totalUsagePercent * 100);

  this.cpuTime = process.hrtime();
  this.previousCpuUsage = process.cpuUsage();
}

SystemModel.prototype.handleSessionActivity = function(msg, session) {
  if(msg.msg === 'connect' && !msg.session) {
    this.countNewSession(session);
  } else if(['sub', 'method'].indexOf(msg.msg) != -1) {
    if(!this.isSessionActive(session)) {
      this.countNewSession(session);
    }
  }
  session._activeAt = Date.now();
}

SystemModel.prototype.countNewSession = function(session) {
  if(!isLocalAddress(session.socket)) {
    this.newSessions++;
  }
}

SystemModel.prototype.isSessionActive = function(session) {
  var inactiveTime = Date.now() - session._activeAt;
  return inactiveTime < this.sessionTimeout;
}

// ------------------------------------------------------------------------- //

// http://regex101.com/r/iF3yR3/2
var isLocalHostRegex = /^(?:.*\.local|localhost)(?:\:\d+)?|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

// http://regex101.com/r/hM5gD8/1
var isLocalAddressRegex = /^127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

function isLocalAddress (socket) {
  var host = socket.headers['host'];
  if(host) return isLocalHostRegex.test(host);
  var address = socket.headers['x-forwarded-for'] || socket.remoteAddress;
  if(address) return isLocalAddressRegex.test(address);
}
