Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter db',
  function (test) {
    var filter = Tracer.stripSensitive();
    var filtered = filter(
      "db", {selector: "something-else"}, {type: "method", name: "name"});
    test.equal(filtered, {selector: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter start',
  function (test) {
    var filter = Tracer.stripSensitive();
    var filtered = filter(
      "start", {params: "something-else"}, {type: "method", name: "name"});
    test.equal(filtered, {params: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter http',
  function (test) {
    var filter = Tracer.stripSensitive();
    var filtered = filter(
      "http", {url: "something-else"}, {type: "method", name: "name"});
    test.equal(filtered, {url: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - filter email',
  function (test) {
    var filter = Tracer.stripSensitive();
    var filtered = filter("email", {
      from: "something-else",
      to: "something-else",
      cc: "something-else",
      bcc: "something-else",
      replyTo: "something-else"
    }, {type: "method", name: "name"});

    test.equal(filtered, {
      from: "[stripped]",
      to: "[stripped]",
      cc: "[stripped]",
      bcc: "[stripped]",
      replyTo: "[stripped]"
    });
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - with given types',
  function (test) {
    var filter = Tracer.stripSensitive(["db", "http"]);
    var filtered = filter(
      "db", {selector: "something-else"}, {type: "method", name: "name"});
    test.equal(filtered, {selector: "[stripped]"});

    var filtered = filter(
      "start", {params: "something-else"}, {type: "method", name: "name"});
    test.equal(filtered, {params: "something-else"})
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - with given receiverType',
  function (test) {
    var filter = Tracer.stripSensitive(["db"], "method");
    var filtered = filter(
      "db", {selector: "some-selector"}, {type: "method", name: "name"});
    test.equal(filtered, {selector: "[stripped]"});

    var filtered = filter(
      "db", {selector: "some-selector"}, {type: "sub", name: "name"});
    test.equal(filtered, {selector: "some-selector"})
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitive - with given receiverType and name',
  function (test) {
    var filter = Tracer.stripSensitive(["db"], "method", "name");
    var filtered = filter(
      "db", {selector: "some-selector"}, {type: "method", name: "name"});
    test.equal(filtered, {selector: "[stripped]"});

    var filtered = filter(
      "db", {selector: "some-selector"}, {type: "method", name: "not-name"});
    test.equal(filtered, {selector: "some-selector"})
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - given collections',
  function (test) {
    var filter = Tracer.stripSelectors(["posts", "comments"]);
    var filtered = filter("db", {coll: "posts", selector: "something-else"},
                          {type: "method", name: "name"});
    test.equal(filtered, {coll: "posts", selector: "[stripped]"});

    var notfiltered = filter("db", {coll: "other", selector: "something-else"},
                             {type: "method", name: "name"});
    test.equal(notfiltered, {coll: "other", selector: "something-else"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - no given collections',
  function (test) {
    var filter = Tracer.stripSelectors();
    var filtered = filter("db", {coll: "posts", selector: "something-else"},
                          {type: "method", name: "name"});
    test.equal(filtered, {coll: "posts", selector: "something-else"});

    var notfiltered = filter("db", {coll: "other", selector: "something-else"},
                             {type: "method", name: "name"});
    test.equal(notfiltered, {coll: "other", selector: "something-else"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - given receiverType',
  function (test) {
    var filter = Tracer.stripSelectors(["posts"], "method");
    var filtered = filter("db", {coll: "posts", selector: "something-else"},
                          {type: "method", name: "name"});
    test.equal(filtered, {coll: "posts", selector: "[stripped]"});

    var notfiltered = filter("db", {coll: "posts", selector: "something-else"},
                             {type: "sub", name: "name"});
    test.equal(notfiltered, {coll: "posts", selector: "something-else"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSelectors - given receiverType and name',
  function (test) {
    var filter = Tracer.stripSelectors(["posts"], "method", "name");
    var filtered = filter("db", {coll: "posts", selector: "something-else"},
                          {type: "method", name: "name"});
    test.equal(filtered, {coll: "posts", selector: "[stripped]"});

    var notfiltered = filter("db", {coll: "posts", selector: "something-else"},
                             {type: "method", name: "not-name"});
    test.equal(notfiltered, {coll: "posts", selector: "something-else"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter start',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("start", {userId: "user-1", params: "create"});
    test.equal(filtered, {userId: "user-1", params: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter db',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("db", {coll: "notes", query: "{_id: '1234'}"});
    test.equal(filtered, {coll: "notes", query: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter http',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("http", {method: "get", data: "{_id: '1234'}"});
    test.equal(filtered, {method: "get", data: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter email',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("http", {to: "hello@test.com"});
    test.equal(filtered, {to: "[stripped]"});
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - do not filter custom',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("custom", { method: "get", data: "{_id: '1234'}" });
    test.equal(filtered, { method: "get", data: "{_id: '1234'}" });
  }
);


Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter unknown',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("other", { method: "get", data: "{_id: '1234'}" });
    test.equal(filtered, { method: "[stripped]", data: "[stripped]" });
  }
);

Tinytest.add(
  'Tracer - Default filters - Tracer.stripSensitiveThorough - filter error',
  function (test) {
    var filter = Tracer.stripSensitiveThorough();
    var filtered = filter("error", { error: { message: 'Unrecognized type', stack: 'stack' }});
    test.equal(filtered, { error: { message: 'Unrecognized type', stack: 'stack' } });
  }
);
