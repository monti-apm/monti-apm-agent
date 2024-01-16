import { WebApp } from 'meteor/webapp';
import { addAsyncTest } from '../_helpers/helpers';
import { TestData } from '../_helpers/globals';
import { getInfo } from '../../lib/async/als';
import { sleep } from '../../lib/utils';

let trace = null;
function syncWait (ms) {
  let start = Date.now();
  let now = start;
  while (now - start < ms) {
    now = Date.now();
  }
}

async function middleware (req, res, next) {
  await TestData.find().fetchAsync();

  next();
}

WebApp.handlers.use('/test-route/:id/:name?', middleware, (req, res) => {
  trace = getInfo().trace;

  res.writeHead(200);
  res.end(`Hello world from: ${Meteor.release}`);
});

WebApp.handlers.use('/test-middleware', middleware, (req, res) => {
  trace = getInfo().trace;

  res.writeHead(200);
  res.end(`Hello world from: ${Meteor.release}`);
});
WebApp.handlers.use(
  '/test-middleware-2',
  (req, res, next) => {
    setTimeout(() => {
      next();
    }, 1000);
  },
  (req, res) => {
    trace = getInfo().trace;

    res.writeHead(200);
    res.end(`Hello world from: ${Meteor.release}`);
  }
);
WebApp.handlers.use(
  '/test-middleware-3',
  // uses async/await, but the async function resolves
  // before next is called
  async (req, res, next) => {
    await 0;

    // not awaited, so the parent async function resolves before next is called
    TestData.findOneAsync().then(() => {
      next();
    });
  },
  (req, res) => {
    trace = getInfo().trace;

    res.writeHead(200);
    res.end(`Hello world from: ${Meteor.release}`);
  }
);

WebApp.handlers.use('/async-test', async (req, res) => {
  trace = getInfo().trace;
  await sleep(100);
  await sleep(100);
  res.writeHead(200);
  res.end(`Hello world from: ${Meteor.release}`);
});
WebApp.handlers.use('/async-test-2', async (req, res) => {
  trace = getInfo().trace;
  syncWait(300);
  await TestData.find().fetchAsync();

  res.writeHead(200);
  res.end(`Hello world from: ${Meteor.release}`);
});

addAsyncTest('Webapp - return express app from .use', async function (test) {
  const result = WebApp.handlers.use((req, res, next) => {
    next();
  });

  test.equal(result, WebApp.handlers);
});

addAsyncTest('Webapp - filter headers', async function (test) {
  Kadira.tracer.redactField('x--test--authorization');

  let req = {
    url: '/test',
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'content-length': '1000',
      'x--test--authorization': 'secret',
    },
  };

  const firstMiddleware = WebApp.rawHandlers.parent._router.stack[0].handle;

  await new Promise((resolve) => {
    firstMiddleware(req, { on () {} }, function () {
      const expected = JSON.stringify({
        'content-type': 'application/json',
        'content-length': '1000',
        'x--test--authorization': 'Monti: redacted',
      });
      test.equal(req.__kadiraInfo.trace.events[0].data.headers, expected);
      resolve();
    });
  });
});

addAsyncTest('Webapp - find in middleware', async function (test) {
  const result = await fetch(`${Meteor.absoluteUrl()}/test-middleware`);
  test.equal(trace.events[0][2].url, '/test-middleware');

  const event = trace.events.find(([type]) => type === 'db');

  test.equal(result.status, 200);
  test.stableEqual(event[2], {
    coll: 'tinytest-data',
    selector: '{}',
    func: 'fetch',
    cursor: true,
    docSize: 0,
    docsFetched: 0,
  });
});
addAsyncTest('Webapp - async events inside routes', async function (test) {
  const result = await fetch(`${Meteor.absoluteUrl()}/async-test`);

  test.equal(trace.events[0][2].url, '/async-test');

  const event = trace.events.find(([type]) => type === 'async');

  test.equal(result.status, 200);
  test.equal(event[1] < 250, true);
});
addAsyncTest(
  'Webapp - dynamic route name optional param',
  async function (test) {
    const result = await fetch(`${Meteor.absoluteUrl()}/test-route/2`);
    test.equal(trace.name, 'GET-/test-route/:id/:name?');
    console.error(trace);
    const event = trace.events.find(([type]) => type === 'async');

    test.equal(result.status, 200);
    test.equal(event[1] < 250, true);
  }
);
addAsyncTest('Webapp - dynamic route name all params', async function (test) {
  const result = await fetch(`${Meteor.absoluteUrl()}/test-route/2/montiapm`);

  test.equal(trace.name, 'GET-/test-route/:id/:name?');

  const event = trace.events.find(([type]) => type === 'async');

  test.equal(result.status, 200);
  test.equal(event[1] < 250, true);
});

addAsyncTest(
  'Webapp - async and compute events inside routes',
  async function (test) {
    const result = await fetch(`${Meteor.absoluteUrl()}/async-test-2`);

    test.equal(trace.events[0][2].url, '/async-test-2');

    const events = trace.events;

    test.equal(result.status, 200);
    test.equal(events.length >= 2, true);
    // compute time
    test.equal(events[1][1] >= 300, true);
    test.equal(events[1][0], 'compute');

    // db call
    test.equal(events[2][1] > 0, true);
    test.equal(events[2][0], 'db');
  }
);
addAsyncTest(
  'Webapp - async event when middleware resolves before next is called',
  async function (test) {
    const result = await fetch(`${Meteor.absoluteUrl()}/test-middleware-2`);

    test.equal(trace.events[0][2].url, '/test-middleware-2');

    const events = trace.events.filter(([type]) =>
      ['async', 'compute', 'db'].includes(type)
    );

    console.error(trace);
    test.equal(result.status, 200);
    test.equal(events.length <= 4, true);
    // async
    test.equal(events[0][1] <= 1010 && events[0][1] >= 900, true);
  }
);

addAsyncTest(
  'Webapp - async event when middleware resolves before next is called 2',
  async function (test) {
    const result = await fetch(`${Meteor.absoluteUrl()}/test-middleware-3`);

    test.equal(trace.events[0][2].url, '/test-middleware-3');

    const events = trace.events.filter(([type]) =>
      ['async', 'compute', 'db'].includes(type)
    );

    test.equal(result.status, 200);
    test.equal(events.length >= 2, true);
    // async
    test.equal(events[0][1] <= 2, true);
    // db call
    test.equal(events[1][1] <= 5, true);
  }
);
