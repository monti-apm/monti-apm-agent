Tinytest.addAsync('CheckForOplog - Kadira.checkWhyNoOplog - reactive publish', function (test, done) {
  CleanTestData();

  let observeChangesEvent;

  TestData.insert({ foo: 'bar'});

  const pubId = RegisterPublication(function () {
    this.autorun(function () {
      TestData.findOne({ foo: 'bar' }, {
        fields: { _id: 1},
        sort: { _id: 1 }
      });

      const info = Kadira._getInfo();

      const event = _.last(info.trace.events);
      observeChangesEvent = _.first(event.nested);

      return TestData.find({});
    });
  });

  const client = GetMeteorClient();

  const sub = SubscribeAndWait(client, pubId);

  const { data } = observeChangesEvent;

  test.equal(data.oplog, false);
  test.equal(data.func, 'observeChanges');
  test.equal(data.noOplogCode, 'TRACKER_ACTIVE');

  sub.stop();
  CloseClient(client);

  done();
});

Tinytest.add(
  'CheckForOplog - OplogCheck.env - MONGO_OPLOG_URL exists',
  function (test) {
    WithMongoOplogUrl(function () {
      test.equal(OplogCheck.env(), true);
    });
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.env - MONGO_OPLOG_URL doesnot exists',
  function (test) {
    test.equal(OplogCheck.env().code, 'NO_ENV');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.disableOplog - without _disableOplog',
  function (test) {
    test.equal(OplogCheck.disableOplog({options: {}}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.disableOplog - with _disableOplog',
  function (test) {
    let result = OplogCheck.disableOplog({options: {_disableOplog: true}});
    test.equal(result.code, 'DISABLE_OPLOG');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.miniMongoMatcher - with correct selector',
  function (test) {
    test.equal(OplogCheck.miniMongoMatcher({
      options: {},
      selector: {aa: 10}
    }), true);
  }
);

// for older versions. We don't need to break apps
Tinytest.add(
  'CheckForOplog - OplogCheck.miniMongoMatcher - no MiniMongo.Matcher',
  function (test) {
    let originalMiniMongoMatcher = Minimongo.Matcher;
    Minimongo.Matcher = null;
    test.equal(OplogCheck.miniMongoMatcher({
      options: {},
      // if there was Minimongo.Matcher, this should've trigger an error
      selector: {aa: {$in: null}}
    }), true);
    Minimongo.Matcher = originalMiniMongoMatcher;
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.miniMongoMatcher - with incorrect selector',
  function (test) {
    let result = OplogCheck.miniMongoMatcher({
      options: {},
      selector: {aa: {$in: null}}
    });
    test.equal(result.code, 'MINIMONGO_MATCHER_ERROR');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.fields - without any fields',
  function (test) {
    test.equal(OplogCheck.fields({options: {}}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.fields - with valid fields',
  function (test) {
    test.equal(OplogCheck.fields({options: {
      fields: {aa: 0}
    }}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.fields - with invalid fields',
  function (test) {
    test.equal(OplogCheck.fields({options: {
      fields: {$elemMatch: {aa: 10}}
    }}).code, 'NOT_SUPPORTED_FIELDS');
  }
);


Tinytest.add(
  'CheckForOplog - OplogCheck.skip - with having skip',
  function (test) {
    test.equal(OplogCheck.skip({options: {
      skip: 10
    }}).code, 'SKIP_NOT_SUPPORTED');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.skip - no skip',
  function (test) {
    test.equal(OplogCheck.skip({options: {

    }}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.where - with having where',
  function (test) {
    test.equal(OplogCheck.where({selector: {
      $where () {}
    }}).code, 'WHERE_NOT_SUPPORTED');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.where - without having where',
  function (test) {
    test.equal(OplogCheck.where({selector: {

    }}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.geo - with having geo',
  function (test) {
    test.equal(OplogCheck.geo({selector: {
      loc: {$near: [50, 50]}
    }}).code, 'GEO_NOT_SUPPORTED');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.geo - without having geo operators',
  function (test) {
    test.equal(OplogCheck.geo({selector: {

    }}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.limitButNoSort - limit without sort',
  function (test) {
    test.equal(OplogCheck.limitButNoSort({options: {
      limit: 20
    }}).code, 'LIMIT_NO_SORT');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.limitButNoSort - limit with sort',
  function (test) {
    test.equal(OplogCheck.limitButNoSort({options: {
      limit: 20,
      sort: {aa: 1}
    }}), true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.miniMongoSorter - supported sort specifier',
  function (test) {
    let result = OplogCheck.miniMongoSorter({
      selector: {},
      options: {
        sort: {aa: 1}
      }});
    test.equal(result, true);
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.miniMongoSorter - unsupported sort specifier',
  function (test) {
    let result = OplogCheck.miniMongoSorter({options: {
      sort: {$natural: 1}
    }});
    test.equal(result.code, 'MINIMONGO_SORTER_ERROR');
  }
);

Tinytest.add(
  'CheckForOplog - OplogCheck.unknownReason - unknown reason',
  function (test) {
    let driver = function () {};
    test.equal(OplogCheck.unknownReason(null, driver).code, 'UNKNOWN_REASON');
  }
);

Tinytest.add(
  'CheckForOplog - Kadira.checkWhyNoOplog - no env',
  function (test) {
    let result = Kadira.checkWhyNoOplog({
      selector: {aa: {$gt: 20}},
      options: {limit: 20},
    });

    test.equal(result.code, 'NO_ENV');
  }
);

Tinytest.addAsync(
  'CheckForOplog - Kadira.checkWhyNoOplog - limitNoSort',
  function (test, done) {
    WithMongoOplogUrl(function () {
      let result = Kadira.checkWhyNoOplog({
        selector: {aa: {$gt: 20}},
        options: {limit: 20},
      });
      test.equal(result.code, 'LIMIT_NO_SORT');
      done();
    });
  }
);

Tinytest.addAsync(
  'CheckForOplog - Kadira.checkWhyNoOplog - supporting query',
  function (test, done) {
    function OplogObserveDriver () {}
    OplogObserveDriver.cursorSupported = function () {};
    let driver = new OplogObserveDriver();

    WithMongoOplogUrl(function () {
      let result = Kadira.checkWhyNoOplog({
        selector: {aa: {$gt: 20}},
        options: {limit: 20, sort: {aa: 1}},
      }, driver);

      test.equal(result.code, 'OPLOG_SUPPORTED');
      done();
    });
  }
);

function WithMongoOplogUrl (fn) {
  process.env.MONGO_OPLOG_URL = 'mongodb://ssdsd';
  fn();
  delete process.env.MONGO_OPLOG_URL;
}
