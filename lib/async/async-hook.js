import { EventType } from '../constants';
import { AwaitDetector } from '@monti-apm/core/dist/await-detector';

const EventSymbol = Symbol('monti-agent-event');

export const awaitDetector = new AwaitDetector({
  onAwaitStart(promise, info) {
    if (!info.trace || info.trace.isEventsProcessed) return;

    let currentInfo = Kadira._getInfo();
    if (currentInfo && currentInfo !== info) return;

    let event = Kadira.tracer.event(info.trace, EventType.Async);
    promise[EventSymbol] = event;
  },
  onAwaitEnd(promise, info) {
    let event = promise[EventSymbol];

    if (event && !info.trace.isEventsProcessed) {
      Kadira.tracer.eventEnd(info.trace, event);
    }
  },
});

if (Package.promise?.Promise) {
  // Forcing new Promise to create a non-native promise makes the promise
  // events for awaits consistent and possible to track.
  // This will only make packages loaded later use the wrapped promise, other
  // packages will unfortunately use the native promise and will not be tracked
  // reliably.
  Package.promise.Promise = awaitDetector.createWrappedPromiseConstructor(
    Package.promise.Promise
  );

  // Make sure we use the wrapped promise too. Needed for tests to work
  // This isn't changing the global Promise, and instead is changing the value
  // of the Promise variable exported from the promise package.
  if (Promise !== global.Promise) {
    Promise = Package.promise.Promise;
  }
}
