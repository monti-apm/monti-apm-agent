import { HTTP } from 'meteor/http';
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
