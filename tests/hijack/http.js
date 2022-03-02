import { HTTP } from 'meteor/http';
import { fetch } from 'meteor/fetch';
const Future = Npm.require('fibers/future');

Tinytest.add('HTTP - meteor/http - call a server', function (test) {
    const methodId = RegisterMethod(function () {
      const result = HTTP.get('http://localhost:3301');
      return result.statusCode;
    });
    const client = GetMeteorClient();
    const result = client.call(methodId);
    const events = GetLastMethodEvents([0, 2]);
    const expected = [
      ['start', , { userId: null, params: '[]' }],
      ['wait', , { waitOn: [] }],
      ['http', , { url: 'http://localhost:3301', method: 'GET', statusCode: 200, library: 'meteor/http' }],
      ['complete']
    ];
    test.equal(events, expected);
    test.equal(result, 200);
    CleanTestData();
  }
);

Tinytest.add('HTTP - meteor/http - async callback', function (test) {
    const methodId = RegisterMethod(function () {
      const f = new Future();
      let result;
      HTTP.get('http://localhost:3301', function (err, res) {
        result = res;
        f.return();
      });
      f.wait();
      return result.statusCode;
    });
    const client = GetMeteorClient();
    const result = client.call(methodId);
    const events = GetLastMethodEvents([0, 2]);
    const expected = [
      ['start', , { userId: null, params: '[]' }],
      ['wait', , { waitOn: [] }],
      ['http', , { url: 'http://localhost:3301', method: 'GET', async: true, library: 'meteor/http' }],
      ['async', , {}],
      ['complete']
    ];
    test.equal(events, expected);
    test.equal(result, 200);
    CleanTestData();
  }
);

Tinytest.add('HTTP - meteor/fetch - async call', function (test) {
    const methodId = RegisterMethod(function () {
      const f = new Future();
      let result;
      fetch('http://localhost:3301/').then(function (res) {
        result = res;
        f.return();
      });
      f.wait();
      return result.status;
    });
    const client = GetMeteorClient();
    const result = client.call(methodId);
    const events = GetLastMethodEvents([0, 2]);
    const expected = [
      ['start', , { userId: null, params: '[]' }],
      ['wait', , { waitOn: [] }],
      ['http', , { method: 'GET', url: 'http://localhost:3301/', library: 'meteor/fetch' }],
      ['complete']
    ];
    test.equal(events, expected);
    test.equal(result, 200);
    CleanTestData();
  }
);

Tinytest.add('HTTP - meteor/fetch - trace error', function (test) {
    const methodId = RegisterMethod(function () {
      const f = new Future();
      let error;
      fetch('http://localhost:9999/').catch(function (err) {
        error = err;
        f.return();
      });
      f.wait();
      return error;
    });
    const client = GetMeteorClient();
    const result = client.call(methodId);
    const events = GetLastMethodEvents([0, 2]);
    const expected = [
      ["start", , { userId: null, params: "[]" }],
      ["wait", , { waitOn: [] }],
      [
        "http",
        ,
        {
          method: "GET",
          url: "http://localhost:9999/",
          library: "meteor/fetch",
          err: "request to http://localhost:9999/ failed, reason: connect ECONNREFUSED 127.0.0.1:9999",
        },
      ],
      ["complete"],
    ];
    test.equal(events, expected);
    test.equal(result, {
      message:
        "request to http://localhost:9999/ failed, reason: connect ECONNREFUSED 127.0.0.1:9999",
      type: "system",
      errno: "ECONNREFUSED",
      code: "ECONNREFUSED",
    });
    CleanTestData();
  }
);
