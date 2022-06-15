/* global Kadira */

import Fibers from 'fibers';
import { Meteor } from 'meteor/meteor';

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
    Picker.constructor.prototype._processRoute = function (callback, params, req) {
      const args = arguments;

      if (!Fibers.current) {
        return new Fibers(() => {
          Kadira._setInfo(req.__kadiraInfo);
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
