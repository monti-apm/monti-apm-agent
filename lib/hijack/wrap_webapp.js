import { WebApp, WebAppInternals } from 'meteor/webapp';
import { runWithALS } from '../async/als';
import { EventType } from '../constants';
import { awaitDetector } from '../async/async-hook';

// Maximum content-length size
const MAX_BODY_SIZE = 8000;
// Maximum characters for stringified body
const MAX_STRINGIFIED_BODY_SIZE = 4000;

const canWrapStaticHandler = !!WebAppInternals.staticFilesByArch;

const InfoSymbol = Symbol('MontiInfoSymbol');

/**
 * https://github.com/meteor/meteor/pull/12442
 */
export function wrapWebApp () {
  if (!canWrapStaticHandler) {
    return;
  }

  // eslint-disable-next-line global-require
  const parseUrl = require('parseurl');

  WebAppInternals.registerBoilerplateDataCallback(
    '__montiApmRouteName',
    function (request) {
      // TODO: record in trace which arch is used

      if (request[InfoSymbol]) {
        request[InfoSymbol].isAppRoute = true;
      }

      // Let WebApp know we didn't make changes
      // so it can use a cache
      return false;
    }
  );

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

  const Layer = WebApp.rawHandlers.parent._router.stack[0].constructor;

  const middleware = (req, res, next) => {
    const name = parseUrl(req).pathname;
    const trace = Kadira.tracer.start(`${req.method}-${name}`, 'http');

    const headers = Kadira.tracer._applyObjectFilters(req.headers);

    Kadira.tracer.event(trace, EventType.Start, {
      url: req.url,
      method: req.method,
      headers: JSON.stringify(headers),
    });

    req.__kadiraInfo = { trace };

    res.on('finish', () => {
      Kadira.tracer.endLastEvent(trace);

      if (req.__kadiraInfo.isStatic) {
        trace.name = `${req.method}-<static file>`;
      } else if (req.__kadiraInfo.suggestedRouteName) {
        trace.name = `${req.method}-${req.__kadiraInfo.suggestedRouteName}`;
      } else if (req.__kadiraInfo.isAppRoute) {
        trace.name = `${req.method}-<app>`;
      }

      const isJson = req.headers['content-type'] === 'application/json';
      const hasSmallBody =
        req.headers['content-length'] > 0 &&
        req.headers['content-length'] < MAX_BODY_SIZE;

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
      Kadira.tracer.event(trace, EventType.Complete);
      let built = Kadira.tracer.buildTrace(trace);
      Kadira.models.http.processRequest(built, req, res);
    });

    runWithALS(next)();
  };

  const layer = new Layer(
    '',
    {
      sensitive: false,
      strict: false,
      end: false,
    },
    middleware
  );

  // Adding the handler directly to the stack
  // to force it to be the first one to run
  WebApp.rawHandlers.parent._router.stack.unshift(layer);

  function wrapHandler (handler, possibleRouteName) {
    //  identifies error handles by them accepting
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
      if (possibleRouteName && typeof possibleRouteName === 'string') {
        req.__kadiraInfo.suggestedRouteName = possibleRouteName;
      }

      Kadira._setInfo(kadiraInfo);

      // TODO: track errors passed to next or thrown

      let potentialPromise;

      if (errorHandler) {
        potentialPromise = awaitDetector.detect(() =>
          handler.call(this, error, req, res, next)
        );
      } else {
        potentialPromise = awaitDetector.detect(() =>
          handler.call(this, req, res, next)
        );
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

  function wrapExpress (app, wrapStack) {
    let oldUse = app.use;
    if (wrapStack) {
      app.parent._router.stack.forEach((entry) => {
        let wrappedHandler = wrapHandler(entry.handle);
        if (entry.handle.length >= 4) {
          // eslint-disable-next-line no-unused-vars,handle-callback-err
          entry.handle = function (error, req, res, next) {
            return wrappedHandler.apply(this, arguments);
          };
        } else {
          // eslint-disable-next-line no-unused-vars
          entry.handle = function (req, res, next) {
            return wrappedHandler.apply(this, arguments);
          };
        }
      });
    }
    app.use = function (...args) {
      const possibleRouteName = args[0];
      args[args.length - 1] = wrapHandler(
        args[args.length - 1],
        possibleRouteName
      );
      return oldUse.apply(app, args);
    };
  }

  wrapExpress(WebApp.rawHandlers, false);
  wrapExpress(WebAppInternals.meteorInternalHandlers, false);

  // The oauth package and other core packages might have already added their middleware,
  // so we need to wrap the existing middleware
  wrapExpress(WebApp.handlers, true);

  wrapExpress(WebApp.expressApp, false);

  let oldStaticFilesMiddleware = WebAppInternals.staticFilesMiddleware;
  const staticHandler = wrapHandler(
    oldStaticFilesMiddleware.bind(
      WebAppInternals,
      WebAppInternals.staticFilesByArch
    )
  );
  WebAppInternals.staticFilesMiddleware = function (
    _staticFiles,
    req,
    res,
    next
  ) {
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
