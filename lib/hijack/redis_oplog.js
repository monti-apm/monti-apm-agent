import { Random } from 'meteor/random';

export function getDummyCollectionName () {
  const collection = new Meteor.Collection(`__dummy_coll_${Random.id()}`);
  const handler = collection.find({}).observeChanges({ added: Function.prototype });
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

let WrappedSymbol = Symbol('MontiCompareWithWrapped');
let InfoSymbol = Symbol('MontiCompareWithInfo');
export function rewriteReloadRequeryFuncs (observableCollection) {
  if (observableCollection._ownerInfo) {
    observableCollection.store[InfoSymbol] = observableCollection._ownerInfo;
  }

  if (observableCollection.store.constructor[WrappedSymbol]) {
    return;
  }

  observableCollection.store.constructor[WrappedSymbol] = true;

  // handle reload/requery cases
  const originalCompareWith = observableCollection.store.constructor.prototype.compareWith;

  observableCollection.store.constructor.prototype.compareWith = function (other) {
    Kadira.models.pubsub.trackPolledDocuments(this[InfoSymbol], other.size());

    return originalCompareWith.apply(this, arguments);
  };
}

export function wrapRedisOplogObserveDriver (driver) {
  const collectionName = getDummyCollectionName();

  const dummyDriver = new driver({
    cursorDescription: {
      collectionName,
      selector: {},
      options: {}
    },
    multiplexer: { ready () {} },
    matcher: { combineIntoProjection: () => ({}) },
  });

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
    if (this._ownerInfo) {
      Kadira.models.pubsub.trackLiveUpdates(this._ownerInfo, '_changePublished', 1);
    }
    originalChange.call(this, doc, modifiedFields);
  };

  observableCollectionProto.remove = function (docId) {
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
