/* eslint-disable camelcase */

import { DDPServer } from 'meteor/ddp-server';

export function setLabels () {
  // name Session.prototype.send
  let originalSend = MeteorX.Session.prototype.send;
  MeteorX.Session.prototype.send = function kadira_Session_send (msg) {
    return originalSend.call(this, msg);
  };

  // name Multiplexer initial adds
  // Multiplexer is undefined in rocket chat
  if (MeteorX.Multiplexer) {
    let originalSendAdds = MeteorX.Multiplexer.prototype._sendAdds;
    MeteorX.Multiplexer.prototype._sendAdds = function kadira_Multiplexer_sendAdds (handle) {
      return originalSendAdds.call(this, handle);
    };
  }

  // name MongoConnection insert
  let originalMongoInsert = MeteorX.MongoConnection.prototype._insert;
  MeteorX.MongoConnection.prototype._insert = function kadira_MongoConnection_insert (coll, doc, cb) {
    return originalMongoInsert.call(this, coll, doc, cb);
  };

  // name MongoConnection update
  let originalMongoUpdate = MeteorX.MongoConnection.prototype._update;
  MeteorX.MongoConnection.prototype._update = function kadira_MongoConnection_update (coll, selector, mod, options, cb) {
    return originalMongoUpdate.call(this, coll, selector, mod, options, cb);
  };

  // name MongoConnection remove
  let originalMongoRemove = MeteorX.MongoConnection.prototype._remove;
  MeteorX.MongoConnection.prototype._remove = function kadira_MongoConnection_remove (coll, selector, cb) {
    return originalMongoRemove.call(this, coll, selector, cb);
  };

  // name Pubsub added
  let originalPubsubAdded = MeteorX.Session.prototype.sendAdded;
  MeteorX.Session.prototype.sendAdded = function kadira_Session_sendAdded (coll, id, fields) {
    return originalPubsubAdded.call(this, coll, id, fields);
  };

  // name Pubsub changed
  let originalPubsubChanged = MeteorX.Session.prototype.sendChanged;
  MeteorX.Session.prototype.sendChanged = function kadira_Session_sendChanged (coll, id, fields) {
    return originalPubsubChanged.call(this, coll, id, fields);
  };

  // name Pubsub removed
  let originalPubsubRemoved = MeteorX.Session.prototype.sendRemoved;
  MeteorX.Session.prototype.sendRemoved = function kadira_Session_sendRemoved (coll, id) {
    return originalPubsubRemoved.call(this, coll, id);
  };

  // name MongoCursor forEach
  let originalCursorForEach = MeteorX.MongoCursor.prototype.forEach;
  MeteorX.MongoCursor.prototype.forEach = function kadira_Cursor_forEach () {
    return originalCursorForEach.apply(this, arguments);
  };

  // name MongoCursor map
  let originalCursorMap = MeteorX.MongoCursor.prototype.map;
  MeteorX.MongoCursor.prototype.map = function kadira_Cursor_map () {
    return originalCursorMap.apply(this, arguments);
  };

  // name MongoCursor fetch
  let originalCursorFetch = MeteorX.MongoCursor.prototype.fetch;
  MeteorX.MongoCursor.prototype.fetch = function kadira_Cursor_fetch () {
    return originalCursorFetch.apply(this, arguments);
  };

  // name MongoCursor count
  let originalCursorCount = MeteorX.MongoCursor.prototype.count;
  MeteorX.MongoCursor.prototype.count = function kadira_Cursor_count () {
    return originalCursorCount.apply(this, arguments);
  };

  // name MongoCursor observeChanges
  let originalCursorObserveChanges = MeteorX.MongoCursor.prototype.observeChanges;
  MeteorX.MongoCursor.prototype.observeChanges = function kadira_Cursor_observeChanges () {
    return originalCursorObserveChanges.apply(this, arguments);
  };

  // name MongoCursor observe
  let originalCursorObserve = MeteorX.MongoCursor.prototype.observe;
  MeteorX.MongoCursor.prototype.observe = function kadira_Cursor_observe () {
    return originalCursorObserve.apply(this, arguments);
  };

  // name CrossBar listen
  let originalCrossbarListen = DDPServer._Crossbar.prototype.listen;
  DDPServer._Crossbar.prototype.listen = function kadira_Crossbar_listen (trigger, callback) {
    return originalCrossbarListen.call(this, trigger, callback);
  };

  // name CrossBar fire
  let originalCrossbarFire = DDPServer._Crossbar.prototype.fire;
  DDPServer._Crossbar.prototype.fire = function kadira_Crossbar_fire (notification) {
    return originalCrossbarFire.call(this, notification);
  };
}
