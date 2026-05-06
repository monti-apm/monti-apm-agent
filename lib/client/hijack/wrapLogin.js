import { Ntp } from '../../ntp';
import { Tracker } from 'meteor/tracker';

let tracking = true;
export function wrapLogin () {
  if (Package['accounts-base']) {
    Kadira.webVitals.pendingObjects += 1;
    Tracker.autorun((computation) => {
      const isLogingIn = Meteor.loggingIn();
      if (isLogingIn && !Kadira.webVitals.loginStart) {
        Kadira.webVitals.loginStart = Ntp._now();
        computation.stop();
      }
    });

    Package['accounts-base'].Accounts.onLogin(() => {
      if (!tracking) {
        return;
      }
      Kadira.webVitals.completedObjects += 1;
      Kadira.webVitals.loginEnd = Ntp._now();
      tracking = false;
    });
  }
}
