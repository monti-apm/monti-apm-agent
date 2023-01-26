import { ErrorModel } from '../../../lib/client/models/errors';
import { getClientArch } from '../../../lib/client/utils';
import { getClientArchVersion } from '../../../lib/common/utils';

const arch = getClientArch();
const archVersion = getClientArchVersion(arch);

Tinytest.add(
  'Client Side - Error Model - sends errors',
  function (test) {
    let em = new ErrorModel();
    let payloadReceived;
    const resetSend = onKadiraSend(function (payload) {
      payloadReceived = payload;
      resetSend();
    });
    em.sendError({name: 'hello'});

    test.equal(
      payloadReceived,
      buildPayload([
        {name: 'hello', count: 1}
      ])
    );

    test.equal(em.errorsSent['hello'], {
      name: 'hello', count: 0
    });

    em.close();
  }
);

Tinytest.add(
  'Client Side - Error Model - sends same error twice',
  function (test) {
    let em = new ErrorModel();
    let payloadReceived;
    const resetSend = onKadiraSend(function (payload) {
      payloadReceived = payload;
      resetSend();
    });
    em.sendError({name: 'hello'});
    em.sendError({name: 'hello'});

    test.equal(
      payloadReceived,
      buildPayload([
        {name: 'hello', count: 1}
      ])
    );

    test.equal(em.errorsSent['hello'], {
      name: 'hello', count: 1
    });

    em.close();
  }
);

Tinytest.add(
  'Client Side - Error Model - isErrorExists',
  function (test) {
    let em = new ErrorModel();

    const resetSend = onKadiraSend(function () {
      resetSend();
    });

    em.sendError({name: 'hoo'});
    test.equal(em.isErrorExists('hoo'), true);
    test.equal(em.isErrorExists('no-hoo'), false);

    em.close();
  }
);

Tinytest.add(
  'Client Side - Error Model - increamentErrorCount',
  function (test) {
    let em = new ErrorModel();

    const resetSend = onKadiraSend(function () {
      resetSend();
    });

    em.sendError({name: 'hoo'});
    em.increamentErrorCount('hoo');
    em.increamentErrorCount('hoo');

    test.equal(em.errorsSent['hoo'], {
      name: 'hoo', count: 2
    });

    em.close();
  }
);

Tinytest.add(
  'Client Side - Error Model - canSendErrors',
  function (test) {
    let em = new ErrorModel({maxErrorsPerInterval: 2});

    const resetSend = onKadiraSend(function () {
      resetSend();
    });

    em.sendError({name: 'hoo'});
    test.equal(em.canSendErrors(), true);
    em.sendError({name: 'hoo2'});
    test.equal(em.canSendErrors(), false);

    em.close();
  }
);

Tinytest.addAsync(
  'Client Side - Error Model - validateInterval',
  function (test, done) {
    let em = new ErrorModel({
      maxErrorsPerInterval: 2,
      intervalInMillis: 200
    });

    em.sendError({name: 'hoo'});
    em.sendError({name: 'hoo2'});
    test.equal(em.canSendErrors(), false);

    setTimeout(function () {
      test.equal(em.canSendErrors(), true);
      em.close();
      done();
    }, 250);
  }
);

Tinytest.addAsync(
  'Client Side - Error Model - wait for ntpSync - not synced yet',
  function (test, done) {
    let em = new ErrorModel({
      waitForNtpSyncInterval: 200
    });

    Kadira.syncedDate.synced = false;
    let payloadReceived;
    const resetSend = onKadiraSend(function (payload) {
      payloadReceived = payload;
      resetSend();
    });
    em.sendError({name: 'hello'});

    setTimeout(function () {
      test.equal(payloadReceived,
        buildPayload([
          {name: 'hello', count: 1}
        ])
      );

      test.equal(em.errorsSent['hello'], {
        name: 'hello', count: 0
      });

      em.close();
      done();
    }, 250);
  }
);

Tinytest.add(
  'Client Side - Error Model - wait for ntpSync - already synced',
  function (test) {
    let em = new ErrorModel({
      waitForNtpSyncInterval: 200
    });

    Kadira.syncedDate.synced = true;
    let payloadReceived;
    const resetSend = onKadiraSend(function (payload) {
      payloadReceived = payload;
      resetSend();
    });
    em.sendError({name: 'hello'});

    test.equal(
      payloadReceived,
      buildPayload([
        {name: 'hello', count: 1}
      ])
    );

    test.equal(em.errorsSent['hello'], {
      name: 'hello', count: 0
    });

    em.close();
  }
);

Tinytest.add(
  'Client Side - Error Model - wait for ntpSync - syncing time',
  function (test) {
    let em = new ErrorModel({
      waitForNtpSyncInterval: 200
    });

    let orginalSyncTime = Kadira.syncedDate.syncTime;
    Kadira.syncedDate.syncTime = function (localTime) {
      return localTime + 500;
    };
    Kadira.syncedDate.synced = true;

    let payloadReceived;
    const resetSend = onKadiraSend(function (payload) {
      payloadReceived = payload;
      resetSend();
    });
    em.sendError({name: 'hello', startTime: 100});

    test.equal(
      payloadReceived,
      buildPayload([
        {name: 'hello', count: 1, startTime: 600}
      ])
    );

    Kadira.syncedDate.syncTime = orginalSyncTime;
    em.close();
  }
);

function onKadiraSend (callback) {
  let originalSend = Kadira.send;
  Kadira.send = function (payload) {
    callback(payload);
  };

  return function () {
    Kadira.send = originalSend;
  };
}

function buildPayload (errors) {
  return {
    errors,
    host: undefined,
    arch,
    archVersion,
    recordIPAddress: 'full'
  };
}
