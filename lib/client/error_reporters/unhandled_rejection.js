/* global window */

import { getBrowserInfo } from '../utils';
import { getLocalTime } from '../../common/utils';

window.addEventListener('unhandledrejection', function (e) {
  if (!Kadira.options.enableErrorTracking) {
    return;
  }

  let message = e.reason;
  let stack = '';

  if (typeof message === 'object' && message !== null) {
    stack = message.stack;
    message = message.message;
  }

  const now = getLocalTime();

  Kadira.errors.sendError({
    appId: Kadira.options.appId,
    name: message,
    type: 'client',
    startTime: now,
    subType: 'window.onunhandledrejection',
    info: getBrowserInfo(),
    _internalDetails: {
      origError: {
        reason: e.reason,
      }
    },
    stacks: JSON.stringify([{ at: now, events: [], stack }])
  });
});
