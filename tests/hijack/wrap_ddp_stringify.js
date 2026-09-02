import { DDPCommon } from 'meteor/ddp-common';
import { createStore, MontiAsyncStorage } from '../../lib/async/als';
import { withCurrentSub } from '../../lib/hijack/wrap_ddp_stringify';

function trackStringifiedMessages (run) {
  let originalMethodTracker = Kadira.models.methods.trackMsgSize;
  let originalPubTracker = Kadira.models.pubsub.trackMsgSize;
  let tracked = [];

  Kadira.models.methods.trackMsgSize = function (name) {
    tracked.push({ type: 'method', name });
  };
  Kadira.models.pubsub.trackMsgSize = function (name, phase) {
    tracked.push({ type: 'publication', name, phase });
  };

  try {
    run();
  } finally {
    Kadira.models.methods.trackMsgSize = originalMethodTracker;
    Kadira.models.pubsub.trackMsgSize = originalPubTracker;
  }

  return tracked;
}

Tinytest.add(
  'MessageAttribution - scopes the current subscription to the call',
  function (test) {
    let outerSub = { _name: 'outer' };
    let innerSub = { _name: 'inner', _initialSentFinished: true };
    let thrownMessage;
    let result;

    let tracked = trackStringifiedMessages(() => {
      let inner = withCurrentSub(function () {
        DDPCommon.stringifyDDP({ msg: 'added' });
        throw new Error('fail');
      });

      let outer = withCurrentSub(function (result) {
        DDPCommon.stringifyDDP({ msg: 'added' });

        try {
          inner.call(innerSub);
        } catch (error) {
          thrownMessage = error.message;
        }

        DDPCommon.stringifyDDP({ msg: 'changed' });
        return result;
      });

      result = outer.call(outerSub, 'result');
      DDPCommon.stringifyDDP({ msg: 'removed' });
    });

    test.equal(thrownMessage, 'fail');
    test.equal(result, 'result');
    test.equal(tracked, [
      { type: 'publication', name: 'outer', phase: 'initialSent' },
      { type: 'publication', name: 'inner', phase: 'liveSent' },
      { type: 'publication', name: 'outer', phase: 'initialSent' },
      { type: 'method', name: '<not-a-method-or-a-pub>' },
    ]);
  }
);

Tinytest.addAsync(
  'MessageAttribution - current subscription does not cross an await',
  async function (test, done) {
    let originalMethodTracker = Kadira.models.methods.trackMsgSize;
    let originalPubTracker = Kadira.models.pubsub.trackMsgSize;
    let tracked = [];

    Kadira.models.methods.trackMsgSize = function (name) {
      tracked.push({ type: 'method', name });
    };
    Kadira.models.pubsub.trackMsgSize = function (name) {
      tracked.push({ type: 'publication', name });
    };

    try {
      let wrapped = withCurrentSub(async function () {
        DDPCommon.stringifyDDP({ msg: 'added' });
        await Promise.resolve();
        DDPCommon.stringifyDDP({ msg: 'changed' });
      });

      await wrapped.call({ _name: 'publicationX' });
    } finally {
      Kadira.models.methods.trackMsgSize = originalMethodTracker;
      Kadira.models.pubsub.trackMsgSize = originalPubTracker;
    }

    test.equal(tracked, [
      { type: 'publication', name: 'publicationX' },
      { type: 'method', name: '<not-a-method-or-a-pub>' },
    ]);
    done();
  }
);

Tinytest.add(
  'MessageAttribution - method takes precedence and ready is ignored',
  function (test) {
    let tracked = trackStringifiedMessages(() => {
      MontiAsyncStorage.run(createStore(), () => {
        Kadira._setInfo({ trace: { type: 'method', name: 'methodX' } });

        withCurrentSub(function () {
          DDPCommon.stringifyDDP({ msg: 'ready', subs: ['subscriptionX'] });
          DDPCommon.stringifyDDP({ msg: 'added' });
        }).call({ _name: 'publicationX' });
      });
    });

    test.equal(tracked, [
      { type: 'method', name: 'methodX' },
    ]);
  }
);
