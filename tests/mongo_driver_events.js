import { getMongoDriverStats, resetMongoDriverStats } from '../lib/hijack/mongo-driver-events.js';

const delay = ms => new Promise(res => setTimeout(res, ms));

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
    // pool size value isn't consistent across all versions so we can't expect a certain number
    test.equal(stats, {
      poolSize: stats.poolSize, 
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: NaN,
      checkedOut: NaN,
      created: 0,
      measurementCount: 0
    });
    test.equal(typeof stats.poolSize, 'number')
    await delay(5000);
    const delayedStats = getMongoDriverStats();
    test.equal(delayedStats, {
      poolSize: stats.poolSize,
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: 0,
      checkedOut: 0,
      created: 0,
      measurementCount: 5
    });
    test.equal(typeof delayedStats.poolSize, 'number')
    resetMongoDriverStats();
    const postResetStats = getMongoDriverStats();
    test.equal(postResetStats, {
      poolSize: stats.poolSize,
      primaryCheckouts: 0,
      otherCheckouts: 0,
      checkoutTime: 0,
      maxCheckoutTime: 0,
      pending: NaN,
      checkedOut: NaN,
      created: 0,
      measurementCount: 0
    });
    test.equal(typeof postResetStats.poolSize, 'number')
    done();
  }
);

