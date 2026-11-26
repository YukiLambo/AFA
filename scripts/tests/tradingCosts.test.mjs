// node scripts/tests/tradingCosts.test.mjs — checks the HK/US trading-cost rules
import assert from 'node:assert/strict';
import { tradeCost, hkTick, roundTripPct } from '../../src/lib/tradingCosts.js';

// HK buy of 100 shares at HK$400 = HK$40,000
const hk = tradeCost({ market: 'HK', side: 'buy', price: 400, shares: 100 });
assert.equal(hk.lines.find(l => l[0].startsWith('Stamp'))[1], 40);          // 0.1%, rounded up to HK$1
assert.equal(hk.lines.find(l => l[0] === 'Settlement')[1], 2);              // HK$2 minimum
assert.equal(hk.halfSpread, 0.1);                                            // tick 0.2 at HK$200–500
assert.equal(Math.ceil(40001 * 0.001), 41);                                  // rounding rule sanity
// Warrants and CBBCs pay no stamp duty
assert.ok(!tradeCost({ market: 'HK', side: 'buy', price: 0.3, shares: 10000, stampExempt: true }).lines.some(l => l[0].startsWith('Stamp')));
// HK tick table edges
assert.equal(hkTick(9.99), 0.01); assert.equal(hkTick(10), 0.02); assert.equal(hkTick(600), 0.5);
// US: no stamp duty, SEC and FINRA fees only on sells
assert.equal(tradeCost({ market: 'US', side: 'buy', price: 200, shares: 50 }).fees, 0);
assert.ok(tradeCost({ market: 'US', side: 'sell', price: 200, shares: 50 }).fees > 0);
// A HK round trip costs at least the 0.2% stamp duty
assert.ok(roundTripPct('HK', 400) > 0.002 && roundTripPct('HK', 400) < 0.005);
console.log('tradingCosts.test: all checks passed');
