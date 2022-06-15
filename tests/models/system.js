import { Meteor } from 'meteor/meteor';

Tinytest.add(
  'Models - System - buildPayload',
  function (test) {
    let beforeTime = new Date().getTime();
    let model = new SystemModel();
    Meteor._wrapAsync(function (callback) {
      setTimeout(callback, 1000);
    })();
    let payload = model.buildPayload().systemMetrics[0];

    test.isTrue(payload.memory > 0);
    test.isTrue(payload.pcpu >= 0);
    test.isTrue(payload.sessions >= 0);
    test.isTrue(payload.endTime >= payload.startTime + 1000);
    test.isTrue(payload.pctEvloopBlock >= 0);
  }
);

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

Tinytest.add(
  'Models - System - new Sessions - inactive ddp client',
  function (test) {
    let model = new SystemModel();
    model.sessionTimeout = 100;
    let session = {socket: {headers: {'x-forwarded-for': '1.1.1.1'}}};
    model.handleSessionActivity({msg: 'connect'}, session);
    Wait(200);
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
  if (options.remoteAddress) { socket.remoteAddress = options.remoteAddress; }
  if (options.forwardedAddress) { socket.headers['x-forwarded-for'] = options.forwardedAddress; }
  if (options.sessionId) { message.session = options.sessionId; }
  Meteor.server._handleConnect(socket, message);
  return socket._meteorSession;
}
