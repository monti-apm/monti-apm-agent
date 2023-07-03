import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo } from './als';
import { MaxAsyncLevel } from '../constants';
import { Ntp } from '../ntp';
import { stackTrace } from '../utils';
import { wrapPromise } from './wrap-promise';

export const AsyncMetrics = {
  totalAsyncCount: 0,
  activeAsyncCount: 0,
};

const getResource = (asyncId) => {
  if (!asyncId) return;

  const info = getInfo();

  if (!info) return;

  return info.resources?.get(asyncId);
};

const captureEndTime = (type) => (asyncId) => {
  AsyncMetrics.activeAsyncCount--;

  const resource = getResource(asyncId);

  if (!resource) return;

  resource.endTime = Ntp._now();
  resource.duration = resource.endTime - resource.startTime;
  resource.hooks = { ...resource.hooks, [type]: true };
};

export const AsyncResourceType = {
  PROMISE: 'PROMISE',
};

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
      startTime: Ntp._now(),
      endTime: null,
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
  promiseResolve: captureEndTime('promiseResolve'),
});

hook.enable();

process.once('beforeExit', function () {
  hook.disable();
});

wrapPromise();
