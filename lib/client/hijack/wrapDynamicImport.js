import { Ntp } from '../../ntp';
const meteorInstall = require('meteor/modules').meteorInstall;

let oldFetch;
export function wrapDynamicImport () {
  oldFetch = meteorInstall.fetch;
  meteorInstall.fetch = function (ids) {
    const start = Ntp._now();
    const promise = oldFetch(ids);
    Kadira.webVitals.pendingObjects += 1;
    return promise.then((...args) => {
      Kadira.webVitals.importTime.push({start, end: Ntp._now(), ids});
      Kadira.webVitals.completedObjects += 1;
      return Promise.resolve(...args);
    });
  };
}
export function unwrapDynamicImport () {
  meteorInstall.fetch = oldFetch;
}
