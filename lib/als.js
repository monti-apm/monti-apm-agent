import fs from 'fs';
import util from 'util';
import asyncHooks from 'async_hooks';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';
import { stackTrace } from './collect';

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

export const asyncHook = asyncHooks.createHook({
  init: debug('init'),
  before: debug('before'),
  after: debug('after'),
  destroy: debug('destroy'),
  promiseResolve: debug('promiseResolve'),
});

const skipAsyncIds = new Set();

const hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId) {
    // Save the asyncId such nested async operations can be skiped later.
    if (exports.skipThis) return skipAsyncIds.add(asyncId);
    // This is a nested async operations, skip this and track futher nested
    // async operations.
    if (skipAsyncIds.has(triggerAsyncId)) return skipAsyncIds.add(asyncId);

    const info = MontiAsyncStorage.getStore()?.get('info');

    if (!info) return;

    // Track async events that comes from this async operation
    exports.skipThis = true;

    info._traces = info._traces || [];

    info._traces.push({
      asyncId,
      frames: stackTrace(2)
    });

    exports.skipThis = false;
  },

  destroy (asyncId) {
    skipAsyncIds.delete(asyncId);
  }
});

hook.enable();

// If we add this for very trace context we will have a ton of memory usage. Need to improve that.
process.once('beforeExit', function () {
  hook.disable();
});

