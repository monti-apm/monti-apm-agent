import { Ntp } from '../../ntp';

let tracking = true;
export function wrapLogin () {
  if (Package['accounts-base']) {
    Kadira.webVitals.pendingObjects += 1;
    Package['accounts-base'].Accounts.onLogin(() => {
      if (!tracking) {
        return;
      }
      Kadira.webVitals.completedObjects += 1;
      Kadira.webVitals.loggedIn = Ntp._now();
    });
  }
}
export function unWrapLogin () {
  tracking = false;
}
