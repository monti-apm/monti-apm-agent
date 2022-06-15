Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter db',
  function (test) {
    let filter = Tracer.stripSensitive();
    let filtered = filter(
      'db', {selector: 'something-else'}, {type: 'method', name: 'name'});
    test.equal(filtered, {selector: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter start',
  function (test) {
    let filter = Tracer.stripSensitive();
    let filtered = filter(
      'start', {params: 'something-else'}, {type: 'method', name: 'name'});
    test.equal(filtered, {params: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter http',
  function (test) {
    let filter = Tracer.stripSensitive();
    let filtered = filter(
      'http', {url: 'something-else'}, {type: 'method', name: 'name'});
    test.equal(filtered, {url: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter email',
  function (test) {
    let filter = Tracer.stripSensitive();
    let filtered = filter('email', {
      from: 'something-else',
      to: 'something-else',
      cc: 'something-else',
      bcc: 'something-else',
      replyTo: 'something-else'
    }, {type: 'method', name: 'name'});

    test.equal(filtered, {
      from: '[stripped]',
      to: '[stripped]',
      cc: '[stripped]',
      bcc: '[stripped]',
      replyTo: '[stripped]'
    });
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - with given types',
  function (test) {
    let filter = Tracer.stripSensitive(['db', 'http']);
    var filtered = filter(
      'db', {selector: 'something-else'}, {type: 'method', name: 'name'});
    test.equal(filtered, {selector: '[stripped]'});

    var filtered = filter(
      'start', {params: 'something-else'}, {type: 'method', name: 'name'});
    test.equal(filtered, {params: 'something-else'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - with given receiverType',
  function (test) {
    let filter = Tracer.stripSensitive(['db'], 'method');
    var filtered = filter(
      'db', {selector: 'some-selector'}, {type: 'method', name: 'name'});
    test.equal(filtered, {selector: '[stripped]'});

    var filtered = filter(
      'db', {selector: 'some-selector'}, {type: 'sub', name: 'name'});
    test.equal(filtered, {selector: 'some-selector'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - with given receiverType and name',
  function (test) {
    let filter = Tracer.stripSensitive(['db'], 'method', 'name');
    var filtered = filter(
      'db', {selector: 'some-selector'}, {type: 'method', name: 'name'});
    test.equal(filtered, {selector: '[stripped]'});

    var filtered = filter(
      'db', {selector: 'some-selector'}, {type: 'method', name: 'not-name'});
    test.equal(filtered, {selector: 'some-selector'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - strip headers and request body',
  function (test) {
    let filter = Tracer.stripSensitive();
    let filtered = filter(
      'start', { body: '{"_id": 5}', headers: "{'x-token': '123'}" }, 'http', 'POST-/create'
    );
    test.equal(filtered, {body: '[stripped]', headers: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - given collections',
  function (test) {
    let filter = Tracer.stripSelectors(['posts', 'comments']);
    let filtered = filter('db', {coll: 'posts', selector: 'something-else'},
      {type: 'method', name: 'name'});
    test.equal(filtered, {coll: 'posts', selector: '[stripped]'});

    let notfiltered = filter('db', {coll: 'other', selector: 'something-else'},
      {type: 'method', name: 'name'});
    test.equal(notfiltered, {coll: 'other', selector: 'something-else'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - no given collections',
  function (test) {
    let filter = Tracer.stripSelectors();
    let filtered = filter('db', {coll: 'posts', selector: 'something-else'},
      {type: 'method', name: 'name'});
    test.equal(filtered, {coll: 'posts', selector: 'something-else'});

    let notfiltered = filter('db', {coll: 'other', selector: 'something-else'},
      {type: 'method', name: 'name'});
    test.equal(notfiltered, {coll: 'other', selector: 'something-else'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - given receiverType',
  function (test) {
    let filter = Tracer.stripSelectors(['posts'], 'method');
    let filtered = filter('db', {coll: 'posts', selector: 'something-else'},
      {type: 'method', name: 'name'});
    test.equal(filtered, {coll: 'posts', selector: '[stripped]'});

    let notfiltered = filter('db', {coll: 'posts', selector: 'something-else'},
      {type: 'sub', name: 'name'});
    test.equal(notfiltered, {coll: 'posts', selector: 'something-else'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - given receiverType and name',
  function (test) {
    let filter = Tracer.stripSelectors(['posts'], 'method', 'name');
    let filtered = filter('db', {coll: 'posts', selector: 'something-else'},
      {type: 'method', name: 'name'});
    test.equal(filtered, {coll: 'posts', selector: '[stripped]'});

    let notfiltered = filter('db', {coll: 'posts', selector: 'something-else'},
      {type: 'method', name: 'not-name'});
    test.equal(notfiltered, {coll: 'posts', selector: 'something-else'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter start',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('start', {userId: 'user-1', params: 'create'});
    test.equal(filtered, {userId: 'user-1', params: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter db',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('db', {coll: 'notes', query: "{_id: '1234'}"});
    test.equal(filtered, {coll: 'notes', query: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter http',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('http', {method: 'get', data: "{_id: '1234'}"});
    test.equal(filtered, {method: 'get', data: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter email',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('http', {to: 'hello@test.com'});
    test.equal(filtered, {to: '[stripped]'});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - do not filter custom',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('custom', { method: 'get', data: "{_id: '1234'}" });
    test.equal(filtered, { method: 'get', data: "{_id: '1234'}" });
  }
);


Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter unknown',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('other', { method: 'get', data: "{_id: '1234'}" });
    test.equal(filtered, { method: '[stripped]', data: '[stripped]' });
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter error',
  function (test) {
    let filter = Tracer.stripSensitiveThorough();
    let filtered = filter('error', { error: { message: 'Unrecognized type', stack: 'stack' }});
    test.equal(filtered, { error: { message: 'Unrecognized type', stack: 'stack' } });
  }
);
