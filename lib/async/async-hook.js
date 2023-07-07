import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo } from './als';
import { MaxAsyncLevel } from '../constants';
import { Ntp } from '../ntp';
import { stackTrace } from '../utils';

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

const captureEnd = (type) => (asyncId) => {
  AsyncMetrics.activeAsyncCount--;

  const resource = getResource(asyncId);

  if (!resource) return;

  resource.end = Ntp._now();
  resource.duration = resource.end - resource.start;
  resource.hooks = { ...resource.hooks, [type]: true };
};

export const AsyncResourceType = {
  PROMISE: 'PROMISE',
};

// @todo Keep nested async events for all events, except `db`.
// @todo Generate metrics for nested events as if they are root when nested in `custom` events.
const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    // We don't want to capture anything other than promise resources.
    if (type !== AsyncResourceType.PROMISE) return;

    AsyncMetrics.totalAsyncCount++;
    AsyncMetrics.activeAsyncCount++;

    const info = getInfo();

    const activeEvent = getActiveEvent();

    if (activeEvent?.level > MaxAsyncLevel) return;

    const {trace} = info || {};

    if (!trace) return;

    info.resources = info.resources || new Map();

    const trigger = info.resources.get(triggerAsyncId);

    const executionAsyncId = asyncHooks.executionAsyncId();

    const executionChanged = trigger?.executionAsyncId !== executionAsyncId;

    const res = {
      asyncId,
      triggerAsyncId,
      executionAsyncId,
      type,
      start: Ntp._now(),
      end: null,
      activeEvent,
      executionChanged,
    };

    if (Kadira.options.enableAsyncStackTraces || process.env.ENABLE_ASYNC_STACK_TRACES) {
      res.stack = stackTrace();
    }

    info.resources.set(asyncId, res);

    if (trigger) {
      trigger.children = trigger.children || [];
      trigger.children.push(asyncId);
    }
  },
  // @todo Perhaps we need to handle rejected promises.
  // All promises call `promiseResolve` at the end, except when they are rejected.
  promiseResolve: captureEnd('promiseResolve'),
});

hook.enable();

process.once('beforeExit', function () {
  hook.disable();
});
