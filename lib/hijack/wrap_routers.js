import Fibers from 'fibers';

export function wrapRouters () {
  let connectRoute
  try {
    connectRoute = require('connect-route');
  } catch (e) {
    // We can ignore errors
    return
  }

  if (connectRoute && typeof connectRoute === 'function') {
    connectRoute((router) => {
      const oldAdd = router.constructor.prototype.add;
      router.constructor.prototype.add = function (method, route, handler) {
        // Unlike most routers, connect-route doesn't look at the arguments length
        oldAdd.call(this, method, route, function () {
          if (Fibers.current && Fibers.current.__kadiraInfo) {
            Fibers.current.__kadiraInfo.suggestedRouteName = route;
          }

          handler.apply(null, arguments)
        });
      }
    });
  }
}
