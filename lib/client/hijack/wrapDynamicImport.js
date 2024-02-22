import { Ntp } from '../../ntp';
const meteorInstall = require('meteor/modules').meteorInstall;

let oldFetch;
export function wrapDynamicImport () {
  oldFetch = meteorInstall.fetch;
  meteorInstall.fetch = function (ids) {
    const promise = oldFetch(ids);
    Kadira.webVitals.pendingObjects += 1;
    return promise.then((...args) => {
      Kadira.webVitals.importTime.push(Ntp._now());
      Kadira.webVitals.completedObjects += 1;
      return Promise.resolve(...args);
    });
  };
}
export function unwrapDynamicImport () {
  meteorInstall.fetch = oldFetch;
}
