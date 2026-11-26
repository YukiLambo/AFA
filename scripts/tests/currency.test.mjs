// node scripts/tests/currency.test.mjs — checks money formatting, FX conversion and the HK$ -> home scaling
import assert from 'node:assert/strict';
import { convert, formatMoney, makeMoney, niceAmount, FALLBACK_RATES } from '../../src/lib/currency.js';

const rates = { ...FALLBACK_RATES, USD: 1, HKD: 7.8, EUR: 0.9, JPY: 150 };

// Conversion goes through USD and is symmetric
assert.equal(convert(78, 'HKD', 'USD', rates), 10);
assert.equal(convert(10, 'USD', 'HKD', rates), 78);
assert.ok(Math.abs(convert(convert(123.45, 'EUR', 'JPY', rates), 'JPY', 'EUR', rates) - 123.45) < 1e-9);
assert.equal(convert(50, 'GBP', 'GBP', rates), 50);
assert.equal(convert(50, 'XXX', 'USD', rates), 50); // unknown code: left unchanged rather than guessed

// Formatting: symbol, grouping, minus sign, currency-specific decimals, compact axis labels
assert.equal(formatMoney(1234.5, 'HKD'), 'HK$1,234.50');
assert.equal(formatMoney(-12, 'EUR', { dp: 0 }), '−€12');
assert.equal(formatMoney(5, 'USD', { signed: true }), '+$5.00');
assert.equal(formatMoney(1500, 'JPY'), '¥1,500');
assert.equal(formatMoney(3400, 'USD', { compact: true }), '$3.4k');
assert.equal(formatMoney(2_500_000, 'GBP', { compact: true }), '£2.5M');

// Helpers bound to a home currency
const usd = makeMoney('USD', rates);
assert.equal(usd.toHome(78, 'HKD'), 10);
assert.equal(usd.fmt0(1234.6), '$1,235');
assert.equal(usd.fmtAuto(45), '$45');
assert.equal(usd.fmtAuto(45.5), '$45.50');
assert.equal(usd.fmtHK(1500), 'HK$1,500');          // MPF figures stay in HK$
assert.equal(usd.fmtIn(12.3, 'HKD'), 'HK$12.30');   // a HK share keeps its own currency

// Friendly rounding for scaled thresholds and examples
assert.equal(niceAmount(7812), 7800);
assert.equal(niceAmount(128), 130);
assert.equal(niceAmount(3), 3);
assert.equal(niceAmount(convert(20000, 'HKD', 'USD', rates)), 2600);

console.log('currency.test: all checks passed');
