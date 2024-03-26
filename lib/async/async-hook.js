import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo } from './als';
import { DEBUG_ASYNC_HOOKS, EventType, MaxAsyncLevel } from '../constants';
import { Ntp } from '../ntp';
import { stackTrace } from '../utils';
import { AwaitDetector } from '@monti-apm/core/dist/await-detector';

export function getResources () {
  const info = getInfo();

  return info?.resources;
}

export const getResource = (asyncId) => {
  if (!asyncId) return;

  const resources = getResources();

  return resources?.get(asyncId);
};

export const awaitDetector = new AwaitDetector({
  onAwaitStart (asyncId, triggerAsyncId) {
    const info = getInfo();

    if (!info) return;
    const activeEvent = getActiveEvent();

    if (activeEvent?.level > MaxAsyncLevel) return;

    const { trace } = info || {};

    if (!trace) return;

    info.resources = info.resources || new Map();
    let event = Kadira.tracer.event(info.trace, EventType.Async);
    let res = { event };

    if (DEBUG_ASYNC_HOOKS) {
      Object.apply(res, {
        asyncId,
        triggerAsyncId,
        executionAsyncId: asyncHooks.executionAsyncId(),
        start: Ntp._now(),
        activeEvent,
        stack: stackTrace(),
      });
    }

    info.resources.set(asyncId, res);
  },
  onAwaitEnd (asyncId) {
    const info = getInfo();

    if (!info) return;

    let resources = info.resources;
    let resource = resources?.get(asyncId);

    if (!resource) return;

    if (!DEBUG_ASYNC_HOOKS) {
      resources.delete(asyncId);
    }
    // Some events finish after the trace is already processed.
    if (info.trace.isEventsProcessed) return;
    Kadira.tracer.eventEnd(info.trace, resource.event);
  },
});
