import asyncHooks from 'async_hooks';
import { getActiveEvent, getInfo } from './als';
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

    const {trace} = info || {};

    if (!trace) return;

    info.resources = info.resources || new Map();

    const executionAsyncId = asyncHooks.executionAsyncId();

    const res = {
      asyncId,
      triggerAsyncId,
      executionAsyncId,
      start: Ntp._now(),
      end: null,
      startTime: Ntp._now(),
      endTime: null,
      activeEvent,
    };

    if (Kadira.options.enableAsyncStackTraces || process.env.ENABLE_ASYNC_STACK_TRACES) {
      res.stack = stackTrace();
    }

    res.event = Kadira.tracer.event(info.trace, EventType.Async, pick(res, ['asyncId', 'stack', 'asyncId', 'triggerAsyncId', 'executionAsyncId']));
  },
  onAwaitEnd (asyncId) {
    const resource = getResource(asyncId);

    if (!resource) return;

    const info = getInfo();

    if (!info) return;

    // Some events finish after the trace is already processed.
    if (info.trace.isEventsProcessed) return;

    Kadira.tracer.eventEnd(info.trace, resource.event);
  }
});

const oldBindEnv = Meteor.bindEnvironment;

Meteor.bindEnvironment = function (...args) {
  const func = oldBindEnv.apply(this, args);
  return function () {
    return awaitDetector.ignore(() => func.apply(this, arguments));
  };
};
