// Calibration test (step 10): when the trade plan says "55% chance the target is hit before the stop", does that
// happen about 55% of the time? Replays the app's own horizonOutlook() plans (the short ~2-week and long ~6-month
// plans shown on the stock page) on past data and checks what really happened.
//
//   node research/calibration.mjs     # a few minutes; writes results/calibration.json and calibration.md
//
// Every STEP trading days from 2019 for every stock: build both plans with data up to that day (no valuation or
// news inputs). Buy at that day's close, as the plan assumes, then follow daily lows and highs for the plan's
// horizon (10 or 120 trading days): target first = win, stop first = loss (a day touching both counts as a loss;
// a gap below the stop exits at the open), neither = still open at the end, closed at that day's price.
// Scores: stated probability vs what happened, in buckets; Brier score (mean squared error of the probability,
// lower is better) against always predicting the average; the stated vs realised average profit per trade.
// The bucket table becomes PLAN_CALIB in horizonModel.js, which the app uses to correct the probability it shows.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, RESEARCH_DIR } from './lib/data.mjs';
import { mean, round } from './lib/stats.mjs';
import { horizonOutlook } from '../src/lib/horizonModel.js';

const START = '2019-01-01', STEP = 10;
const EDGES = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0001];
const snap = loadSnapshot();
const T = { short: [], long: [] };
const t0 = Date.now();

for (const s of Object.values(snap.series)) {
  if (s.kind !== 'stock') continue;
  const R = s.rows;
  for (let i = 260; i < R.length - 120; i += STEP) {
    if (R[i].date < START) continue;
    const o = horizonOutlook({ rows: R.slice(0, i + 1), price: R[i].close });
    if (!o) continue;
    for (const h of ['short', 'long']) {
      const x = o[h];
      if (!(x.target > x.entry) || !(x.stop < x.entry)) continue;
      let outcome = 0, exit = R[i + x.horizon].close;
      for (let d = i + 1; d <= i + x.horizon; d++) {
        if (R[d].low <= x.stop) { outcome = -1; exit = Math.min(x.stop, R[d].open || x.stop); break; }
        if (R[d].high >= x.target) { outcome = 1; exit = x.target; break; }
      }
      T[h].push({ date: R[i].date, market: s.market, p: x.rawProbTarget ?? x.probTarget, ps: x.rawProbStop ?? x.probStop, signal: x.signal, outcome, ret: exit / x.entry - 1, predRet: x.evPerShare / x.entry });
    }
  }
}

const summarise = (A) => {
  const win = A.map(t => (t.outcome === 1 ? 1 : 0)), loss = A.map(t => (t.outcome === -1 ? 1 : 0));
  const base = mean(win);
  const buckets = [];
  for (let k = 0; k < EDGES.length - 1; k++) {
    const B = A.filter(t => t.p >= EDGES[k] && t.p < EDGES[k + 1]);
    if (B.length < 30) continue;
    const res = B.filter(t => t.outcome !== 0);
    buckets.push({ from: EDGES[k], to: Math.min(1, EDGES[k + 1]), n: B.length, stated: round(mean(B.map(t => t.p)) * 100, 1),
      targetFirst: round(mean(B.map(t => (t.outcome === 1 ? 1 : 0))) * 100, 1), stopFirst: round(mean(B.map(t => (t.outcome === -1 ? 1 : 0))) * 100, 1),
      targetOfResolved: res.length ? round(mean(res.map(t => (t.outcome === 1 ? 1 : 0))) * 100, 1) : null });
  }
  return {
    trades: A.length, targetFirst: round(base * 100, 1), stopFirst: round(mean(loss) * 100, 1), open: round((1 - base - mean(loss)) * 100, 1),
    stated: round(mean(A.map(t => t.p)) * 100, 1),
    brier: round(mean(A.map((t, j) => (t.p - win[j]) ** 2)), 4), brierBaseline: round(mean(win.map(w => (base - w) ** 2)), 4),
    avgReturnPct: round(mean(A.map(t => t.ret)) * 100, 2), statedReturnPct: round(mean(A.map(t => t.predRet)) * 100, 2),
    bySignal: Object.fromEntries(['Buy', 'Accumulate', 'Hold', 'Reduce', 'Sell'].map(sg => { const S = A.filter(t => t.signal === sg); return S.length ? [sg, { n: S.length, targetFirst: round(mean(S.map(t => (t.outcome === 1 ? 1 : 0))) * 100, 1), avgReturnPct: round(mean(S.map(t => t.ret)) * 100, 2) }] : null; }).filter(Boolean)),
    buckets
  };
};

// Monotone calibration table (pool-adjacent-violators on stated-probability buckets with at least MIN_N plans):
// stated → observed share. The app interpolates in it (PLAN_CALIB in horizonModel.js).
const MIN_N = 200;
function pav(A, key, won) {
  const pts = [];
  for (let k = 0; k < 20; k++) {
    const B = A.filter(t => t[key] >= k / 20 && t[key] < (k + 1) / 20);
    if (B.length >= MIN_N) pts.push({ x: mean(B.map(t => t[key])), y: mean(B.map(won)), w: B.length });
  }
  for (let changed = true; changed;) {
    changed = false;
    for (let j = 0; j + 1 < pts.length; j++) if (pts[j].y > pts[j + 1].y) {
      const a = pts[j], b = pts[j + 1], w = a.w + b.w;
      pts.splice(j, 2, { x: (a.x * a.w + b.x * b.w) / w, y: (a.y * a.w + b.y * b.w) / w, w }); changed = true; break;
    }
  }
  return { x: pts.map(q => round(q.x, 3)), y: pts.map(q => round(q.y, 3)) };
}
const calib = {};
for (const h of ['short', 'long']) calib[h] = { target: pav(T[h], 'p', t => (t.outcome === 1 ? 1 : 0)), stop: pav(T[h], 'ps', t => (t.outcome === -1 ? 1 : 0)) };

// Honest check of the correction: fit the table on plans made before SPLIT, score it on plans made after
const SPLIT = '2023-01-01';
const lerp = (t, x) => { const X = t.x, Y = t.y; if (!X.length) return x; if (x <= X[0]) return Y[0]; if (x >= X.at(-1)) return Y.at(-1); for (let k = 1; k < X.length; k++) if (x <= X[k]) return Y[k - 1] + (x - X[k - 1]) / (X[k] - X[k - 1]) * (Y[k] - Y[k - 1]); return Y.at(-1); };
const outOfSample = {};
for (const h of ['short', 'long']) {
  const fit = T[h].filter(t => t.date < SPLIT), test = T[h].filter(t => t.date >= SPLIT);
  const tab = pav(fit, 'p', t => (t.outcome === 1 ? 1 : 0)), win = test.map(t => (t.outcome === 1 ? 1 : 0));
  const avgFit = mean(fit.map(t => (t.outcome === 1 ? 1 : 0)));
  outOfSample[h] = { fitPlans: fit.length, testPlans: test.length,
    brierRaw: round(mean(test.map((t, j) => (t.p - win[j]) ** 2)), 4),
    brierCalibrated: round(mean(test.map((t, j) => (lerp(tab, t.p) - win[j]) ** 2)), 4),
    brierConstant: round(mean(win.map(w => (avgFit - w) ** 2)), 4),
    statedRawPct: round(mean(test.map(t => t.p)) * 100, 1), statedCalibratedPct: round(mean(test.map(t => lerp(tab, t.p))) * 100, 1), actualPct: round(mean(win) * 100, 1) };
}

const result = { snapshot: basename(snap.dir), start: START, step: STEP, calib, outOfSample, plans: {} };
for (const h of ['short', 'long']) { result.plans[h] = {}; for (const m of ['HK', 'US']) result.plans[h][m] = summarise(T[h].filter(t => t.market === m)); result.plans[h].all = summarise(T[h]); }

const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'calibration.json'), JSON.stringify(result, null, 1) + '\n');
const md = ['# Trade-plan probability calibration', '', `Snapshot \`${result.snapshot}\`: the app's short (10-day) and long (120-day) plans, built every ${STEP} trading days per stock from ${START}, bought at that day's close and followed for the plan's horizon. Plans overlap, so treat the numbers as descriptive. Returns are before costs.`, ''];
md.push('## Does the correction work on later data?', '', `Table fitted on plans before ${SPLIT}, scored on plans after. Brier score: lower is better.`, '',
  '| Plan | Test plans | Stated (raw) | Stated (corrected) | Actual target first | Brier raw | Brier corrected | Brier, constant average |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...['short', 'long'].map(h => { const o = outOfSample[h]; return `| ${h} | ${o.testPlans} | ${o.statedRawPct}% | ${o.statedCalibratedPct}% | ${o.actualPct}% | ${o.brierRaw} | ${o.brierCalibrated} | ${o.brierConstant} |`; }), '');
for (const h of ['short', 'long']) for (const m of ['HK', 'US', 'all']) {
  const r = result.plans[h][m];
  md.push(`## ${h === 'short' ? 'Short-term plan (10 days)' : 'Long-term plan (120 days)'} · ${m}`, '',
    `${r.trades} plans. Target first ${r.targetFirst}% (plans said ${r.stated}%), stop first ${r.stopFirst}%, neither by the end ${r.open}%. Brier ${r.brier} vs ${r.brierBaseline} for always predicting the average. Average result ${r.avgReturnPct}% per trade (plans said ${r.statedReturnPct}%).`, '',
    'By signal: ' + Object.entries(r.bySignal).map(([k, v]) => `${k} ${v.n} (target first ${v.targetFirst}%, average ${v.avgReturnPct}%)`).join('; ') + '.', '',
    '| Stated probability | Plans | Stated (avg) | Target first | Stop first | Target first, of those resolved |', '| --- | --- | --- | --- | --- | --- |',
    ...r.buckets.map(b => `| ${Math.round(b.from * 100)}–${Math.round(b.to * 100)}% | ${b.n} | ${b.stated}% | ${b.targetFirst}% | ${b.stopFirst}% | ${b.targetOfResolved ?? '—'}% |`), '');
}
writeFileSync(join(outDir, 'calibration.md'), md.join('\n'));
console.log(md.join('\n'));
console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s`);
