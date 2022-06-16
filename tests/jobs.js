Tinytest.addAsync(
  'Jobs - get',
  function (test, done) {
    let id = 'the-id';

    let newSend = function (_id) {
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
    let value = 10;
    let id = 'the-id';

    let newSend = function (_id, _params) {
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
  let originaSend = Kadira.send;
  Kadira.coreApi[fnName] = newFn;
  fn();
  Kadira.coreApi[fnName] = originaSend;
}
