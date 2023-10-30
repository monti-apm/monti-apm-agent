import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo, MontiAsyncStorage } from './als';
import { EventType, MaxAsyncLevel } from '../constants';
import { Ntp } from '../ntp';
import { pick, stackTrace } from '../utils';
import { AwaitDetector } from '@monti-apm/core/dist/await-detector';


export const AsyncMetrics = {
  totalAsyncCount: 0,
  activeAsyncCount: 0,
};

export function getResources () {
  const info = getInfo();

  return info?.resources;
}

export function getResourcesAsArray () {
  const resources = getResources();

  return resources ? Array.from(resources.values()) : [];
}

export const getResource = (asyncId) => {
  if (!asyncId) return;

  const resources = getResources();

  return resources?.get(asyncId);
};

export const awaitDetector = new AwaitDetector({
  onAwaitStart (asyncId, triggerAsyncId) {
    const info = getInfo();

    if (!info?.trackAsync) return;

    const activeEvent = getActiveEvent();

    if (activeEvent?.level > MaxAsyncLevel) return;

    const {trace} = info || {};

    if (!trace) return;

    info.resources = info.resources || new Map();

    const trigger = info.resources.get(triggerAsyncId);

    const oldStore = MontiAsyncStorage.getStore();

    const executionAsyncId = asyncHooks.executionAsyncId();

    const res = {
      asyncId,
      triggerAsyncId,
      executionAsyncId,
      start: Ntp._now(),
      end: null,
      startTime: Ntp._now(),
      endTime: null,
      oldStore,
      activeEvent,
    };

    if (Kadira.options.enableAsyncStackTraces || process.env.ENABLE_ASYNC_STACK_TRACES) {
      res.stack = stackTrace();
    }

    res.event = Kadira.tracer.event(info.trace, EventType.Async, pick(res, ['shouldBeSibling', 'asyncId', 'stack', 'asyncId', 'triggerAsyncId', 'executionAsyncId']));
    MontiAsyncStorage.enterWith(Object.assign({}, oldStore, { activeEvent: res.event }));

    info.resources.set(asyncId, res);

    if (trigger) {
      trigger.children = trigger.children || [];
      trigger.children.push(asyncId);
    }
  },
  onAwaitEnd (asyncId) {
    const resource = getResource(asyncId);

    if (!resource) return;


    resource.end = Ntp._now();
    resource.duration = resource.end - resource.start;

    console.log({ resource });

    const info = getInfo();

    if (!info) return;

    MontiAsyncStorage.enterWith(resource.oldStore);

    // Some events finish after the trace is already processed.
    if (info.trace.isEventsProcessed) return;

    Kadira.tracer.eventEnd(info.trace, resource.event);
  }
});

// @todo Keep nested async events for all events, except `db`.
// @todo Generate metrics for nested events as if they are root when nested in `custom` events.
