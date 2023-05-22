import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo } from './als';

const getResource = (asyncId) => {
  const info = getInfo();

  if (!info) return;

  return info.resources.get(asyncId);
};

const captureStartTime = (asyncId) => {
  const resource = getResource(asyncId);

  if (!resource) return;

  resource.startTime = Date.now();
};

const captureEndTime = (asyncId) => {
  const resource = getResource(asyncId);
  if (!resource) return;

  resource.endTime = Date.now();
};

export const AsyncResourceType = {
  PROMISE: 'PROMISE',
};

const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    const info = getInfo();

    if (!info) return;

    if (type !== AsyncResourceType.PROMISE) return;

    const activeEvent = getActiveEvent();

    if (activeEvent) {
      console.log({ activeEvent });
    }

    info.resources = info.resources || new Map();

    info.resources.set(asyncId, {
      asyncId,
      parentAsyncId: triggerAsyncId,
      type,
      startTime: null,
      endTime: null,
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
