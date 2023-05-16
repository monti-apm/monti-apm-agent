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
  store = new Map([['id', getId()], ['info', null], ['env', {}]])
) => function (...args) {
  return storage.run(store, () => fn.apply(this, args));
};

export const runWithEnvironment = (fn, store = new Map([['env', {}]])) => runWithALS(fn, MontiEnvironmentVariable, store);

export const debug = label => (...args) => {
  fs.writeFileSync(1, `${util.format(label, ...args)}\n`, { flag: 'a' });
};

export const ASYNC_RESOURCE_TYPE = {
  TICKOBJECT: 'TickObject',
  ZLIB: 'ZLIB',
  PROMISE: 'PROMISE',
};
