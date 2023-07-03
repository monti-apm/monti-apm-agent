import fs from 'fs';
import util from 'util';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';

export const getId = () => crypto.randomUUID();

export const MontiAsyncStorage = new AsyncLocalStorage();

export const runWithALS = (
  fn,
  info = null,
  store = { id: getId(), info: null, env: {}, activeEvent: null },
) => function (...args) {
  if (info) {
    store.info = info;
  }

  return MontiAsyncStorage.run(store, () => fn.apply(this, args));
};

export const MontiEnvironmentVariable = new AsyncLocalStorage();

export const runWithEnvironment = (fn, store = new Map([['env', {}]])) => function (...args) {
  return MontiEnvironmentVariable.run(store, () => fn.apply(this, args));
};

export const getStore = () => MontiAsyncStorage.getStore() ?? {};

export const getInfo = () => MontiAsyncStorage.getStore()?.info;

export const setActiveEvent = (event, store = MontiAsyncStorage.getStore()) => {
  if (!store) return;

  MontiAsyncStorage.enterWith({ ...store, activeEvent: event });
};

export const getActiveEvent = (store = MontiAsyncStorage.getStore()) => store?.activeEvent;

export const debug = label => (...args) => {
  fs.writeFileSync(1, `${util.format(label, ...args)}\n`, { flag: 'a' });
};
