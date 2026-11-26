// node scripts/fundamentals/parse.test.mjs — checks the parser on a made-up quoteSummary result (not real data)
import assert from 'node:assert/strict';
import { parseQuoteSummary } from './parse.mjs';

const v = (x) => ({ raw: x, fmt: String(x) });
const fixture = {
  price: { currency: 'HKD', regularMarketPrice: v(400), longName: 'Example Holdings' },
  financialData: { financialCurrency: 'CNY', currentPrice: v(400), freeCashflow: v(1.8e11), totalDebt: v(3e11), totalCash: v(4e11), targetMeanPrice: v(480), numberOfAnalystOpinions: v(40) },
  defaultKeyStatistics: { trailingEps: v(18), forwardEps: v(21), sharesOutstanding: v(9e9), beta: v(0.9), bookValue: v(110), priceToBook: v(3.3), enterpriseToEbitda: v(14) },
  summaryDetail: { currency: 'HKD', trailingPE: v(20.38), forwardPE: v(17.5), dividendRate: v(4.5) },
  earningsTrend: { trend: [{ period: '+1y', growth: v(0.12) }, { period: '+5y', growth: v(0.1) }] },
  assetProfile: { sector: 'Communication Services', industry: 'Internet Content & Information' }
};
const fx = (a, b) => (a === 'CNY' && b === 'HKD' ? 1.09 : null);
const r = parseQuoteSummary('0700.HK', fixture, fx);
// 400 / 20.38 = 19.63 ≈ 18 × 1.09 → EPS was in CNY and is converted
assert.equal(r.trailingEps, 19.62);
assert.equal(r.forwardEps, 22.89);
assert.equal(r.fcfPerShare, 21.8);          // 1.8e11 × 1.09 / 9e9
assert.equal(r.netDebtPerShare, -12.1111);  // (3e11 − 4e11) × 1.09 / 9e9
assert.equal(r.growth5y, 0.1);
assert.equal(r.dps, 4.5);
// Same company with EPS already in HKD: no conversion
const f2 = structuredClone(fixture); f2.defaultKeyStatistics.trailingEps = v(19.63); f2.defaultKeyStatistics.forwardEps = v(22.9);
assert.equal(parseQuoteSummary('0700.HK', f2, fx).trailingEps, 19.63);
// Missing FX rate is reported, not guessed
assert.ok(parseQuoteSummary('X', fixture, () => null).error);
console.log('parse.test: all checks passed');
