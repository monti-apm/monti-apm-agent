import { Meteor } from 'meteor/meteor';
import { getBrowserInfo } from '../utils';

let originalMeteorDebug = Meteor._debug;

let lastMessageToIgnore = null;
let messagesToIgnore = 0;

// Sometimes one of the other error reporter tracks an error, but Meteor also
// sends the details to Meteor._debug. In some places, Meteor splits the
// information across multiple Meteor._debug calls.
//
// Does not report Meteor._debug errors until it sees the given message
// or it has ignored maxMessages.
Kadira._ignoreDebugMessagesUntil = function (message, maxMessages) {
  lastMessageToIgnore = message;
  messagesToIgnore = maxMessages;
};

Meteor._debug = function (m, s) {
  // We need to assign variables like this. Otherwise,
  // we can't see proper error messages.
  // See: https://github.com/meteorhacks/kadira/issues/193
  let message = m;
  let stack = s;
  let args = arguments;

  function runOriginal () {
    return originalMeteorDebug.apply(Meteor, args);
  }

  // track only if error tracking is enabled
  if (!Kadira.options.enableErrorTracking) {
    return runOriginal();
  }

  // do not track if a zone is available (let zone handle the error)
  if (window.zone) {
    return runOriginal();
  }

  // Do not report messages until either we see the
  // lastMessageToIgnore or we have ignored the number of
  // messages in messagesToIgnore
  if (lastMessageToIgnore) {
    if (message === lastMessageToIgnore || messagesToIgnore === 1) {
      lastMessageToIgnore = null;
      messagesToIgnore = 0;
    } else {
      messagesToIgnore -= 1;
    }

    return runOriginal();
  }

  // We hate Meteor._debug (no single usage pattern)
  if (message instanceof Error) {
    stack = message.stack;
    message = message.message;
  } else if (typeof message === 'string' && stack === undefined) {
    stack = getStackFromMessage(message);
    message = firstLine(message);
  } else if (typeof message === 'string' && stack instanceof Error) {
    const separator = message.endsWith(':') ? '' : ':';
    message = `${message}${separator} ${stack.message}`;
    stack = getStackFromMessage(stack.stack);
  }

  // sometimes Meteor._debug is called with the stack concat to the message
  // FIXME Meteor._debug can be called in many ways
  if (message && stack === undefined) {
    stack = getStackFromMessage(message);
    message = firstLine(message);
  }

  let now = new Date().getTime();
  Kadira.errors.sendError({
    appId: Kadira.options.appId,
    name: message,
    type: 'client',
    startTime: now,
    subType: 'meteor._debug',
    info: getBrowserInfo(),
    stacks: JSON.stringify([{at: now, events: [], stack}]),
  });

  return runOriginal();
};

// Identifies lines that are a stack trace frame:
// 1. Has "at" proceeded and followed by at least one space
// 2. Or has an "@" symbol
let stackRegex = /(^.*@.*$|^\s+at\s.+$)/gm;
function getStackFromMessage (message) {
  // add empty string to add the empty line at start
  let stack = [''];
  let match;
  // eslint-disable-next-line no-cond-assign
  while (match = stackRegex.exec(message)) {
    stack.push(match[0]);
  }
  return stack.join('\n');
}

function firstLine (message) {
  return message.split('\n')[0];
}
