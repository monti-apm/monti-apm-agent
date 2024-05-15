import { Random } from 'meteor/random';

export async function getDummyCollectionName () {
  const collection = new Meteor.Collection(`__dummy_coll_${Random.id()}`);
  const handler = await collection.find({}).observeChanges({ added: Function.prototype });
  handler.stop();
  return collection._name;
}
function protectAgainstRaceConditions (collection) {
  if (!collection._redisOplog) {
    return true;
  }

  return (
    collection._redisOplog &&
      collection._redisOplog.protectAgainstRaceConditions
  );
}

function rewriteReloadRequeryFuncs () {
  // handle reload/requery cases
  const originalCompareWith = this.store.constructor.prototype.compareWith;
  this.store.constructor.prototype.compareWith = (other, callbacks) => {
    Kadira.models.pubsub.trackPolledDocuments(this._ownerInfo, other.size());

    return originalCompareWith.call(this.store, other, callbacks);
  };
}

export async function wrapRedisOplogObserveDriver (driver) {
  const collectionName = await getDummyCollectionName();

  const dummyDriver = new driver({
    cursorDescription: {
      collectionName,
      selector: {},
      options: {}
    },
    multiplexer: { ready () {} },
    matcher: { combineIntoProjection: () => ({}) },
  });
  await dummyDriver.init();

  const observableCollectionProto = dummyDriver.observableCollection.constructor.prototype;
  const redisSubscriberProto = dummyDriver.redisSubscriber.constructor.prototype;

  let originalAdd = observableCollectionProto.add;
  let originalChange = observableCollectionProto.change;
  let originalRemove = observableCollectionProto.remove;

  // Track the polled documents. This is reflect to the RAM size and
  // for the CPU usage directly


  // According to the comments in redis-oplog, the "safe" param means that the document is "cleaned".
  // it is set to true in the initial add and synthetic mutations
  observableCollectionProto.add = function (doc, safe) {
    // handle reload/requery cases
    rewriteReloadRequeryFuncs.call(this);
    let coll = this.cursorDescription.collectionName;
    let query = this.cursorDescription.selector;
    let opts = this.cursorDescription.options;
    let docSize = Kadira.docSzCache.getSize(coll, query, opts, [doc]);
    if (this._ownerInfo) {
      Kadira.models.pubsub.trackLiveUpdates(this._ownerInfo, '_addPublished', 1);
      Kadira.models.pubsub.trackDocSize(this._ownerInfo.name, 'liveFetches', docSize);
    } else {
      // If there is no ownerInfo, that means this is the initial adds
      // Also means it is not coming from a subscription
      if (!this._liveUpdatesCounts) {
        this._liveUpdatesCounts = {
          _initialAdds: 0
        };
      }

      this._liveUpdatesCounts._initialAdds++;

      if (this._polledDocuments) {
        this._polledDocuments += 1;
      } else {
        this._polledDocuments = 1;
      }

      if (this._docSize) {
        this._docSize.polledFetches += docSize;
      } else {
        this._docSize = {
          polledFetches: docSize,
          initialFetches: 0
        };
      }

      this._docSize.initialFetches += docSize;
    }

    return originalAdd.call(this, doc, safe);
  };

  observableCollectionProto.change = function (doc, modifiedFields) {
    // handle reload/requery cases
    rewriteReloadRequeryFuncs.call(this);

    if (this._ownerInfo) {
      Kadira.models.pubsub.trackLiveUpdates(this._ownerInfo, '_changePublished', 1);
    }
    originalChange.call(this, doc, modifiedFields);
  };

  observableCollectionProto.remove = function (docId) {
    // handle reload/requery cases
    rewriteReloadRequeryFuncs.call(this);

    if (this._ownerInfo) {
      Kadira.models.pubsub.trackLiveUpdates(this._ownerInfo, '_removePublished', 1);
    }
    originalRemove.call(this, docId);
  };

  // Redis and oplog don't have the same op constants
  const redisEventToOplogMap = {
    i: 'i',
    u: 'u',
    r: 'd',
  };

  const originalRedisProcess = redisSubscriberProto.process;

  redisSubscriberProto.process = function (op, doc, fields) {
    Kadira.models.pubsub.trackDocumentChanges(this.observableCollection._ownerInfo, {
      op: redisEventToOplogMap[op]
    });
    const collection = this.observableCollection.collection;
    // redis-oplog always fetches the document again, except when:
    // - operator === removal
    // - there is an explicit _redisOplog config passed with collection.configureRedisOplog and that includes protectAgainstRaceConditions = false
    //            in this case there is a fetch counted in the collection level, not in the publication level as it happens while doing the insert
    if (op !== 'r' && protectAgainstRaceConditions(collection)) {
      Kadira.models.pubsub.trackPolledDocuments(this.observableCollection._ownerInfo, 1);
    }
    originalRedisProcess.call(this, op, doc, fields);
  };

  // @todo check this
  let originalStop = driver.prototype.stop;
  driver.prototype.stop = function () {
    if (this.observableCollection._ownerInfo && this.observableCollection._ownerInfo.type === 'sub') {
      Kadira.EventBus.emit('pubsub', 'observerDeleted', this.observableCollection._ownerInfo);
      Kadira.models.pubsub.trackDeletedObserver(this.observableCollection._ownerInfo);
    }

    return originalStop.call(this);
  };
}
