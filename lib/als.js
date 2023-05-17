import fs from 'fs';
import util from 'util';
import asyncHooks from 'async_hooks';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';

export const getId = () => crypto.randomUUID();

export const MontiAsyncStorage = new AsyncLocalStorage();
export const MontiEnvironmentVariable = new AsyncLocalStorage();

export const runWithALS = (
  fn,
  storage = MontiAsyncStorage,
  store = new Map([['id', getId()], ['info', null], ['env', {}]])
) => function (...args) {
  return storage.run(store, () => fn.apply(this, args));
};

export const runWithEnvironment = (fn, store = new Map([['env', {}]])) => runWithALS(fn, MontiEnvironmentVariable, store);

export const debug = label => (...args) => {
  fs.writeFileSync(1, `${util.format(label, ...args)}\n`, { flag: 'a' });
};

const getInfo = () => MontiAsyncStorage.getStore()?.get('info');

const captureEndTime = (asyncId) => {
  const info = getInfo();

  if (!info) return;

  const trace = info._traces.get(asyncId);

  if (!trace) return;

  trace.endTime = Date.now();
};

export const ASYNC_RESOURCE_TYPE = {
  PROMISE: 'PROMISE',
};

const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    const info = getInfo();

    if (!info) return;
    if (type !== ASYNC_RESOURCE_TYPE.PROMISE) return;

    info._traces = info._traces || new Map();

    info._traces.set(asyncId, {
      asyncId,
      type,
      startTime: Date.now(),
      endTime: null
    });

    const trigger = info._traces.get(triggerAsyncId);

    if (trigger) {
      trigger.children = trigger.children || [];
      trigger.children.push(asyncId);
    }
  },

  after: captureEndTime,
  promiseResolve: captureEndTime,
});

hook.enable();

process.once('beforeExit', function () {
  hook.disable();
});

