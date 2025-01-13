import { _ } from 'meteor/underscore';
import { Meteor } from 'meteor/meteor';
import { countKeys, createHistogram } from '../utils.js';
import GCMetrics from '../hijack/gc.js';
import { getMongoDriverStats, resetMongoDriverStats } from '../hijack/mongo_driver_events.js';
import { KadiraModel } from './0model';
import { EventLoopMonitor } from '../event_loop_monitor.js';
import { Ntp } from '../ntp';
import os from 'os';
import fs from 'fs';
import cp from 'child_process';

export const MEMORY_ROUNDING_FACTOR = 100 * 1024; // 100kb
const EVENT_LOOP_ROUNDING_FACTOR = 500; // microseconds

function roundUsingFactor (number, factor) {
  return factor * Math.round(number / factor);
}

export function SystemModel () {
  this.startTime = Ntp._now();
  this.newSessions = 0;
  // 30 min
  this.sessionTimeout = 1000 * 60 * 30;

  this.evloopHistogram = createHistogram();
  this.evloopMonitor = new EventLoopMonitor(200);
  this.evloopMonitor.start();
  this.evloopMonitor.on('lag', lag => {
    const lagInMS = lag * 1000;
    // store as microsecond rounded to the nearest EVENT_LOOP_ROUNDING_FACTOR
    this.evloopHistogram.add(roundUsingFactor(lagInMS, EVENT_LOOP_ROUNDING_FACTOR));
  });

  this.gcMetrics = new GCMetrics();
  this.gcMetrics.start();


  this.cpuTime = process.hrtime();
  this.previousCpuUsage = process.cpuUsage();
  this.cpuHistory = [];
  this.currentCpuUsage = 0;
  this.freeMemory = os.freemem();

  setInterval(() => {
    this.cpuUsage();
  }, 2000);

  setInterval(async () => {
    try {
      await this.getFreeMemory();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Monti APM: failed to get memory info', e);
    }
  }, 2000);
}

_.extend(SystemModel.prototype, KadiraModel.prototype);

async function meminfo () {
  let info = {};
  const content = await new Promise((resolve, reject) => {
    fs.readFile('/proc/meminfo', (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
  let data = content.toString();
  data.split(/\n/g).forEach(function (line) {
    line = line.split(':');

    // Ignore invalid lines, if any
    if (line.length < 2) {
      return;
    }

    // Remove parseInt call to make all values strings
    info[line[0].trim()] = parseInt(line[1].trim(), 10);
  });

  return info;
}

SystemModel.prototype.getFreeMemory = async function () {
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
  try {
    if (isLinux) {
      const info = await meminfo();
      // in kb to bytes
      this.freeMemory = 1024 * (info.MemFree + info.Buffers + info.Cached);
      return true;
    }
    if (isMac) {
      const output = await new Promise((resolve, reject) => {
        cp.exec(
          'vm_stat',
          (error, stdout) => {
            if (error) {
              reject(error);
            } else {
              resolve(stdout);
            }
          });
      });
      const pageSizeArray = /page size of (\d*)/g.exec(output);
      const pageSize = parseInt(pageSizeArray[1], 10);
      const freePagesMatches = /Pages free:\s*(\d*)/g.exec(output);
      const freePages = parseInt(freePagesMatches[1], 10);
      const inactivePagesMatches = /Pages inactive:\s*(\d*)/g.exec(output);
      const inactivePages = parseInt(inactivePagesMatches[1],10);
      [pageSize, freePages, inactivePages].forEach(o => {
        if (Number.isNaN(o)) {
          throw new Error('Monti APM: failed to parse vm_stat');
        }
      });
      const totalFreeMemory = pageSize * (freePages + inactivePages);
      this.freeMemory = totalFreeMemory;
      return true;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Monti APM: failed to get native memory info, falling back to default option', e);
  }

  this.freeMemory = os.freemem();
  return false;
};

SystemModel.prototype.buildPayload = function () {
  let metrics = {};
  let now = Ntp._now();
  metrics.startTime = Kadira.syncedDate.syncTime(this.startTime);
  metrics.endTime = Kadira.syncedDate.syncTime(now);
  metrics.sessions = countKeys(Meteor.server.sessions);

  let memoryUsage = process.memoryUsage();
  metrics.memory = roundUsingFactor(memoryUsage.rss, MEMORY_ROUNDING_FACTOR) / (1024 * 1024);
  metrics.memoryArrayBuffers = roundUsingFactor(memoryUsage.arrayBuffers || 0, MEMORY_ROUNDING_FACTOR) / (1024 * 1024);
  metrics.memoryExternal = roundUsingFactor(memoryUsage.external, MEMORY_ROUNDING_FACTOR) / (1024 * 1024);
  metrics.memoryHeapUsed = roundUsingFactor(memoryUsage.heapUsed, MEMORY_ROUNDING_FACTOR) / (1024 * 1024);
  metrics.memoryHeapTotal = roundUsingFactor(memoryUsage.heapTotal, MEMORY_ROUNDING_FACTOR) / (1024 * 1024);

  const freeMemory = this.freeMemory;
  metrics.freeMemory = roundUsingFactor(freeMemory, MEMORY_ROUNDING_FACTOR) / (1024 * 1024);
  metrics.totalMemory = roundUsingFactor(os.totalmem(), MEMORY_ROUNDING_FACTOR) / (1024 * 1024);

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
  let elapTimeMS = hrtimeToMS(process.hrtime(this.cpuTime));
  let elapUsage = process.cpuUsage(this.previousCpuUsage);
  let elapUserMS = elapUsage.user / 1000;
  let elapSystMS = elapUsage.system / 1000;
  let totalUsageMS = elapUserMS + elapSystMS;
  let totalUsagePercent = totalUsageMS / elapTimeMS;

  this.cpuHistory.push({
    time: Ntp._now(),
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
  session._activeAt = Date.now();
};

SystemModel.prototype.countNewSession = function (session) {
  if (!isLocalAddress(session.socket)) {
    this.newSessions++;
  }
};

SystemModel.prototype.isSessionActive = function (session) {
  let inactiveTime = Date.now() - session._activeAt;
  return inactiveTime < this.sessionTimeout;
};

// ------------------------------------------------------------------------- //

// http://regex101.com/r/iF3yR3/2
// eslint-disable-next-line no-useless-escape
let isLocalHostRegex = /^(?:.*\.local|localhost)(?:\:\d+)?|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

// http://regex101.com/r/hM5gD8/1
let isLocalAddressRegex = /^127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/;

function isLocalAddress (socket) {
  let host = socket.headers['host'];
  if (host) {
    return isLocalHostRegex.test(host);
  }
  let address = socket.headers['x-forwarded-for'] || socket.remoteAddress;
  if (address) {
    return isLocalAddressRegex.test(address);
  }
}
