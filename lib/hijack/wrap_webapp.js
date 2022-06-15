import { WebAppInternals, WebApp } from 'meteor/webapp';
import Fibers from 'fibers';

// Maximum content-length size
MAX_BODY_SIZE = 8000;
// Maximum characters for stringified body
MAX_STRINGIFIED_BODY_SIZE = 4000;

const canWrapStaticHandler = Boolean(WebAppInternals.staticFilesByArch);

// This checks if running on a version of Meteor that
// wraps connect handlers in a fiber.
// This check is dependant on Meteor's implementation of `use`,
// which wraps every handler in a new fiber.
// This will need to be updated if Meteor starts reusing
// fibers when they exist.
export function checkHandlersInFiber () {
  const handlersLength = WebApp.rawConnectHandlers.stack.length;
  let inFiber = false;
  let outsideFiber = Fibers.current;

  WebApp.rawConnectHandlers.use((_req, _res, next) => {
    inFiber = Fibers.current && Fibers.current !== outsideFiber;

    // in case we didn't successfully remove this handler
    // and it is a real request
    next();
  });

  if (WebApp.rawConnectHandlers.stack[handlersLength]) {
    let handler = WebApp.rawConnectHandlers.stack[handlersLength].handle;

    // remove the newly added handler
    // We remove it immediately so there is no opportunity for
    // other code to add handlers first if the current fiber is yielded
    // while running the handler
    while (WebApp.rawConnectHandlers.stack.length > handlersLength) {
      WebApp.rawConnectHandlers.stack.pop();
    }

    handler({}, {}, () => {});
  }

  return inFiber;
}

const InfoSymbol = Symbol();

export async function wrapWebApp () {
  if (!checkHandlersInFiber() || !canWrapStaticHandler) {
    return;
  }

  const parseUrl = require('parseurl');

  WebAppInternals.registerBoilerplateDataCallback('__montiApmRouteName', function (request) {
    // TODO: record in trace which arch is used

    if (request[InfoSymbol]) {
      request[InfoSymbol].isAppRoute = true;
    }

    // Let WebApp know we didn't make changes
    // so it can use a cache
    return false;
  });

  // We want the request object returned by categorizeRequest to have
  // __kadiraInfo
  let origCategorizeRequest = WebApp.categorizeRequest;
  WebApp.categorizeRequest = function (req) {
    let result = origCategorizeRequest.apply(this, arguments);

    if (result && req.__kadiraInfo) {
      result[InfoSymbol] = req.__kadiraInfo;
    }

    return result;
  };

  // Adding the handler directly to the stack
  // to force it to be the first one to run
  WebApp.rawConnectHandlers.stack.unshift({
    route: '',
    handle: (req, res, next) => {
      const name = parseUrl(req).pathname;
      const trace = Kadira.tracer.start(`${req.method}-${name}`, 'http');

      const headers = Kadira.tracer._applyObjectFilters(req.headers);
      Kadira.tracer.event(trace, 'start', {
        url: req.url,
        method: req.method,
        headers: JSON.stringify(headers),
      });
      req.__kadiraInfo = { trace };

      res.on('finish', () => {
        if (req.__kadiraInfo.asyncEvent) {
          Kadira.tracer.eventEnd(trace, req.__kadiraInfo.asyncEvent);
        }

        Kadira.tracer.endLastEvent(trace);

        if (req.__kadiraInfo.isStatic) {
          trace.name = `${req.method}-<static file>`;
        } else if (req.__kadiraInfo.suggestedRouteName) {
          trace.name = `${req.method}-${req.__kadiraInfo.suggestedRouteName}`;
        } else if (req.__kadiraInfo.isAppRoute) {
          trace.name = `${req.method}-<app>`;
        }

        const isJson = req.headers['content-type'] === 'application/json';
        const hasSmallBody = req.headers['content-length'] > 0 && req.headers['content-length'] < MAX_BODY_SIZE;

        // Check after all middleware have run to see if any of them
        // set req.body
        // Technically bodies can be used with any method, but since many load balancers and
        // other software only support bodies for POST requests, we are
        // not recording the body for other methods.
        if (req.method === 'POST' && req.body && isJson && hasSmallBody) {
          try {
            let body = JSON.stringify(req.body);

            // Check the body size again in case it is much
            // larger than what was in the content-length header
            if (body.length < MAX_STRINGIFIED_BODY_SIZE) {
              trace.events[0].data.body = body;
            }
          } catch (e) {
          // It is okay if this fails
          }
        }

        // TODO: record status code
        Kadira.tracer.event(trace, 'complete');
        let built = Kadira.tracer.buildTrace(trace);
        Kadira.models.http.processRequest(built, req, res);
      });

      next();
    }
  });


  function wrapHandler (handler) {
    // connect identifies error handles by them accepting
    // four arguments
    let errorHandler = handler.length === 4;

    function wrapper (req, res, next) {
      let error;
      if (errorHandler) {
        error = req;
        req = res;
        res = next;
        next = arguments[3];
      }

      const kadiraInfo = req.__kadiraInfo;
      Kadira._setInfo(kadiraInfo);

      let nextCalled = false;
      // TODO: track errors passed to next or thrown
      function wrappedNext (...args) {
        if (kadiraInfo && kadiraInfo.asyncEvent) {
          Kadira.tracer.eventEnd(req.__kadiraInfo.trace, req.__kadiraInfo.asyncEvent);
          req.__kadiraInfo.asyncEvent = null;
        }

        nextCalled = true;
        next(...args);
      }

      let potentialPromise;

      if (errorHandler) {
        potentialPromise = handler.call(this, error, req, res, wrappedNext);
      } else {
        potentialPromise = handler.call(this, req, res, wrappedNext);
      }

      if (potentialPromise && typeof potentialPromise.then === 'function') {
        potentialPromise.then(() => {
          // res.finished is depreciated in Node 13, but it is the only option
          // for Node 12.9 and older.
          if (kadiraInfo && !res.finished && !nextCalled) {
            const lastEvent = Kadira.tracer.getLastEvent(kadiraInfo.trace);
            if (lastEvent.endAt) {
              // req is not done, and next has not been called
              // create an async event that will end when either of those happens
              kadiraInfo.asyncEvent = Kadira.tracer.event(kadiraInfo.trace, 'async');
            }
          }
        });
      }

      return potentialPromise;
    }

    if (errorHandler) {
      return function (error, req, res, next) {
        return wrapper(error, req, res, next);
      };
    }
    return function (req, res, next) {
      return wrapper(req, res, next);
    };
  }

  function wrapConnect (app, wrapStack) {
    let oldUse = app.use;
    if (wrapStack) {
      // We need to set kadiraInfo on the Fiber the handler will run in.
      // Meteor has already wrapped the handler to run it in a new Fiber
      // by using Promise.asyncApply so we are not able to directly set it
      // on that Fiber.
      // Meteor's promise library copies properties from the current fiber to
      // the new fiber, so we can wrap it in another Fiber with kadiraInfo set
      // and Meteor will copy kadiraInfo to the new Fiber.
      // It will only create the additional Fiber if it isn't already running in a Fiber
      app.stack.forEach(entry => {
        let wrappedHandler = wrapHandler(entry.handle);
        if (entry.handle.length >= 4) {
          entry.handle = function (error, req, res, next) {
            return Promise.asyncApply(
              wrappedHandler,
              this,
              arguments,
              true
            );
          };
        } else {
          entry.handle = function (req, res, next) {
            return Promise.asyncApply(
              wrappedHandler,
              this,
              arguments,
              true
            );
          };
        }
      });
    }
    app.use = function (...args) {
      args[args.length - 1] = wrapHandler(args[args.length - 1]);
      return oldUse.apply(app, args);
    };
  }

  wrapConnect(WebApp.rawConnectHandlers, false);
  wrapConnect(WebAppInternals.meteorInternalHandlers, false);

  // The oauth package and other core packages might have already added their middleware,
  // so we need to wrap the existing middleware
  wrapConnect(WebApp.connectHandlers, true);

  wrapConnect(WebApp.connectApp, false);

  let oldStaticFilesMiddleware = WebAppInternals.staticFilesMiddleware;
  const staticHandler = wrapHandler(oldStaticFilesMiddleware.bind(WebAppInternals, WebAppInternals.staticFilesByArch));
  WebAppInternals.staticFilesMiddleware = function (_staticFiles, req, res, next) {
    if (req.__kadiraInfo) {
      req.__kadiraInfo.isStatic = true;
    }

    return staticHandler(req, res, function () {
      // if the request is for a static file, the static handler will end the response
      // instead of calling next
      req.__kadiraInfo.isStatic = false;
      return next.apply(this, arguments);
    });
  };
}
