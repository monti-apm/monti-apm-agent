import { Ntp } from '../../ntp';
const meteorInstall = require('meteor/modules').meteorInstall;

let oldMeteorInstallFetch;
export function wrapDynamicImport () {
  oldMeteorInstallFetch = meteorInstall.fetch;
  meteorInstall.fetch = function (ids) {
    const start = Ntp._now();
    const promise = oldMeteorInstallFetch(ids);
    Kadira.webVitals.pendingObjects += 1;
    return promise.then((...args) => {
      Kadira.webVitals.importTime.push({start, end: Ntp._now(), ids: Object.keys(ids)});
      Kadira.webVitals.completedObjects += 1;
      return Promise.resolve(...args);
    });
  };
}
export function unwrapDynamicImport () {
  meteorInstall.fetch = oldMeteorInstallFetch;
}
