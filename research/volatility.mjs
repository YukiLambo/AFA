// Volatility forecast test (step 11): which estimate of a stock's coming volatility is closest to what happened?
// Stops, targets, ranges and the odds of hitting them all scale with volatility, so a better estimate makes the
// plan's levels and probabilities more reliable.
//
//   node research/volatility.mjs      # writes results/volatility.json and volatility.md
//
// Every 10 trading days from 2019, for every stock, forecast the average daily volatility over the next H days
// (10 and 120) with volForecast() ('flat' = the old one-year standard deviation, 'ewma', 'garch'), then compare
// with the realised volatility over those days. Scores:
//   QLIKE        the standard loss for volatility forecasts (lower is better; robust to noisy realised values)
//   RMSE ratio   error of the forecast volatility ÷ error of the flat forecast (below 1 = better than before)
//   coverage     how often the H-day return fell inside ±1.96 × forecast vol × √H (should be about 95%)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, RESEARCH_DIR } from './lib/data.mjs';
import { mean, round } from './lib/stats.mjs';
import { volForecast } from '../src/lib/indicators.js';

const HS = [10, 120], METHODS = ['flat', 'ewma', 'garch'], START = '2019-01-01', STEP = 10;
const snap = loadSnapshot();
const acc = {};
for (const mk of ['HK', 'US']) for (const h of HS) for (const m of METHODS) acc[`${mk}|${h}|${m}`] = { q: [], se: [], cov: [] };

for (const s of Object.values(snap.series)) {
  if (s.kind !== 'stock') continue;
  const c = s.rows.map(r => r.close), lr = c.map((v, i) => (i ? Math.log(v / c[i - 1]) : NaN));
  for (let i = 520; i < c.length - Math.max(...HS); i += STEP) {
    if (s.rows[i].date < START) continue;
    const hist = lr.slice(1, i + 1);
    for (const h of HS) {
      const fut = lr.slice(i + 1, i + 1 + h);
      const rv2 = fut.reduce((a, v) => a + v * v, 0) / h; // realised variance per day (zero-mean)
      if (!(rv2 > 0)) continue;
      const ret = Math.log(c[i + h] / c[i]);
      for (const m of METHODS) {
        const f = volForecast(hist, h, m); if (!f) continue;
        const a = acc[`${s.market}|${h}|${m}`], f2 = f * f;
        a.q.push(rv2 / f2 - Math.log(rv2 / f2) - 1);
        a.se.push((Math.sqrt(rv2) - f) ** 2);
        a.cov.push(Math.abs(ret) <= 1.96 * f * Math.sqrt(h) ? 1 : 0);
      }
    }
  }
}

const result = { snapshot: basename(snap.dir), start: START, step: STEP, markets: {} };
for (const mk of ['HK', 'US']) {
  result.markets[mk] = {};
  for (const h of HS) {
    const base = Math.sqrt(mean(acc[`${mk}|${h}|flat`].se));
    result.markets[mk][h] = Object.fromEntries(METHODS.map(m => { const a = acc[`${mk}|${h}|${m}`]; return [m, { n: a.q.length, qlike: round(mean(a.q), 4), rmseRatio: round(Math.sqrt(mean(a.se)) / base, 3), coverage95: round(mean(a.cov) * 100, 1) }]; }));
  }
}
const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'volatility.json'), JSON.stringify(result, null, 1) + '\n');
const md = ['# Volatility forecasts', '', `Snapshot \`${result.snapshot}\`, a forecast every ${STEP} trading days per stock from ${START}. QLIKE: lower is better. RMSE ratio below 1 = better than the old flat one-year estimate. Coverage of the ±1.96σ√H range should be about 95%.`, '',
  '| Market | Days ahead | Method | Forecasts | QLIKE | RMSE ratio vs flat | Inside 95% range (%) |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const mk of ['HK', 'US']) for (const h of HS) for (const m of METHODS) { const r = result.markets[mk][h][m]; md.push(`| ${mk} | ${h} | ${m} | ${r.n} | ${r.qlike} | ${r.rmseRatio} | ${r.coverage95} |`); }
writeFileSync(join(outDir, 'volatility.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
