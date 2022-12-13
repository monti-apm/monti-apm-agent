import { Meteor } from 'meteor/meteor';
import { EventLoopMonitor } from '../lib/event_loop_monitor';

function blockEventLoop () {
  let start = Date.now();
  // eslint-disable-next-line no-empty
  while (Date.now() - start < 100) {}
}

Tinytest.addAsync(
  'EventLoopMonitor - basic usage',
  function (test, done) {
    const monitor = new EventLoopMonitor(100);
    monitor.start();

    // Saturate the event loop so that we can detect lag.
    blockEventLoop();

    Meteor.setTimeout(function () {
      const status = monitor.status();

      test.isTrue(status.pctBlock > 0);
      test.isTrue(status.totalLag > 0);
      test.isTrue(status.elapsedTime > 0);
      monitor.stop();
      done();
    }, 300);
  }
);

Tinytest.addAsync(
  'EventLoopMonitor - usage just after created',
  function (test, done) {
    const monitor = new EventLoopMonitor(100);
    monitor.start();
    let status = monitor.status();
    test.isTrue(status.pctBlock === 0);
    monitor.stop();
    done();
  }
);

Tinytest.addAsync(
  'EventLoopMonitor - usage just after stopped',
  function (test, done) {
    let monitor = new EventLoopMonitor(100);
    monitor.start();


    // Saturate the event loop so that we can detect lag.
    blockEventLoop();

    Meteor.setTimeout(function () {
      let status = monitor.status();

      console.log(status);

      test.isTrue(status.pctBlock > 0);
      monitor.stop();

      status = monitor.status();

      console.log(status);

      test.isTrue(status.pctBlock === 0);
      done();
    }, 200);
  }
);
