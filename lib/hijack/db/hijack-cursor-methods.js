import { EventType } from '../../constants';
import { getCursorData } from './get-cursor-data';
import { calculateMetrics } from './calculate-metrics';

export function hijackCursorMethods () {
  const cursorProto = MeteorX.MongoCursor.prototype;

  // `fetchAsync` calls `fetch` behind the scenes, so we only need to intercept `fetch`, which is also called by `findOneAsync`.
  const ASYNC_CURSOR_METHODS = ['fetch', 'forEach', 'map', 'countAsync'];

  ASYNC_CURSOR_METHODS.forEach(function (type) {
    let originalFunc = cursorProto[type];

    if (!originalFunc) {
      return;
    }

    cursorProto[type] = function () {
      const { payload, cursorDescription } = getCursorData({
        type,
        cursor: this,
      });

      return Kadira.tracer.asyncEvent(EventType.DB, payload, null, async (event) => {
        let kadiraInfo = Kadira._getInfo();

        let previousTrackNextObject;

        if (kadiraInfo) {
          previousTrackNextObject = kadiraInfo.trackNextObject;

          if (['forEach', 'map'].includes(type)) {
            kadiraInfo.trackNextObject = true;
          }
        }

        const result = await originalFunc.apply(this, arguments);

        let endData = {};

        if (['fetch', 'map'].includes(type)) {
          // for other cursor operation
          endData.docsFetched = result.length;

          if (type === 'fetch') {
            calculateMetrics(cursorDescription, result, endData, kadiraInfo, previousTrackNextObject);

            // TODO: Add doc size tracking to `map` as well.
          }
        }

        Kadira.tracer.asyncEventEnd(event, endData);
        return result;
      });
    };
  });
}
