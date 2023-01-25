import { GetMeteorClient, RegisterMethod } from './_helpers/helpers';

Tinytest.add(
  'Helpers - ddp server connection',
  function (test) {
    let methodId = RegisterMethod(function () {
      return 'pong';
    });
    let client = GetMeteorClient();
    let result = client.call(methodId);
    test.equal(result, 'pong');
  }
);
