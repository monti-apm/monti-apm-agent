import { wrapWebApp } from './wrap_webapp.js';
import { wrapFastRender } from './fast_render.js';
import { wrapFs } from './fs.js';
import { wrapPicker } from './picker.js';
import { wrapRouters } from './wrap_routers.js';
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

let instrumented = false;
Kadira._startInstrumenting = function (callback) {
  if (instrumented) {
    callback();
    return;
  }

  instrumented = true;
  wrapStringifyDDP();
  wrapWebApp();
  wrapFastRender();
  wrapPicker();
  wrapFs();
  wrapRouters();

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
