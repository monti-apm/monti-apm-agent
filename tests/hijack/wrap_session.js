import { DDPCommon } from 'meteor/ddp-common';
import { withCurrentSub } from '../../lib/hijack/wrap_ddp_stringify';

// Meteor only buffers raw messages in ddp-server >= 3.3, so these drive our
// Session.send wrapper with a fake session to keep the tests version-independent.
function fakeSession (messageQueue) {
  return {
    messageQueue,
    socket: null,
    options: { maxMessageQueueLength: 100 },
  };
}

function send (session, msg) {
  return MeteorX.Session.prototype.send.call(session, msg);
}

function stringifyAttribution (msg) {
  let originalMethodTracker = Kadira.models.methods.trackMsgSize;
  let originalPubTracker = Kadira.models.pubsub.trackMsgSize;
  let attribution;

  Kadira.models.methods.trackMsgSize = function (name) {
    attribution = { type: 'method', name };
  };
  Kadira.models.pubsub.trackMsgSize = function (name, phase) {
    attribution = { type: 'publication', name, phase };
  };

  try {
    DDPCommon.stringifyDDP(msg);
  } finally {
    Kadira.models.methods.trackMsgSize = originalMethodTracker;
    Kadira.models.pubsub.trackMsgSize = originalPubTracker;
  }

  return attribution;
}

Tinytest.add(
  'WrapSession - send captures attribution while buffering',
  function (test) {
    let sub = { _name: 'publicationX' };
    let laterSub = { _name: 'later', _initialSentFinished: true };
    let msg = Object.freeze({
      msg: 'added',
      collection: 'c',
      id: 'doc1',
      fields: { aa: 1 },
    });

    withCurrentSub(function () {
      send(fakeSession([]), msg);
    }).call(sub);

    // Queueing the same message again must not replace its original context.
    withCurrentSub(function () {
      send(fakeSession([]), msg);
    }).call(laterSub);

    sub._initialSentFinished = true;

    test.equal(stringifyAttribution(msg), {
      type: 'publication',
      name: 'publicationX',
      phase: 'initialSent',
    });
  }
);

Tinytest.add(
  'WrapSession - send does not capture attribution on a normal send',
  function (test) {
    let sub = { _name: 'publicationX' };
    let msg = { msg: 'added', collection: 'c', id: 'doc1', fields: { aa: 1 } };
    let ping = { msg: 'ping' };

    withCurrentSub(function () {
      send(fakeSession(undefined), msg);
      send(fakeSession([]), ping);
    }).call(sub);

    test.equal(stringifyAttribution(msg), {
      type: 'method',
      name: '<not-a-method-or-a-pub>',
    });
    test.equal(stringifyAttribution(ping), {
      type: 'method',
      name: '<not-a-method-or-a-pub>',
    });
  }
);

Tinytest.add(
  'WrapSession - replayed messages are not tracked twice',
  function (test) {
    let msg = { msg: 'nosub', id: 'subscriptionX' };
    let original = Kadira.models.pubsub._trackNoSub;
    let calls = 0;

    Kadira.models.pubsub._trackNoSub = function () {
      calls += 1;
    };

    try {
      send(fakeSession([]), msg);
      test.equal(calls, 1);

      send(fakeSession(undefined), msg);
      test.equal(calls, 1);
    } finally {
      Kadira.models.pubsub._trackNoSub = original;
    }
  }
);
