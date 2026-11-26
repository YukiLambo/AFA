// Cross-sectional ranking test (step 8): the way quant desks judge a stock score. On each rebalance date, rank the
// stocks of one market by a score, split them into five groups (quintiles), hold each group, and compare the
// groups' returns against the index. A score that picks stocks should give a rising staircase from Q1 to Q5 and
// a positive top-minus-bottom spread, in most periods.
//
//   node research/crosssection.mjs      # writes results/crosssection.json and crosssection.md
//
// Scores tested (all computed only from data up to the rebalance day, with the app's own code):
//   outlookShort / outlookLong  composite() in horizonModel.js (the 2-week / 6-month outlook score)
//   timing                      signalSeries().timing in indicators.js (used by the trade plan)
//   strength                    relativeStrengthScore() in indicators.js (used by the trade plan)
//   mom12_1                     plain 12-month momentum skipping the last month (textbook benchmark factor)
// Rebalance every 21 trading days from 2019-10; holding periods of 21 and 126 trading days. With 126-day holds
// the monthly samples overlap, so t-statistics are Newey–West with 5 lags.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadSnapshot, indexCloser, RESEARCH_DIR } from './lib/data.mjs';
import { mean, sd, nwTstat, spearman, round } from './lib/stats.mjs';
import { _research } from '../src/lib/horizonModel.js';
import { signalSeries, factorValues, relativeStrengthScore } from '../src/lib/indicators.js';

const { series, featuresAt, composite } = _research;
const HOLDS = [21, 126];
const START = '2019-10-01';
const SCORES = ['outlookShort', 'outlookLong', 'timing', 'strength', 'mom12_1'];
const COST_PCT = { HK: 0.1 + 0.1 + 0.05, US: 0.05 }; // one-way: HK stamp duty 0.1% + ~0.1% fees/spread; US ~0.05%

const snap = loadSnapshot();
const INDEX = { HK: indexCloser(snap, 'HK'), US: indexCloser(snap, 'US') };

// Per stock: date → { scores, fwd vs index per hold }
const byMarket = { HK: new Map(), US: new Map() };
for (const [sym, s] of Object.entries(snap.series)) {
  if (s.kind !== 'stock') continue;
  const R = s.rows, S = series(R), sig = signalSeries(R), ix = INDEX[s.market];
  for (let i = 252; i < S.n; i++) {
    const d = R[i].date; if (d < START) continue;
    const f = featuresAt(S, i), fv = factorValues(R, i);
    const sc = {
      outlookShort: composite(f, 'short').score, outlookLong: composite(f, 'long').score,
      timing: sig.timing[i], strength: fv ? relativeStrengthScore(fv)?.score ?? null : null,
      mom12_1: Number.isFinite(f.mom) ? f.mom : null
    };
    const fwd = {};
    for (const hd of HOLDS) if (i + hd < S.n) fwd[hd] = (S.c[i + hd] / S.c[i] - 1) - (ix(R[i + hd].date) / ix(d) - 1);
    const m = byMarket[s.market];
    (m.get(d) || m.set(d, []).get(d)).push({ sym, sc, fwd });
  }
}

const result = { snapshot: basename(snap.dir), start: START, costsOneWayPct: COST_PCT, markets: {} };
for (const [mkt, map] of Object.entries(byMarket)) {
  const dates = [...map.keys()].sort();
  // rebalance dates: every 21 trading days that have at least 20 stocks
  const rebal = dates.filter((_, k) => k % 21 === 0).filter(d => map.get(d).length >= 20);
  result.markets[mkt] = {};
  for (const name of SCORES) {
    result.markets[mkt][name] = {};
    for (const hd of HOLDS) {
      const q = [[], [], [], [], []], spread = [], ics = [], turn = [];
      let prevTop = null;
      for (const d of rebal) {
        const rows = map.get(d).filter(r => r.sc[name] !== null && Number.isFinite(r.sc[name]) && Number.isFinite(r.fwd[hd]));
        if (rows.length < 20) continue;
        rows.sort((a, b) => a.sc[name] - b.sc[name]);
        const groups = [0, 1, 2, 3, 4].map(g => rows.slice(Math.floor(g * rows.length / 5), Math.floor((g + 1) * rows.length / 5)));
        const avg = groups.map(g => mean(g.map(r => r.fwd[hd])) * 100);
        avg.forEach((v, g) => q[g].push(v));
        spread.push(avg[4] - avg[0]);
        ics.push(spearman(rows.map(r => r.sc[name]), rows.map(r => r.fwd[hd])));
        const top = new Set(groups[4].map(r => r.sym));
        if (prevTop) turn.push(1 - [...top].filter(x => prevTop.has(x)).length / top.size);
        prevTop = top;
      }
      const lags = hd > 21 ? Math.round(hd / 21) - 1 : 0;
      // Long top quintile vs short bottom quintile, after costs: each rebalance replaces `turn` of each side
      const costPerRebal = 2 * 2 * COST_PCT[mkt] * (turn.length ? mean(turn) : 1); // 2 sides × buy+sell
      const perYear = 252 / hd;
      // 21-day hold: pay for the share of each side that changes; 126-day hold: one full round trip per side
      const net = mean(spread) - (hd === 21 ? costPerRebal : 4 * COST_PCT[mkt]);
      result.markets[mkt][name][hd] = {
        periods: spread.length,
        quintiles: q.map(a => round(mean(a))),
        spread: round(mean(spread)), spreadT: round(nwTstat(spread, lags), 1), spreadPositive: `${spread.filter(x => x > 0).length} of ${spread.length}`,
        ic: round(mean(ics), 3), icT: round(nwTstat(ics, lags), 1),
        topTurnover: round(mean(turn), 2),
        spreadAfterCosts: round(net),
        sharpeLS: hd === 21 ? round((mean(spread) - costPerRebal) / sd(spread) * Math.sqrt(perYear), 2) : null
      };
    }
  }
}

const outDir = join(RESEARCH_DIR, 'results'); mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'crosssection.json'), JSON.stringify(result, null, 1) + '\n');

const md = ['# Cross-sectional ranking test', '',
  `Snapshot \`${result.snapshot}\`, rebalanced every 21 trading days from ${START}. Returns are vs the index (HSI / S&P 500), in %. Q1 = lowest score, Q5 = highest. t-statistics are Newey–West. Costs assumed one-way: HK ${COST_PCT.HK}%, US ${COST_PCT.US}%.`, ''];
for (const hd of HOLDS) {
  md.push(`## Hold ${hd} trading days`, '', '| Market | Score | Q1 → Q5 return vs index (%) | Q5 − Q1 (t, periods > 0) | IC (t) | Top turnover | Q5 − Q1 after costs |' + (hd === 21 ? ' Long-short Sharpe |' : ''), '| --- | --- | --- | --- | --- | --- | --- |' + (hd === 21 ? ' --- |' : ''));
  for (const mkt of ['HK', 'US']) for (const name of SCORES) {
    const r = result.markets[mkt][name][hd];
    md.push(`| ${mkt} | ${name} | ${r.quintiles.join(' / ')} | ${r.spread} (${r.spreadT}, ${r.spreadPositive}) | ${r.ic} (${r.icT}) | ${Math.round(r.topTurnover * 100)}% | ${r.spreadAfterCosts} |` + (hd === 21 ? ` ${r.sharpeLS} |` : ''));
  }
  md.push('');
}
writeFileSync(join(outDir, 'crosssection.md'), md.join('\n'));
console.log(md.join('\n'));
