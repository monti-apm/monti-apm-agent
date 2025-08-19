import { addAsyncTest, callAsync, registerMethod } from './_helpers/helpers';

addAsyncTest(
  'Helpers - ddp server connection',
  async function (test) {
    const methodId = registerMethod(function () {
      return 'pong';
    });

    const result = await callAsync(methodId);

    test.equal(result, 'pong');
  }
);
