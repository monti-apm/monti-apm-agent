// lib/sketch.js must serialize exactly like monti-apm-sketches-js, which Monti's
// engine parses. Run with: npm install && npm run test:sketch
const assert = require('node:assert');
const Old = require('monti-apm-sketches-js').DDSketch;
const New = require('../lib/sketch').DDSketch;
const cases = {
  integers: Array.from({ length: 100000 }, (_, i) => i + 1),
  random: Array.from({ length: 100000 }, () => Math.random() * 60000),
  tiny: Array.from({ length: 1000 }, () => Math.random()),
  edges: [0, 0, -5, NaN, Infinity, -Infinity, 1, 1e9, 0.001, 5],
  empty: [],
};
let mism = 0;
for (const [name, vals] of Object.entries(cases)) {
  const o = new Old({ alpha: 0.02 }), n = new New({ alpha: 0.02 });
  vals.forEach((v) => { o.add(v); n.add(v); });
  const oj = JSON.parse(JSON.stringify(o)), nj = JSON.parse(JSON.stringify(n));
  const diff = Object.keys({ ...oj.bins, ...nj.bins }).filter((k) => oj.bins[k] !== nj.bins[k]);
  console.log(name.padEnd(9), 'n', oj.n, nj.n, '| bins', oj.numBins, nj.numBins, '| differing keys', diff.length, diff.slice(0, 4).map((k) => `${k}:${oj.bins[k]}/${nj.bins[k]}`).join(' '));
  for (const f of ['alpha', 'maxNumBins', 'n', 'gamma', 'numBins']) assert.strictEqual(nj[f], oj[f], `${name}.${f}`);
  assert.deepStrictEqual(Object.keys(nj).sort(), Object.keys(oj).sort());
  mism += diff.length;
}
assert.strictEqual(mism, 0, 'bins differ');
console.log('identical');
