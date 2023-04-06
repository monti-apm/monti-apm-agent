import { callAsync, registerMethod } from './_helpers/helpers';

Tinytest.addAsync(
  'Helpers - ddp server connection',
  async function (test, done) {
    const methodId = registerMethod(function () {
      return 'pong';
    });

    const result = await callAsync(methodId);

    test.equal(result, 'pong');

    done();
  }
);
