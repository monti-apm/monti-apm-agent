import { Ntp } from '../../ntp';
const meteorInstall = require('meteor/modules').meteorInstall;

let oldFetch;
export function wrapDynamicImport () {
  oldFetch = meteorInstall.fetch;
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
