import { EventType } from '../../constants';
import { getCursorData } from './get-cursor-data';

export function hijackObserveMethods () {
  const cursorProto = MeteorX.MongoCursor.prototype;

  // Right now they are async in the server and sync in the client, but it might change.
  const OBSERVE_METHODS = ['observeChanges', 'observe'];

  OBSERVE_METHODS.forEach(function (type) {
    let originalFunc = cursorProto[type];

    cursorProto[type] = function () {
      const { payload, cursorDescription } = getCursorData({
        type,
        cursor: this,
      });

      return Kadira.tracer.asyncEvent(EventType.DB, payload, null, async (event) => {
        let ret = await originalFunc.apply(this, arguments);

        let endData = {};

        let observerDriver;

        endData.oplog = false;
        // get data written by the multiplexer
        endData.wasMultiplexerReady = ret._wasMultiplexerReady;
        endData.queueLength = ret._queueLength;
        endData.elapsedPollingTime = ret._elapsedPollingTime;

        if (ret._multiplexer) {
          // older meteor versions done not have an _multiplexer value
          observerDriver = ret._multiplexer._observeDriver;
          if (observerDriver) {
            observerDriver = ret._multiplexer._observeDriver;
            let observerDriverClass = observerDriver.constructor;
            endData.oplog = typeof observerDriverClass.cursorSupported === 'function';

            let size = 0;
            ret._multiplexer._cache.docs.forEach(function () {
              size++;
            });
            endData.noOfCachedDocs = size;

            // if multiplexerWasNotReady, we need to get the time spend for the polling
            if (!ret._wasMultiplexerReady) {
              endData.initialPollingTime = observerDriver._lastPollTime;
            }
          }
        }

        if (!endData.oplog) {
          // let's try to find the reason
          let reasonInfo = Kadira.checkWhyNoOplog(cursorDescription, observerDriver);
          endData.noOplogCode = reasonInfo.code;
          endData.noOplogReason = reasonInfo.reason;
          endData.noOplogSolution = reasonInfo.solution;
        }

        Kadira.tracer.asyncEventEnd(event, endData);

        return ret;
      });
    };
  });
}
