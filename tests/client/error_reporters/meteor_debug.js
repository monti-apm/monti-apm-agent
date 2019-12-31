
Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - with zone',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    var errorSent = false;
    var message = Random.id();

    // set window.zone as nothing
    var originalZone = window.zone;
    window.zone = {};

    Meteor._debug(message, '_stack');
    test.equal(errorSent, false);
    restoreKadiraSendErrors();

    // cleajr 
    window.zone = originalZone;
    function mock_KadiraSendErrors(data) {
      errorSent = true;
    }
  })
);

Tinytest.add(
  'Client Side - Error Manager - Reporters - meteor._debug - without zone',
  TestWithErrorTracking(function (test) {
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    var errorSent = false;
    var originalZone = window.zone;
    var message = Random.id();
    window.zone = undefined;

    try {
      Meteor._debug(message, '_stack');
    } catch (e) { };

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mock_KadiraSendErrors(error) {
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
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    var errorSent = false;
    var originalZone = window.zone;
    var message = Random.id();
    window.zone = undefined;

    try {
      var err = new Error(message);
      err.stack = '_stack';
      Meteor._debug(err);
    } catch (e) { };

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mock_KadiraSendErrors(error) {
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
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    var errorSent = false;
    var originalZone = window.zone;
    var message = Random.id()
    var errorMessage = Random.id();
    window.zone = undefined;

    try {
      var err = new Error(errorMessage);
      err.stack = '_stack';
      Meteor._debug(message, err);
    } catch (e) { };

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mock_KadiraSendErrors(error) {
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
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    test.equal(typeof Meteor._debug, 'function');
    var errorSent = false;
    var originalZone = window.zone;
    var message = `${Random.id()}:`
    var errorMessage = Random.id();
    window.zone = undefined;

    try {
      var err = new Error(errorMessage);
      err.stack = '_stack';
      Meteor._debug(message, err);
    } catch (e) { };

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mock_KadiraSendErrors(error) {
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
      hijackKadiraSendErrors(mock_KadiraSendErrors);
      test.equal(typeof Meteor._debug, 'function');
      var errorSent = false;
      var originalZone = window.zone;
      var message = Random.id()
      var errorMessage = Random.id();
      window.zone = undefined;
  
      try {
        var err = new Error(errorMessage);
        err.stack = '_stack';
        Meteor._debug(message, err);
      } catch (e) { };
  
      window.zone = originalZone;
      test.equal(errorSent, true);
      restoreKadiraSendErrors();
  
      function mock_KadiraSendErrors(error) {
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
    hijackKadiraSendErrors(mock_KadiraSendErrors);
    var errorSent = false;
    var originalZone = window.zone;
    var message = Random.id()
    var errorMessage = Random.id();
    window.zone = undefined;

    const stack = `Message
    @debugger eval code:1:47
    EVp.withValue@http://localhost:3000/packages/meteor.js?hash=d522625a3ade81e56b990f2722ff3ed57f63222d:1207:15
    withoutInvocation/<@http://localhost:3000/packages/meteor.js?hash=d522625a3ade81e56b990f2722ff3ed57f63222d:588:25
    Meteor.bindEnvironment/<@http://localhost:3000/packages/meteor.js?hash=d522625a3ade81e56b990f2722ff3ed57f63222d:1234:22`
    // The stack without the message on the first line
    const expectedStack = '\n' + stack.split('\n').slice(1).join('\n');

    try {
      var err = new Error(errorMessage);
      err.stack = stack;
      Meteor._debug(message, err);
    } catch (e) { };

    window.zone = originalZone;
    test.equal(errorSent, true);
    restoreKadiraSendErrors();

    function mock_KadiraSendErrors(error) {
      errorSent = true;
      test.equal(expectedStack, stackResult);
      test.equal('number', typeof error.startTime);
      test.equal('meteor._debug', error.subType);
    }
  })
);

//--------------------------------------------------------------------------\\

var original_KadiraSendErrors;

function hijackKadiraSendErrors(mock) {
  original_KadiraSendErrors = Kadira.errors.sendError;
  Kadira.errors.sendError = mock;
}

function restoreKadiraSendErrors() {
  Kadira.errors.sendError = original_KadiraSendErrors;
}

function TestWithErrorTracking(testFunction) {
  return function (test) {
    var status = Kadira.options.enableErrorTracking;
    var appId = Kadira.options.appId;
    Kadira.options.appId = 'app';
    Kadira.enableErrorTracking();
    testFunction(test);
    Kadira.options.appId = appId;
    status ? Kadira.enableErrorTracking() : Kadira.disableErrorTracking();
  }
}
