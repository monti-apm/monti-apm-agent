export const fibersEnabled = !Meteor.isFibersDisabled;

let Fibers;
let storage;
if (fibersEnabled) {
  Fibers = require('fibers');
} else {
  const { AsyncLocalStorage } = require('node:async_hooks');
  storage = new AsyncLocalStorage();
}

export function getInfo(currentFiber, useEnvironmentVariable) {
  if (useEnvironmentVariable) {
    return Kadira.env.kadiraInfo.get();
  }

  if (fibersEnabled) {
    currentFiber = currentFiber || Fibers.current;
    return currentFiber ? currentFiber.__kadiraInfo : undefined;
  }

  return storage.getStore()?.info;
}

export function setInfo(info) {
  if (fibersEnabled) {
    Fibers.current.__kadiraInfo = info;
  } else {
    // TODO
    throw new Error('requires fibers');
  }
}

export function withInfo(info, cb) {
  if (fibersEnabled) {
    let prevInfo = getInfo();
    setInfo(info);
    try {
      return cb();
    } finally {
      setInfo(prevInfo);
    }
  } else {
    return storage.run({ info }, cb);
  }
}

export function setCurrentEvent (event) {
  if (fibersEnabled) {
    return () => {};
  }
  let prev = storage.getStore();
  if (!prev) {
    return () => {};
  }

  storage.enterWith(Object.assign({}, prev, { activeEvent: event }));

  return function reset () {
    storage.enterWith(prev);
  };
}
