// Short-term (about 2 weeks) and long-term (about 6 months) outlook, built from what indicators and chart
// patterns were actually followed by in the real market, not from their textbook meaning.
//
// Study 3 (re-runnable: research/study3.mjs, data snapshot in research/data/): 60 Hang Seng large caps + 40 US
// large caps, daily split-adjusted prices 2018–2026. Every indicator state and pattern was checked against the
// stock's return over the next 10 and 120 trading days MINUS the index's return over the same days (Hang Seng
// Index / S&P 500), so the numbers show stock picking, not timing the whole market. Tuned on Oct 2019 –
// Jun 2023, checked on Jul 2023 – 2026, separately for Hong Kong and the US (four "cells").
// Main finding (Nov 2026 re-run): measured against the index, short-term mean reversion adds little; most of
// the "stretched moves snap back" effect in the first version was the whole market rebounding. Over 6 months,
// relative strength tended to persist: 12-month winners, stocks above their 200-day average or near 52-week
// highs beat the index more often, and the composite's top quintile lagged. Most candlestick and chart patterns
// had no reliable edge.
// Caveat: the sample is today's large caps, so stocks that fell and never recovered are missing (survivorship),
// which flatters momentum. Effects are therefore shrunk by 25% before they are shown.

const SHRINK = 0.75;

// Evidence per state: [excess % 10d, hit-rate change pp 10d, cells agreeing 10d, excess % 120d, hit pp 120d, cells 120d]
// "excess" = average return after the state minus the index over the same days, relative to the average stock-day;
// hit = change in how often the stock beat the index; "cells agreeing" = how many of the four market/period
// cells had the same sign with |t| >= 1.5. Written by research/update_app_constants.mjs; do not edit by hand.
export const EVIDENCE = {
  farBelow50: [0.42, 2.3, 0, 0.96, -1.2, 0], farAbove50: [0.37, 0.7, 1, 4.03, 1.6, 1],
  aboveSma200: [0.09, 0.7, 0, 1.62, 3.3, 0], belowSma200: [-0.09, -0.7, 0, -1.81, -4, 2],
  golden: [0.1, 0.6, 0, 1.63, 3.3, 0], death: [-0.1, -0.5, 0, -1.83, -4.1, 2],
  emaBull: [0.08, 0.5, 0, 0.71, 1.5, 0], emaBear: [-0.07, -0.3, 0, -0.71, -1.5, 0],
  macdAbove: [0.05, 0.3, 0, 0.14, 0, 0], macdBelow: [-0.05, -0.3, 0, -0.15, 0, 0],
  macdXup: [0.04, -0.1, 0, -0.02, -0.2, 0], macdXdn: [0.01, -0.7, 0, -0.1, 0, 0],
  rsi14lt30: [0.18, 1.1, 1, -1.2, -1.1, 1], rsi14gt70: [0.45, 3.2, 1, 2.87, 3.9, 1],
  stochLt20: [-0.1, -0.8, 0, -0.7, -1, 0], stochGt80: [0.09, 1.2, 0, 0.77, 1.5, 0],
  cciVeryLow: [-0.07, -0.4, 0, -0.82, -0.3, 2], cciLow: [-0.13, -1.1, 1, -0.55, -1, 1], cciHigh: [0.12, 0.9, 0, 0.78, 1.4, 0],
  bbBelow: [-0.07, -0.8, 1, -0.53, -0.7, 2], bbAbove: [0.23, 1.6, 2, 1.81, 2.2, 0],
  adxUp: [0.25, 2, 0, 1.04, 1.9, 0], adxDown: [0.22, 2.3, 0, -0.1, 0.3, 1], adxWeak: [-0.16, -1.5, 1, -0.35, -1.2, 1],
  aboveCloud: [0.11, 0.9, 0, 0.98, 2, 0], belowCloud: [-0.06, -0.5, 1, -0.88, -1.7, 2],
  superUp: [0.09, 0.6, 0, 0.18, 0.8, 0], superDown: [-0.09, -0.5, 0, -0.17, -0.8, 1],
  psarUp: [0.06, 0.4, 0, 0.31, 0.6, 0], psarDown: [-0.06, -0.4, 0, -0.31, -0.6, 0],
  psarFlipUp: [0.03, 1, 0, -0.19, -0.6, 1], psarFlipDown: [-0.14, -0.9, 0, -0.45, -0.5, 1],
  obvUp: [0.06, 0.6, 1, 0.56, 1, 0], obvDown: [-0.06, -0.6, 1, -0.56, -1, 0],
  cmfPos: [0.07, 1.3, 0, 0.44, 1.9, 0], cmfNeg: [-0.09, -0.9, 1, -0.28, -0.7, 0],
  volOscPos: [0.05, 0.1, 1, 0.57, 0.3, 1], volOscNeg: [0.17, 0.5, 0, 0.54, 0.6, 0],
  aboveR1: [0.17, 0.7, 1, 0.52, 0.1, 0], belowS1: [-0.06, -0.2, 1, -0.12, -0.4, 0],
  mom12Strong: [0.24, 1.2, 1, 3.77, 6, 1], mom12Weak: [-0.09, -2.6, 1, 0.06, -3.7, 0],
  near52High: [0.24, 2.7, 0, 1.48, 4.3, 0], deepDraw: [0.1, -0.7, 0, 0.28, -3.9, 1],
  lowVol: [0.08, 0.3, 0, 2.31, 4.6, 1], highVol: [-0.19, -1.4, 2, -1.29, -5.3, 1],
  new20Low: [-0.11, -1.1, 1, -0.91, -1.2, 2], new20High: [0.14, 0.9, 0, 1.25, 2.3, 0],
  new55Low: [0.05, -0.4, 0, -0.84, -1, 2], new55High: [0.19, 1.8, 0, 2.07, 3.5, 0],
  drop5: [0.15, 0.4, 1, 1.33, -0.5, 1], rsiReclaim30: [0.13, 0.6, 0, -0.93, -0.8, 1],
  // candlesticks
  hammer: [0.16, 0.3, 0, -0.43, -1.3, 0], invHammer: [0.04, 1.5, 1, 0.49, 0.6, 2], shootingStar: [0.12, 0.8, 2, 1.71, 2.8, 0],
  hangingMan: [-0.16, -0.9, 1, 1.08, 0.9, 1], doji: [-0.09, -0.4, 0, -0.13, 0.2, 1], dragonfly: [0.44, 3.7, 1, 1.63, 1.6, 1],
  gravestone: [0.08, 1.9, 0, 1.1, 2.4, 1], spinTopAfterDown: [0.24, 1.6, 2, 0.3, -0.9, 1], spinTopAfterUp: [0.01, -0.1, 0, 2.79, 2, 1],
  bullEngulf: [-0.03, 0.5, 0, 0.91, -0.9, 1], bearEngulf: [0.36, 2.2, 1, 0.71, 2, 0],
  bullHarami: [-0.01, 0, 0, 0.53, -0.5, 0], bearHarami: [0.07, -0.8, 0, 1.58, -1.1, 1],
  piercing: [0.29, 1.3, 2, 0.78, -1.7, 1], darkCloud: [0.02, -0.3, 1, 0.87, -1.6, 2],
  morningStar: [-0.27, -1.9, 0, -0.41, -1.5, 1], eveningStar: [-0.2, -2.4, 0, 2.83, 3.1, 3],
  threeSoldiers: [0.38, 2.9, 1, -1.04, -0.7, 1], threeCrows: [0.12, -1.9, 0, -1.4, -1.5, 0],
  tweezerBottom: [-0.11, -0.8, 1, -0.79, -1, 0], tweezerTop: [0.14, 2.1, 0, 0.51, 0.1, 0],
  bullKicker: [0.17, 0.3, 1, 0.29, 0.8, 1], bearKicker: [-0.26, -2.2, 1, 0.68, 0.3, 0],
  // chart patterns
  doubleBottom: [-0.29, -0.7, 1, -0.25, 2, 1], doubleTop: [-0.47, -4.1, 1, -0.34, -1.7, 0],
  baseBreakout: [0.18, 2, 1, 0.62, 4.1, 2], baseBreakdown: [-0.27, -0.2, 1, -2.11, -1.8, 3],
  bullFlag: [-0.22, -0.8, 0, 3.44, 2.6, 1], bearFlag: [0.36, 2.1, 0, -1.99, -4.4, 1],
  ascTriangle: [0.12, 2.4, 0, 1.29, 4.1, 0], descTriangle: [-0.21, 0, 1, -1.59, -2.3, 2],
  cupHandle: [0.26, 3.8, 0, 1.02, 3.5, 0], headShoulders: [-0.37, -1.8, 0, -0.51, 1.9, 0], invHeadShoulders: [-0.43, -1.1, 1, -0.23, -3, 0],
  risingWedgeBreak: [-0.07, 0.5, 1, -0.07, -0.1, 1], fallingWedgeBreak: [-0.16, -0.8, 1, 0.02, -0.2, 1],
  roundedBottom: [1.79, 9.8, 0, 6.91, -0.5, 0], roundedTop: [1.65, 0.6, 0, 21.64, 6.5, 0],
  abcdBull: [0.22, 0.7, 1, -1.2, -1.7, 1], abcdBear: [-0.06, 0.5, 0, 0.87, 1.3, 0],
  gartleyBull: [0.22, 1.9, 2, 0.16, 9.3, 1], gartleyBear: [-0.6, -0.7, 1, -0.43, 12.6, 1],
  rsiBullDiv: [0, 1.8, 0, -1.33, -2.7, 2], rsiBearDiv: [0.2, 1.9, 0, 2.18, 4, 1],
  macdBullDiv: [-0.07, 0.2, 0, -0.65, -1.3, 2], macdBearDiv: [0.16, 1.5, 0, 1.34, 3.3, 0]
};

// States that passed false-discovery control (Benjamini–Hochberg, Newey–West t-statistics). Written by
// research/update_app_constants.mjs.
export const FDR_PASS = {
  q: 0.1,
  short: ['doubleTop'],
  long: ['eveningStar', 'new20Low', 'descTriangle', 'baseBreakdown', 'bearFlag', 'spinTopAfterUp', 'rsiReclaim30', 'belowSma200', 'new55Low']
};

// Pattern names, the textbook direction (+1 bullish, −1 bearish) and the idea behind each
export const PATTERNS = {
  hammer: ['Hammer', 1, 'candle', 'Long lower wick after a fall: sellers pushed down, buyers pushed back.'],
  invHammer: ['Inverted hammer', 1, 'candle', 'Long upper wick after a fall: first sign of buyers testing higher.'],
  shootingStar: ['Shooting star', -1, 'candle', 'Long upper wick after a rise: buyers pushed up, sellers pushed back.'],
  hangingMan: ['Hanging man', -1, 'candle', 'Hammer shape after a rise: heavy selling inside the day.'],
  doji: ['Doji', 0, 'candle', 'Open ≈ close: indecision between buyers and sellers.'],
  dragonfly: ['Dragonfly doji', 1, 'candle', 'Doji with a long lower wick after a fall.'],
  gravestone: ['Gravestone doji', -1, 'candle', 'Doji with a long upper wick after a rise.'],
  spinTopAfterDown: ['Spinning top after a fall', 1, 'candle', 'Small body, long wicks on both sides: the selling is losing control.'],
  spinTopAfterUp: ['Spinning top after a rise', -1, 'candle', 'Small body, long wicks on both sides: the buying is losing control.'],
  bullEngulf: ['Bullish engulfing', 1, 'candle', 'An up day whose body covers the previous down day.'],
  bearEngulf: ['Bearish engulfing', -1, 'candle', 'A down day whose body covers the previous up day.'],
  bullHarami: ['Bullish harami', 1, 'candle', 'A small up day inside a big down day.'],
  bearHarami: ['Bearish harami', -1, 'candle', 'A small down day inside a big up day.'],
  piercing: ['Piercing line', 1, 'candle', 'Gap down, then a close above the middle of the previous down day.'],
  darkCloud: ['Dark cloud cover', -1, 'candle', 'Gap up, then a close below the middle of the previous up day.'],
  morningStar: ['Morning star', 1, 'candle', 'Big down day, small day, big up day.'],
  eveningStar: ['Evening star', -1, 'candle', 'Big up day, small day, big down day.'],
  threeSoldiers: ['Three white soldiers', 1, 'candle', 'Three strong up days in a row.'],
  threeCrows: ['Three black crows', -1, 'candle', 'Three strong down days in a row.'],
  tweezerBottom: ['Tweezer bottom', 1, 'candle', 'Two days with the same low after a fall.'],
  tweezerTop: ['Tweezer top', -1, 'candle', 'Two days with the same high after a rise.'],
  bullKicker: ['Bullish kicker', 1, 'candle', 'Down day, then a gap up that never trades back.'],
  bearKicker: ['Bearish kicker', -1, 'candle', 'Up day, then a gap down that never trades back.'],
  doubleBottom: ['Double bottom (W)', 1, 'chart', 'Two lows at the same level, then a break above the peak between them.'],
  doubleTop: ['Double top (M)', -1, 'chart', 'Two highs at the same level, then a break below the trough between them.'],
  headShoulders: ['Head and shoulders', -1, 'chart', 'Three peaks, the middle highest, then a break below the neckline.'],
  invHeadShoulders: ['Inverse head and shoulders', 1, 'chart', 'Three troughs, the middle lowest, then a break above the neckline.'],
  ascTriangle: ['Ascending triangle breakout', 1, 'chart', 'Flat highs with rising lows, then a break above the highs.'],
  descTriangle: ['Descending triangle breakdown', -1, 'chart', 'Flat lows with falling highs, then a break below the lows.'],
  bullFlag: ['Bull flag breakout', 1, 'chart', 'A sharp rise, a tight pullback on lower volume, then a new high.'],
  bearFlag: ['Bear flag breakdown', -1, 'chart', 'A sharp fall, a tight bounce on lower volume, then a new low.'],
  risingWedgeBreak: ['Rising wedge breakdown', -1, 'chart', 'Rising, narrowing range broken to the downside.'],
  fallingWedgeBreak: ['Falling wedge breakout', 1, 'chart', 'Falling, narrowing range broken to the upside.'],
  cupHandle: ['Cup with handle', 1, 'chart', 'A rounded 15–40% dip, a small handle, then a break above the old high.'],
  baseBreakout: ['Flat-base breakout', 1, 'chart', 'A tight 5-week range broken upward on heavy volume.'],
  baseBreakdown: ['Flat-base breakdown', -1, 'chart', 'A tight 5-week range broken downward on heavy volume.'],
  roundedBottom: ['Rounded bottom', 1, 'chart', 'A slow U-shaped turn, then a break above the starting level.'],
  roundedTop: ['Rounded top', -1, 'chart', 'A slow upside-down U, then a break below the starting level.'],
  abcdBull: ['Bullish ABCD (harmonic)', 1, 'harmonic', 'Price reaches point D, where the second leg down equals the first.'],
  abcdBear: ['Bearish ABCD (harmonic)', -1, 'harmonic', 'Price reaches point D, where the second leg up equals the first.'],
  gartleyBull: ['Bullish Gartley (harmonic)', 1, 'harmonic', 'Price reaches the 78.6% retracement of the X–A leg.'],
  gartleyBear: ['Bearish Gartley (harmonic)', -1, 'harmonic', 'Price reaches the 78.6% retracement of the X–A leg.'],
  rsiBullDiv: ['RSI bullish divergence', 1, 'divergence', 'Price made a lower low but RSI made a higher low.'],
  rsiBearDiv: ['RSI bearish divergence', -1, 'divergence', 'Price made a higher high but RSI made a lower high.'],
  macdBullDiv: ['MACD bullish divergence', 1, 'divergence', 'Price made a lower low but MACD made a higher low.'],
  macdBearDiv: ['MACD bearish divergence', -1, 'divergence', 'Price made a higher high but MACD made a lower high.']
};

// Composite reversion score. Feature means / spreads come from the tuning period of the study.
const FEAT = ['d50', 'd200', 'rsi', 'ret5', 'ret20', 'dd52', 'mom', 'adxDir', 'volRatio', 'pb', 'd20'];
const MU = [0.002029, 0.009209, 50.31, 0.001592, 0.006697, -0.2118, 0.08397, 1.299, 0.9732, 0.5072, 0.0007313];
const SD = [0.1054, 0.2119, 12.33, 0.06085, 0.1234, 0.1662, 0.4977, 25.5, 0.2952, 0.3361, 0.06638];
const WEIGHTS = {
  short: { d50: 1, d200: 1, dd52: 1, adxDir: 1, rsi: 0.7, ret20: 0.7, d20: 0.5 },
  long: { d200: 1, dd52: 1.2, d50: 1, mom: 0.8, rsi: 0.7, ret20: 0.7, pb: 0.5, adxDir: 0.7 }
};
// Average over the four cells of the study, by composite quintile: excess return vs the index % and change in
// how often the stock beat the index (pp). Written by research/update_app_constants.mjs.
const CALIB = {
  short: { x: [-1.06, -0.48, -0.08, 0.31, 0.91], ex: [0.37, -0.07, -0.15, -0.18, 0.03], hit: [2.47, -0.06, -1.18, -1.46, 0.22] },
  long: { x: [-1, -0.45, -0.1, 0.26, 0.82], ex: [3.23, -0.23, -0.6, -0.97, -1.43], hit: [4.75, 1.34, -1.26, -1.61, -3.22] }
};
// Out-of-sample check of the composite (rank correlation with the next return vs the index, inside each stock)
export const STUDY3 = {
  universe: '60 Hang Seng and 40 US large caps',
  period: 'tuned Oct 2019 – Jun 2023, tested Jul 2023 – Nov 2026',
  method: 'market', snapshot: 'snapshot-2026-11-25',
  short: { horizon: 10, icTrainHK: 0.007, icTestHK: 0.005, icTrainUS: 0.047, icTestUS: 0.024, posTestHK: '31 of 60', posTestUS: '21 of 40',
    top: { HK: [-0.31, -3.1], US: [0.1, 0.8] }, bottom: { HK: [0.36, 2.8], US: [0.09, 0.9] } },
  long: { horizon: 120, icTrainHK: -0.045, icTestHK: 0.107, icTrainUS: 0.097, icTestUS: 0.131, posTestHK: '40 of 60', posTestUS: '30 of 40',
    top: { HK: [-1.81, -5.3], US: [-1.48, -2.9] }, bottom: { HK: [0.36, 0.8], US: [2.75, 5.4] } }
};

// "+1.7% vs the index, 10 pts more often ahead of it"
export const evText = (v) => { const pts = Math.round(Math.abs(v.hit)); return `${v.ex >= 0 ? '+' : '−'}${Math.abs(v.ex).toFixed(1)}% vs the index, ${pts} pt${pts === 1 ? '' : 's'} ${v.hit >= 0 ? 'more' : 'less'} often ahead of it`; };

const interp = (xs, ys, x) => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let k = 1; k < xs.length; k++) if (x <= xs[k]) { const t = (x - xs[k - 1]) / (xs[k] - xs[k - 1]); return ys[k - 1] + t * (ys[k] - ys[k - 1]); }
  return ys[ys.length - 1];
};

// Verdict for one state at one horizon
export function verdict(key, h) {
  const e = EVIDENCE[key]; if (!e) return null;
  const [ex, hit, agree] = h === 'short' ? e.slice(0, 3) : e.slice(3, 6);
  const big = h === 'short' ? 2 : 3;
  // A direction is shown only when the cells agree (Newey–West |t| >= 1.5) AND the state passed
  // false-discovery control across all ~100 states tested; otherwise it reads as "no reliable edge"
  const passed = FDR_PASS[h].includes(key);
  const dir = passed && ((agree >= 3 && Math.abs(hit) >= big) || (agree >= 2 && Math.abs(hit) >= big + 1)) ? Math.sign(hit || ex) : 0;
  return { ex: ex * SHRINK, hit: hit * SHRINK, agree, dir, passed, strong: agree >= 3 && dir !== 0 };
}

// ---------- series (same definitions as the study) ----------
function series(rows) {
  const n = rows.length, c = rows.map(r => r.close), h = rows.map(r => r.high), l = rows.map(r => r.low), o = rows.map(r => r.open), v = rows.map(r => r.volume || 0);
  const smaA = (a, p) => { const out = Array(n).fill(NaN); let s = 0; for (let i = 0; i < n; i++) { s += a[i]; if (i >= p) s -= a[i - p]; if (i >= p - 1) out[i] = s / p; } return out; };
  const emaA = (a, p) => { const out = Array(n).fill(NaN); const k = 2 / (p + 1); let e = a[0]; for (let i = 0; i < n; i++) { e = i ? a[i] * k + e * (1 - k) : a[0]; out[i] = i >= p - 1 ? e : NaN; } return out; };
  const rsiA = (p) => { const out = Array(n).fill(NaN); let g = 0, lo = 0; for (let i = 1; i < n; i++) { const d = c[i] - c[i - 1]; const up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= p) { g += up / p; lo += dn / p; if (i === p) out[i] = lo === 0 ? 100 : 100 - 100 / (1 + g / lo); } else { g = (g * (p - 1) + up) / p; lo = (lo * (p - 1) + dn) / p; out[i] = lo === 0 ? 100 : 100 - 100 / (1 + g / lo); } } return out; };
  const s20 = smaA(c, 20), s50 = smaA(c, 50), s200 = smaA(c, 200), e12 = emaA(c, 12), e26 = emaA(c, 26);
  const macd = c.map((_, i) => e12[i] - e26[i]); const sig = emaA(macd.map(x => (isNaN(x) ? 0 : x)), 9);
  const r14 = rsiA(14), v20 = smaA(v, 20), v5 = smaA(v, 5);
  const sd20 = c.map((_, i) => { if (i < 19) return NaN; let s = 0; for (let k = i - 19; k <= i; k++) s += (c[k] - s20[i]) ** 2; return Math.sqrt(s / 20); });
  const tr = [0], pdm = [0], ndm = [0];
  for (let i = 1; i < n; i++) { tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))); const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; pdm.push(up > dn && up > 0 ? up : 0); ndm.push(dn > up && dn > 0 ? dn : 0); }
  const W = (a) => { const out = Array(n).fill(NaN); let s = 0; for (let i = 1; i < n; i++) { if (i <= 14) { s += a[i]; if (i === 14) out[i] = s; } else { s = s - s / 14 + a[i]; out[i] = s; } } return out; };
  const atrS = W(tr), pd = W(pdm), nd = W(ndm); const pdi = pd.map((x, i) => 100 * x / atrS[i]), ndi = nd.map((x, i) => 100 * x / atrS[i]);
  const dx = pdi.map((x, i) => 100 * Math.abs(x - ndi[i]) / (x + ndi[i] || 1)); const adx = Array(n).fill(NaN);
  { let s = 0, cnt = 0, a = NaN; for (let i = 15; i < n; i++) { if (isNaN(dx[i])) continue; if (cnt < 14) { s += dx[i]; cnt++; if (cnt === 14) a = s / 14; } else a = (a * 13 + dx[i]) / 14; adx[i] = a; } }
  const tp = c.map((x, i) => (h[i] + l[i] + x) / 3), tps = smaA(tp, 20);
  const cci = tp.map((x, i) => { if (i < 19) return NaN; let md = 0; for (let k = i - 19; k <= i; k++) md += Math.abs(tp[k] - tps[i]); md /= 20; return (x - tps[i]) / (0.015 * md || 1); });
  const mfv = c.map((x, i) => ((x - l[i]) - (h[i] - x)) / ((h[i] - l[i]) || 1) * v[i]);
  const cmf = c.map((_, i) => { if (i < 19) return NaN; let a = 0, b = 0; for (let k = i - 19; k <= i; k++) { a += mfv[k]; b += v[k]; } return b ? a / b : NaN; });
  const sar = Array(n).fill(NaN), sdir = Array(n).fill(0);
  { let up = true, af = 0.02, ep = h[0], s = l[0]; for (let i = 1; i < n; i++) { s = s + af * (ep - s); if (up) { s = Math.min(s, l[i - 1], i > 1 ? l[i - 2] : l[i - 1]); if (l[i] < s) { up = false; s = ep; ep = l[i]; af = 0.02; } else if (h[i] > ep) { ep = h[i]; af = Math.min(0.2, af + 0.02); } } else { s = Math.max(s, h[i - 1], i > 1 ? h[i - 2] : h[i - 1]); if (h[i] > s) { up = true; s = ep; ep = h[i]; af = 0.02; } else if (l[i] < ep) { ep = l[i]; af = Math.min(0.2, af + 0.02); } } sar[i] = s; sdir[i] = up ? 1 : -1; } }
  const st = Array(n).fill(0); { let up = 0, dn = 0, dir = 1; for (let i = 15; i < n; i++) { const a = atrS[i] / 14; const mid = (h[i] + l[i]) / 2; const bu = mid + 3 * a, bl = mid - 3 * a; up = (bu < up || c[i - 1] > up) ? bu : up; dn = (bl > dn || c[i - 1] < dn) ? bl : dn; if (c[i] > up) dir = 1; else if (c[i] < dn) dir = -1; st[i] = dir; } }
  const obv = [0]; for (let i = 1; i < n; i++) obv.push(obv[i - 1] + (c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0));
  const lr = c.map((x, i) => (i ? Math.log(x / c[i - 1]) : 0));
  return { n, c, h, l, o, v, s20, s50, s200, e12, e26, macd, sig, r14, v20, v5, sd20, atr: atrS.map(x => x / 14), pdi, ndi, adx, cci, cmf, sar, sdir, st, obv, lr };
}

const hhOf = (S, k, p) => { let m = -Infinity; for (let j = Math.max(0, k - p + 1); j <= k; j++) m = Math.max(m, S.h[j]); return m; };
const llOf = (S, k, p) => { let m = Infinity; for (let j = Math.max(0, k - p + 1); j <= k; j++) m = Math.min(m, S.l[j]); return m; };
const volW = (S, i, p) => { const a = Math.max(1, i - p + 1); const k = i - a + 1; let s = 0, s2 = 0; for (let q = a; q <= i; q++) { s += S.lr[q]; s2 += S.lr[q] * S.lr[q]; } const m = s / k; return Math.sqrt(Math.max(0, s2 / k - m * m)); };
const linfit = (ys) => { const n = ys.length; let sx = 0, sy = 0, sxy = 0, sxx = 0; ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; }); const b = (n * sxy - sx * sy) / (n * sxx - sx * sx); return { b, a: (sy - b * sx) / n }; };
function zigzag(c, th) {
  const piv = []; let dir = 0, ext = c[0], exti = 0;
  for (let i = 1; i < c.length; i++) {
    if (dir >= 0) { if (c[i] > ext) { ext = c[i]; exti = i; } else if (c[i] < ext * (1 - th)) { piv.push({ i: exti, p: ext, t: 'H', conf: i }); dir = -1; ext = c[i]; exti = i; } }
    if (dir < 0) { if (c[i] < ext) { ext = c[i]; exti = i; } else if (c[i] > ext * (1 + th)) { piv.push({ i: exti, p: ext, t: 'L', conf: i }); dir = 1; ext = c[i]; exti = i; } }
  }
  return piv;
}

// All tested states at day i (definitions match the study exactly)
function statesAt(S, i, piv) {
  const { c, h, l, o, v } = S, X = {};
  if (i < 60) return X;
  const near = (x, a, b) => x >= a && x <= b;
  const body = k => Math.abs(c[k] - o[k]), rng = k => (h[k] - l[k]) || 1e-9, upSh = k => h[k] - Math.max(c[k], o[k]), loSh = k => Math.min(c[k], o[k]) - l[k];
  const bull = k => c[k] > o[k], bear = k => c[k] < o[k];
  const downBefore = k => c[k - 1] < c[k - 6] * 0.97, upBefore = k => c[k - 1] > c[k - 6] * 1.03;
  const max252 = hhOf(S, i, 252), k14lo = llOf(S, i, 14), k14hi = hhOf(S, i, 14), K = 100 * (c[i] - k14lo) / ((k14hi - k14lo) || 1);
  const pb = (c[i] - (S.s20[i] - 2 * S.sd20[i])) / ((4 * S.sd20[i]) || 1);
  const mom = i >= 252 ? c[i - 21] / c[i - 252] - 1 : NaN;
  // trend and level states
  X.farBelow50 = c[i] < 0.9 * S.s50[i]; X.farAbove50 = c[i] > 1.1 * S.s50[i];
  X.aboveSma200 = c[i] > S.s200[i]; X.belowSma200 = c[i] < S.s200[i]; X.golden = S.s50[i] > S.s200[i]; X.death = S.s50[i] < S.s200[i];
  X.emaBull = S.e12[i] > S.e26[i]; X.emaBear = S.e12[i] < S.e26[i]; X.macdAbove = S.macd[i] > S.sig[i]; X.macdBelow = S.macd[i] < S.sig[i];
  const cross = (a, b, k) => { for (let q = i - k + 1; q <= i; q++) if (a[q - 1] <= b[q - 1] && a[q] > b[q]) return true; return false; };
  X.macdXup = cross(S.macd, S.sig, 3); X.macdXdn = cross(S.sig, S.macd, 3);
  X.rsi14lt30 = S.r14[i] < 30; X.rsi14gt70 = S.r14[i] > 70; X.stochLt20 = K < 20; X.stochGt80 = K > 80;
  X.cciVeryLow = S.cci[i] < -200; X.cciLow = S.cci[i] < -100 && !X.cciVeryLow; X.cciHigh = S.cci[i] > 100;
  X.bbBelow = pb < 0; X.bbAbove = pb > 1;
  X.adxUp = S.adx[i] > 25 && S.pdi[i] > S.ndi[i]; X.adxDown = S.adx[i] > 25 && S.ndi[i] > S.pdi[i]; X.adxWeak = S.adx[i] < 20;
  if (i >= 78) { const j = i - 26; const tenk = (hhOf(S, j, 9) + llOf(S, j, 9)) / 2, kij = (hhOf(S, j, 26) + llOf(S, j, 26)) / 2, spanA = (tenk + kij) / 2, spanB = (hhOf(S, j, 52) + llOf(S, j, 52)) / 2; X.aboveCloud = c[i] > Math.max(spanA, spanB); X.belowCloud = c[i] < Math.min(spanA, spanB); }
  X.superUp = S.st[i] === 1; X.superDown = S.st[i] === -1;
  X.psarUp = S.sdir[i] === 1; X.psarDown = S.sdir[i] === -1; X.psarFlipUp = S.sdir[i] === 1 && S.sdir[i - 1] === -1; X.psarFlipDown = S.sdir[i] === -1 && S.sdir[i - 1] === 1;
  X.obvUp = S.obv[i] > S.obv[i - 20]; X.obvDown = S.obv[i] < S.obv[i - 20];
  X.cmfPos = S.cmf[i] > 0.1; X.cmfNeg = S.cmf[i] < -0.1; X.volOscPos = S.v5[i] > S.v20[i] * 1.2; X.volOscNeg = S.v5[i] < S.v20[i] * 0.8;
  { const pH = hhOf(S, i - 1, 5), pL = llOf(S, i - 1, 5), P = (pH + pL + c[i - 1]) / 3; X.aboveR1 = c[i] > 2 * P - pL; X.belowS1 = c[i] < 2 * P - pH; }
  X.mom12Strong = mom > 0.2; X.mom12Weak = mom < -0.2;
  X.near52High = c[i] >= 0.95 * max252; X.deepDraw = c[i] < 0.7 * max252;
  { const v60 = volW(S, i, 60), v252 = volW(S, i, 252); X.lowVol = v60 < 0.75 * v252; X.highVol = v60 > 1.3 * v252; }
  X.new20Low = c[i] < llOf(S, i - 1, 20); X.new20High = c[i] > hhOf(S, i - 1, 20); X.new55Low = c[i] < llOf(S, i - 1, 55); X.new55High = c[i] > hhOf(S, i - 1, 55);
  X.drop5 = c[i] / c[i - 5] - 1 < -0.05; X.rsiReclaim30 = S.r14[i] > 30 && Math.min(S.r14[i - 1], S.r14[i - 2], S.r14[i - 3]) < 30;
  // candlesticks
  X.hammer = downBefore(i) && loSh(i) > 2 * body(i) && upSh(i) < body(i) + 0.1 * rng(i);
  X.invHammer = downBefore(i) && upSh(i) > 2 * body(i) && loSh(i) < body(i) + 0.1 * rng(i);
  X.shootingStar = upBefore(i) && upSh(i) > 2 * body(i) && loSh(i) < body(i) + 0.1 * rng(i);
  X.hangingMan = upBefore(i) && loSh(i) > 2 * body(i) && upSh(i) < body(i) + 0.1 * rng(i);
  X.doji = body(i) < 0.1 * rng(i);
  X.dragonfly = X.doji && loSh(i) > 0.6 * rng(i) && downBefore(i); X.gravestone = X.doji && upSh(i) > 0.6 * rng(i) && upBefore(i);
  const spin = body(i) > 0.1 * rng(i) && body(i) < 0.3 * rng(i) && upSh(i) > body(i) && loSh(i) > body(i);
  X.spinTopAfterUp = spin && upBefore(i); X.spinTopAfterDown = spin && downBefore(i);
  X.bullEngulf = downBefore(i) && bear(i - 1) && bull(i) && c[i] >= o[i - 1] && o[i] <= c[i - 1];
  X.bearEngulf = upBefore(i) && bull(i - 1) && bear(i) && c[i] <= o[i - 1] && o[i] >= c[i - 1];
  X.bullHarami = downBefore(i) && bear(i - 1) && bull(i) && o[i] > c[i - 1] && c[i] < o[i - 1] && body(i - 1) > 0.6 * rng(i - 1);
  X.bearHarami = upBefore(i) && bull(i - 1) && bear(i) && o[i] < c[i - 1] && c[i] > o[i - 1] && body(i - 1) > 0.6 * rng(i - 1);
  X.piercing = downBefore(i) && bear(i - 1) && bull(i) && o[i] < l[i - 1] && c[i] > (o[i - 1] + c[i - 1]) / 2 && c[i] < o[i - 1];
  X.darkCloud = upBefore(i) && bull(i - 1) && bear(i) && o[i] > h[i - 1] && c[i] < (o[i - 1] + c[i - 1]) / 2 && c[i] > o[i - 1];
  X.morningStar = downBefore(i - 1) && bear(i - 2) && body(i - 2) > 0.5 * rng(i - 2) && body(i - 1) < 0.3 * body(i - 2) && bull(i) && c[i] > (o[i - 2] + c[i - 2]) / 2;
  X.eveningStar = upBefore(i - 1) && bull(i - 2) && body(i - 2) > 0.5 * rng(i - 2) && body(i - 1) < 0.3 * body(i - 2) && bear(i) && c[i] < (o[i - 2] + c[i - 2]) / 2;
  X.threeSoldiers = bull(i) && bull(i - 1) && bull(i - 2) && c[i] > c[i - 1] && c[i - 1] > c[i - 2] && [i, i - 1, i - 2].every(k => body(k) > 0.6 * rng(k));
  X.threeCrows = bear(i) && bear(i - 1) && bear(i - 2) && c[i] < c[i - 1] && c[i - 1] < c[i - 2] && [i, i - 1, i - 2].every(k => body(k) > 0.6 * rng(k));
  X.tweezerBottom = downBefore(i) && Math.abs(l[i] - l[i - 1]) < 0.002 * c[i] && bear(i - 1) && bull(i);
  X.tweezerTop = upBefore(i) && Math.abs(h[i] - h[i - 1]) < 0.002 * c[i] && bull(i - 1) && bear(i);
  X.bullKicker = bear(i - 1) && bull(i) && o[i] > o[i - 1] && l[i] > h[i - 1];
  X.bearKicker = bull(i - 1) && bear(i) && o[i] < o[i - 1] && h[i] < l[i - 1];
  // chart patterns (breakout day)
  { let a = -1, b = -1; for (let k = i - 60; k < i - 10; k++) if (a < 0 || l[k] < l[a]) a = k; for (let k = a + 10; k < i - 1; k++) if (b < 0 || l[k] < l[b]) b = k;
    let pk = 0; if (a > 0 && b > 0) for (let k = a; k <= b; k++) pk = Math.max(pk, h[k]);
    X.doubleBottom = a > 0 && b > a && Math.abs(l[b] - l[a]) < 0.03 * l[a] && pk > l[a] * 1.06 && c[i] > pk && c[i - 1] <= pk; }
  { let a = -1, b = -1; for (let k = i - 60; k < i - 10; k++) if (a < 0 || h[k] > h[a]) a = k; for (let k = a + 10; k < i - 1; k++) if (b < 0 || h[k] > h[b]) b = k;
    let tr = Infinity; if (a > 0 && b > 0) for (let k = a; k <= b; k++) tr = Math.min(tr, l[k]);
    X.doubleTop = a > 0 && b > a && Math.abs(h[b] - h[a]) < 0.03 * h[a] && tr < h[a] * 0.94 && c[i] < tr && c[i - 1] >= tr; }
  { const hi25 = hhOf(S, i - 1, 25), lo25 = llOf(S, i - 1, 25); X.baseBreakout = hi25 / lo25 < 1.15 && c[i] > hi25 && v[i] > 1.4 * S.v20[i]; X.baseBreakdown = hi25 / lo25 < 1.15 && c[i] < lo25 && v[i] > 1.4 * S.v20[i]; }
  { const pole = c[i - 8] / c[i - 28] - 1, fh = hhOf(S, i - 1, 7), fl = llOf(S, i - 1, 7); X.bullFlag = pole > 0.15 && fl > fh * 0.92 && c[i] > fh && S.v5[i - 1] < S.v20[i - 8]; X.bearFlag = pole < -0.15 && fh < fl * 1.08 && c[i] < fl && S.v5[i - 1] < S.v20[i - 8]; }
  { const h30 = hhOf(S, i - 1, 30), firstLow = llOf(S, i - 16, 15), lastLow = llOf(S, i - 1, 15); let t1 = 0; for (let k = i - 30; k < i; k++) if (h[k] > h30 * 0.98) t1++;
    X.ascTriangle = t1 >= 3 && lastLow > firstLow * 1.03 && c[i] > h30;
    const l30 = llOf(S, i - 1, 30), firstHigh = hhOf(S, i - 16, 15), lastHigh = hhOf(S, i - 1, 15); let t2 = 0; for (let k = i - 30; k < i; k++) if (l[k] < l30 * 1.02) t2++;
    X.descTriangle = t2 >= 3 && lastHigh < firstHigh * 0.97 && c[i] < l30; }
  if (i >= 120) { const left = hhOf(S, i - 30, 90), cupLow = llOf(S, i - 10, 80), handleLo = llOf(S, i - 1, 10); X.cupHandle = cupLow < left * 0.85 && cupLow > left * 0.6 && handleLo > left * 0.88 && c[i] > left && c[i - 1] <= left; }
  if (i >= 90) {
    const ls = hhOf(S, i - 60, 30), hd = hhOf(S, i - 30, 30), rs = hhOf(S, i - 1, 30), neck = Math.min(llOf(S, i - 45, 15), llOf(S, i - 15, 15));
    X.headShoulders = hd > ls * 1.05 && hd > rs * 1.05 && Math.abs(ls - rs) < 0.05 * ls && c[i] < neck && c[i - 1] >= neck;
    const ls2 = llOf(S, i - 60, 30), hd2 = llOf(S, i - 30, 30), rs2 = llOf(S, i - 1, 30), neck2 = Math.max(hhOf(S, i - 45, 15), hhOf(S, i - 15, 15));
    X.invHeadShoulders = hd2 < ls2 * 0.95 && hd2 < rs2 * 0.95 && Math.abs(ls2 - rs2) < 0.05 * ls2 && c[i] > neck2 && c[i - 1] <= neck2;
  }
  { const H = h.slice(i - 30, i), Lw = l.slice(i - 30, i); const fh = linfit(H), fl = linfit(Lw); const upper = fh.a + fh.b * 30, lower = fl.a + fl.b * 30; const conv = (upper - lower) < (H[0] - Lw[0]) * 0.7 || (fh.a - fl.a) > (upper - lower) * 1.4;
    X.risingWedgeBreak = fh.b > 0 && fl.b > fh.b && conv && c[i] < lower && c[i - 1] >= fl.a + fl.b * 29;
    X.fallingWedgeBreak = fl.b < 0 && fh.b < fl.b && conv && c[i] > upper && c[i - 1] <= fh.a + fh.b * 29; }
  { const w = c.slice(i - 60, i), a = w.slice(0, 20), m = w.slice(20, 40), z = w.slice(40); const avg = q => q.reduce((s, x) => s + x, 0) / q.length;
    const rimL = Math.max(...a), rimT = Math.min(...a);
    X.roundedBottom = avg(m) < avg(a) * 0.9 && avg(m) < avg(z) * 0.93 && Math.min(...m) <= Math.min(...w) && c[i] > rimL && c[i - 1] <= rimL;
    X.roundedTop = avg(m) > avg(a) * 1.1 && avg(m) > avg(z) * 1.07 && Math.max(...m) >= Math.max(...w) && c[i] < rimT && c[i - 1] >= rimT; }
  { const P = piv.filter(p => p.conf <= i).slice(-4);
    if (P.length >= 3) { const [A, B, Cc] = P.slice(-3); const AB = Math.abs(A.p - B.p), r = Math.abs(Cc.p - B.p) / AB;
      if (A.t === 'H' && B.t === 'L' && Cc.t === 'H' && near(r, 0.382, 0.886)) { const D = Cc.p - AB; X.abcdBull = near(c[i], D * 0.98, D * 1.02) && l[i] <= D * 1.02; }
      if (A.t === 'L' && B.t === 'H' && Cc.t === 'L' && near(r, 0.382, 0.886)) { const D = Cc.p + AB; X.abcdBear = near(c[i], D * 0.98, D * 1.02) && h[i] >= D * 0.98; } }
    if (P.length >= 4) { const [Xp, A, B, Cc] = P; const XA = Math.abs(A.p - Xp.p), AB = Math.abs(A.p - B.p), BC = Math.abs(Cc.p - B.p);
      if (Xp.t === 'L' && A.t === 'H' && near(AB / XA, 0.55, 0.69) && near(BC / AB, 0.382, 0.886)) { const D = A.p - 0.786 * XA; X.gartleyBull = near(c[i], D * 0.98, D * 1.02); }
      if (Xp.t === 'H' && A.t === 'L' && near(AB / XA, 0.55, 0.69) && near(BC / AB, 0.382, 0.886)) { const D = A.p + 0.786 * XA; X.gartleyBear = near(c[i], D * 0.98, D * 1.02); } } }
  { const lowIdx = (a, b) => { let m = Infinity, ix = a; for (let q = a; q <= b; q++) if (c[q] < m) { m = c[q]; ix = q; } return ix; }; const hiIdx = (a, b) => { let m = -Infinity, ix = a; for (let q = a; q <= b; q++) if (c[q] > m) { m = c[q]; ix = q; } return ix; };
    const i1 = lowIdx(i - 19, i), i0 = lowIdx(i - 45, i - 20), j1 = hiIdx(i - 19, i), j0 = hiIdx(i - 45, i - 20);
    X.rsiBullDiv = c[i1] < c[i0] && S.r14[i1] > S.r14[i0] + 3 && i - i1 <= 5; X.rsiBearDiv = c[j1] > c[j0] && S.r14[j1] < S.r14[j0] - 3 && i - j1 <= 5;
    X.macdBullDiv = c[i1] < c[i0] && S.macd[i1] > S.macd[i0] && i - i1 <= 5; X.macdBearDiv = c[j1] > c[j0] && S.macd[j1] < S.macd[j0] && i - j1 <= 5; }
  return X;
}

// Raw feature values for the composite at day i
function featuresAt(S, i) {
  const { c } = S;
  const max252 = hhOf(S, i, 252);
  return {
    d50: c[i] / S.s50[i] - 1, d200: c[i] / S.s200[i] - 1, rsi: S.r14[i], ret5: c[i] / c[i - 5] - 1, ret20: c[i] / c[i - 20] - 1,
    dd52: c[i] / max252 - 1, mom: i >= 252 ? c[i - 21] / c[i - 252] - 1 : NaN, adxDir: S.adx[i] * Math.sign(S.pdi[i] - S.ndi[i]),
    volRatio: volW(S, i, 60) / volW(S, i, 252), pb: (c[i] - (S.s20[i] - 2 * S.sd20[i])) / ((4 * S.sd20[i]) || 1), d20: c[i] / S.s20[i] - 1
  };
}

function composite(f, h) {
  let s = 0, ws = 0; const parts = {};
  for (const [nm, w] of Object.entries(WEIGHTS[h])) {
    const j = FEAT.indexOf(nm); const x = f[nm]; if (!isFinite(x)) continue;
    const z = Math.max(-3, Math.min(3, (x - MU[j]) / SD[j]));
    parts[nm] = -w * z; s += -w * z; ws += w;
  }
  const score = ws ? s / ws : 0;
  Object.keys(parts).forEach(k => { parts[k] /= ws; });
  return { score, parts };
}

// Plain-language reason for each composite ingredient (sign > 0 = pushes the outlook up)
function featureReason(nm, f, h) {
  const pct = (x) => `${Math.abs(x * 100).toFixed(1)}%`;
  const ev = (key) => { const v = verdict(key, h); return v ? ` In the study: ${evText(v)}.` : ''; };
  switch (nm) {
    case 'd50': return f.d50 < 0 ? `Price is ${pct(f.d50)} below its 50-day average.${f.d50 < -0.1 ? ev('farBelow50') : ''}` : `Price is ${pct(f.d50)} above its 50-day average.${f.d50 > 0.1 ? ev('farAbove50') : ''}`;
    case 'd200': return f.d200 < 0 ? `Price is ${pct(f.d200)} below its 200-day average, the long-term trend line.${ev('belowSma200')}` : `Price is ${pct(f.d200)} above its 200-day average.${ev('aboveSma200')}`;
    case 'dd52': return f.dd52 < -0.3 ? `Price is ${pct(f.dd52)} below its 52-week high, a deep drawdown.${ev('deepDraw')}` : f.dd52 > -0.05 ? `Price is within ${pct(f.dd52)} of its 52-week high.${ev('near52High')}` : f.dd52 > -0.21 ? `Price is ${pct(f.dd52)} below its 52-week high (a typical stock sits about 21% below).` : `Price is ${pct(f.dd52)} below its 52-week high, a bigger pullback than usual.`;
    case 'rsi': return f.rsi < 30 ? `RSI is ${f.rsi.toFixed(0)} (oversold).${ev('rsi14lt30')}` : f.rsi > 70 ? `RSI is ${f.rsi.toFixed(0)} (overbought).${ev('rsi14gt70')}` : `RSI is ${f.rsi.toFixed(0)}, neither oversold nor overbought.`;
    case 'ret20': return f.ret20 < 0 ? `Down ${pct(f.ret20)} over the last month.` : `Up ${pct(f.ret20)} over the last month.`;
    case 'mom': return f.mom < 0 ? `Down ${pct(f.mom)} over the past year (excluding the last month).${f.mom < -0.2 ? ev('mom12Weak') : ''}` : `Up ${pct(f.mom)} over the past year (excluding the last month).${f.mom > 0.2 ? ev('mom12Strong') : ''}`;
    case 'adxDir': return f.adxDir < -25 ? `A strong downtrend (ADX ${Math.abs(f.adxDir).toFixed(0)}, sellers ahead).${ev('adxDown')}` : f.adxDir > 25 ? `A strong uptrend (ADX ${f.adxDir.toFixed(0)}, buyers ahead).${ev('adxUp')}` : `No strong trend (ADX ${Math.abs(f.adxDir).toFixed(0)}).`;
    case 'pb': return f.pb < 0 ? `Price is below the lower Bollinger band.${ev('bbBelow')}` : f.pb > 1 ? `Price is above the upper Bollinger band.` : `Price is inside the Bollinger bands.`;
    case 'd20': return f.d20 < 0 ? `Price is ${pct(f.d20)} below its 20-day average.` : `Price is ${pct(f.d20)} above its 20-day average.`;
    default: return '';
  }
}

// Events (patterns) that add to the composite, at half weight (they partly overlap with it)
const EVENT_KEYS = Object.keys(PATTERNS).concat(['cciVeryLow', 'cmfPos', 'cmfNeg', 'psarFlipDown', 'rsiReclaim30']);

const SIGNALS = ['Sell', 'Reduce', 'Hold', 'Accumulate', 'Buy'];
const signalOf = (lift, cut) => (lift >= cut[1] ? 'Buy' : lift >= cut[0] ? 'Accumulate' : lift > -cut[0] ? 'Hold' : lift > -cut[1] ? 'Reduce' : 'Sell');

/**
 * Short- and long-term outlook for one stock.
 * @param rows daily [{date, open, high, low, close, volume}] (≥ 260 days for every feature)
 * @param price live price
 * @param valScore valuation score −1…1 (long-term only; optional)
 * @param severe true when serious company news was found (caps the signal at Hold)
 */
export function horizonOutlook({ rows, price, valScore = null, severe = false }) {
  if (!rows || rows.length < 80) return null;
  const R = rows.slice();
  if (price && R.length) { const last = R[R.length - 1]; R[R.length - 1] = { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) }; }
  const S = series(R); const n = S.n, i = n - 1;
  const piv = zigzag(S.c, 0.06);
  const now = statesAt(S, i, piv);
  // patterns in the last 5 sessions
  const recent = [];
  for (let k = Math.max(60, n - 5); k < n; k++) { const X = k === i ? now : statesAt(S, k, piv); Object.keys(PATTERNS).forEach(key => { if (X[key]) recent.push({ key, date: R[k].date, ago: i - k }); }); }
  const uniq = []; recent.sort((a, b) => a.ago - b.ago).forEach(r => { if (!uniq.some(u => u.key === r.key)) uniq.push(r); });
  const f = featuresAt(S, i);
  const p = S.c[i];
  const dailyVol = volW(S, i, Math.min(250, i)) || 0.02;
  const atrNow = S.atr[i] || p * dailyVol;

  const build = (h) => {
    const H = h === 'short' ? 10 : 120;
    // the stock's own normal behaviour over this horizon (its past), blended with the market average when short
    let cnt = 0, ups = 0, sum = 0;
    for (let k = Math.max(0, n - 1 - 1000); k + H < n; k++) { const r = S.c[k + H] / S.c[k] - 1; cnt++; sum += r; if (r > 0) ups++; }
    const mkt = h === 'short' ? { up: 0.51, mean: 0.004 } : { up: 0.55, mean: 0.05 };
    const w = Math.min(1, cnt / 500);
    const baseUp = cnt ? w * (ups / cnt) + (1 - w) * mkt.up : mkt.up;
    const baseMean = cnt ? w * (sum / cnt) + (1 - w) * mkt.mean : mkt.mean;
    const comp = composite(f, h);
    const C = CALIB[h];
    let hitLift = interp(C.x, C.hit, comp.score) * SHRINK, exLift = interp(C.x, C.ex, comp.score) * SHRINK;
    const events = [];
    EVENT_KEYS.forEach(key => {
      const active = PATTERNS[key] ? uniq.some(u => u.key === key) : now[key];
      if (!active) return; const v = verdict(key, h); if (!v || !v.dir) return;
      hitLift += 0.5 * v.hit; exLift += 0.5 * v.ex; events.push({ key, v });
    });
    let valPart = null;
    if (h === 'long' && valScore !== null && valScore !== undefined) { valPart = { hit: 3 * valScore, ex: 1.5 * valScore }; hitLift += valPart.hit; exLift += valPart.ex; }
    hitLift = Math.max(-20, Math.min(20, hitLift));
    const probUp = Math.max(0.05, Math.min(0.95, baseUp + hitLift / 100));
    const expRet = baseMean + exLift / 100;
    const sigmaH = dailyVol * Math.sqrt(H);
    let signal = signalOf(hitLift, h === 'short' ? [2, 5] : [3, 7]);
    if (severe && SIGNALS.indexOf(signal) > 2) signal = 'Hold';
    // drivers: composite ingredients sorted by size
    const neutral = /neither|inside the Bollinger|No strong trend/;
    // A higher composite score raised or lowered the outlook depending on the calibration (in the market-relative
    // study the long-term score works in reverse), so each part's push follows that slope; when the top and
    // bottom quintiles differ by less than 3 points, the parts are shown as neutral
    const spread = C.hit[C.hit.length - 1] - C.hit[0];
    const slope = Math.abs(spread) >= 3 ? Math.sign(spread) : 0;
    const drivers = Object.entries(comp.parts).filter(([, v]) => Math.abs(v) > 0.08).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([nm, v]) => ({ dir: Math.sign(v) * slope, text: featureReason(nm, f, h) })).filter(d => d.text && !neutral.test(d.text)).slice(0, 5);
    events.forEach(({ key, v }) => {
      const name = PATTERNS[key] ? PATTERNS[key][0] : { cciVeryLow: 'CCI below −200', cmfPos: 'Chaikin money flow strongly positive', cmfNeg: 'Chaikin money flow strongly negative', psarFlipDown: 'Parabolic SAR flipped down', rsiReclaim30: 'RSI climbed back above 30' }[key];
      const taught = PATTERNS[key] ? PATTERNS[key][1] : 0;
      drivers.push({ dir: v.dir, text: `${name}${taught && taught !== v.dir ? ' (the textbook reads it the other way; in the study it worked in reverse)' : ''}: ${evText(v)}.` });
    });
    if (valPart) drivers.push({ dir: Math.sign(valScore), text: valScore > 0 ? 'Price is below the fair-value range from your valuation inputs. (Value matters most over months; this part comes from published research, not this study.)' : valScore < 0 ? 'Price is above the fair-value range from your valuation inputs, which lowers the long-term outlook.' : 'Price is inside the fair-value range.' });
    if (severe) drivers.push({ dir: -1, text: 'Serious company news in the last two weeks: buy signals are switched off until it clears.' });

    // triggers: what would change the picture, with prices
    const fmtP = (x) => Math.round(x * 100) / 100;
    const swingLow = h === 'short' ? llOf(S, i, 10) : llOf(S, i, 120), swingHigh = h === 'short' ? hhOf(S, i, 10) : hhOf(S, i, 60);
    const up = [], down = [];
    if (h === 'short') {
      if (p < S.s20[i]) up.push(`A close back above the 20-day average (${fmtP(S.s20[i])}) would confirm the bounce has started.`);
      else up.push(`Holding above the 20-day average (${fmtP(S.s20[i])}) keeps the short-term picture intact.`);
      if (S.r14[i] < 30) { const v = verdict('rsiReclaim30', 'short'); up.push(`RSI climbing back above 30 is the classic sign of a turn${v ? ` (in the study: ${evText(v)} over 2 weeks)` : ''}.`); }
      up.push(`A break above the 10-day high (${fmtP(swingHigh)}) would show buyers taking control.`);
      down.push(`A close below the 10-day low (${fmtP(swingLow)}) would mean the selling is not finished: that is the natural stop.`);
      if (S.v[i] > 1.5 * S.v20[i] && S.c[i] < S.c[i - 1]) down.push('Today’s heavy-volume drop: watch for follow-through selling tomorrow.');
      down.push('Bad company news or a market-wide sell-off can override these signals in the short run.');
    } else {
      if (p < S.s200[i]) up.push(`Reclaiming the 200-day average (${fmtP(S.s200[i])}) would show the long-term downtrend is over.`);
      else up.push(`Staying above the 200-day average (${fmtP(S.s200[i])}) supports the long-term case.`);
      if (valScore > 0) up.push('The market re-rating the stock towards its fair value (for example after results) is the main long-term upside driver.');
      up.push(`A move through the 3-month high (${fmtP(swingHigh)}) would confirm recovery.`);
      down.push(`A new 6-month low below ${fmtP(swingLow)} would break the recovery case.`);
      down.push('Weaker earnings or guidance would lower the fair value and the long-term outlook.');
    }

    // levels sized to the horizon
    const stop = h === 'short' ? Math.min(p - 1.5 * atrNow, swingLow * 0.995) : Math.min(p * (1 - 0.9 * sigmaH), swingLow * 0.98);
    const stopC = Math.max(stop, p * (1 - (h === 'short' ? 0.12 : 0.35)));
    const target = p * (1 + Math.max(expRet + (h === 'short' ? 0.8 : 0.6) * sigmaH, h === 'short' ? 2 * atrNow / p : 0.1));
    const nu = Math.log(1 + expRet) / H;
    const probT = Math.max(0, Math.min(1, (() => { const b = Math.log(target / p), a = Math.log(p / stopC); const k = (2 * nu) / (dailyVol * dailyVol); if (Math.abs(k) < 1e-9) return a / (a + b); return (1 - Math.exp(k * a)) / (Math.exp(-k * b) - Math.exp(k * a)); })()));
    return {
      horizon: H, label: h === 'short' ? 'Short-term · about 2 weeks' : 'Long-term · about 6 months',
      signal, probUp, baseUp, lift: hitLift, expRet, baseMean, sigmaH,
      range: [p * (1 + expRet - sigmaH), p * (1 + expRet + sigmaH)],
      composite: comp.score, drivers, triggers: { up, down }, events: events.map(e => e.key),
      entry: p, stop: stopC, target, rr: (target - p) / Math.max(1e-9, p - stopC), probTarget: probT,
      evPerShare: probT * (target - p) - (1 - probT) * (p - stopC)
    };
  };

  return { short: build('short'), long: build('long'), now, features: f, patterns: uniq, series: S, i };
}

// Rows for the indicator table: current value, current state, and what that state led to at each horizon
export function indicatorTable(o) {
  if (!o) return [];
  const S = o.series, i = o.i, X = o.now, c = S.c[i];
  const f2 = (x, d = 2) => (isFinite(x) ? x.toFixed(d) : '—');
  const k14lo = llOf(S, i, 14), k14hi = hhOf(S, i, 14), K = 100 * (c - k14lo) / ((k14hi - k14lo) || 1);
  const pick = (...keys) => keys.find(k => X[k]) || null;
  const rows = [
    ['50-day average', 'Trend', `${f2(S.s50[i])} (${f2((c / S.s50[i] - 1) * 100, 1)}%)`, pick('farBelow50', 'farAbove50'), X.farBelow50 ? 'More than 10% below' : X.farAbove50 ? 'More than 10% above' : 'Within 10%'],
    ['200-day average', 'Trend', `${f2(S.s200[i])}`, pick('aboveSma200', 'belowSma200'), X.aboveSma200 ? 'Price above' : 'Price below'],
    ['SMA 50 / 200 cross', 'Trend', `${f2(S.s50[i])} / ${f2(S.s200[i])}`, pick('golden', 'death'), X.golden ? 'Golden cross state' : 'Death cross state'],
    ['EMA 12 / 26', 'Trend', `${f2(S.e12[i])} / ${f2(S.e26[i])}`, pick('emaBull', 'emaBear'), X.emaBull ? 'Fast above slow' : 'Fast below slow'],
    ['MACD (12,26,9)', 'Trend', `${f2(S.macd[i], 3)} vs ${f2(S.sig[i], 3)}`, pick('macdXup', 'macdXdn', 'macdAbove', 'macdBelow'), X.macdXup ? 'Just crossed up' : X.macdXdn ? 'Just crossed down' : X.macdAbove ? 'Above signal' : 'Below signal'],
    ['Parabolic SAR', 'Trend', `${f2(S.sar[i])}`, pick('psarFlipUp', 'psarFlipDown', 'psarUp', 'psarDown'), X.psarFlipUp ? 'Just flipped up' : X.psarFlipDown ? 'Just flipped down' : X.psarUp ? 'Dots below price' : 'Dots above price'],
    ['ADX (14) · ±DI', 'Trend', `${f2(S.adx[i], 1)} · ${f2(S.pdi[i], 1)} / ${f2(S.ndi[i], 1)}`, pick('adxUp', 'adxDown', 'adxWeak'), X.adxUp ? 'Strong uptrend' : X.adxDown ? 'Strong downtrend' : X.adxWeak ? 'No trend' : 'Moderate trend'],
    ['Ichimoku cloud', 'Trend', '', pick('aboveCloud', 'belowCloud'), X.aboveCloud ? 'Above the cloud' : X.belowCloud ? 'Below the cloud' : 'Inside the cloud'],
    ['Supertrend (10,3)', 'Trend', '', pick('superUp', 'superDown'), X.superUp ? 'Up' : 'Down'],
    ['RSI (14)', 'Momentum', f2(S.r14[i], 1), pick('rsi14lt30', 'rsi14gt70'), S.r14[i] < 30 ? 'Oversold (<30)' : S.r14[i] > 70 ? 'Overbought (>70)' : 'Neutral'],
    ['Stochastic (14,3)', 'Momentum', `%K ${f2(K, 1)}`, pick('stochLt20', 'stochGt80'), K < 20 ? 'Oversold (<20)' : K > 80 ? 'Overbought (>80)' : 'Neutral'],
    ['Williams %R (14)', 'Momentum', f2(K - 100, 1), pick('stochLt20', 'stochGt80'), K < 20 ? 'Oversold (<−80)' : K > 80 ? 'Overbought (>−20)' : 'Neutral'],
    ['CCI (20)', 'Momentum', f2(S.cci[i], 0), pick('cciVeryLow', 'cciLow', 'cciHigh'), S.cci[i] < -200 ? 'Deeply oversold (<−200)' : S.cci[i] < -100 ? 'Oversold (<−100)' : S.cci[i] > 100 ? 'Overbought (>+100)' : 'Neutral'],
    ['12-month momentum', 'Momentum', isFinite(o.features.mom) ? `${f2(o.features.mom * 100, 1)}%` : '—', pick('mom12Strong', 'mom12Weak'), o.features.mom > 0.2 ? 'Big winner' : o.features.mom < -0.2 ? 'Big loser' : 'Normal'],
    ['Bollinger (20,2)', 'Volatility', `%B ${f2(((c - (S.s20[i] - 2 * S.sd20[i])) / (4 * S.sd20[i] || 1)) * 100, 0)}`, pick('bbBelow', 'bbAbove'), X.bbBelow ? 'Below lower band' : X.bbAbove ? 'Above upper band' : 'Inside the bands'],
    ['ATR / volatility', 'Volatility', `${f2(S.atr[i])} a day`, pick('lowVol', 'highVol'), X.lowVol ? 'Calmer than usual' : X.highVol ? 'Wilder than usual' : 'Normal'],
    ['52-week position', 'Volatility', `${f2(o.features.dd52 * 100, 1)}% from high`, pick('deepDraw', 'near52High'), X.deepDraw ? 'More than 30% below the high' : X.near52High ? 'Near the high' : 'In between'],
    ['On-balance volume', 'Volume', '', pick('obvUp', 'obvDown'), X.obvUp ? 'Rising (20 days)' : 'Falling (20 days)'],
    ['Chaikin money flow (20)', 'Volume', f2(S.cmf[i], 2), pick('cmfPos', 'cmfNeg'), S.cmf[i] > 0.1 ? 'Buying pressure' : S.cmf[i] < -0.1 ? 'Selling pressure' : 'Neutral'],
    ['Volume oscillator (5/20)', 'Volume', `${f2((S.v5[i] / S.v20[i] - 1) * 100, 0)}%`, pick('volOscPos', 'volOscNeg'), X.volOscPos ? 'Volume rising' : X.volOscNeg ? 'Volume drying up' : 'Normal'],
    ['Pivot points (weekly)', 'Levels', '', pick('aboveR1', 'belowS1'), X.aboveR1 ? 'Above R1' : X.belowS1 ? 'Below S1' : 'Between S1 and R1']
  ];
  return rows.map(([name, group, now, key, reading]) => ({ name, group, now, key, reading, short: key ? verdict(key, 'short') : null, long: key ? verdict(key, 'long') : null }));
}

export const SIGNAL_SCALE = SIGNALS;

// Internals for research/study3.mjs, so the study re-runs with exactly the definitions the app uses
export const _research = { series, statesAt, featuresAt, composite, zigzag, FEAT, MU, SD, WEIGHTS, CALIB, SHRINK };
