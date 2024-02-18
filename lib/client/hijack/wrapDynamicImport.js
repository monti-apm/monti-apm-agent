import { Ntp } from '../../ntp';
const meteorInstall = require('meteor/modules').meteorInstall;
const oldFetch = meteorInstall.fetch;

export function wrapDynamicImport () {
  meteorInstall.fetch = function (ids) {
    const promise = oldFetch(ids);
    Kadira.webVitals.numberOfImports += 1;
    const now = Ntp._now();
    return promise.then((...args) => {
      Kadira.webVitals.importTime.push(Ntp._now() - now);
      return Promise.resolve(...args);
    });
  };
}
export function unwrapDynamicImport () {
  meteorInstall.fetch = oldFetch;
}
