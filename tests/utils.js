import { Random } from 'meteor/random';
import { _ } from 'meteor/underscore';
import { optimizedApply } from '../lib/utils';

Tinytest.addAsync(
  'Utils - optimizedApply - calling arguments',
  function (test, done) {
    runWithArgs(0);
    function runWithArgs (argCount) {
      let context = {};
      let args = buildArrayOf(argCount);
      let retValue = Random.id();
      let fn = function () {
        test.equal(_.toArray(arguments), args);
        test.equal(this, context);
        return retValue;
      };

      let ret = optimizedApply(context, fn, args);
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
  let arr = [];
  for (let lc = 0; lc < length; lc++) {
    arr.push(Random.id());
  }
  return arr;
}
