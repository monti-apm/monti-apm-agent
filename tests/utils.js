/* global BigInt */
import { Random } from 'meteor/random';
import { _ } from 'meteor/underscore';
import { optimizedApply } from '../lib/utils';
import { toErrorObject } from '../lib/common/utils';

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

Tinytest.add(
  'Utils - toErrorObject - keeps errors',
  function (test) {
    let error = new Error('the-message');
    test.isTrue(toErrorObject(error) === error);

    let errorLike = { message: 'the-message', stack: 'the-stack' };
    test.isTrue(toErrorObject(errorLike) === errorLike);
  }
);

Tinytest.add(
  'Utils - toErrorObject - primitives',
  function (test) {
    test.equal(toErrorObject('err').message, 'err');
    test.equal(toErrorObject('err').stack, 'err');
    test.equal(toErrorObject(5).message, '5');
    test.equal(toErrorObject(null).message, 'null');
    test.equal(toErrorObject(undefined).message, 'undefined');
    test.equal(toErrorObject(Symbol('sym')).message, 'Symbol(sym)');
    test.equal(toErrorObject(BigInt(10)).message, '10');
  }
);

Tinytest.add(
  'Utils - toErrorObject - objects without a message',
  function (test) {
    test.equal(toErrorObject({ code: 1 }).message, '[object Object]');
    test.equal(toErrorObject({ message: 404 }).message, '404');
    test.equal(toErrorObject({ message: { code: 1 } }).message, '[object Object]');
    test.equal(toErrorObject(Object.create(null)).message, '[object Object]');
    test.equal(toErrorObject({ stack: 'the-stack' }).stack, 'the-stack');
  }
);

Tinytest.add(
  'Utils - toErrorObject - Event and objects with a status',
  function (test) {
    test.equal(toErrorObject(new Event('error')).message, 'Event "error"');

    let response = new Response('', { status: 404, statusText: 'Not Found' });
    test.equal(toErrorObject(response).message, 'Response 404 Not Found');

    let xhrLike = { status: 0, responseURL: 'http://localhost/api' };
    test.equal(toErrorObject(xhrLike).message, 'Object 0 from http://localhost/api');
  }
);

function buildArrayOf (length) {
  let arr = [];
  for (let lc = 0; lc < length; lc++) {
    arr.push(Random.id());
  }
  return arr;
}
