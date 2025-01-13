import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { MethodStore, TestData } from './globals';
import { sleep } from '../../lib/utils';

Kadira.connect('foo', 'bar', {enableErrorTracking: true});

let http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200);
  res.end('hello');
}).listen(3301);

http.createServer(function (req, res) {
  let data = '';
  req.on('data', function (d) {
    data += d.toString();
  });

  req.on('end', function () {
    if (req.url === '/echo') {
      let sendData = {success: true};
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      });

      if (req.headers['content-type'] === 'application/json') {
        data = JSON.parse(data);
        sendData = {echo: data};
      }

      res.end(JSON.stringify(sendData));
    } else {
      res.writeHead(400, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end('internal-error-here');
    }
  });
}).listen(8808);

// TODO use registerPublication instead of these

Meteor.publish('tinytest-data', function () {
  return TestData.find();
});

Meteor.publish('tinytest-data-with-no-oplog', function () {
  return TestData.find({}, { disableOplog: true });
});

Meteor.publish('tinytest-data-random', function () {
  return TestData.find({ aa: {$ne: Random.id()}});
});

Meteor.publish('tinytest-wait-time', function () {
  Meteor._sleepForMs(1);
  return TestData.find();
});


Meteor.publish('tinytest-data-cursor-fetch', async function () {
  await TestData.find({}).fetchAsync();
  this.ready();
});

Meteor.publish('tinytest-waited-on', async function () {
  await sleep(100);
  return TestData.find();
});

Meteor.publish('tinytest-waited-on2', async function () {
  await sleep(10);
  if (this.unblock) this.unblock();
  await sleep(40);
  return TestData.find();
});


Meteor.publish('tinytest-data-2', function () {
  return TestData.find();
});

Meteor.publish('tinytest-data-delayed', function () {
  Meteor.wrapAsync(function (done) {
    setTimeout(done, 200);
  })();
  return TestData.find();
});

(function () {
  let doneOnce = false;
  Meteor.publish('tinytest-data-multi', function () {
    let pub = this;
    Meteor.wrapAsync(function () {
      setTimeout(function () {
        if (!doneOnce) {
          pub.ready();
          doneOnce = true;
          setTimeout(function () {
            pub.ready();
          }, 500);
        }
      }, 400);
    })();
  });
})();

(function () {
  let original = Kadira.models.methods.processMethod;
  Kadira.models.methods.processMethod = function (method) {
    MethodStore.push(method);
    original.call(Kadira.models.methods, method);
  };
})();
