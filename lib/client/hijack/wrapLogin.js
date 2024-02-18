import { Ntp } from '../../ntp';

let tracking = true;
export function wrapLogin () {
  if (Package['accounts-base']) {
    Package['accounts-base'].Accounts.onLogin(() => {
      if (!tracking) {
        return;
      }
      Kadira.webVitals.loggedIn = Ntp._now() - Kadira.webVitals.startTime;
    });
  }
}
export function unWrapLogin () {
  tracking = false;
}
