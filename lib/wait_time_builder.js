import { _ } from 'meteor/underscore';
import { TimeoutManager } from './hijack/timeout_manager';

const WAITON_MESSAGE_FIELDS = ['msg', 'id', 'method', 'name', 'waitTime'];

// This is way how we can build waitTime and it's breakdown
export class WaitTimeBuilder {
  constructor () {
    this._waitListStore = {};
    this._currentProcessingMessages = {};
    this._messageCache = {};
  }

  register (session, msgId) {
    const mainKey = this._getMessageKey(session.id, msgId);

    let inQueue = session.inQueue || [];
    if (typeof inQueue.toArray === 'function') {
      // latest version of Meteor uses a double-ended-queue for the inQueue
      // info: https://www.npmjs.com/package/double-ended-queue
      inQueue = inQueue.toArray();
    }

    const waitList =
      inQueue.map(msg => {
        const key = this._getMessageKey(session.id, msg.id);

        return this._getCacheMessage(key, msg);
      }) || [];

    // add currently processing ddp message if exists
    const currentlyProcessingMessage =
      this._currentProcessingMessages[session.id];
    if (currentlyProcessingMessage) {
      const key = this._getMessageKey(
        session.id,
        currentlyProcessingMessage.id
      );
      waitList.unshift(this._getCacheMessage(key, currentlyProcessingMessage));
    }

    this._waitListStore[mainKey] = waitList;
  }

  build (session, msgId) {
    const mainKey = this._getMessageKey(session.id, msgId);
    const waitList = this._waitListStore[mainKey] || [];
    delete this._waitListStore[mainKey];

    const filteredWaitList = waitList.map(this._cleanCacheMessage.bind(this));

    return filteredWaitList;
  }

  _getMessageKey (sessionId, msgId) {
    return `${sessionId}::${msgId}`;
  }

  _getCacheMessage (key, msg) {
    let cachedMessage = this._messageCache[key];
    if (!cachedMessage) {
      this._messageCache[key] = cachedMessage = _.pick(
        msg,
        WAITON_MESSAGE_FIELDS
      );
      cachedMessage._key = key;
      cachedMessage._registered = 1;
    } else {
      cachedMessage._registered++;
    }

    return cachedMessage;
  }

  _cleanCacheMessage (msg) {
    msg._registered--;
    if (msg._registered == 0) {
      delete this._messageCache[msg._key];
    }

    // need to send a clean set of objects
    // otherwise register can go with this
    return _.pick(msg, WAITON_MESSAGE_FIELDS);
  }

  trackWaitTime (session, msg, unblock) {
    const started = Date.now();
    this._currentProcessingMessages[session.id] = msg;

    let unblocked = false;
    const self = this;

    const wrappedUnblock = function () {
      if (!unblocked) {
        const waitTime = Date.now() - started;
        const key = self._getMessageKey(session.id, msg.id);
        const cachedMessage = self._messageCache[key];
        if (cachedMessage) {
          cachedMessage.waitTime = waitTime;
        }
        delete self._currentProcessingMessages[session.id];
        unblocked = true;
        unblock();

        TimeoutManager.clearTimeout();
      }
    };

    return wrappedUnblock;
  }
}
