import { getMongoDriverStats, resetMongoDriverStats } from '../lib/hijack/mongo-driver-events.js';

const delay = ms => new Promise(res => setTimeout(res, ms));

// It can be as simple as calling getMongoDriverStats and resetMongoDriverStats and making sure the return values are reasonable.
// This won't catch everything, but will at least make sure the file won't
// cause an app to crash on startup. We will probably have to manually review Mongo's changelog
// and test this feature to make sure it works with the new mongo driver.

Tinytest.addAsync(
  'Mongo Driver Events - getMongoDriverStats',
  function (test) {
    const stats = getMongoDriverStats();
    test.equal(stats, {
      poolSize: 0,
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: NaN,
      checkedOut: NaN,
      created: 0,
      measurementCount: 0
    });
  }
);


Tinytest.addAsync(
  'Mongo Driver Events - resetMongoDriverStats',
  async function (test, done) {
    resetMongoDriverStats();
    const stats = getMongoDriverStats();
    test.equal(stats, {
      poolSize: 100,
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: NaN,
      checkedOut: NaN,
      created: 0,
      measurementCount: 0
    });
    await delay(5000);
    const delayedStats = getMongoDriverStats();
    test.equal(delayedStats, {
      poolSize: 100,
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: 0,
      checkedOut: 0,
      created: 0,
      measurementCount: 5
    });
    resetMongoDriverStats();
    const postResetStats = getMongoDriverStats();
    test.equal(postResetStats, {
      poolSize: 100,
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: NaN,
      checkedOut: NaN,
      created: 0,
      measurementCount: 0
    });
    done();
  }
);

