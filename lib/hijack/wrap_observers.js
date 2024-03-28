import { _ } from 'meteor/underscore';

export function wrapOplogObserveDriver (proto) {
  // Track the polled documents. This is reflected to the RAM size and
  // for the CPU usage directly
  let originalPublishNewResults = proto._publishNewResults;
  proto._publishNewResults = function (newResults, newBuffer) {
    let coll = this._cursorDescription.collectionName;
    let query = this._cursorDescription.selector;
    let opts = this._cursorDescription.options;
    const docSize = Kadira.docSzCache.getSize(coll, query, opts, newBuffer);
    let count = newResults.size() + newBuffer.size();
    if (this._ownerInfo) {
      Kadira.models.pubsub.trackPolledDocuments(this._ownerInfo, count);
      Kadira.models.pubsub.trackDocSize(this._ownerInfo.name, 'polledFetches', docSize * count);
    } else {
      this._polledDocuments = count;
      this._docSize = {
        polledFetches: docSize * count
      };
    }
    return originalPublishNewResults.call(this, newResults, newBuffer);
  };

  let originalHandleOplogEntryQuerying = proto._handleOplogEntryQuerying;
  proto._handleOplogEntryQuerying = function (op) {
    Kadira.models.pubsub.trackDocumentChanges(this._ownerInfo, op);
    return originalHandleOplogEntryQuerying.call(this, op);
  };

  let originalHandleOplogEntrySteadyOrFetching = proto._handleOplogEntrySteadyOrFetching;
  proto._handleOplogEntrySteadyOrFetching = function (op) {
    Kadira.models.pubsub.trackDocumentChanges(this._ownerInfo, op);
    return originalHandleOplogEntrySteadyOrFetching.call(this, op);
  };

  // track live updates
  ['_addPublished', '_removePublished', '_changePublished'].forEach(function (fnName) {
    let originalFn = proto[fnName];
    proto[fnName] = function (a, b, c) {
      if (this._ownerInfo) {
        Kadira.models.pubsub.trackLiveUpdates(this._ownerInfo, fnName, 1);

        if (fnName === '_addPublished') {
          const coll = this._cursorDescription.collectionName;
          const query = this._cursorDescription.selector;
          const opts = this._cursorDescription.options;
          const docSize = Kadira.docSzCache.getSize(coll, query, opts, [b]);

          Kadira.models.pubsub.trackDocSize(this._ownerInfo.name, 'liveFetches', docSize);
        }
      } else {
        // If there is no ownerInfo, that means this is the initial adds
        if (!this._liveUpdatesCounts) {
          this._liveUpdatesCounts = {
            _initialAdds: 0
          };
        }

        this._liveUpdatesCounts._initialAdds++;

        if (fnName === '_addPublished') {
          if (!this._docSize) {
            this._docSize = {
              initialFetches: 0
            };
          }

          if (!this._docSize.initialFetches) {
            this._docSize.initialFetches = 0;
          }

          const coll = this._cursorDescription.collectionName;
          const query = this._cursorDescription.selector;
          const opts = this._cursorDescription.options;
          const docSize = Kadira.docSzCache.getSize(coll, query, opts, [b]);

          this._docSize.initialFetches += docSize;
        }
      }

      return originalFn.call(this, a, b, c);
    };
  });

  let originalStop = proto.stop;
  proto.stop = function () {
    if (this._ownerInfo && this._ownerInfo.type === 'sub') {
      Kadira.EventBus.emit('pubsub', 'observerDeleted', this._ownerInfo);
      Kadira.models.pubsub.trackDeletedObserver(this._ownerInfo);
    }

    return originalStop.call(this);
  };
}

export function wrapPollingObserveDriver (proto) {
  let originalPollMongo = proto._pollMongo;
  proto._pollMongo = function () {
    originalPollMongo.call(this);

    // Current result is stored in the following variable.
    // So, we can use that
    // Sometimes, it's possible to get size as undefined.
    // May be something with different version. We don't need to worry about
    // this now
    let count = 0;
    let docSize = 0;

    if (this._results && this._results.size) {
      count = this._results.size() || 0;

      let coll = this._cursorDescription.collectionName;
      let query = this._cursorDescription.selector;
      let opts = this._cursorDescription.options;

      docSize = Kadira.docSzCache.getSize(coll, query, opts, this._results._map) * count;
    }

    if (this._ownerInfo) {
      Kadira.models.pubsub.trackPolledDocuments(this._ownerInfo, count);
      Kadira.models.pubsub.trackDocSize(this._ownerInfo.name, 'polledFetches', docSize);
    } else {
      this._polledDocuments = count;
      this._polledDocSize = docSize;
    }
  };

  let originalStop = proto.stop;
  proto.stop = function () {
    if (this._ownerInfo && this._ownerInfo.type === 'sub') {
      Kadira.EventBus.emit('pubsub', 'observerDeleted', this._ownerInfo);
      Kadira.models.pubsub.trackDeletedObserver(this._ownerInfo);
    }

    return originalStop.call(this);
  };
}

export function wrapMultiplexer (proto) {
  let originalInitalAdd = proto.addHandleAndSendInitialAdds;
  proto.addHandleAndSendInitialAdds = function (handle) {
    if (!this._firstInitialAddTime) {
      this._firstInitialAddTime = Date.now();
    }

    handle._wasMultiplexerReady = this._ready();
    handle._queueLength = this._queue._taskHandles.length;

    if (!handle._wasMultiplexerReady) {
      handle._elapsedPollingTime = Date.now() - this._firstInitialAddTime;
    }
    return originalInitalAdd.call(this, handle);
  };
}

export function wrapForCountingObservers () {
  // to count observers
  let mongoConnectionProto = MeteorX.MongoConnection.prototype;
  let originalObserveChanges = mongoConnectionProto._observeChanges;

  mongoConnectionProto._observeChanges = function (cursorDescription, ordered, callbacks) {
    let ret = originalObserveChanges.call(this, cursorDescription, ordered, callbacks);
    // get the Kadira Info via the Meteor.EnvironmentalVariable
    let kadiraInfo = Kadira._getInfo(null, true);

    if (kadiraInfo && ret._multiplexer) {
      if (!ret._multiplexer.__kadiraTracked) {
        // new multiplexer
        ret._multiplexer.__kadiraTracked = true;
        Kadira.EventBus.emit('pubsub', 'newSubHandleCreated', kadiraInfo.trace);
        Kadira.models.pubsub.incrementHandleCount(kadiraInfo.trace, false);
        if (kadiraInfo.trace.type === 'sub') {
          let ownerInfo = {
            type: kadiraInfo.trace.type,
            name: kadiraInfo.trace.name,
            startTime: new Date().getTime()
          };

          console.log('ownerInfo', ownerInfo);

          let observerDriver = ret._multiplexer._observeDriver;
          // We store counts for redis-oplog in the observableCollection instead
          let ownerStorer = observerDriver.observableCollection || observerDriver;

          ownerStorer._ownerInfo = ownerInfo;

          Kadira.EventBus.emit('pubsub', 'observerCreated', ownerInfo);
          Kadira.models.pubsub.trackCreatedObserver(ownerInfo);

          // We need to send initially polled documents if there are
          if (ownerStorer._polledDocuments) {
            Kadira.models.pubsub.trackPolledDocuments(ownerInfo, ownerStorer._polledDocuments);
            ownerStorer._polledDocuments = 0;
          }

          // We need to send initially polled documents if there are
          if (ownerStorer._polledDocSize) {
            Kadira.models.pubsub.trackDocSize(ownerInfo.name, 'polledFetches', ownerStorer._polledDocSize);
            ownerStorer._polledDocSize = 0;
          }

          // Process _liveUpdatesCounts
          _.each(ownerStorer._liveUpdatesCounts, function (count, key) {
            Kadira.models.pubsub.trackLiveUpdates(ownerInfo, key, count);
          });

          // Process docSize
          _.each(ownerStorer._docSize, function (count, key) {
            Kadira.models.pubsub.trackDocSize(ownerInfo.name, key, count);
          });
        }
      } else {
        Kadira.EventBus.emit('pubsub', 'cachedSubHandleCreated', kadiraInfo.trace);
        Kadira.models.pubsub.incrementHandleCount(kadiraInfo.trace, true);
      }
    }

    return ret;
  };
}
