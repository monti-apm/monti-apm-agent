import { BaseErrorModel } from '../../lib/models/base_error';

Tinytest.add(
  'Models - BaseErrorModel - add filters - pass errors',
  function (test) {
    let model = new BaseErrorModel();
    model.addFilter(function () {
      return true;
    });
    let validated = model.applyFilters('type', 'message', {}, 'subType');
    test.equal(validated, true);
  }
);

Tinytest.add(
  'Models - BaseErrorModel - add filters - no filters',
  function (test) {
    let model = new BaseErrorModel();
    let validated = model.applyFilters('type', 'message', {}, 'subType');
    test.equal(validated, true);
  }
);

Tinytest.add(
  'Models - BaseErrorModel - add filters - fail errors',
  function (test) {
    let model = new BaseErrorModel();
    model.addFilter(function () {
      return false;
    });
    let validated = model.applyFilters('type', 'message', {}, 'subType');
    test.equal(validated, false);
  }
);

Tinytest.add(
  'Models - BaseErrorModel - add filters - multiple errors',
  function (test) {
    let model = new BaseErrorModel();
    model.addFilter(() => true);
    model.addFilter(() => false);

    let validated = model.applyFilters('type', 'message', {}, 'subType');
    test.equal(validated, false);
  }
);

Tinytest.add(
  'Models - BaseErrorModel - remove filters - multiple errors',
  function (test) {
    let model = new BaseErrorModel();
    let falseFilter = () => false;
    model.addFilter(() => true);
    model.addFilter(falseFilter);
    model.removeFilter(falseFilter);

    let validated = model.applyFilters('type', 'message', {}, 'subType');
    test.equal(validated, true);
  }
);

Tinytest.add(
  'Models - BaseErrorModel - add filters - invalid filters',
  function (test) {
    let model = new BaseErrorModel();
    try {
      model.addFilter({});
      test.fail('expect an error');
      // eslint-disable-next-line no-empty
    } catch (ex) { }
  }
);

Tinytest.addAsync(
  'Models - BaseErrorModel - apply filters - get params',
  function (test, done) {
    let model = new BaseErrorModel();
    model.addFilter(function (type, message, error, subType) {
      test.equal(type, 'type');
      test.equal(subType, 'subType');
      test.equal(error, {stack: {}});
      test.equal(subType, 'subType');
      done();
    });
    model.applyFilters('type', 'message', {stack: {}}, 'subType');
  }
);

Tinytest.add(
  'Models - BaseErrorModel - apply filters - throw an error inside a filter',
  function (test) {
    let model = new BaseErrorModel();
    model.addFilter(function () {
      throw new Error('super error');
    });

    try {
      model.applyFilters();
      test.fail('we are looking for an error');
    } catch (ex) {
      if (ex.message === 'super error') {
        // Old versions of IE don't have a useful error message
        test.equal(true, true);
      } else {
        test.equal(/an error thrown from a filter you've suplied/.test(ex.message), true);
      }
    }
  }
);
