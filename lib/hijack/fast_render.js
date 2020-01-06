const Fibers = require('fibers');

export function wrapFastRender () {
  Meteor.startup(() => {
    if (Package['staringatlights:fast-render']) {
      const FastRender = Package['staringatlights:fast-render'].FastRender;
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
