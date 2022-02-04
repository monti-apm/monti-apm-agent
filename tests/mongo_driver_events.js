import { getMongoDriverStats, resetMongoDriverStats } from '../lib/hijack/mongo-driver-events.js';
import { releaseParts } from './hijack/webapp';

const delay = ms => new Promise(res => setTimeout(res, ms));

// Check if Meteor 2.2 or newer, which is the first version that enabled `useUnifiedTopology` by default
const mongoMonitoringEnabled = releaseParts[1] ? (releaseParts[0] > 1 && releaseParts[1] > 1) : releaseParts[0] > 1;

if (mongoMonitoringEnabled) {
  
  Tinytest.add(
    'Mongo Driver Events - getMongoDriverStats',
    function (test) {
      const stats = getMongoDriverStats();
      const poolSizeValues = [100, 10];
      const checkedOutValues = 	[...Array(stats.poolSize).keys()];
      const pendingValues = [...Array(10).keys()];

      test.equal(stats,
        {
          poolSize: stats.poolSize,
          primaryCheckouts: 0,
          otherCheckouts: 0,
          checkoutTime: 0,
          maxCheckoutTime: 0,
          pending: stats.pending,
          checkedOut: stats.checkedOut,
          created: stats.created
        }
      );
      pendingValues.includes(stats.pending);
      poolSizeValues.includes(stats.poolSize);
      checkedOutValues.includes(stats.checkedOutValues);
    }
  );


  Tinytest.add(
    'Mongo Driver Events - resetMongoDriverStats',
    async function (test, done) {
      await delay(5000);
      resetMongoDriverStats();
      const postResetStats = getMongoDriverStats();
      test.equal(postResetStats, {
        poolSize: stats.poolSize,
        primaryCheckouts: 0,
        otherCheckouts: 0,
        checkoutTime: 0,
        maxCheckoutTime: 0,
        pending: 0,
        checkedOut: 0,
        created: 0
      });
      done();
    }
  );

}