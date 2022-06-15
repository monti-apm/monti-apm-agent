/* global window */

import { getBrowserInfo } from '../utils';
import { getLocalTime } from '../../common/utils';

let prevWindowOnError = window.onerror || Function.prototype;

function handleOnError (message, url, line, col, error) {
  // track only if error tracking is enabled
  if (!Kadira.options.enableErrorTracking) {
    return prevWindowOnError(message, url, line, col, error);
  }

  url = url || '<anonymous>';
  line = line || 0;
  col = col || 0;

  let stack;
  if (error) {
    stack = error.stack;
  } else {
    stack = `Error:\n    at window.onerror (${url}:${line}:${col})`;
  }

  const now = getLocalTime();

  Kadira.errors.sendError({
    appId: Kadira.options.appId,
    name: message,
    type: 'client',
    startTime: now,
    subType: 'window.onerror',
    info: getBrowserInfo(),
    _internalDetails: {
      origError: {
        message,
        url,
        line,
        col,
        error
      }
    },
    stacks: JSON.stringify([{ at: now, events: [], stack }]),
  });

  return prevWindowOnError(message, url, line, col, error);
}

Kadira._setupOnErrorReporter = function setupOnError () {
  if (window.onerror !== handleOnError) {
    prevWindowOnError = window.onerror || prevWindowOnError;

    window.onerror = handleOnError;
  }
};

Kadira._setupOnErrorReporter();
