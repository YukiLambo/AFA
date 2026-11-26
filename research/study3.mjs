// Study 3: re-runs the evidence behind src/lib/horizonModel.js (EVIDENCE, CALIB, STUDY3) on the snapshot,
// using the app's own indicator and pattern definitions (imported, not copied).
//
//   node research/study3.mjs              # market-relative method → results/study3-market.json (+ -compare.md)
//   node research/study3.mjs --baseline   # original method          → results/study3-baseline.json (+ -compare.md)
//
// Method (the known weaknesses still open are listed in research/README.md):
//  - Four cells: HK / US × tuning period (Oct 2019 – Jun 2023) / test period (Jul 2023 – end of data).
//  - For each stock and day, the forward return over 10 and 120 trading days.
//  - market (default): excess = the stock's forward return − the index's forward return over the same days
//    (Hang Seng Index for HK, S&P 500 for US). Hit change = beat the index (0/1) − the share of all stock-days
//    in that cell that beat it, in points. Nothing from after day i is used except the outcome itself.
//  - baseline (the original study): "normal" = that stock's average forward return over all days of the same
//    period, which uses later data (look-ahead); hit change = up (0/1) − that stock's up-rate in the period.
//  - For every state: pooled average excess (%) and hit change (pp) per cell, with a plain t-statistic.
//    Reported value = average over the four cells; "cells agreeing" = cells with the same sign and |t| ≥ 1.5.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, RESEARCH_DIR } from './lib/data.mjs';
import { mean, tstat, spearman, quantiles, round } from './lib/stats.mjs';
import { indexCloser } from './lib/data.mjs';
import { EVIDENCE, STUDY3, _research } from '../src/lib/horizonModel.js';

const { series, statesAt, featuresAt, composite, zigzag, FEAT, MU, SD, CALIB } = _research;
const PERIODS = { train: ['2019-10-01', '2023-06-30'], test: ['2023-07-01', '9999-12-31'] };
const H = { short: 10, long: 120 };
const T_AGREE = 1.5;
const METHOD = process.argv.includes('--baseline') ? 'baseline' : 'market';

const snap = loadSnapshot();
const INDEX = { HK: indexCloser(snap, 'HK'), US: indexCloser(snap, 'US') };
const stocks = Object.entries(snap.series).filter(([, s]) => s.kind === 'stock');
const periodOf = (d) => (d >= PERIODS.train[0] && d <= PERIODS.train[1] ? 'train' : d >= PERIODS.test[0] ? 'test' : null);

// acc[h][cell][key] = { ex: [], hit: [] }
const acc = { short: {}, long: {} };
const obs = []; // composite inputs per observation
const push = (h, cell, key, ex, hit) => { const c = (acc[h][cell] ||= {}); const k = (c[key] ||= { ex: [], hit: [] }); k.ex.push(ex); k.hit.push(hit); };

let done = 0;
// (filled per observation after the loop, once the cell's beat rate is known)
for (const [sym, s] of stocks) {
  const R = s.rows; const S = series(R); const piv = zigzag(S.c, 0.06);
  for (const per of ['train', 'test']) {
    for (const h of ['short', 'long']) {
      const Hd = H[h];
      const days = [];
      for (let i = 252; i + Hd < S.n; i++) if (periodOf(R[i].date) === per) days.push(i);
      if (days.length < 30) continue;
      const fwd = days.map(i => S.c[i + Hd] / S.c[i] - 1);
      const cell = `${s.market}-${per}`;
      let rel, beat;
      if (METHOD === 'baseline') {
        const normal = mean(fwd), baseUp = mean(fwd.map(r => (r > 0 ? 1 : 0)));
        rel = fwd.map(r => r - normal); beat = fwd.map(r => (r > 0 ? 1 : 0) - baseUp);
      } else {
        const ix = INDEX[s.market];
        rel = days.map((i, k) => fwd[k] - (ix(R[i + Hd].date) / ix(R[i].date) - 1));
        beat = rel.map(r => (r > 0 ? 1 : 0)); // centred on the cell's beat rate below
      }
      days.forEach((i, k) => {
        const X = statesAt(S, i, piv);
        const keys = Object.keys(EVIDENCE).filter(key => X[key]);
        obs.push({ sym, market: s.market, per, h, i, cell, keys, ex: rel[k] * 100, b: beat[k], fwd: METHOD === 'baseline' ? fwd[k] : rel[k], f: featuresAt(S, i) });
      });
    }
  }
  if (++done % 10 === 0) console.error(`${done}/${stocks.length} stocks`);
}

const CELLS = ['HK-train', 'US-train', 'HK-test', 'US-test'];

// Hit change: baseline method is already centred per stock; market method is centred on the cell's beat rate
// Excess is centred the same way, so a state shows what it adds beyond the average stock-day in its cell
// (in this sample of today's large caps the average stock beat its index, which would otherwise make every
// state look positive).
const beatRate = {}, relMean = {};
if (METHOD === 'market') for (const h of ['short', 'long']) for (const c of CELLS) {
  const g = obs.filter(o => o.h === h && o.cell === c);
  beatRate[`${h}-${c}`] = mean(g.map(o => o.b)); relMean[`${h}-${c}`] = mean(g.map(o => o.ex));
}
for (const o of obs) {
  if (METHOD === 'market') o.ex -= relMean[`${o.h}-${o.cell}`];
  o.hit = (METHOD === 'market' ? o.b - beatRate[`${o.h}-${o.cell}`] : o.b) * 100;
  for (const key of o.keys) push(o.h, o.cell, key, o.ex, o.hit);
}

// ---- Evidence per state, in the same array layout as EVIDENCE ----
const evidence = {}, detail = {};
for (const key of Object.keys(EVIDENCE)) {
  const row = [];
  detail[key] = {};
  for (const h of ['short', 'long']) {
    const per = CELLS.map(c => { const a = acc[h][c]?.[key]; return a && a.ex.length >= 5 ? { n: a.ex.length, ex: mean(a.ex), hit: mean(a.hit), t: tstat(a.ex) } : null; });
    const ok = per.filter(Boolean);
    const ex = ok.length ? mean(ok.map(p => p.ex)) : NaN, hit = ok.length ? mean(ok.map(p => p.hit)) : NaN;
    const agree = ok.filter(p => Math.sign(p.ex) === Math.sign(ex) && Math.abs(p.t) >= T_AGREE).length;
    row.push(round(ex), round(hit, 1), agree);
    detail[key][h] = Object.fromEntries(CELLS.map((c, j) => [c, per[j] && { n: per[j].n, ex: round(per[j].ex), hit: round(per[j].hit, 1), t: round(per[j].t, 1) }]));
  }
  evidence[key] = row;
}

// ---- Feature means / spreads from the tuning period (compare with MU / SD in the app) ----
const trainF = obs.filter(o => o.per === 'train' && o.h === 'short');
const muSd = FEAT.map((nm, j) => { const v = trainF.map(o => o.f[nm]).filter(Number.isFinite); const m = mean(v); return { feature: nm, mu: round(m, 4), sd: round(Math.sqrt(mean(v.map(x => (x - m) ** 2))), 4), appMu: MU[j], appSd: SD[j] }; });

// ---- Composite: quintile calibration, IC inside each stock, top / bottom quintile in the test period ----
const calib = {}, ic = {}, topBottom = {};
for (const h of ['short', 'long']) {
  const mine = obs.filter(o => o.h === h).map(o => ({ ...o, score: composite(o.f, h).score }));
  const qRows = CELLS.map(cell => {
    const [m, per] = cell.split('-');
    const cs = mine.filter(o => o.market === m && o.per === per);
    const cut = quantiles(cs.map(o => o.score), [0.2, 0.4, 0.6, 0.8]);
    const qOf = (x) => cut.filter(c => x > c).length;
    return [0, 1, 2, 3, 4].map(q => { const g = cs.filter(o => qOf(o.score) === q); return { x: mean(g.map(o => o.score)), ex: mean(g.map(o => o.ex)), hit: mean(g.map(o => o.hit)) }; });
  });
  calib[h] = { x: [0, 1, 2, 3, 4].map(q => round(mean(qRows.map(r => r[q].x)))), ex: [0, 1, 2, 3, 4].map(q => round(mean(qRows.map(r => r[q].ex)))), hit: [0, 1, 2, 3, 4].map(q => round(mean(qRows.map(r => r[q].hit)))) };
  ic[h] = {};
  for (const m of ['HK', 'US']) for (const per of ['train', 'test']) {
    const bySym = {};
    mine.filter(o => o.market === m && o.per === per).forEach(o => { (bySym[o.sym] ||= []).push(o); });
    const ics = Object.values(bySym).filter(a => a.length >= 30).map(a => spearman(a.map(o => o.score), a.map(o => o.fwd))).filter(Number.isFinite);
    ic[h][`${m}-${per}`] = { ic: round(mean(ics), 3), positive: `${ics.filter(x => x > 0).length} of ${ics.length}` };
  }
  topBottom[h] = Object.fromEntries(['HK', 'US'].map(m => [m, { top: [round(qRows[CELLS.indexOf(`${m}-test`)][4].ex), round(qRows[CELLS.indexOf(`${m}-test`)][4].hit, 1)], bottom: [round(qRows[CELLS.indexOf(`${m}-test`)][0].ex), round(qRows[CELLS.indexOf(`${m}-test`)][0].hit, 1)] }]));
}

// ---- Write results ----
const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
const result = { method: METHOD, snapshot: basename(snap.dir), beatRate: Object.fromEntries(Object.entries(beatRate).map(([k, v]) => [k, round(v, 3)])), avgExcessVsIndexPct: Object.fromEntries(Object.entries(relMean).map(([k, v]) => [k, round(v, 2)])), periods: PERIODS, horizons: H, universe: { HK: stocks.filter(([, s]) => s.market === 'HK').length, US: stocks.filter(([, s]) => s.market === 'US').length }, evidence, detail, calib, ic, topBottom, featureScaling: muSd };
writeFileSync(join(outDir, `study3-${METHOD}.json`), JSON.stringify(result, null, 1) + '\n');

// Comparison with the numbers hard-coded in the app
const keys = Object.keys(EVIDENCE);
const cmp = (col) => { const a = keys.map(k => EVIDENCE[k][col]), b = keys.map(k => evidence[k][col]); const ok = a.map((v, i) => Number.isFinite(v) && Number.isFinite(b[i])); const A = a.filter((_, i) => ok[i]), B = b.filter((_, i) => ok[i]); return { r: round(spearman(A, B), 2), sameSign: `${A.filter((v, i) => Math.sign(v) === Math.sign(B[i])).length} of ${A.length}` }; };
const dirOf = (row, off) => { const [ex, hit, agree] = row.slice(off, off + 3); const big = off ? 3 : 2; return (agree >= 3 && Math.abs(hit) >= big) || (agree >= 2 && Math.abs(hit) >= big + 1) ? Math.sign(hit || ex) : 0; };
const flips = keys.filter(k => [0, 3].some(off => dirOf(EVIDENCE[k], off) !== dirOf(evidence[k], off)));
const md = [
  `# Study 3 re-run (${METHOD} method) vs the numbers in the app`, '',
  METHOD === 'market' ? 'Excess = return minus the index (HSI / S&P 500) over the same days, minus the average of that for all stock-days in the cell; hit change = how much more often the stock beat the index than the average stock-day.' : 'Original method: excess vs the stock\'s own full-period average (look-ahead).', '',
  `Snapshot: \`${result.snapshot}\` · ${result.universe.HK} HK + ${result.universe.US} US stocks · tuning ${PERIODS.train.join(' to ')}, test from ${PERIODS.test[0]}`, '',
  '## Agreement with `EVIDENCE` (all states)', '',
  '| Column | Rank correlation with app | Same sign |', '| --- | --- | --- |',
  ...[['Excess 10d', 0], ['Hit change 10d', 1], ['Excess 120d', 3], ['Hit change 120d', 4]].map(([n, c]) => { const x = cmp(c); return `| ${n} | ${x.r} | ${x.sameSign} |`; }),
  '', `States whose app verdict (lean up / lean down / no edge) would change with the re-run numbers: ${flips.length} of ${keys.length}.`, '',
  flips.length ? '| State | App 10d | Re-run 10d | App 120d | Re-run 120d |\n| --- | --- | --- | --- | --- |\n' + flips.map(k => `| ${k} | ${EVIDENCE[k].slice(0, 3).join(' / ')} | ${evidence[k].slice(0, 3).join(' / ')} | ${EVIDENCE[k].slice(3).join(' / ')} | ${evidence[k].slice(3).join(' / ')} |`).join('\n') : '',
  '', '## Composite outlook score', '',
  '| | App | Re-run |', '| --- | --- | --- |',
  `| 10d IC, HK train / test | ${STUDY3.short.icTrainHK} / ${STUDY3.short.icTestHK} | ${ic.short['HK-train'].ic} / ${ic.short['HK-test'].ic} |`,
  `| 10d IC, US train / test | ${STUDY3.short.icTrainUS} / ${STUDY3.short.icTestUS} | ${ic.short['US-train'].ic} / ${ic.short['US-test'].ic} |`,
  `| 120d IC, HK train / test | ${STUDY3.long.icTrainHK} / ${STUDY3.long.icTestHK} | ${ic.long['HK-train'].ic} / ${ic.long['HK-test'].ic} |`,
  `| 120d IC, US train / test | ${STUDY3.long.icTrainUS} / ${STUDY3.long.icTestUS} | ${ic.long['US-train'].ic} / ${ic.long['US-test'].ic} |`,
  `| Stocks with positive test IC, 10d HK / US | ${STUDY3.short.posTestHK} / ${STUDY3.short.posTestUS} | ${ic.short['HK-test'].positive} / ${ic.short['US-test'].positive} |`,
  `| Stocks with positive test IC, 120d HK / US | ${STUDY3.long.posTestHK} / ${STUDY3.long.posTestUS} | ${ic.long['HK-test'].positive} / ${ic.long['US-test'].positive} |`,
  `| 10d quintile excess % (low → high) | ${CALIB.short.ex.join(', ')} | ${calib.short.ex.join(', ')} |`,
  `| 120d quintile excess % (low → high) | ${CALIB.long.ex.join(', ')} | ${calib.long.ex.join(', ')} |`,
  '', METHOD === 'baseline' ? 'These figures use the original method, including its known weaknesses (overlapping returns, look-ahead "normal" return, no multiple-testing control). See README.' : 'IC here is measured on returns relative to the index. Still open: overlapping returns and multiple testing (step 3), one fixed tuning split (step 4).', ''
].join('\n');
writeFileSync(join(outDir, `study3-${METHOD}-compare.md`), md);
console.log(md);
