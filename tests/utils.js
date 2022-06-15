import { Random } from 'meteor/random';
import { _ } from 'meteor/underscore';
import { OptimizedApply } from '../lib/utils';

Tinytest.addAsync(
  'Utils - OptimizedApply - calling arguments',
  function (test, done) {
    runWithArgs(0);
    function runWithArgs (argCount) {
      const context = {};
      const args = buildArrayOf(argCount);
      const retValue = Random.id();
      const fn = function () {
        test.equal(_.toArray(arguments), args);
        test.equal(this, context);
        return retValue;
      };

      const ret = OptimizedApply(context, fn, args);
      test.equal(ret, retValue);

      if (argCount > 10) {
        done();
      } else {
        runWithArgs(argCount + 1);
      }
    }
  }
);

function buildArrayOf (length) {
  const arr = [];
  for (let lc = 0; lc < length; lc++) {
    arr.push(Random.id());
  }
  return arr;
}
