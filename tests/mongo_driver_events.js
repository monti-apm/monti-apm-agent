import { getMongoDriverStats, resetMongoDriverStats, getPoolSize } from '../lib/hijack/mongo-driver-events.js';

  Tinytest.add(
    'Mongo Driver Events - getMongoDriverStats',
    function (test) {
      const poolSize = getPoolSize();
      const poolSizeValues = [100, 10];
      const checkedOutValues = 	[...Array(poolSize).keys()];
      const pendingValues = [...Array(10).keys()];
      const extraRounds = 5;
      [...Array(poolSize+extraRounds).keys()].forEach(() => {
        TestData.find().count()
      })
      const stats = getMongoDriverStats();
      test.equal(stats,
        {
          poolSize: stats.poolSize,
          primaryCheckouts: (poolSize > 0) ? poolSize+extraRounds : poolSize,
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
        pending: NaN,
        checkedOut: NaN,
        created: 0
      });
    }
  );
