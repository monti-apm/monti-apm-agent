import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { WaitTimeBuilder } from '../lib/wait_time_builder';

Tinytest.add(
  'WaitTimeBuilder - register and build - clean _messageCache',
  test => {
    const wtb = new WaitTimeBuilder();
    const session = {
      id: 'session-id',
      inQueue: [{ id: 'a' }, { id: 'b' }]
    };

    wtb.register(session, 'myid');
    const build = wtb.build(session, 'myid');
    test.equal(build, [{ id: 'a' }, { id: 'b' }]);
    test.equal(wtb._messageCache, {});
    test.equal(wtb._waitListStore, {});
  }
);

Tinytest.add('WaitTimeBuilder - no inQueue', test => {
  const wtb = new WaitTimeBuilder();
  const session = {
    id: 'session-id',
    inQueue: null
  };

  wtb.register(session, 'myid');
  const build = wtb.build(session, 'myid');
  test.equal(build, []);
  test.equal(wtb._messageCache, {});
  test.equal(wtb._waitListStore, {});
});

Tinytest.add(
  'WaitTimeBuilder - register and build - cached _messageCache',
  test => {
    const wtb = new WaitTimeBuilder();
    const session = {
      id: 'session-id',
      inQueue: [{ id: 'a' }, { id: 'b' }]
    };

    wtb.register(session, 'myid');
    wtb.register(session, 'myid2');
    const build = wtb.build(session, 'myid');
    test.equal(build, [{ id: 'a' }, { id: 'b' }]);
    test.equal(_.keys(wtb._messageCache).length, 2);
    test.equal(_.keys(wtb._waitListStore).length, 1);
  }
);

Tinytest.add(
  'WaitTimeBuilder - register and build - current processing',
  test => {
    const wtb = new WaitTimeBuilder();
    const session = {
      id: 'session-id',
      inQueue: [{ id: 'a' }, { id: 'b' }]
    };
    wtb._currentProcessingMessages[session.id] = { id: '01' };

    wtb.register(session, 'myid');
    const build = wtb.build(session, 'myid');

    test.equal(build, [{ id: '01' }, { id: 'a' }, { id: 'b' }]);
    test.equal(wtb._messageCache, {});
    test.equal(wtb._waitListStore, {});
  }
);

Tinytest.addAsync(
  'WaitTimeBuilder - track waitTime - with unblock',
  (test, done) => {
    const wtb = new WaitTimeBuilder();
    const session = {
      id: 'session-id',
      inQueue: [{ id: 'a' }, { id: 'b' }]
    };

    wtb.register(session, 'myid');
    const unblock = wtb.trackWaitTime(session, session.inQueue[0], () => {});
    Meteor.setTimeout(() => {
      unblock();
      const build = wtb.build(session, 'myid');
      test.equal(build[0].waitTime >= 100, true);
      test.equal(wtb._messageCache, {});
      test.equal(wtb._waitListStore, {});
      done();
    }, 200);
  }
);

Tinytest.addAsync(
  'WaitTimeBuilder - track waitTime - without unblock',
  (test, done) => {
    const wtb = new WaitTimeBuilder();
    const session = {
      id: 'session-id',
      inQueue: [{ id: 'a' }, { id: 'b' }]
    };

    wtb.register(session, 'myid');
    wtb.trackWaitTime(session, session.inQueue[0], () => {});
    Meteor.setTimeout(() => {
      const build = wtb.build(session, 'myid');
      test.equal(build[0].waitTime, undefined);
      test.equal(wtb._messageCache, {});
      test.equal(wtb._waitListStore, {});
      done();
    }, 100);
  }
);
