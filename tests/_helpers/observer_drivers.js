import { Meteor } from 'meteor/meteor';
import { TestData } from './globals';

const mongo = TestData._driver.mongo;
const hasChangeStreams = typeof mongo._selectReactivityDriver === 'function';
const isRedis = !!process.env.REDIS_OPLOG_SETTINGS;

export const observerDrivers = isRedis ? ['redis'] : [
  'oplog',
  'polling',
  ...hasChangeStreams ? ['changeStreams'] : []
];

let currentTest;
let currentDriver;

export function observerOptions () {
  if (currentDriver !== 'polling') {
    return {};
  }

  return {disableOplog: true, pollingIntervalMs: 20, pollingThrottleMs: 1};
}

export function assertObserverDriver (test, handle, driverName) {
  if (driverName === 'redis') {
    return;
  }

  const driver = handle._multiplexer._observeDriver;
  const name = driver._usesChangeStreams ? 'changeStreams' : driver._usesOplog ? 'oplog' : 'polling';
  test.equal(name, driverName, 'actual observer driver');
}

// Check if the publication used the expected observer driver
export function checkPublicationObserverDrivers () {
  if (!currentTest || currentDriver === 'redis') return;
  for (const [key, multiplexer] of Object.entries(mongo._observeMultiplexers)) {
    if (JSON.parse(key).collectionName === TestData._name) {
      assertObserverDriver(currentTest, {_multiplexer: multiplexer}, currentDriver);
    }
  }
}

export function withObserverDriver (driver, fn) {
  return async function (test, done) {
    const packages = Meteor.settings.packages;
    if (hasChangeStreams && driver !== 'redis') {
      Meteor.settings.packages = {
        ...packages,
        mongo: {...packages?.mongo, reactivity: [driver]}
      };
    }
    currentTest = test;
    currentDriver = driver;

    try {
      await fn(test, () => {});
    } finally {
      currentTest = undefined;
      currentDriver = undefined;
      if (packages === undefined) {
        delete Meteor.settings.packages;
      } else {
        Meteor.settings.packages = packages;
      }
    }
    done();
  };
}

export function addObserverDriverTests (addTest, wrap) {
  addTest.withDriver = (driver, name, fn) => {
    if (!['oplog', 'polling', 'changeStreams', 'redis'].includes(driver)) {
      throw new Error(`Unknown observer driver: ${driver}`);
    }
    if (!observerDrivers.includes(driver)) {
      return;
    }

    Tinytest.addAsync(
      `${name} - ${driver}`,
      withObserverDriver(driver, wrap((test, client) => fn(test, client, driver)))
    );
  };

  addTest.withDrivers = (drivers, name, fn) => {
    for (const driver of drivers) {
      addTest.withDriver(driver, name, fn);
    }
  };

  addTest.eachDriver = (name, fn) => addTest.withDrivers(observerDrivers, name, fn);
}
