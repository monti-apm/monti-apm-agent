import { WebApp } from 'meteor/webapp';
import { checkHandlersInFiber, wrapWebApp } from "../../lib/hijack/wrap_webapp";
import { releaseParts } from '../_helpers/helpers';

// Check if Meteor 1.7 or newer, which are the
// versions that wrap connect handlers in a fiber and are easy
// to wrap the static middleware
const httpMonitoringEnabled = releaseParts[0] > 1 ||
  (releaseParts[0] > 0 && releaseParts[1] > 6)

Tinytest.add(
  'Webapp - checkHandlersInFiber',
  function (test) {
    const expected = httpMonitoringEnabled
    test.equal(checkHandlersInFiber(), expected);
  }
);

if (httpMonitoringEnabled) {
  wrapWebApp();

  Tinytest.add(
    'Webapp - return connect app from .use',
    function (test) {
      const result = WebApp.connectHandlers.use((req, res, next) =>{
        next();
      });

      test.equal(result, WebApp.connectHandlers);
    }
  )

  Tinytest.addAsync(
    'Webapp - filter headers',
    function (test, done) {
      Kadira.tracer.redactField('x--test--authorization');

      let req = {
        url: '/test',
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'content-length': '1000',
          'x--test--authorization': 'secret'
        }
      };

      WebApp.rawConnectHandlers.stack[0].handle(
        req,
        {on() {}},
        function () {
          const expected = JSON.stringify({
            'content-type': 'application/json',
            'content-length': '1000',
            'x--test--authorization': 'Monti: redacted'
          });
          test.equal(req.__kadiraInfo.trace.events[0].data.headers, expected)
          done();
      });
  })
}
