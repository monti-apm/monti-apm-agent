import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - with zone',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    let errorSent = false;
    let message = Random.id();

    // set window.zone as nothing
    let originalZone = window.zone;
    window.zone = {};

    Meteor._debug(message, '_stack');
    test.equal(errorSent, false);
    restoreKadiraSendErrors();

    // cleajr
    window.zone = originalZone;
    function mockKadiraSendErrors () {
      errorSent = true;
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - without zone',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    let errorSent = false;
    let originalZone = window.zone;
    let message = Random.id();
    window.zone = undefined;

    try {
      Meteor._debug(message, '_stack');
    } catch (e) { /* empty */ }

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mockKadiraSendErrors (error) {
      errorSent = true;
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - using Error only',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    let errorSent = false;
    let originalZone = window.zone;
    let message = Random.id();
    window.zone = undefined;

    try {
      let err = new Error(message);
      err.stack = '_stack';
      Meteor._debug(err);
    } catch (e) { /* empty */ }

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mockKadiraSendErrors (error) {
      errorSent = true;
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(message, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - string and Error',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    let errorSent = false;
    let originalZone = window.zone;
    let message = Random.id();
    let errorMessage = Random.id();
    window.zone = undefined;

    try {
      let err = new Error(errorMessage);
      err.stack = '_stack';
      Meteor._debug(message, err);
    } catch (e) { /* empty */ }

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mockKadiraSendErrors (error) {
      errorSent = true;
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(`${message}: ${errorMessage}`, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - string with colon and Error',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    let errorSent = false;
    let originalZone = window.zone;
    let message = `${Random.id()}:`;
    let errorMessage = Random.id();
    window.zone = undefined;

    try {
      let err = new Error(errorMessage);
      err.stack = '_stack';
      Meteor._debug(message, err);
    } catch (e) { /* empty */ }

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mockKadiraSendErrors (error) {
      errorSent = true;
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(`${message} ${errorMessage}`, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - Meteor.timeout Error',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    let errorSent = false;
    let originalZone = window.zone;
    let message = Random.id();
    let errorMessage = Random.id();
    window.zone = undefined;

    try {
      let err = new Error(errorMessage);
      err.stack = '_stack';
      Meteor._debug(message, err);
    } catch (e) { /* empty */ }

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mockKadiraSendErrors (error) {
      errorSent = true;
      test.equal('string', typeof error.appId);
      test.equal('object', typeof error.info);
      test.equal(`${message}: ${errorMessage}`, error.name);
      test.equal('client', error.type);
      test.equal(true, Array.isArray(JSON.parse(error.stacks)));
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - extract firefox stack',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mockKadiraSendErrors);
    let errorSent = false;
    let originalZone = window.zone;
    let message = Random.id();
    let errorMessage = Random.id();
    window.zone = undefined;

    const stack = `Message
    @debugger eval code:1:47
    EVp.withValue@http://localhost:3000/packages/meteor.js?hash=d522625a3ade81e56b990f2722ff3ed57f63222d:1207:15
    withoutInvocation/<@http://localhost:3000/packages/meteor.js?hash=d522625a3ade81e56b990f2722ff3ed57f63222d:588:25
    Meteor.bindEnvironment/<@http://localhost:3000/packages/meteor.js?hash=d522625a3ade81e56b990f2722ff3ed57f63222d:1234:22`;
    // The stack without the message on the first line
    const expectedStack = `\n${stack.split('\n').slice(1).join('\n')}`;

    try {
      let err = new Error(errorMessage);
      err.stack = stack;
      Meteor._debug(message, err);
    } catch (e) { /* empty */ }

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mockKadiraSendErrors (error) {
      errorSent = true;
      // eslint-disable-next-line no-undef
      test.equal(expectedStack, stackResult);
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

// --------------------------------------------------------------------------\\

let originalKadiraSendError;

function hijackKadiraSendErrors (mock) {
  originalKadiraSendError = Kadira.errors.sendError;
  Kadira.errors.sendError = mock;
}

function restoreKadiraSendErrors () {
  Kadira.errors.sendError = originalKadiraSendError;
}

function TestWithErrorTracking (testFunction) {
  return function (test) {
    let status = Kadira.options.enableErrorTracking;
    let appId = Kadira.options.appId;
    Kadira.options.appId = 'app';
    Kadira.enableErrorTracking();
    testFunction(test);
    Kadira.options.appId = appId;
    if (status) {
      Kadira.enableErrorTracking();
    } else {
      Kadira.disableErrorTracking();
    }
  };
}
