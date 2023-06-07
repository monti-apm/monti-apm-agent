import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo } from './als';
import { EventType } from '../constants';
import { Ntp } from '../ntp';
import { checkForNested } from '../tracer/tracer';
import { stackTrace } from '../utils';

const getResource = (asyncId) => {
  if (!asyncId) return;

  const info = getInfo();

  if (!info) return;

  return info.resources?.get(asyncId);
};

export const isDescendantOf = (asyncId, parentAsyncId) => {
  const resource = getResource(asyncId);

  if (!resource) return false;

  if (resource.triggerAsyncId === parentAsyncId) return true;

  const parent = getResource(resource.triggerAsyncId);

  if (!parent) return false;

  return isDescendantOf(parent.asyncId, parentAsyncId);
};

export const getAncestryChainOfIds = (asyncId) => {
  const resource = getResource(asyncId);

  if (!resource) return [];

  if (!resource.triggerAsyncId) return [asyncId];

  const parent = getResource(resource.triggerAsyncId);

  if (!parent) return [asyncId];

  return [...getAncestryChainOfIds(parent.asyncId), asyncId];
};

export const getActiveEventResource = () => {
  const activeEvent = getActiveEvent();

  return getResource(activeEvent?.asyncId);
};

const captureStartTime = (asyncId) => {
  const resource = getResource(asyncId);

  if (!resource) return;

  resource.startTime = Ntp._now();
};

const captureEndTime = (asyncId) => {
  const resource = getResource(asyncId);
  if (!resource) return;

  // Some resources do not trigger before/after hooks.
  if (!resource.startTime) {
    resource.startTime = resource.initAt;
  }

  resource.endTime = Ntp._now();
  resource.duration = resource.endTime - resource.startTime;

  const info = getInfo();

  if (!info) return;

  // We only care about leaf resources.
  // if (resource.children?.length) return;

  // We can ignore async events which take less than two milliseconds for performance.
  if (resource.duration <= 1) return;

  // Some events finish after the trace is already processed.
  if (info.trace.isEventsProcessed) return;

  const activeEvent = getActiveEvent();

  const asyncEvent = {
    type: EventType.Async,
    at: resource.startTime,
    endAt: resource.endTime,
    asyncId,
    level: activeEvent?.level + 1 || 0,
  };

  if (resource.stack) {
    asyncEvent.stack = resource.stack;
  }

  if (activeEvent && !activeEvent.endAt) {
    checkForNested(activeEvent);
    activeEvent.nested.push(asyncEvent);
  } else {
    info.trace.events.push(asyncEvent);
  }
};

export const AsyncResourceType = {
  PROMISE: 'PROMISE',
};

const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    const info = getInfo();

    if (!info) return;

    if (!info.trackAsync) return;

    // We don't want to capture anything other than promise resources.
    if (type !== AsyncResourceType.PROMISE) return;

    // Some wraps might intercept Meteor internals, this helps prevent capturing the first ones.
    // Check `incrementIgnoreOffset`.
    if (info.ignoreOffset > 0) {
      info.ignoreOffset--;
      return;
    }

    const activeEvent = getActiveEvent();

    if (activeEvent?.asyncId === asyncId) return;

    const {trace} = info || {};

    if (!trace) return;

    info.resources = info.resources || new Map();

    info.resources.set(asyncId, {
      asyncId,
      triggerAsyncId,
      type,
      initAt: Ntp._now(),
      startTime: null,
      endTime: null,
      stack: stackTrace(),
      activeEvent,
    });

    const trigger = info.resources.get(triggerAsyncId);

    if (trigger) {
      trigger.children = trigger.children || [];
      trigger.children.push(asyncId);
    }
  },

  before: captureStartTime,
  after: captureEndTime,
  promiseResolve: captureEndTime,
});

hook.enable();

process.once('beforeExit', function () {
  hook.disable();
});
