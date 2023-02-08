import { Meteor } from 'meteor/meteor';
import { runWithALS } from '../als';

export function wrapPicker () {
  Meteor.startup(() => {
    if (!Package['meteorhacks:picker']) {
      return;
    }

    const Picker = Package['meteorhacks:picker'].Picker;

    // Wrap Picker._processRoute to make sure it runs the
    // handler in a Fiber with __kadiraInfo set
    // Needed if any previous middleware called `next` outside of a fiber.
    const origProcessRoute = Picker.constructor.prototype._processRoute;
    Picker.constructor.prototype._processRoute = runWithALS(function (callback, params, req) {
      const args = arguments;

      if (req.__kadiraInfo) {
        Kadira._setInfo(req.__kadiraInfo);
      }

      return origProcessRoute.apply(this, args);
    });
  });
}
