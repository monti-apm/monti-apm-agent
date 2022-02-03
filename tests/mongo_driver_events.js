import { getMongoDriverStats, resetMongoDriverStats } from '../lib/hijack/mongo-driver-events.js';
import { releaseParts } from './hijack/webapp';

const delay = ms => new Promise(res => setTimeout(res, ms));

// Check if Meteor 2.2 or newer
const mongoMonitoringEnabled = releaseParts[0] > 1 ||
  (releaseParts[0] > 1 && releaseParts[1] > 1)

if (mongoMonitoringEnabled) {

  Tinytest.add(
    'Mongo Driver Events - getMongoDriverStats',
    function (test) {
      const stats = getMongoDriverStats();
      test.equal(stats,
        {
          poolSize: 10,
          primaryCheckouts: 0,
          otherCheckouts: 0,
          checkoutTime: 0,
          maxCheckoutTime: 0,
          pending: stats.pending,
          checkedOut: stats.checkedOut,
          created: stats.created,
          measurementCount: stats.measurementCount
        }
      );
    }
  );


  Tinytest.addAsync(
    'Mongo Driver Events - resetMongoDriverStats',
    async function (test, done) {
      resetMongoDriverStats();
      const stats = getMongoDriverStats();
      // immediately checking for poolsize after triggering getMongoDriverStats should be zerob 
      test.equal(stats, {
        poolSize: 10,
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
      // pool size value isn't consistent across all versions so we can't expect a certain number
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

}