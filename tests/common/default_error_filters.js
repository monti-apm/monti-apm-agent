Tinytest.add(
  'Default Error Filters - filterValidationErrors - filtered',
  function (test) {
    let err = new Meteor.Error('hello');
    let validated = Kadira.errorFilters.filterValidationErrors(null, null, err);
    test.equal(validated, false);
  }
);

Tinytest.add(
  'Default Error Filters - filterValidationErrors - not filtered',
  function (test) {
    let err = new Error('hello');
    let validated = Kadira.errorFilters.filterValidationErrors(null, null, err);
    test.equal(validated, true);
  }
);

Tinytest.add(
  'Default Error Filters - filterCommonMeteorErrors - not filtered',
  function (test) {
    let message = 'this is something else';
    let validated = Kadira.errorFilters.filterValidationErrors(null, message);
    test.equal(validated, true);
  }
);

Tinytest.add(
  'Default Error Filters - filterCommonMeteorErrors - ddp heartbeats',
  function (test) {
    let message = 'Connection timeout. No DDP heartbeat received.';
    let validated = Kadira.errorFilters.filterCommonMeteorErrors(null, message);
    test.equal(validated, false);
  }
);

Tinytest.add(
  'Default Error Filters - filterCommonMeteorErrors - sockjs heartbeats',
  function (test) {
    let message = 'Connection timeout. No sockjs heartbeat received.';
    let validated = Kadira.errorFilters.filterCommonMeteorErrors(null, message);
    test.equal(validated, false);
  }
);

Tinytest.add(
  'Default Error Filters - filterCommonMeteorErrors - sockjs invalid state',
  function (test) {
    let message = 'INVALID_STATE_ERR';
    let validated = Kadira.errorFilters.filterCommonMeteorErrors(null, message);
    test.equal(validated, false);
  }
);
