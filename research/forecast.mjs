// Forecast test (step 9): does the price projection beat a random walk ("tomorrow's price = today's")?
// A random walk is the standard benchmark for price forecasts; most methods fail to beat it out of sample.
//
//   node research/forecast.mjs      # writes results/forecast.json and forecast.md
//
// Every 21 trading days from 2019-10, for every stock, each method forecasts the log return over the next H days
// using only data up to that day. Scores:
//   RMSE ratio (Theil's U)  model error ÷ random-walk error; below 1 = better than "no change"
//   Direction hit rate      how often the sign of the forecast return matched the actual one (random walk excluded)
//   95% range coverage      how often the actual price ended inside the stated 95% range (should be about 95%)
// Methods: holt (the app's old price-level Holt trend), logDamped (logForecast), drift (last year's average daily
// log return), randomWalk (zero return).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, RESEARCH_DIR } from './lib/data.mjs';
import { mean, round } from './lib/stats.mjs';
import { holtForecast, logForecast } from '../src/lib/indicators.js';

const HS = [5, 20];
const START = '2019-10-01';
const METHODS = ['holt', 'logDamped', 'drift', 'randomWalk'];
const snap = loadSnapshot();

const acc = {};
for (const mkt of ['HK', 'US']) for (const h of HS) for (const m of METHODS) acc[`${mkt}|${h}|${m}`] = { se: [], hit: [], cover: [] };

for (const s of Object.values(snap.series)) {
  if (s.kind !== 'stock') continue;
  const c = s.rows.map(r => r.close);
  for (let i = 260; i < c.length - Math.max(...HS); i += 21) {
    if (s.rows[i].date < START) continue;
    const hist = c.slice(0, i + 1), p0 = c[i];
    const old = holtForecast(hist, Math.max(...HS)), neu = logForecast(hist, Math.max(...HS));
    const lr = hist.slice(-251).map(Math.log), drift = (lr.at(-1) - lr[0]) / (lr.length - 1);
    for (const h of HS) {
      const actual = Math.log(c[i + h] / p0);
      const preds = {
        holt: old ? { r: Math.log(Math.max(1e-9, old.path[h - 1].mid) / p0), lo: old.path[h - 1].lower, hi: old.path[h - 1].upper } : null,
        logDamped: neu ? { r: Math.log(neu.path[h - 1].mid / p0), lo: neu.path[h - 1].lower, hi: neu.path[h - 1].upper } : null,
        drift: { r: drift * h },
        randomWalk: { r: 0 }
      };
      for (const m of METHODS) {
        const p = preds[m]; if (!p || !Number.isFinite(p.r)) continue;
        const a = acc[`${s.market}|${h}|${m}`];
        a.se.push((actual - p.r) ** 2);
        if (m !== 'randomWalk' && p.r !== 0 && actual !== 0) a.hit.push(Math.sign(p.r) === Math.sign(actual) ? 1 : 0);
        if (p.lo !== undefined) a.cover.push(c[i + h] >= p.lo && c[i + h] <= p.hi ? 1 : 0);
      }
    }
  }
}

const result = { snapshot: basename(snap.dir), start: START, markets: {} };
for (const mkt of ['HK', 'US']) {
  result.markets[mkt] = {};
  for (const h of HS) {
    const rw = Math.sqrt(mean(acc[`${mkt}|${h}|randomWalk`].se));
    result.markets[mkt][h] = {};
    for (const m of METHODS) {
      const a = acc[`${mkt}|${h}|${m}`];
      const rmse = Math.sqrt(mean(a.se));
      result.markets[mkt][h][m] = {
        n: a.se.length, rmsePct: round(rmse * 100), theilU: round(rmse / rw, 3),
        hitRate: a.hit.length ? round(mean(a.hit) * 100, 1) : null,
        coverage95: a.cover.length ? round(mean(a.cover) * 100, 1) : null
      };
    }
  }
}
const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'forecast.json'), JSON.stringify(result, null, 1) + '\n');
const md = ['# Forecast vs random walk', '', `Snapshot \`${result.snapshot}\`, a forecast every 21 trading days per stock from ${START}. Theil's U below 1 means more accurate than "no change". A 95% range should contain the outcome about 95% of the time.`, '',
  '| Market | Days ahead | Method | Forecasts | RMSE of log return (%) | Theil\'s U | Direction right (%) | Inside 95% range (%) |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const mkt of ['HK', 'US']) for (const h of HS) for (const m of METHODS) {
  const r = result.markets[mkt][h][m];
  md.push(`| ${mkt} | ${h} | ${m} | ${r.n} | ${r.rmsePct} | ${r.theilU} | ${r.hitRate ?? '—'} | ${r.coverage95 ?? '—'} |`);
}
writeFileSync(join(outDir, 'forecast.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
