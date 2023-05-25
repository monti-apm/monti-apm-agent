import fs from 'fs';
import util from 'util';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';

export const getId = () => crypto.randomUUID();

export const MontiAsyncStorage = new AsyncLocalStorage();
export const MontiEnvironmentVariable = new AsyncLocalStorage();

export const runWithALS = (
  fn,
  storage = MontiAsyncStorage,
  store = { id: getId(), info: null, env: {}, activeEvent: null }
) => function (...args) {
  return storage.run(store, () => fn.apply(this, args));
};

export const runWithPartial = (fn, partial, storage = MontiAsyncStorage) => function (...args) {
  const store = storage.getStore() ?? {};

  if (!store) return Reflect.apply(fn, this, args);

  return storage.run({ ...store, ...partial }, () => Reflect.apply(fn, this, args));
};

export const getInfo = () => MontiAsyncStorage.getStore()?.info;

export const setActiveEvent = (event, store = MontiAsyncStorage.getStore()) => {
  if (!store) return;

  MontiAsyncStorage.enterWith({ ...store, activeEvent: event });
};

export const getActiveEvent = (store = MontiAsyncStorage.getStore()) => store?.activeEvent;

export const runWithEnvironment = (fn, store = new Map([['env', {}]])) => runWithALS(fn, MontiEnvironmentVariable, store);

export const debug = label => (...args) => {
  fs.writeFileSync(1, `${util.format(label, ...args)}\n`, { flag: 'a' });
};
