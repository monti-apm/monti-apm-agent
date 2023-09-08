import { WebApp } from 'meteor/webapp';
import { wrapWebApp } from '../../lib/hijack/wrap_webapp';
import { addAsyncTest, releaseParts } from '../_helpers/helpers';

// Check if Meteor 1.7 or newer, which are the
// versions that wrap connect handlers in a fiber and are easy
// to wrap the static middleware
const httpMonitoringEnabled = releaseParts[0] > 1 ||
  (releaseParts[0] > 0 && releaseParts[1] > 6);

if (httpMonitoringEnabled) {
  wrapWebApp();

  addAsyncTest(
    'Webapp - return connect app from .use',
    async function (test) {
      const result = WebApp.expressHandlers.use((req, res, next) => {
        next();
      });

      test.equal(result, WebApp.expressHandlers);
    }
  );

  addAsyncTest(
    'Webapp - filter headers',
    async function (test) {
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

      const firstMiddleware = WebApp.rawExpressHandlers.parent._router.stack[0].handle;

      await new Promise((resolve) => {
        firstMiddleware(
          req,
          { on () {} },
          function () {
            const expected = JSON.stringify({
              'content-type': 'application/json',
              'content-length': '1000',
              'x--test--authorization': 'Monti: redacted'
            });
            test.equal(req.__kadiraInfo.trace.events[0].data.headers, expected);
            resolve();
          });
      });
    });
}
