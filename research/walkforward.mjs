// Walk-forward test of the outlook model (step 4): every 6 months, refit the parts of the model that are learned
// from data, using only outcomes known before that date, then score the next 6 months.
//
//   node research/walkforward.mjs     # writes results/walkforward.json and walkforward.md
//
// Refitted each window (from training data only):
//  - feature scaling (MU / SD) for the composite score,
//  - the quintile calibration (CALIB): composite score → change in how often the stock beat its index,
//  - the evidence per state, with Newey–West t-statistics and Benjamini–Hochberg control (as in study3),
//    so only states that pass add to the outlook.
// Not refitted: the composite's ingredient weights (WEIGHTS in horizonModel.js), which were chosen by hand.
// Purging: a training observation is used only if its whole forward window ends before the test window starts.
//
// Returns are relative to the index (HSI / S&P 500), as in the market method of study3.
// For comparison the same windows are scored with the constants currently in the app, which were fitted on data
// that includes these windows, so their score is optimistic.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, indexCloser, RESEARCH_DIR } from './lib/data.mjs';
import { mean, nwTstat, pTwoSided, bhQvalues, spearman, quantiles, round, tstat } from './lib/stats.mjs';
import { EVIDENCE, verdict, _research } from '../src/lib/horizonModel.js';

const { series, statesAt, featuresAt, zigzag, FEAT, WEIGHTS, CALIB, SHRINK } = _research;
const H = { short: 10, long: 120 };
const FIRST_TEST = '2021-01-01';
const FDR_Q = 0.10, MIN_DATES = 30, T_AGREE = 1.5;
const KEYS = Object.keys(EVIDENCE);

const snap = loadSnapshot();
const INDEX = { HK: indexCloser(snap, 'HK'), US: indexCloser(snap, 'US') };

// ---- Observations: every stock-day from 2019 with its states, features and index-relative outcome ----
const obs = { short: [], long: [] };
for (const [sym, s] of Object.entries(snap.series)) {
  if (s.kind !== 'stock') continue;
  const R = s.rows, S = series(R), piv = zigzag(S.c, 0.06), ix = INDEX[s.market];
  for (let i = 252; i < S.n; i++) {
    if (R[i].date < '2019-01-01') continue;
    const X = statesAt(S, i, piv), f = featuresAt(S, i), keys = KEYS.filter(k => X[k]);
    for (const h of ['short', 'long']) {
      if (i + H[h] >= S.n) continue;
      const rel = S.c[i + H[h]] / S.c[i] - 1 - (ix(R[i + H[h]].date) / ix(R[i].date) - 1);
      obs[h].push({ sym, market: s.market, date: R[i].date, end: R[i + H[h]].date, keys, f, rel });
    }
  }
}

// Composite score with given scaling (same formula as composite() in horizonModel.js)
const scoreOf = (f, h, mu, sd) => {
  let s = 0, ws = 0;
  for (const [nm, w] of Object.entries(WEIGHTS[h])) {
    const j = FEAT.indexOf(nm), x = f[nm]; if (!Number.isFinite(x)) continue;
    s += -w * Math.max(-3, Math.min(3, (x - mu[j]) / sd[j])); ws += w;
  }
  return ws ? s / ws : 0;
};
const interp = (xs, ys, x) => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let k = 1; k < xs.length; k++) if (x <= xs[k]) { const t = (x - xs[k - 1]) / (xs[k] - xs[k - 1]); return ys[k - 1] + t * (ys[k] - ys[k - 1]); }
  return ys[ys.length - 1];
};
const nwDaily = (rows, val, lags) => {
  const by = new Map(); rows.forEach(o => { const v = by.get(o.date); const x = val(o); if (v) { v.s += x; v.n++; } else by.set(o.date, { s: x, n: 1 }); });
  const ser = [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v.s / v.n);
  return ser.length >= MIN_DATES ? nwTstat(ser, lags) : NaN;
};

// ---- Fit on training rows ----
function fit(train, h) {
  const mu = FEAT.map(nm => mean(train.map(o => o.f[nm]).filter(Number.isFinite)));
  const sd = FEAT.map((nm, j) => { const v = train.map(o => o.f[nm]).filter(Number.isFinite); return Math.sqrt(mean(v.map(x => (x - mu[j]) ** 2))) || 1; });
  const byM = { HK: train.filter(o => o.market === 'HK'), US: train.filter(o => o.market === 'US') };
  const base = Object.fromEntries(Object.entries(byM).map(([m, a]) => [m, { rel: mean(a.map(o => o.rel)), beat: mean(a.map(o => (o.rel > 0 ? 1 : 0))) }]));
  const hitOf = (o) => ((o.rel > 0 ? 1 : 0) - base[o.market].beat) * 100;
  // calibration: per market quintiles of the score, averaged over the two markets
  const q = Object.values(byM).map(a => {
    const sc = a.map(o => scoreOf(o.f, h, mu, sd)), cut = quantiles(sc, [0.2, 0.4, 0.6, 0.8]);
    const g = [[], [], [], [], []]; a.forEach((o, k) => g[cut.filter(c => sc[k] > c).length].push([sc[k], hitOf(o)]));
    return g.map(r => ({ x: mean(r.map(z => z[0])), hit: mean(r.map(z => z[1])) }));
  });
  const calib = { x: [0, 1, 2, 3, 4].map(k => mean(q.map(r => r[k].x))), hit: [0, 1, 2, 3, 4].map(k => mean(q.map(r => r[k].hit))) };
  // evidence per state: two cells (HK, US), Newey–West t, combined z, BH across states
  const tests = KEYS.map(key => {
    const cells = Object.entries(byM).map(([m, a]) => { const r = a.filter(o => o.keys.includes(key)); return r.length >= 5 ? { hit: mean(r.map(hitOf)), t: nwDaily(r, o => o.rel - base[m].rel, H[h] - 1) } : null; }).filter(Boolean);
    const ts = cells.map(c => c.t).filter(Number.isFinite);
    const z = ts.length ? ts.reduce((a, b) => a + b, 0) / Math.sqrt(ts.length) : NaN;
    const hit = cells.length ? mean(cells.map(c => c.hit)) : 0;
    const agree = cells.filter(c => Math.sign(c.hit) === Math.sign(hit) && Math.abs(c.t) >= T_AGREE).length;
    return { key, z, p: pTwoSided(z), hit, agree };
  });
  const qv = bhQvalues(tests.map(t => t.p));
  const passed = tests.filter((t, j) => qv[j] <= FDR_Q && t.agree >= 2);
  return { mu, sd, calib, passed };
}

// Predicted lift (points more often ahead of the index), as the app combines it
const liftOf = (o, h, model) => {
  let lift = interp(model.calib.x, model.calib.hit, scoreOf(o.f, h, model.mu, model.sd)) * SHRINK;
  for (const p of model.passed) if (o.keys.includes(p.key)) lift += 0.5 * p.hit * SHRINK;
  return Math.max(-20, Math.min(20, lift));
};
// The app's current constants, for comparison
const appModel = (h) => ({ mu: _research.MU, sd: _research.SD, calib: CALIB[h], passed: KEYS.map(k => ({ key: k, v: verdict(k, h) })).filter(x => x.v.dir).map(x => ({ key: x.key, hit: x.v.hit / SHRINK })) });

// ---- Windows ----
const lastDate = obs.short.reduce((m, o) => (o.date > m ? o.date : m), '');
const windows = [];
for (let d = new Date(FIRST_TEST); d.toISOString().slice(0, 10) <= lastDate; d.setMonth(d.getMonth() + 6)) {
  const a = d.toISOString().slice(0, 10), e = new Date(d); e.setMonth(e.getMonth() + 6);
  windows.push([a, e.toISOString().slice(0, 10)]);
}

// Scores a window. IC = rank correlation between predicted lift and the stock's return vs the index across the
// stocks of one market on each day, averaged over the days (the standard cross-sectional IC). A within-stock
// IC is not used here: inside a 6-month window the 120-day outcomes overlap almost completely, which biases it.
function score(rows, pred) {
  const out = {};
  for (const m of ['HK', 'US']) {
    const r = rows.filter(o => o.market === m); if (r.length < 200) { out[m] = null; continue; }
    const byDate = {}; r.forEach(o => (byDate[o.date] ||= []).push(o));
    const ics = Object.values(byDate).filter(a => a.length >= 10).map(a => spearman(a.map(pred), a.map(o => o.rel))).filter(Number.isFinite);
    const p = r.map(pred), cut = quantiles(p, [0.2, 0.8]);
    const top = r.filter((_, k) => p[k] >= cut[1]), bot = r.filter((_, k) => p[k] <= cut[0]);
    out[m] = { ic: mean(ics), spread: (mean(top.map(o => o.rel)) - mean(bot.map(o => o.rel))) * 100, n: r.length };
  }
  return out;
}

const result = { snapshot: basename(snap.dir), firstTest: FIRST_TEST, windows: [], summary: {} };
for (const h of ['short', 'long']) {
  const app = appModel(h);
  for (const [a, b] of windows) {
    const train = obs[h].filter(o => o.end < a), test = obs[h].filter(o => o.date >= a && o.date < b);
    if (!test.length || train.length < 5000) continue;
    const model = fit(train, h);
    result.windows.push({ h, from: a, to: b, trainRows: train.length, passed: model.passed.map(p => p.key),
      calibSlope: round(model.calib.hit[4] - model.calib.hit[0], 1),
      walk: score(test, o => liftOf(o, h, model)), app: score(test, o => liftOf(o, h, app)) });
  }
  const W = result.windows.filter(w => w.h === h);
  const agg = (kind, m, field) => { const v = W.map(w => w[kind][m]?.[field]).filter(Number.isFinite); return { mean: round(mean(v), 3), positive: `${v.filter(x => x > 0).length} of ${v.length}`, t: round(tstat(v), 1) }; };
  result.summary[h] = Object.fromEntries(['HK', 'US'].map(m => [m, { walk: { ic: agg('walk', m, 'ic'), spread: agg('walk', m, 'spread') }, app: { ic: agg('app', m, 'ic'), spread: agg('app', m, 'spread') } }]));
  // how stable the "real" signals are from window to window
  const counts = {}; W.forEach(w => w.passed.forEach(k => { counts[k] = (counts[k] || 0) + 1; }));
  result.summary[h].passedCounts = Object.fromEntries(Object.entries(counts).sort((x, y) => y[1] - x[1]));
  result.summary[h].windows = W.length;
}

const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'walkforward.json'), JSON.stringify(result, null, 1) + '\n');

const S = result.summary, row = (h, m, k) => `| ${h === 'short' ? '10 days' : '120 days'} | ${m} | ${S[h][m].walk[k].mean} (${S[h][m].walk[k].positive}) | ${S[h][m].app[k].mean} (${S[h][m].app[k].positive}) |`;
const md = [
  '# Walk-forward test of the outlook model', '',
  `Snapshot \`${result.snapshot}\`. Refit every 6 months from ${FIRST_TEST} on data whose outcomes were known before each window; scored on the next 6 months. Returns relative to the index.`, '',
  '## Cross-sectional rank IC (average over windows; windows with IC > 0)', '',
  '| Horizon | Market | Walk-forward | App constants (fitted with hindsight) |', '| --- | --- | --- | --- |',
  ...['short', 'long'].flatMap(h => ['HK', 'US'].map(m => row(h, m, 'ic'))), '',
  '## Top 20% minus bottom 20% of predicted lift, return vs index (% points)', '',
  '| Horizon | Market | Walk-forward | App constants |', '| --- | --- | --- | --- |',
  ...['short', 'long'].flatMap(h => ['HK', 'US'].map(m => row(h, m, 'spread'))), '',
  '## Signals passing false-discovery control, by number of windows', '',
  ...['short', 'long'].map(h => `- ${h === 'short' ? '10 days' : '120 days'} (${S[h].windows} windows): ${Object.entries(S[h].passedCounts).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`), '',
  '## Per window', '',
  '| Horizon | Window | Signals passing | Calibration slope (pts) | IC HK | IC US |', '| --- | --- | --- | --- | --- | --- |',
  ...result.windows.map(w => `| ${w.h} | ${w.from} | ${w.passed.length} | ${w.calibSlope} | ${round(w.walk.HK?.ic, 3)} | ${round(w.walk.US?.ic, 3)} |`), ''
].join('\n');
writeFileSync(join(outDir, 'walkforward.md'), md);
console.log(md);
