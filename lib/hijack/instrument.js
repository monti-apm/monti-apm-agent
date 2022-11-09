import { wrapWebApp } from './wrap_webapp.js';
import { wrapFastRender } from './fast_render.js';
import { wrapFs } from './fs.js';
import { wrapPicker } from './picker.js';
import { wrapRouters } from './wrap_routers.js';
import { wrapFibers } from './async.js';

let instrumented = false;
Kadira._startInstrumenting = function (callback) {
  if (instrumented) {
    callback();
    return;
  }

  instrumented = true;
  wrapFibers();
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
