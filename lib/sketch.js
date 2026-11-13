// DataDog's DDSketch (@datadog/sketches-js) behind the API and JSON of the
// monti-apm-sketches-js it replaces. Monti's engine parses the sketches sent in
// each payload as {alpha, bins: {key: count}, maxNumBins, n, gamma, numBins},
// so toJSON keeps that shape. The keys match: both libraries use
// key = ceil(ln(x) / ln(gamma)) with gamma = (1 + alpha) / (1 - alpha).
const { DDSketch: DatadogSketch } = require('@datadog/sketches-js');

const MAX_NUM_BINS = 2048;

class DDSketch {
  constructor ({ alpha }) {
    this.alpha = alpha;
    this.gamma = (1 + alpha) / (1 - alpha);
    this.n = 0;
    this.sketch = new DatadogSketch({ relativeAccuracy: alpha });
    // Values DataDog keeps outside its key range, under the key the old
    // library gave them: 0 -> "-Infinity", Infinity -> "Infinity",
    // negatives and NaN -> "NaN".
    this.otherBins = {};
  }

  add (value) {
    this.n++;
    if (value > 0 && value !== Infinity) {
      this.sketch.accept(value);
    } else {
      const key = Math.ceil(Math.log10(value) / Math.log10(this.gamma));
      this.otherBins[key] = (this.otherBins[key] || 0) + 1;
    }
  }

  // No bin collapsing. The old library collapsed past 2048 bins, which
  // at alpha 0.02 means values spanning a ratio of e^81; timings never get there.
  toJSON () {
    const bins = { ...this.otherBins };
    const { store } = this.sketch;
    store.bins.forEach((count, i) => {
      if (count > 0) {
        bins[i + store.offset] = count;
      }
    });

    return {
      alpha: this.alpha,
      bins,
      maxNumBins: MAX_NUM_BINS,
      n: this.n,
      gamma: this.gamma,
      numBins: Object.keys(bins).length,
    };
  }
}

module.exports = { DDSketch };
