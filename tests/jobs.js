Tinytest.addAsync(
  'Jobs - get',
  function (test, done) {
    const id = 'the-id';

    const newSend = function (_id) {
      test.equal(_id, id);
      done();
    };

    hijackCoreApi('getJob', newSend, function () {
      Kadira.Jobs.get(id);
    });
  }
);

Tinytest.addAsync(
  'Jobs - set',
  function (test, done) {
    const value = 10;
    const id = 'the-id';

    const newSend = function (_id, _params) {
      test.equal(_id, id);
      test.equal(_params, {val: value});
      done();
    };

    hijackCoreApi('updateJob', newSend, function () {
      Kadira.Jobs.set(id, {val: value});
    });
  }
);

function hijackCoreApi (fnName, newFn, fn) {
  const originaSend = Kadira.send;
  Kadira.coreApi[fnName] = newFn;
  fn();
  Kadira.coreApi[fnName] = originaSend;
}
