import { getMongoDriverStats, resetMongoDriverStats } from '../../lib/hijack/mongo_driver_events.js';
import { releaseParts } from '../_helpers/helpers';

// Check if Meteor 2.2 or newer, which is the first version that enabled
// useUnifiedTopology by default
const mongoMonitoringEnabled = releaseParts[0] > 2 ||
  (releaseParts[0] > 1 && releaseParts[1] > 1);

function checkRange(value, disabledValue, min, max) {
  if (typeof value !== 'number') {
    throw new Error(`${value} is not a number`);
  }

  if (!mongoMonitoringEnabled) {
    if (value !== disabledValue) {
      throw new Error(`${value} does not equal ${disabledValue}`);
    }

    return;
  }

  if (value < min || value > max) {
    throw new Error(`Value (${value}) is outside of range (${min} - ${max})`);;
  }
}

  Tinytest.addAsync(
    'Mongo Driver Events - getMongoDriverStats',
    async function (test, done) {
      resetMongoDriverStats();

      const promises = [];
      for(let i = 0; i < 200; i++) {
        promises.push(TestData.rawCollection().count());
      }

      await Promise.all(promises);

      const stats = getMongoDriverStats();

      checkRange(stats.poolSize, 0, 10, 100);
      test.equal(stats.primaryCheckouts, mongoMonitoringEnabled ? 200 : 0);
      test.equal(stats.otherCheckouts, 0);
      checkRange(stats.checkoutTime, 0, 100, 20000);
      checkRange(stats.maxCheckoutTime, 0, 10, 200);
      checkRange(stats.pending, 0, 0, 50);
      checkRange(stats.checkedOut, 0, 0, 1);
      checkRange(stats.created, 0, 1, 100);
      done();
    }
  );

  Tinytest.add(
    'Mongo Driver Events - resetMongoDriverStats',
    function (test) {
      resetMongoDriverStats();
      const postResetStats = getMongoDriverStats();
      test.equal(postResetStats, {
        poolSize: postResetStats.poolSize,
        primaryCheckouts: 0,
        otherCheckouts: 0,
        checkoutTime: 0,
        maxCheckoutTime: 0,
        pending: 0,
        checkedOut: 0,
        created: 0
      });
    }
  );
