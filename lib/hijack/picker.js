import Fiber from "fibers";

export function wrapPicker () {
  Meteor.startup(() => {
    if (!Package['meteorhacks:picker']) {
      return;
    }

    const Picker = Package['meteorhacks:picker'].Picker;

    // Wrap Picker._processRoute to make sure it runs the
    // handler in a Fiber with __kadiraInfo set
    const origProcessRoute = Picker.constructor.prototype._processRoute;
    Picker.constructor.prototype._processRoute = function (callback, params, req) {
      const args = arguments;

      if (!Fiber.current) {
        return new Fiber(() => {
          Kadira._setInfo(req.__kadiraInfo)
          return origProcessRoute.apply(this, args);
        }).run();
      }
      
      if (req.__kadiraInfo) {
        Kadira._setInfo(req.__kadiraInfo);
      }

      return origProcessRoute.apply(this, args);
    };
  });
}
