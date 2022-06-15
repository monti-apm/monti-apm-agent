let LRU = Npm.require('lru-cache');
let crypto = Npm.require('crypto');
let jsonStringify = Npm.require('json-stringify-safe');

DocSzCache = function (maxItems, maxValues) {
  this.items = new LRU({max: maxItems});
  this.maxValues = maxValues;
  this.cpuUsage = 0;
};

// This is called from SystemModel.prototype.cpuUsage and saves cpu usage.
DocSzCache.prototype.setPcpu = function (pcpu) {
  this.cpuUsage = pcpu;
};

DocSzCache.prototype.getSize = function (coll, query, opts, data) {
  // If the dataset is null or empty we can't calculate the size
  // Do not process this data and return 0 as the document size.
  if (!(data && (data.length || (typeof data.size === 'function' && data.size())))) {
    return 0;
  }

  let key = this.getKey(coll, query, opts);
  let item = this.items.get(key);

  if (!item) {
    item = new DocSzCacheItem(this.maxValues);
    this.items.set(key, item);
  }

  if (this.needsUpdate(item)) {
    let doc = {};
    if (typeof data.get === 'function') {
      // This is an IdMap
      data.forEach(function (element) {
        doc = element;
        return false; // return false to stop loop. We only need one doc.
      });
    } else {
      doc = data[0];
    }
    let size = Buffer.byteLength(jsonStringify(doc), 'utf8');
    item.addData(size);
  }

  return item.getValue();
};

DocSzCache.prototype.getKey = function (coll, query, opts) {
  return jsonStringify([coll, query, opts]);
};

// returns a score between 0 and 1 for a cache item
// this score is determined by:
//  * available cache item slots
//  * time since last updated
//  * cpu usage of the application
DocSzCache.prototype.getItemScore = function (item) {
  return [
    (item.maxValues - item.values.length) / item.maxValues,
    (Date.now() - item.updated) / 60000,
    (100 - this.cpuUsage) / 100,
  ].map(function (score) {
    return score > 1 ? 1 : score;
  }).reduce(function (total, score) {
    return (total || 0) + score;
  }) / 3;
};

DocSzCache.prototype.needsUpdate = function (item) {
  // handle newly made items
  if (!item.values.length) {
    return true;
  }

  let currentTime = Date.now();
  let timeSinceUpdate = currentTime - item.updated;
  if (timeSinceUpdate > 1000 * 60) {
    return true;
  }

  return this.getItemScore(item) > 0.5;
};


DocSzCacheItem = function (maxValues) {
  this.maxValues = maxValues;
  this.updated = 0;
  this.values = [];
};

DocSzCacheItem.prototype.addData = function (value) {
  this.values.push(value);
  this.updated = Date.now();

  if (this.values.length > this.maxValues) {
    this.values.shift();
  }
};

DocSzCacheItem.prototype.getValue = function () {
  function sortNumber (a, b) {
    return a - b;
  }
  let sorted = this.values.sort(sortNumber);
  let median = 0;

  if (sorted.length % 2 === 0) {
    var idx = sorted.length / 2;
    median = (sorted[idx] + sorted[idx - 1]) / 2;
  } else {
    var idx = Math.floor(sorted.length / 2);
    median = sorted[idx];
  }

  return median;
};
