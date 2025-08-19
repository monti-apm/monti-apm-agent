import fs from 'fs';
import util from 'util';
import { AsyncLocalStorage } from 'node:async_hooks';

let id = 0;
export const getId = () => id++;

export const MontiAsyncStorage = new AsyncLocalStorage();

export function createStore () {
  return {
    id: getId(),
    info: null,
    activeEvent: null
  };
}

export const runWithALS = (
  fn,
) => function (...args) {
  return MontiAsyncStorage.run(createStore(), () => fn.apply(this, args));
};

export const MontiEnvironmentVariable = new AsyncLocalStorage();

export const runWithEnvironment = (fn, store = new Map([['env', {}]])) => function (...args) {
  return MontiEnvironmentVariable.run(store, () => fn.apply(this, args));
};

export const getStore = () => MontiAsyncStorage.getStore() ?? {};

export const getInfo = () => MontiAsyncStorage.getStore()?.info;

export const getActiveEvent = (store = MontiAsyncStorage.getStore()) => store?.activeEvent;

export const debug = label => (...args) => {
  fs.writeFileSync(1, `${util.format(label, ...args)}\n`, { flag: 'a' });
};
