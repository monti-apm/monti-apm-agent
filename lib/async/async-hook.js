import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo, MontiAsyncStorage } from './als';
import { EventType } from '../constants';
import { Ntp } from '../ntp';
import { stackTrace } from '../utils';
import { wrapPromise } from './wrap-promise';

const getResource = (asyncId) => {
  if (!asyncId) return;

  const info = getInfo();

  if (!info) return;

  return info.resources?.get(asyncId);
};

const captureEndTime = (type) => (asyncId) => {
  const resource = getResource(asyncId);

  if (!resource) return;

  resource.endTime = Ntp._now();
  resource.duration = resource.endTime - resource.startTime;
  resource.hooks = { ...resource.hooks, [type]: true };

  const info = getInfo();

  if (!info) return;

  MontiAsyncStorage.enterWith(resource.oldStore);

  // Some events finish after the trace is already processed.
  if (info.trace.isEventsProcessed) return;

  Kadira.tracer.eventEnd(info.trace, resource.event);
};

export const AsyncResourceType = {
  PROMISE: 'PROMISE',
};

const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    const info = getInfo();

    if (!info?.trackAsync) return;

    // We don't want to capture anything other than promise resources.
    if (type !== AsyncResourceType.PROMISE) return;

    // Some wraps might intercept Meteor internals, this helps prevent capturing the first ones.
    // Check `incrementIgnoreOffset`.
    if (info.ignoreOffset > 0) {
      info.ignoreOffset--;
      return;
    }

    const activeEvent = getActiveEvent();

    if (activeEvent?.level > 1) return;
    if (activeEvent?.asyncId === asyncId) return;

    const {trace} = info || {};

    if (!trace) return;

    info.resources = info.resources || new Map();

    const oldStore = MontiAsyncStorage.getStore();


    const event = Kadira.tracer.event(info.trace, EventType.Async, {
      asyncId,
    });

    const res = {
      asyncId,
      triggerAsyncId,
      type,
      startTime: Ntp._now(),
      endTime: null,
      oldStore,
      activeEvent,
      event,
    };

    if (Kadira.options.enableAsyncStackTraces) {
      res.stack = stackTrace();
    }

    info.resources.set(asyncId, res);

    MontiAsyncStorage.enterWith(Object.assign({}, oldStore, { activeEvent: event }));

    const trigger = info.resources.get(triggerAsyncId);

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
