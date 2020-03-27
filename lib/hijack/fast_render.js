const Fibers = require('fibers');

export function wrapFastRender () {
  Meteor.startup(() => {
    if (Package['staringatlights:fast-render']) {
      const FastRender = Package['staringatlights:fast-render'].FastRender;

      // Flow Router doesn't call FastRender.route until after all
      // Meteor.startup callbacks finish
      let origRoute = FastRender.route
      FastRender.route = function (path, _callback) {
        let callback = function () {
          const info = Kadira._getInfo()
          if (info) {
            info.suggestedRouteName = path
          }

          return _callback.call(this, arguments)
        }

        return origRoute.call(FastRender, path, callback)
      }

      let origProcessAllRoutes = FastRender._processAllRoutes;

      // FastRender._processAllRoutes creates a new fiber so
      // we lose access to the kadiraInfo.
      // We wrap Fibers.run once to copy over
      // __kadiraInfo the next time it is run
      FastRender._processAllRoutes = function (req, callback) {
        var originalRun = Fibers.prototype.run;

        Fibers.prototype.run = function (val) {
          this.__kadiraInfo = Fibers.current.__kadiraInfo;
          Fibers.prototype.run = originalRun;

          return originalRun.call(this, val);
        };

        return origProcessAllRoutes.call(this, req, callback);
      }
    }
  });
}
