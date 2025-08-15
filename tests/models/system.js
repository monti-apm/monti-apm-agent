import cp from 'child_process';
import fs from 'fs';
import { Meteor } from 'meteor/meteor';
import sinon from 'sinon';
import { MEMORY_ROUNDING_FACTOR, SystemModel } from '../../lib/models/system';
import { sleep } from '../../lib/utils';
import { Wait, addAsyncTest, releaseParts } from '../_helpers/helpers';

/**
 * @flaky
 */
addAsyncTest(
  'Models - System - buildPayload',
  async function (test) {
    let model = new SystemModel();

    await sleep(500);

    let payload = model.buildPayload();

    payload = payload.systemMetrics[0];

    test.isTrue(payload.memory > 0, `memory: ${payload.memory}`);
    test.isTrue((payload.memory * 1024 * 1024 /* in bytes */) % MEMORY_ROUNDING_FACTOR === 0, 'memory is rounded');
    test.isTrue((payload.freeMemory * 1024 * 1024 /* in bytes */) % MEMORY_ROUNDING_FACTOR === 0, 'memory is rounded');
    test.isTrue(payload.freeMemory > 0, 'free memory is > 0');
    test.isTrue(payload.freeMemory > 0, 'free memory is > 0');
    test.isTrue(payload.pcpu >= 0, `pcpu: ${payload.pcpu}`);
    test.isTrue(payload.sessions >= 0, `sessions: ${payload.sessions}`);
    test.isTrue(payload.endTime >= payload.startTime + 500, `time: ${payload.endTime} - ${payload.startTime}`);
  }
);

// sinon cant stub fs/cp on older node versions
if (releaseParts[0] > 1 || (releaseParts[0] === 1 && releaseParts[1] > 8) ) {
  Tinytest.addAsync(
    'Models - System - freeMemory',
    async function (test) {
      let model = new SystemModel();
      /**
     * MAC OS
     */
      sinon.stub(process, 'platform').value('darwin');

      sinon.replace(cp, 'exec', (a, callback) => {
        callback(null,
          `Mach Virtual Memory Statistics: (page size of 16384 bytes)
          Pages free:                                3293.
          Pages active:                            231224.
          Pages inactive:                          238682.
          Pages speculative:                          534.
          Pages throttled:                              0.
          Pages wired down:                        212821.
          Pages purgeable:                          15075.
          "Translation faults":                3619403884.
          Pages copy-on-write:                  205742534.
          Pages zero filled:                   1133125308.
          Pages reactivated:                    862283057.
          Pages purged:                         221979774.
          File-backed pages:                       115729.
          Anonymous pages:                         354711.
          Pages stored in compressor:             2284038.
          Pages occupied by compressor:            452497.
          Decompressions:                       992611451.
          Compressions:                        1067810568.
          Pageins:                               58750181.
          Pageouts:                               2172799.
          Swapins:                                6971267.
          Swapouts:                               8892364.`);
      });
      await model.getFreeMemory();
      test.isTrue(model.freeMemory === 3964518400, 'should use the file format on mac');
      sinon.restore();

      /**
     * LINUX
     */
      sinon.stub(process, 'platform').value('linux');
      model = new SystemModel();
      sinon.replace(fs, 'readFile', (_,callback) => {
        callback(null,
          { toString: () => `MemTotal:        2097152 kB
        MemFree:         2085696 kB
        MemAvailable:    2085828 kB
        Buffers:               0 kB
        Cached:              132 kB
        SwapCached:            0 kB
        Active:                0 kB
        Inactive:           4116 kB
        Active(anon):          0 kB
        Inactive(anon):     4116 kB
        Active(file):          0 kB
        Inactive(file):        0 kB
        Unevictable:           0 kB
        Mlocked:               0 kB
        SwapTotal:             0 kB
        SwapFree:              0 kB
        Dirty:                 0 kB
        Writeback:             0 kB
        AnonPages:          4116 kB
        Mapped:                0 kB
        Shmem:                 0 kB
        KReclaimable:    6807616 kB
        Slab:               0 kB
        SReclaimable:          0 kB
        SUnreclaim:            0 kB
        KernelStack:       36496 kB
        PageTables:        48024 kB
        NFS_Unstable:          0 kB
        Bounce:                0 kB
        WritebackTmp:          0 kB
        CommitLimit:    325948112 kB
        Committed_AS:   18755168 kB
        VmallocTotal:   34359738367 kB
        VmallocUsed:      163092 kB
        VmallocChunk:          0 kB
        Percpu:           525312 kB
        HardwareCorrupted:     0 kB
        AnonHugePages:         0 kB
        ShmemHugePages:        0 kB
        ShmemPmdMapped:        0 kB
        FileHugePages:         0 kB
        FilePmdMapped:         0 kB
        HugePages_Total:    8192
        HugePages_Free:     8189
        HugePages_Rsvd:       61
        HugePages_Surp:        0
        Hugepagesize:       2048 kB
        Hugetlb:        16777216 kB
        DirectMap4k:    14918780 kB
        DirectMap2M:    116037632 kB
        DirectMap1G:     5242880 kB`});
      });

      await model.getFreeMemory();
      console.log(model.freeMemory);
      test.isTrue(model.freeMemory === 2135887872, 'should use the file format on linux');
      sinon.restore();
    }
  );
  Tinytest.addAsync(
    'Models - System - freeMemory silent error',
    async function (test) {
      let model = new SystemModel();
      /**
     * MAC OS
     */
      sinon.stub(process, 'platform').value('darwin');
      sinon.replace(cp, 'exec', (a, callback) => {
        callback(/* error */ 'simulated error',null);
      });
      await model.getFreeMemory();
      test.isTrue(model.freeMemory > 0, 'should use fallback on mac');
      sinon.restore();

      /**
     * LINUX
     */
      sinon.stub(process, 'platform').value('linux');
      model = new SystemModel();
      sinon.replace(fs, 'readFile', (_,callback) => {
        callback(/* error */ 'simulated error', null);
      });

      await model.getFreeMemory();
      test.isTrue(model.freeMemory > 0 , 'should use fallback linux');
      sinon.restore();
    }
  );
} else {
  Tinytest.addAsync(
    'Models - System - freeMemory silent error',
    async function (test, done) {
      const model = new SystemModel();
      await model.getFreeMemory();
      test.isTrue(model.freeMemory > 0 , 'should use fallback linux');
      done();
    });
}

if (process.platform !== 'win32') {
  Tinytest.addAsync(
    'Models - System - freeMemory succeed on osx/linux',
    async function (test, done) {
      const model = new SystemModel();
      let success = await model.getFreeMemory();
      test.isTrue(success);
      done();
    }
  );
}

Tinytest.add(
  'Models - System - new Sessions - count new session',
  function (test) {
    let model = new SystemModel();
    let session = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    model.handleSessionActivity({msg: 'connect'}, session);
    test.equal(model.newSessions, 1);
  }
);

Tinytest.add(
  'Models - System - new Sessions - initial _activeAt',
  function (test) {
    let model = new SystemModel();
    let session = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    model.handleSessionActivity({msg: 'connect'}, session);
    test.equal(Date.now() - session._activeAt < 1000, true);
  }
);

Tinytest.add(
  'Models - System - new Sessions - ignore local sessions (by host)',
  function (test) {
    let model = new SystemModel();
    let session = {socket: {headers: {host: 'localhost'}}};
    model.handleSessionActivity({msg: 'connect'}, session);
    test.equal(model.newSessions, 0);
  }
);

Tinytest.add(
  'Models - System - new Sessions - ignore local sessions (by ip)',
  function (test) {
    let model = new SystemModel();
    let session = {socket: {headers: {'x-forwarded-for': '127.0.0.1'}}};
    model.handleSessionActivity({msg: 'connect'}, session);
    test.equal(model.newSessions, 0);
  }
);

Tinytest.add(
  'Models - System - new Sessions - multiple sessions',
  function (test) {
    let model = new SystemModel();
    let session1 = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    let session2 = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    model.handleSessionActivity({msg: 'connect'}, session1);
    model.handleSessionActivity({msg: 'connect'}, session2);
    test.equal(model.newSessions, 2);
  }
);

Tinytest.add(
  'Models - System - new Sessions - reconnecting',
  function (test) {
    let model = new SystemModel();
    let session = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    model.handleSessionActivity({msg: 'connect', session: 'foo'}, session);
    test.equal(model.newSessions, 0);
  }
);

Tinytest.add(
  'Models - System - new Sessions - active ddp client',
  function (test) {
    let model = new SystemModel();
    model.sessionTimeout = 500;
    let session = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    model.handleSessionActivity({msg: 'connect'}, session);
    Wait(200);
    model.handleSessionActivity({msg: 'sub'}, session);
    test.equal(model.newSessions, 1);
  }
);

addAsyncTest(
  'Models - System - new Sessions - inactive ddp client',
  async function (test) {
    let model = new SystemModel();

    model.sessionTimeout = 100;

    let session = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};

    model.handleSessionActivity({msg: 'connect'}, session);

    await sleep(200);

    model.handleSessionActivity({msg: 'sub'}, session);

    test.equal(model.newSessions, 2);
  }
);

Tinytest.add(
  'Models - System - new Sessions - integration - new connections',
  function (test) {
    let model = Kadira.models.system;
    let initCount = model.newSessions;

    sendConnectMessage({remoteAddress: '1.1.1.1'});
    sendConnectMessage({remoteAddress: '1.1.1.1'});

    Wait(100);
    let newSessions = model.newSessions - initCount;
    test.equal(newSessions, 2);
  }
);

Tinytest.add(
  'Models - System - new Sessions - integration - reconnect',
  function (test) {
    let model = Kadira.models.system;
    let initCount = model.newSessions;

    let session = sendConnectMessage({remoteAddress: '1.1.1.1'});
    Wait(50);
    sendConnectMessage({remoteAddress: '1.1.1.1', sessionId: session.id});
    Wait(50);

    let newSessions = model.newSessions - initCount;
    test.equal(newSessions, 1);
  }
);

Tinytest.add(
  'Models - System - new Sessions - integration - local connection',
  function (test) {
    let model = Kadira.models.system;
    let initCount = model.newSessions;

    sendConnectMessage({remoteAddress: '127.0.0.1'});
    sendConnectMessage({forwardedAddress: '127.0.0.1'});

    Wait(100);
    let newSessions = model.newSessions - initCount;
    test.equal(newSessions, 0);
  }
);

function sendConnectMessage (options) {
  let socket = {send () {}, close () {}, headers: []};
  let message = {msg: 'connect', version: 'pre1', support: ['pre1']};

  if (options.remoteAddress) {
    socket.remoteAddress = options.remoteAddress;
  }

  if (options.forwardedAddress) {
    socket.headers['x-forwarded-for'] = options.forwardedAddress;
  }

  if (options.sessionId) {
    message.session = options.sessionId;
  }

  Meteor.server._handleConnect(socket, message);
  return socket._meteorSession;
}
