export function wrapRouters () {
  let connectRoutes = [];
  try {
    // eslint-disable-next-line global-require
    connectRoutes.push(require('connect-route'));
  } catch (e) {
    // We can ignore errors
  }

  connectRoutes.forEach(connectRoute => {
    if (typeof connectRoute !== 'function') {
      return;
    }

    connectRoute((router) => {
      const oldAdd = router.constructor.prototype.add;
      router.constructor.prototype.add = function (method, route, handler) {
        // Unlike most routers, connect-route doesn't look at the arguments length
        oldAdd.call(this, method, route, function () {
          if (arguments[0] && arguments[0].__kadiraInfo) {
            arguments[0].__kadiraInfo.suggestedRouteName = route;
          }

          handler(...arguments);
        });
      };
    });
  });
}
