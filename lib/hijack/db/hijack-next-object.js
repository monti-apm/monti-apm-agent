import { EventType } from '../../constants';

export function hijackNextObject () {
  const SynchronousCursor = MeteorX.SynchronousCursor;

  let origNextObject = SynchronousCursor.prototype._nextObjectPromise;

  SynchronousCursor.prototype._nextObjectPromise = function () {
    let kadiraInfo = Kadira._getInfo();
    let shouldTrack = kadiraInfo && kadiraInfo.trackNextObject;
    let event;
    if (shouldTrack ) {
      event = Kadira.tracer.event(kadiraInfo.trace, EventType.DB, {
        func: '_nextObjectPromise',
        coll: this._cursorDescription.collectionName
      });
    }

    let result = origNextObject.call(this);

    if (shouldTrack) {
      Kadira.tracer.eventEnd(kadiraInfo.trace, event);
    }
    return result;
  };
}
