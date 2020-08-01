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

          return _callback.apply(this, arguments)
        }

        return origRoute.call(FastRender, path, callback)
      }
    }
  });
}
