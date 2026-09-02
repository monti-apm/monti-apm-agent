import { DDPCommon } from 'meteor/ddp-common';

let currentSub = null;
const messageAttributions = new WeakMap();

const IGNORED = Object.freeze({ type: 'ignored' });
const UNATTRIBUTED = Object.freeze({ type: 'unattributed' });

/**
 * With connection resumption in Meteor 3.3, this gets more complicated.
 * If a connection is temporarily disconnected, the messages are queued. By the
 * time they are stringified, we no longer have the context we need to track it.
 * 
 * If we know a message will be queued, we save the attribution when it is
 * originally sent, and use it here. If a message isn't queued, it's faster
 * to just calculate the attribution here.
 */
export function wrapStringifyDDP () {
  let originalStringifyDDP = DDPCommon.stringifyDDP;

  DDPCommon.stringifyDDP = function (msg) {
    let msgString = originalStringifyDDP.call(this, msg);
    let msgSize = Buffer.byteLength(msgString, 'utf8');
    let attribution = getMessageAttribution(msg);

    if (attribution.type === 'method') {
      Kadira.models.methods.trackMsgSize(attribution.name, msgSize);
    } else if (attribution.type === 'publication') {
      Kadira.models.pubsub.trackMsgSize(attribution.name, attribution.phase, msgSize);
    } else if (attribution.type === 'unattributed') {
      Kadira.models.methods.trackMsgSize('<not-a-method-or-a-pub>', msgSize);
    }

    return msgString;
  };
}

// Synchronously tracks current sub, to attribute ddp message to sub
export function withCurrentSub (fn) {
  return function (...args) {
    let previousSub = currentSub;
    currentSub = this;

    try {
      return fn.apply(this, args);
    } finally {
      currentSub = previousSub;
    }
  };
}

export function prepareMessageAttribution (msg, isQueueing) {
  if (msg === null || typeof msg !== 'object') {
    return false;
  }

  let wasQueued = messageAttributions.has(msg);

  if (isQueueing && !wasQueued) {
    messageAttributions.set(msg, createMessageAttribution(msg));
  }

  return wasQueued;
}

function createMessageAttribution (msg) {
  if (msg?.msg === 'ready') {
    return IGNORED;
  }

  let kadiraInfo = Kadira._getInfo();

  if (kadiraInfo?.trace?.type === 'method') {
    return {
      type: 'method',
      name: kadiraInfo.trace.name,
    };
  }

  if (currentSub) {
    return {
      type: 'publication',
      name: currentSub._name,
      phase: currentSub._initialSentFinished ? 'liveSent' : 'initialSent',
    };
  }

  return UNATTRIBUTED;
}

function getMessageAttribution (msg) {
  if (msg !== null && typeof msg === 'object' && messageAttributions.has(msg)) {
    return messageAttributions.get(msg);
  }

  return createMessageAttribution(msg);
}
