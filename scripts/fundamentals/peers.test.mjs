// node scripts/fundamentals/peers.test.mjs — checks peer-relative valuation on made-up companies (not real data)
import assert from 'node:assert/strict';
import { peerComparison, multiplesOf } from '../../src/lib/fundamentals.js';
import { valuationModels } from '../../src/lib/indicators.js';

const mk = (symbol, industry, price, eps, book, ev, nd = 0) => ({ symbol, name: symbol, industry, sector: 'Tech', price, trailingEps: eps, bookPerShare: book, evToEbitda: ev, netDebtPerShare: nd });
const stocks = Object.fromEntries([
  mk('0001.HK', 'Soft', 100, 5, 20, 12, 10), mk('0002.HK', 'Soft', 50, 5, 10, 8), mk('0003.HK', 'Soft', 30, 2, 6, 10),
  mk('0004.HK', 'Soft', 80, 4, 16, 11), mk('0005.HK', 'Soft', 60, -1, 12, null), mk('0006.HK', 'Soft', 90, 6, 30, 9),
  mk('AAPL', 'Soft', 100, 5, 20, 12)
].map(s => [s.symbol, s]));

// Loss-makers get no P/E
assert.deepEqual(multiplesOf(stocks['0005.HK']), { pe: null, pb: 5, evEbitda: null });

const r = peerComparison(stocks['0001.HK'], stocks);
assert.equal(r.group.by, 'industry');
assert.equal(r.peers.length, 5, 'peers come from the same market only');
const by = Object.fromEntries(r.metrics.map(m => [m.key, m]));
assert.equal(by.pe.median, 15); assert.equal(by.pe.implied, 75); assert.equal(by.pe.percentile, 88);
// EBITDA/share = (100 + 10) / 12; implied = 9.5 × that − 10
assert.ok(Math.abs(by.evEbitda.implied - (9.5 * 110 / 12 - 10)) < 1e-9);
assert.equal(by.pb.median, 5); assert.equal(by.pb.percentile, 60, 'ties count half');

// Too few peers in the market → no comparison
assert.equal(peerComparison(stocks.AAPL, stocks), null);

// Peer models join the median; Graham is shown but left out
const v = valuationModels({ eps: 5, growthPct: 8, discountPct: 9, terminalPe: 16, fairPe: 17, peerModels: r.metrics.map(m => m.model) });
assert.ok(v.models.find(m => m.id === 'graham').historical);
assert.equal(v.fair, 85); // median of 85, 100.7, 75, 77.1, 100
console.log('peers.test: all checks passed');
