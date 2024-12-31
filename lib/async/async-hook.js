import { getActiveEvent } from './als';
import { EventType, MaxAsyncLevel } from '../constants';
import { AwaitDetector } from '@monti-apm/core/dist/await-detector';

const EventSymbol = Symbol('monti-agent-event');

export const awaitDetector = new AwaitDetector({
  onAwaitStart(promise, info) {
    if (!info.trace || info.trace.isEventsProcessed) return;

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
