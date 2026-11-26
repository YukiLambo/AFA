// Study 2: re-runs the timing-score evidence behind src/lib/indicators.js (STUDY2, used by tradePlan) on the
// snapshot, with the app's own signalSeries() (imported, not copied).
//
//   node research/study2.mjs            # writes research/results/study2.json and study2-compare.md
//
// Method, from the comments above STUDY2 in indicators.js: tuning Oct 2019 – Dec 2023, test 2024 onward,
// 60-trading-day forward returns. IC = rank correlation of each signal with the forward return inside each
// stock, averaged over stocks. Top / bottom = average forward return (%) on days with timing ≥ +0.25 / ≤ −0.25.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, RESEARCH_DIR } from './lib/data.mjs';
import { mean, spearman, round } from './lib/stats.mjs';
import { signalSeries, STUDY2 } from '../src/lib/indicators.js';

const PERIODS = { train: ['2019-10-01', '2023-12-31'], test: ['2024-01-01', '9999-12-31'] };
const H = 60;
// Only the readings signalSeries() exposes; OBV, Bollinger, Fibonacci and stochastic positions were computed
// separately in the original study and are not re-run here.
const IND = ['emaX', 'golden', 'macdX', 'diDir', 'ichi', 'tkX', 'superT', 'rev1m'];

const snap = loadSnapshot();
const per = (d) => (d >= PERIODS.train[0] && d <= PERIODS.train[1] ? 'train' : d >= PERIODS.test[0] ? 'test' : null);
const res = {};
for (const [sym, s] of Object.entries(snap.series)) {
  if (s.kind !== 'stock') continue;
  const R = s.rows, c = R.map(r => r.close), sig = signalSeries(R);
  for (const p of ['train', 'test']) {
    const rows = [];
    for (let i = 252; i + H < R.length; i++) {
      if (per(R[i].date) !== p || sig.timing[i] === null) continue;
      rows.push({ i, t: sig.timing[i], fwd: c[i + H] / c[i] - 1 });
    }
    if (rows.length < 60) continue;
    const key = `${s.market}-${p}`;
    const cell = (res[key] ||= { ic: [], top: [], all: [], bottom: [], ind: Object.fromEntries(IND.map(k => [k, []])) });
    cell.ic.push(spearman(rows.map(r => r.t), rows.map(r => r.fwd)));
    rows.forEach(r => { cell.all.push(r.fwd); if (r.t >= 0.25) cell.top.push(r.fwd); if (r.t <= -0.25) cell.bottom.push(r.fwd); });
    for (const k of IND) cell.ind[k].push(spearman(rows.map(r => sig[k][r.i] ?? 0), rows.map(r => r.fwd)));
  }
}

const out = {};
for (const [key, c] of Object.entries(res)) {
  const ics = c.ic.filter(Number.isFinite);
  out[key] = {
    ic: round(mean(ics), 3), positive: `${ics.filter(x => x > 0).length} of ${ics.length}`,
    top: round(mean(c.top) * 100), all: round(mean(c.all) * 100), bottom: round(mean(c.bottom) * 100),
    indicatorIC: Object.fromEntries(IND.map(k => [k, round(mean(c.ind[k].filter(Number.isFinite)), 2)]))
  };
}
const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'study2.json'), JSON.stringify({ snapshot: basename(snap.dir), periods: PERIODS, horizon: H, cells: out }, null, 1) + '\n');

const A = STUDY2.timingModel, g = (k) => out[k] || {};
const md = [
  '# Study 2 re-run vs the numbers in the app', '',
  `Snapshot: \`${basename(snap.dir)}\` · 60-day returns · tuning ${PERIODS.train.join(' to ')}, test from ${PERIODS.test[0]}`, '',
  '| Timing score | App | Re-run |', '| --- | --- | --- |',
  `| IC, HK train / test | ${A.trainIC} / ${A.testIC} | ${g('HK-train').ic} / ${g('HK-test').ic} |`,
  `| IC, US train / test | ${A.usTrainIC} / ${A.usTestIC} | ${g('US-train').ic} / ${g('US-test').ic} |`,
  `| HK stocks with positive test IC | ${A.stocksPositive} | ${g('HK-test').positive} |`,
  `| HK test: top / all / bottom 60d return % | ${A.test.top} / ${A.test.all} / ${A.test.bottom} | ${g('HK-test').top} / ${g('HK-test').all} / ${g('HK-test').bottom} |`,
  `| HK train: top / all / bottom | ${A.train.top} / ${A.train.all} / ${A.train.bottom} | ${g('HK-train').top} / ${g('HK-train').all} / ${g('HK-train').bottom} |`,
  `| US test: top / all / bottom | ${A.usTest.top} / ${A.usTest.all} / ${A.usTest.bottom} | ${g('US-test').top} / ${g('US-test').all} / ${g('US-test').bottom} |`,
  '', '| Classic indicator reading, HK test IC | App | Re-run |', '| --- | --- | --- |',
  ...IND.map(k => `| ${k} | ${STUDY2.indicatorIC[k]} | ${g('HK-test').indicatorIC?.[k]} |`),
  '', 'Not re-run: obvTrend, bbPos, fibPos, stoch (not exposed by signalSeries).', '', 'The app study used 45 Hang Seng blue chips; this re-run uses the 60 HK stocks in universe.json, so small differences are expected.', ''
].join('\n');
writeFileSync(join(outDir, 'study2-compare.md'), md);
console.log(md);
