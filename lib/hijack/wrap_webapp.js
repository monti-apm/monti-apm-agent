import { WebAppInternals, WebApp } from 'meteor/webapp';
import Fibers from 'fibers';

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

    handler(null, null, () => {})
  }

  return inFiber;
}

export async function wrapWebApp() {
  if (!checkHandlersInFiber()) {
    return;
  }

  const parseUrl = require('parseurl');

  // TODO: add this handler directly to the connect instance's stack
  // so we can make sure it is the first middleware
  WebApp.rawConnectHandlers.use((req, res, next) => {
    const name = parseUrl(req).pathname;
    const trace = Kadira.tracer.start(`${req.method}-${name}`, 'http');
    Kadira.tracer.event(trace, 'start', {
      url: req.url,
      method: req.method
    });
    req.__kadiraInfo = { trace };

    res.on('finish', () => {
      if (req.__kadiraInfo.asyncEvent) {
        Kadira.tracer.eventEnd(trace, req.__kadiraInfo.asyncEvent);
      }

      Kadira.tracer.endLastEvent(trace);

      // TODO: record response status code and body size
      Kadira.tracer.event(trace, 'complete');
      let built = Kadira.tracer.buildTrace(trace);
      Kadira.models.http.processRequest(built, req, res);
    });

    next();
  });


  function wrapHandler(handler) {
    // connect identifies error handles by them accepting
    // four arguments
    let errorHandler = handler.length === 4;

    function wrapper(req, res, next) {
      let error;
      if (errorHandler) {
        error = req;
        req = res;
        res = next;
        next = arguments[3]
      }

      const kadiraInfo = req.__kadiraInfo;
      Kadira._setInfo(kadiraInfo);

      let nextCalled = false;
      // TODO: track errors passed to next or thrown
      function wrappedNext(...args) {
        if (kadiraInfo && kadiraInfo.asyncEvent) {
          Kadira.tracer.eventEnd(req.__kadiraInfo.trace, req.__kadiraInfo.asyncEvent);
          req.__kadiraInfo.asyncEvent = null;
        }

        nextCalled = true;
        next(...args)
      }

      let potentialPromise

      if (errorHandler) {
        potentialPromise = handler(error, req, res, wrappedNext);
      } else {
        potentialPromise = handler(req, res, wrappedNext);
      }

      if (potentialPromise && typeof potentialPromise.then === 'function') {
        potentialPromise.then(() => {
          // res.finished is depreciated in Node 13, but it is the only option
          // for Node 12.9 and older.
          if (kadiraInfo && !res.finished && !nextCalled) {
            const lastEvent = Kadira.tracer.getLastEvent(kadiraInfo.trace)
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
      }
    } else {
      return function (req, res, next) {
        return wrapper(req, res, next);
      }
    }
  }

  function wrapConnect(app, wrapStack) {
    let oldUse = app.use;
    if (wrapStack) {
      // TODO: run in fiber so the kadira info on fiber can be copied
      // for the actual handler, since Meteor wraps handlers also to be in a fiber
      // app.stack.forEach(entry => {
      //   // TODO: use correct number of arguments 
      //   entry.handle = function (req, res, next) {
      //   }
      // });
    }
    app.use = function (...args) {
      args[args.length - 1] = wrapHandler(args[args.length - 1])
      oldUse.apply(app, args);
    }
  }

  wrapConnect(WebApp.rawConnectHandlers, false);

  // TODO: check how far back Meteor had these, and if it changed over time
  wrapConnect(WebAppInternals.meteorInternalHandlers, false);
  wrapConnect(WebApp.connectHandlers, false);
  wrapConnect(WebApp.connectApp, false);

  let oldStaticFilesMiddleware = WebAppInternals.staticFilesMiddleware;
  // TODO: check how far back Meteor's static files middleware works like this
  const staticHandler = wrapHandler(oldStaticFilesMiddleware.bind(WebAppInternals, WebAppInternals.staticFilesByArch));
  WebAppInternals.staticFilesMiddleware = function (_staticFiles, req, res, next) {
    return staticHandler(req, res, next);
  };
}
