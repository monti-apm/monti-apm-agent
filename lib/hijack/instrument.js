
import { wrapSubscription } from './wrap_subscription';
import { wrapServer } from './wrap_server';
import { wrapSession } from './wrap_session';
import {
  wrapForCountingObservers,
  wrapMultiplexer,
  wrapOplogObserveDriver,
  wrapPollingObserveDriver
} from './wrap_observers';
import { wrapStringifyDDP } from './wrap_ddp_stringify';
import { setLabels } from './set_labels';
import { hijackDBOps } from './db';
import { fibersEnabled } from '../async-context.js';

let instrumented = false;
Kadira._startInstrumenting = function (callback) {
  if (instrumented) {
    callback();
    return;
  }

  instrumented = true;

  if (fibersEnabled) {
    const { wrapFibers } = require('./async.js');
    wrapFibers();

    const { wrapFs } = require('./fs.js');
    wrapFs();

    const { wrapWebApp } = require('./wrap_webapp.js');
    const { wrapFastRender } = require('./fast_render.js');
    const { wrapPicker } = require('./picker.js');
    const { wrapRouters } = require('./wrap_routers.js');

    wrapPicker();
    wrapRouters();
    wrapWebApp();
    wrapFastRender();
  }
  wrapStringifyDDP();

  MeteorX.onReady(function () {
    // instrumenting session
    wrapServer(MeteorX.Server.prototype);
    wrapSession(MeteorX.Session.prototype);
    wrapSubscription(MeteorX.Subscription.prototype);

    if (MeteorX.MongoOplogDriver) {
      wrapOplogObserveDriver(MeteorX.MongoOplogDriver.prototype);
    }

    if (MeteorX.MongoPollingDriver) {
      wrapPollingObserveDriver(MeteorX.MongoPollingDriver.prototype);
    }

    if (MeteorX.Multiplexer) {
      wrapMultiplexer(MeteorX.Multiplexer.prototype);
    }

    wrapForCountingObservers();
    hijackDBOps();

    setLabels();
    callback();
  });
};
