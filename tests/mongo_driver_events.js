import { getMongoDriverStats, resetMongoDriverStats } from '../lib/hijack/mongo-driver-events.js';
import { releaseParts } from './hijack/webapp';

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
      checkedOutValues.includes(stats.created);
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
