import EventLoopMonitor from 'evloop-monitor';
import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { getLocalTime } from '../common/utils';
import { countKeys, createHistogram } from '../utils.js';
import GCMetrics from '../hijack/gc.js';
import { getFiberMetrics, resetFiberMetrics } from '../hijack/async.js';
import { getMongoDriverStats, resetMongoDriverStats } from '../hijack/mongo_driver_events.js';
import { KadiraModel } from './0model';

const BYTES_IN_MB = 1024 * 1024;

export function SystemModel () {
  this.startTime = getLocalTime();
  this.newSessions = 0;
  this.sessionTimeout = 1000 * 60 * 30; // 30 min

  this.evloopHistogram = createHistogram();
  this.evloopMonitor = new EventLoopMonitor(200);
  this.evloopMonitor.start();
  this.evloopMonitor.on('lag', lag => {
    // store as microsecond
    this.evloopHistogram.add(lag * 1000);
  });

  this.gcMetrics = new GCMetrics();
  this.gcMetrics.start();


  this.cpuTime = process.hrtime();
  this.previousCpuUsage = process.cpuUsage();
  this.cpuHistory = [];
  this.currentCpuUsage = 0;

  setInterval(() => {
    this.cpuUsage();
  }, 2000);
}

_.extend(SystemModel.prototype, KadiraModel.prototype);

SystemModel.prototype.buildPayload = function () {
  let metrics = {};
  const now = getLocalTime();
  metrics.startTime = Kadira.syncedDate.syncTime(this.startTime);
  metrics.endTime = Kadira.syncedDate.syncTime(now);
  metrics.sessions = countKeys(Meteor.server.sessions);

  let memoryUsage = process.memoryUsage();
  metrics.memory = memoryUsage.rss / BYTES_IN_MB;
  metrics.memoryArrayBuffers = (memoryUsage.arrayBuffers || 0) / BYTES_IN_MB;
  metrics.memoryExternal = memoryUsage.external / BYTES_IN_MB;
  metrics.memoryHeapUsed = memoryUsage.heapUsed / BYTES_IN_MB;
  metrics.memoryHeapTotal = memoryUsage.heapTotal / BYTES_IN_MB;

  metrics.newSessions = this.newSessions;
  this.newSessions = 0;

  metrics.activeRequests = process._getActiveRequests().length;
  metrics.activeHandles = process._getActiveHandles().length;

  // track eventloop metrics
  metrics.pctEvloopBlock = this.evloopMonitor.status().pctBlock;
  metrics.evloopHistogram = this.evloopHistogram;
  this.evloopHistogram = createHistogram();

  metrics.gcMajorDuration = this.gcMetrics.metrics.gcMajor;
  metrics.gcMinorDuration = this.gcMetrics.metrics.gcMinor;
  metrics.gcIncrementalDuration = this.gcMetrics.metrics.gcIncremental;
  metrics.gcWeakCBDuration = this.gcMetrics.metrics.gcWeakCB;
  this.gcMetrics.reset();

  const driverMetrics = getMongoDriverStats();
  resetMongoDriverStats();

  metrics.mongoPoolSize = driverMetrics.poolSize;
  metrics.mongoPoolPrimaryCheckouts = driverMetrics.primaryCheckouts;
  metrics.mongoPoolOtherCheckouts = driverMetrics.otherCheckouts;
  metrics.mongoPoolCheckoutTime = driverMetrics.checkoutTime;
  metrics.mongoPoolMaxCheckoutTime = driverMetrics.maxCheckoutTime;
  metrics.mongoPoolPending = driverMetrics.pending;
  metrics.mongoPoolCheckedOutConnections = driverMetrics.checkedOut;
  metrics.mongoPoolCreatedConnections = driverMetrics.created;

  const fiberMetrics = getFiberMetrics();
  resetFiberMetrics();
  metrics.createdFibers = fiberMetrics.created;
  metrics.activeFibers = fiberMetrics.active;
  metrics.fiberPoolSize = fiberMetrics.poolSize;

  metrics.pcpu = 0;
  metrics.pcpuUser = 0;
  metrics.pcpuSystem = 0;

  if (this.cpuHistory.length > 0) {
    let lastCpuUsage = this.cpuHistory[this.cpuHistory.length - 1];
    metrics.pcpu = lastCpuUsage.usage * 100;
    metrics.pcpuUser = lastCpuUsage.user * 100;
    metrics.pcpuSystem = lastCpuUsage.sys * 100;
  }

  metrics.cpuHistory = this.cpuHistory.map(entry => ({
    time: Kadira.syncedDate.syncTime(entry.time),
    usage: entry.usage,
    sys: entry.sys,
    user: entry.user
  }));

  this.cpuHistory = [];
  this.startTime = now;
  return {systemMetrics: [metrics]};
};

function hrtimeToMS (hrtime) {
  return hrtime[0] * 1000 + hrtime[1] / 1000000;
}

SystemModel.prototype.cpuUsage = function () {
  const elapTimeMS = hrtimeToMS(process.hrtime(this.cpuTime));
  const elapUsage = process.cpuUsage(this.previousCpuUsage);
  const elapUserMS = elapUsage.user / 1000;
  const elapSystMS = elapUsage.system / 1000;
  const totalUsageMS = elapUserMS + elapSystMS;
  const totalUsagePercent = totalUsageMS / elapTimeMS;

  this.cpuHistory.push({
    time: getLocalTime(),
    usage: totalUsagePercent,
    user: elapUserMS / elapTimeMS,
    sys: elapSystMS / elapUsage.system
  });

  this.currentCpuUsage = totalUsagePercent * 100;
  Kadira.docSzCache.setPcpu(this.currentCpuUsage);

  this.cpuTime = process.hrtime();
  this.previousCpuUsage = process.cpuUsage();
};

SystemModel.prototype.handleSessionActivity = function (msg, session) {
  if (msg.msg === 'connect' && !msg.session) {
    this.countNewSession(session);
  } else if (['sub', 'method'].indexOf(msg.msg) !== -1) {
    if (!this.isSessionActive(session)) {
      this.countNewSession(session);
    }
  }
  session._activeAt = getLocalTime();
};

SystemModel.prototype.countNewSession = function (session) {
  if (!isLocalAddress(session.socket)) {
    this.newSessions++;
  }
};

SystemModel.prototype.isSessionActive = function (session) {
  const inactiveTime = getLocalTime() - session._activeAt;
  return inactiveTime < this.sessionTimeout;
};

// ------------------------------------------------------------------------- //

// http://regex101.com/r/iF3yR3/2
// eslint-disable-next-line no-useless-escape
const isLocalHostRegex = /^(?:.*\.local|localhost)(?:\:\d+)?|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

// http://regex101.com/r/hM5gD8/1
const isLocalAddressRegex = /^127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

function isLocalAddress (socket) {
  const host = socket.headers['host'];
  if (host) {
    return isLocalHostRegex.test(host);
  }
  const address = socket.headers['x-forwarded-for'] || socket.remoteAddress;
  if (address) {
    return isLocalAddressRegex.test(address);
  }
}
