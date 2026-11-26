// Technical indicators and simple statistics on daily OHLCV rows:
//   rows: [{ date, open, high, low, close, volume }] oldest first.
// Every series function returns an array the same length as `rows` (null where not enough history yet).

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < n - 1) continue;
    if (prev === null) prev = values.slice(0, n).reduce((s, v) => s + v, 0) / n; // seed with SMA
    else prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// RSI with Wilder's smoothing
export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

// KD (stochastic) 9,3,3 as used in Taiwan / HK charting: RSV over 9 days, K and D smoothed 1/3
export function kd(rows, n = 9) {
  const K = new Array(rows.length).fill(null);
  const D = new Array(rows.length).fill(null);
  let k = 50, d = 50;
  for (let i = 0; i < rows.length; i++) {
    if (i < n - 1) continue;
    const win = rows.slice(i - n + 1, i + 1);
    const hi = Math.max(...win.map(r => r.high));
    const lo = Math.min(...win.map(r => r.low));
    const rsv = hi === lo ? 50 : ((rows[i].close - lo) / (hi - lo)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    K[i] = k; D[i] = d;
  }
  return { K, D };
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const dif = closes.map((_, i) => (ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null));
  const start = dif.findIndex(v => v !== null);
  const sig = new Array(closes.length).fill(null);
  if (start >= 0) {
    const tail = ema(dif.slice(start), signal);
    tail.forEach((v, j) => { sig[start + j] = v; });
  }
  const hist = dif.map((v, i) => (v !== null && sig[i] !== null ? v - sig[i] : null));
  return { dif, signal: sig, hist };
}

export function bollinger(closes, n = 20, mult = 2) {
  const mid = sma(closes, n);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = n - 1; i < closes.length; i++) {
    const win = closes.slice(i - n + 1, i + 1);
    const mean = mid[i];
    const sd = Math.sqrt(win.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

// ---- Statistics ----
const dailyReturns = (closes) => closes.slice(1).map((c, i) => Math.log(c / closes[i]));

export function annualVolatility(closes, days = 252) {
  const r = dailyReturns(closes.slice(-days - 1));
  if (r.length < 10) return null;
  const mean = r.reduce((s, v) => s + v, 0) / r.length;
  const variance = r.reduce((s, v) => s + (v - mean) ** 2, 0) / (r.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function periodReturn(closes, days) {
  if (closes.length <= days) return null;
  const past = closes[closes.length - 1 - days];
  return past > 0 ? closes[closes.length - 1] / past - 1 : null;
}

// Sharpe ratio over the last year: (annualised return − risk-free) / annualised volatility
export function sharpe(closes, riskFree = 0.03) {
  const vol = annualVolatility(closes);
  const n = Math.min(252, closes.length - 1);
  if (!vol || n < 20) return null;
  const ret = Math.pow(closes[closes.length - 1] / closes[closes.length - 1 - n], 252 / n) - 1;
  return (ret - riskFree) / vol;
}

export function maxDrawdown(closes) {
  let peak = -Infinity, mdd = 0;
  closes.forEach(c => { peak = Math.max(peak, c); mdd = Math.min(mdd, c / peak - 1); });
  return mdd;
}

// Holt's linear exponential smoothing. Alpha/beta are picked by grid search on one-step-ahead error,
// then the trend is projected `horizon` days ahead with a ±1.96σ band that widens with √h.
export function holtForecast(closes, horizon = 20) {
  const y = closes.slice(-250);
  if (y.length < 30) return null;
  let best = null;
  for (let a = 0.1; a <= 0.95; a += 0.05) {
    for (let b = 0.01; b <= 0.5; b += 0.04) {
      let level = y[0], trend = y[1] - y[0], sse = 0;
      for (let i = 1; i < y.length; i++) {
        const pred = level + trend;
        sse += (y[i] - pred) ** 2;
        const prevLevel = level;
        level = a * y[i] + (1 - a) * (level + trend);
        trend = b * (level - prevLevel) + (1 - b) * trend;
      }
      if (!best || sse < best.sse) best = { a, b, sse, level, trend };
    }
  }
  const sigma = Math.sqrt(best.sse / (y.length - 1));
  const path = [];
  for (let h = 1; h <= horizon; h++) {
    const mid = best.level + h * best.trend;
    const band = 1.96 * sigma * Math.sqrt(h);
    path.push({ h, mid, upper: mid + band, lower: Math.max(0, mid - band) });
  }
  return { alpha: best.a, beta: best.b, sigma, path };
}

// ---- Indicator verdicts and a combined score (−10 … +10) ----
export function technicalReview(rows) {
  if (!rows || rows.length < 35) return null;
  const closes = rows.map(r => r.close);
  const i = rows.length - 1;
  const price = closes[i];
  const ma20 = sma(closes, 20), ma60 = sma(closes, 60);
  const { K, D } = kd(rows);
  const r = rsi(closes);
  const m = macd(closes);
  const bb = bollinger(closes);
  const items = [];

  // Moving-average alignment
  const m20 = ma20[i], m60 = ma60[i];
  let s = 0, tag, note;
  if (Math.abs(price - m20) / m20 < 0.002 && (m60 === null || Math.abs(m20 - m60) / m60 < 0.002)) { s = 0; tag = 'Flat'; note = 'Price and averages are moving sideways'; }
  else if (m60 !== null && price > m20 && m20 > m60) { s = 2; tag = 'Bullish alignment'; note = `Price above MA20 (${m20.toFixed(2)}) above MA60 (${m60.toFixed(2)}): uptrend`; }
  else if (m60 !== null && price < m20 && m20 < m60) { s = -2; tag = 'Bearish alignment'; note = `Price below MA20 (${m20.toFixed(2)}) below MA60 (${m60.toFixed(2)}): downtrend`; }
  else if (price > m20) { s = 1; tag = 'Above MA20'; note = `Price above the 20-day average (${m20.toFixed(2)}); longer trend mixed`; }
  else { s = -1; tag = 'Below MA20'; note = `Price below the 20-day average (${m20.toFixed(2)}): short-term weakness`; }
  items.push({ id: 'ma', label: 'Moving averages', score: s, tag, note });

  // KD
  const k = K[i], d = D[i], kPrev = K[i - 1], dPrev = D[i - 1];
  if (k !== null) {
    const crossUp = kPrev !== null && kPrev <= dPrev && k > d;
    const crossDown = kPrev !== null && kPrev >= dPrev && k < d;
    if (k < 20 && crossUp) { s = 2; tag = 'Oversold, turning up'; }
    else if (k > 80 && crossDown) { s = -2; tag = 'Overbought, turning down'; }
    else if (k < 20) { s = 1; tag = 'Oversold'; }
    else if (k > 80) { s = -1; tag = 'Overbought'; }
    else if (Math.abs(k - d) < 0.5) { s = 0; tag = 'Flat'; }
    else { s = k > d ? 1 : -1; tag = k > d ? 'K above D' : 'K below D'; }
    items.push({ id: 'kd', label: 'KD (9,3,3)', score: s, tag, note: `K ${k.toFixed(1)}, D ${d.toFixed(1)}${crossUp ? ' · golden cross' : crossDown ? ' · death cross' : ''}` });
  }

  // RSI
  const rv = r[i];
  if (rv !== null) {
    if (rv >= 70) { s = -1; tag = 'Overbought'; }
    else if (rv <= 30) { s = 1; tag = 'Oversold'; }
    else if (Math.abs(rv - 50) < 1) { s = 0; tag = 'Neutral'; }
    else if (rv >= 50) { s = 1; tag = 'Bullish zone'; }
    else { s = -1; tag = 'Weak zone'; }
    items.push({ id: 'rsi', label: 'RSI (14)', score: s, tag, note: `RSI ${rv.toFixed(1)} (${rv >= 50 ? 'above' : 'below'} 50)` });
  }

  // MACD
  const h = m.hist[i], hPrev = m.hist[i - 1];
  if (h !== null && hPrev !== null) {
    if (h > 0 && h >= hPrev) { s = 2; tag = 'Bullish momentum'; }
    else if (h > 0) { s = 1; tag = 'Bullish, fading'; }
    else if (h >= hPrev) { s = -1; tag = 'Bearish, easing'; }
    else { s = -2; tag = 'Bearish momentum'; }
    items.push({ id: 'macd', label: 'MACD (12,26,9)', score: s, tag, note: `DIF ${m.dif[i].toFixed(3)}, signal ${m.signal[i].toFixed(3)}, histogram ${h.toFixed(3)}` });
  }

  // Bollinger
  const up = bb.upper[i], lo = bb.lower[i], mid = bb.mid[i];
  if (up !== null && up - lo > 1e-9) {
    const pctB = (price - lo) / (up - lo);
    if (price > up) { s = -1; tag = 'Above upper band'; }
    else if (price < lo) { s = 1; tag = 'Below lower band'; }
    else if (price >= mid) { s = 1; tag = 'Upper half'; }
    else { s = -1; tag = 'Lower half'; }
    items.push({ id: 'bb', label: 'Bollinger (20,2)', score: s, tag, note: `%B ${(pctB * 100).toFixed(0)}% · band ${lo.toFixed(2)}–${up.toFixed(2)} · width ${(((up - lo) / mid) * 100).toFixed(1)}%` });
  }

  const total = items.reduce((t, x) => t + x.score, 0);
  const verdict = total >= 5 ? 'Strong bullish' : total >= 2 ? 'Bullish' : total <= -5 ? 'Strong bearish' : total <= -2 ? 'Bearish' : 'Neutral';
  return { items, total, verdict };
}

// ---- Valuation models (per share) ----
//   P/E multiple:    EPS × fair P/E
//   Earnings DCF:    Σ EPS·(1+g)^t / (1+r)^t, t = 1..5, + EPS·(1+g)^5 × terminal P/E / (1+r)^5
//   Gordon DDM:      DPS·(1+gd) / (r − gd)            (only when r > gd and DPS > 0)
//   Graham formula:  EPS × (8.5 + 2g)                  (g in %, the classic 1962 version)
//   FCF DCF:         Σ FCF·(1+g)^t / (1+r)^t, t = 1..5, + FCF·(1+g)^5·(1+gT) / (r − gT) / (1+r)^5, gT = 2.5%
//                    (free cash flow to equity per share, from the nightly company data when available)
// The fair value shown is the median of the models that apply.
export function valuationModels({ eps, growthPct, discountPct, terminalPe, fairPe, dps, divGrowthPct, fcfPerShare = 0 }) {
  const g = (growthPct || 0) / 100, r = (discountPct || 0) / 100, gd = (divGrowthPct || 0) / 100;
  const out = [];
  if (eps > 0 && fairPe > 0) out.push({ id: 'pe', label: 'P/E multiple', value: eps * fairPe, formula: `EPS ${eps.toFixed(2)} × fair P/E ${fairPe}` });
  if (eps > 0 && r > 0 && terminalPe > 0) {
    let pv = 0, e = eps;
    for (let t = 1; t <= 5; t++) { e *= 1 + g; pv += e / Math.pow(1 + r, t); }
    pv += (e * terminalPe) / Math.pow(1 + r, 5);
    out.push({ id: 'dcf', label: 'Earnings DCF (5 yr)', value: pv, formula: `EPS grows ${growthPct}% for 5 yrs, discounted at ${discountPct}%, exit P/E ${terminalPe}` });
  }
  if (fcfPerShare > 0 && r > 0.025) {
    const gT = 0.025;
    let pv = 0, c = fcfPerShare;
    for (let t = 1; t <= 5; t++) { c *= 1 + g; pv += c / Math.pow(1 + r, t); }
    pv += (c * (1 + gT)) / (r - gT) / Math.pow(1 + r, 5);
    out.push({ id: 'fcf', label: 'Free-cash-flow DCF (5 yr)', value: pv, formula: `FCF/share ${fcfPerShare.toFixed(2)} grows ${growthPct}% for 5 yrs, then 2.5%, discounted at ${discountPct}%` });
  }
  if (dps > 0 && r > gd) out.push({ id: 'ddm', label: 'Dividend discount', value: (dps * (1 + gd)) / (r - gd), formula: `DPS ${dps.toFixed(2)} × (1 + ${divGrowthPct}%) ÷ (${discountPct}% − ${divGrowthPct}%)` });
  if (eps > 0) out.push({ id: 'graham', label: 'Graham formula', value: eps * (8.5 + 2 * Math.max(0, Math.min(growthPct || 0, 15))), formula: `EPS × (8.5 + 2 × ${Math.max(0, Math.min(growthPct || 0, 15))})` });
  // Median of the models, so one extreme assumption does not dominate
  const sorted = out.map(m => m.value).sort((a, b) => a - b);
  const fair = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  return { models: out, fair };
}

// ---- Trade plan: when to buy, hold or sell, and at what prices ----

// Average True Range (Wilder), a volatility measure in price units
export function atr(rows, n = 14) {
  const out = new Array(rows.length).fill(null);
  let prev = null;
  for (let i = 1; i < rows.length; i++) {
    const tr = Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close));
    if (i < n) { prev = (prev || 0) + tr; if (i === n - 1) { prev /= n; out[i] = prev; } continue; }
    prev = (prev * (n - 1) + tr) / n;
    out[i] = prev;
  }
  return out;
}

// Swing highs / lows: a bar higher (lower) than the `k` bars on each side, over the last `lookback` days
export function supportResistance(rows, lookback = 120, k = 5) {
  const start = Math.max(k, rows.length - lookback);
  const highs = [], lows = [];
  for (let i = start; i < rows.length - k; i++) {
    const win = rows.slice(i - k, i + k + 1);
    if (rows[i].high === Math.max(...win.map(r => r.high))) highs.push(rows[i].high);
    if (rows[i].low === Math.min(...win.map(r => r.low))) lows.push(rows[i].low);
  }
  return { highs, lows };
}

const normCdf = (x) => {
  // Abramowitz–Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};

// Probability that log-price (drift nu, vol sigma per day) reaches +b before −a (both > 0)
export function probTargetBeforeStop(nu, sigma, b, a) {
  if (sigma <= 0) return nu > 0 ? 1 : 0;
  const k = (2 * nu) / (sigma * sigma);
  if (Math.abs(k) < 1e-9) return a / (a + b);
  const num = 1 - Math.exp(k * a);
  const den = Math.exp(-k * b) - Math.exp(k * a);
  const p = num / den;
  return Math.min(1, Math.max(0, p));
}

// Probability of touching price level T (above S) within `days` (reflection principle with drift).
// For a level below the price, call probTouch(T, S, −nu, …): the mirror image.
export function probTouch(S, T, nu, sigma, days) {
  if (T <= S) return 1;
  const b = Math.log(T / S), st = sigma * Math.sqrt(days);
  if (st <= 0) return nu * days >= b ? 1 : 0;
  return Math.min(1, normCdf((-b + nu * days) / st) + Math.exp((2 * nu * b) / (sigma * sigma)) * normCdf((-b - nu * days) / st));
}

// ---- Evidence from the real market ----
// A walk-forward study on 45 Hang Seng blue chips (daily data Oct 2019 – Aug 2026, qfq-adjusted, sampled every
// 5 days) measured which signals were followed by better returns. Calibrated on 2019–2023, checked on 2024–2026:
//  - Classic trend indicators (MA alignment, MACD) and 3-month momentum had no edge over time on the same stock;
//    3-month momentum was slightly negative (rallies tended to fade).
//  - Short-term mean reversion worked best for timing one stock: buying after a 1-month fall / oversold KD-RSI.
//  - For ranking stocks against each other: nearness to the 52-week high, 12-month momentum (skipping the
//    last month), price vs 200-day average and low volatility (cross-sectional IC ≈ 0.04–0.09, t ≈ 1.1–2.7).
// The quantiles below come from the 2019–2023 HK sample; they turn a raw value into a 0–1 percentile.
export const HK_FACTOR_QUANTILES = {
  hi52: [0.1951, 0.4806, 0.5512, 0.6016, 0.6397, 0.6726, 0.7014, 0.7277, 0.7504, 0.7698, 0.7892, 0.8078, 0.8257, 0.8439, 0.8619, 0.8794, 0.8989, 0.922, 0.9461, 0.9693, 1],
  mom12_1: [-0.7789, -0.4247, -0.3462, -0.2858, -0.2394, -0.1986, -0.1626, -0.1322, -0.1047, -0.07659, -0.04554, -0.01313, 0.02214, 0.05815, 0.1041, 0.1558, 0.2213, 0.308, 0.4768, 0.8316, 4.929],
  trend200: [-0.6439, -0.2745, -0.2082, -0.1717, -0.1435, -0.1197, -0.09961, -0.08104, -0.06375, -0.04707, -0.03041, -0.01326, 0.003755, 0.02285, 0.04536, 0.06961, 0.1017, 0.1395, 0.1964, 0.3266, 1.749],
  lowvol: [-0.1425, -0.04309, -0.03668, -0.03376, -0.03087, -0.0285, -0.02641, -0.02478, -0.02336, -0.0221, -0.02082, -0.01951, -0.01825, -0.01696, -0.0158, -0.01453, -0.01324, -0.01209, -0.01087, -0.009237, -0.005073],
  rev1m: [-1.025, -0.1841, -0.1274, -0.09756, -0.07246, -0.05373, -0.03925, -0.02731, -0.01536, -0.004352, 0.005669, 0.01532, 0.02601, 0.03636, 0.04794, 0.06067, 0.07601, 0.0942, 0.1226, 0.1605, 0.6651]
};
// Headline results of the same study (60-trading-day returns), shown in the app so users can judge the signal
export const STUDY_RESULTS = {
  universe: '45 Hang Seng blue chips', period: 'Oct 2019 – Aug 2026', testPeriod: '2024 – 2026 (not used for calibration)',
  oldModel: { buyAvg: 2.67, allAvg: 4.03, sellAvg: 5.68 },  // trend-following version used before
  newModel: { buyAvg: 4.27, allAvg: 4.03, sellAvg: 2.78, buyUp: 0.61, allUp: 0.58, stocksBeat: '22 of 45' },
  us: { buyAvg: 3.82, allAvg: 4.2, sellAvg: 4.25, note: '10 large US stocks: no edge' }
};

export function percentileOf(key, x) {
  const q = HK_FACTOR_QUANTILES[key];
  if (!q || x === null || x === undefined || !Number.isFinite(x)) return null;
  if (x <= q[0]) return 0;
  if (x >= q[20]) return 1;
  let i = 0;
  while (q[i + 1] < x) i++;
  return (i + (x - q[i]) / ((q[i + 1] - q[i]) || 1)) / 20;
}

// Raw factor values on the last day of `rows` (same definitions as the study)
export function factorValues(rows, i = rows.length - 1) {
  const c = rows.map(r => r.close);
  if (i < 252) return null;
  const m200 = c.slice(i - 199, i + 1).reduce((s, v) => s + v, 0) / 200;
  const rs = [];
  for (let j = i - 59; j <= i; j++) rs.push(Math.log(c[j] / c[j - 1]));
  const mu = rs.reduce((s, v) => s + v, 0) / rs.length;
  const vol = Math.sqrt(rs.reduce((s, v) => s + (v - mu) ** 2, 0) / (rs.length - 1));
  let hi = 0;
  for (let j = i - 251; j <= i; j++) hi = Math.max(hi, rows[j].high);
  return { hi52: c[i] / hi, mom12_1: c[i - 21] / c[i - 252] - 1, trend200: c[i] / m200 - 1, lowvol: -vol, rev1m: -(c[i] / c[i - 21] - 1) };
}

// Relative strength vs HK blue chips (−1…+1): 30% 52-week-high nearness, 30% 12-1 momentum, 20% 200-day trend, 20% low volatility
export function relativeStrengthScore(fv) {
  if (!fv) return null;
  const p = { hi52: percentileOf('hi52', fv.hi52), mom12_1: percentileOf('mom12_1', fv.mom12_1), trend200: percentileOf('trend200', fv.trend200), lowvol: percentileOf('lowvol', fv.lowvol) };
  return { score: (0.3 * p.hi52 + 0.3 * p.mom12_1 + 0.2 * p.trend200 + 0.2 * p.lowvol) * 2 - 1, percentiles: p };
}

// (First-study timing score, kept for reference; the plan now uses signalSeries().timing)
export function timingScore(fv, review) {
  if (!fv || !review) return null;
  const kdItem = review.items.find(x => x.id === 'kd');
  const rsiItem = review.items.find(x => x.id === 'rsi');
  const rev = percentileOf('rev1m', fv.rev1m);
  return (0.5 * rev + 0.25 * ((kdItem ? kdItem.score : 0) + 2) / 4 + 0.25 * ((rsiItem ? rsiItem.score : 0) + 1) / 2) * 2 - 1;
}

// ---- Valuation helpers ----

// Earnings DCF value per share for one set of assumptions (same model as valuationModels)
export function dcfValue(eps, growthPct, discountPct, terminalPe) {
  const g = growthPct / 100, r = discountPct / 100;
  if (!(eps > 0) || !(r > -0.99)) return null;
  let pv = 0, e = eps;
  for (let t = 1; t <= 5; t++) { e *= 1 + g; pv += e / Math.pow(1 + r, t); }
  return pv + (e * terminalPe) / Math.pow(1 + r, 5);
}

// Reverse DCF: the yearly EPS growth (5 years) that today's price already assumes
export function impliedGrowth(price, eps, discountPct, terminalPe) {
  if (!(price > 0) || !(eps > 0)) return null;
  let lo = -50, hi = 100;
  if (dcfValue(eps, lo, discountPct, terminalPe) > price || dcfValue(eps, hi, discountPct, terminalPe) < price) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (dcfValue(eps, mid, discountPct, terminalPe) > price) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// Fair-value range instead of a single number: pessimistic (growth −3 pts, required return +1 pt),
// central, optimistic (growth +3 pts, return −1 pt). Each is the median of the valuation models.
export function valuationRange(inputs) {
  const mid = valuationModels(inputs).fair;
  if (!mid) return null;
  const low = valuationModels({ ...inputs, growthPct: (inputs.growthPct || 0) - 3, discountPct: (inputs.discountPct || 0) + 1, fairPe: (inputs.fairPe || 0) * 0.85 }).fair;
  const high = valuationModels({ ...inputs, growthPct: (inputs.growthPct || 0) + 3, discountPct: Math.max(1, (inputs.discountPct || 0) - 1), fairPe: (inputs.fairPe || 0) * 1.15 }).fair;
  return { low: Math.min(low, mid), mid, high: Math.max(high, mid) };
}

// Fair P/E from expected growth (a PEG-style rule): 8 + 1.2 × growth %, kept between 8 and 35
export const pegFairPe = (growthPct) => Math.round(Math.max(8, Math.min(35, 8 + 1.2 * (growthPct || 0))) * 10) / 10;

// How the valuation enters the signal: full weight only when the price is outside the fair-value range
export function valuationScore(price, range) {
  if (!range || !(price > 0)) return null;
  const raw = Math.max(-1, Math.min(1, (range.mid - price) / price / 0.3));
  if (price < range.low) return Math.max(0, raw);
  if (price > range.high) return Math.min(0, raw);
  return raw * 0.5;
}

// ---- Simulation: resample the stock's own past daily returns (keeps fat tails and jumps) ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Block bootstrap (5-day blocks) of the last ~2 years of daily log returns, re-centred on drift `nu`.
// Returns `n` paths of cumulative log returns, each `days` long.
export function bootstrapPaths(closes, days = 60, n = 1500, nu = 0, block = 5) {
  const rets = closes.slice(-505).slice(1).map((c, i, arr) => Math.log(c / (i === 0 ? closes[Math.max(0, closes.length - 505)] : arr[i - 1]))).filter(Number.isFinite);
  if (rets.length < 40) return [];
  const mean = rets.reduce((s, v) => s + v, 0) / rets.length;
  const centred = rets.map(r => r - mean + nu);
  const rand = mulberry32(Math.round(closes.at(-1) * 1000) ^ closes.length);
  const paths = [];
  for (let p = 0; p < n; p++) {
    const path = new Float64Array(days);
    let cum = 0, d = 0;
    while (d < days) {
      const start = Math.floor(rand() * (centred.length - block));
      for (let b = 0; b < block && d < days; b++, d++) { cum += centred[start + b]; path[d] = cum; }
    }
    paths.push(path);
  }
  return paths;
}

// ---- Track record: how this stock's technical + momentum signal did in the past ----
const corr = (x, y) => {
  const n = x.length; if (n < 10) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
};
const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };

/**
 * Walk-forward test on the stock's own history: on each past day, using only data up to that day, compute
 * the technical score and 3-month momentum, then look at the return over the next `horizon` trading days.
 * Reports the rank correlation (information coefficient, IC) of each part with future returns, how
 * "buy-side" and "sell-side" days performed against all days, and data-adjusted weights for the plan.
 * Valuation and news can't be tested this way (no history of EPS or headlines in the feed).
 */
export function backtestSignals(rows, horizon = 20, priors = { timing: 0.35, strength: 0.15 }) {
  if (!rows || rows.length < 260 + horizon + 60) return null;
  const closes = rows.map(r => r.close);
  const timing = [], strength = [], fwd = [];
  const series = signalSeries(rows);
  for (let i = 260; i < rows.length - horizon; i += 3) {
    const fv = factorValues(rows, i);
    const t = series.timing[i], rsS = relativeStrengthScore(fv);
    if (t === null || !rsS) continue;
    timing.push(t); strength.push(rsS.score);
    fwd.push(closes[i + horizon] / closes[i] - 1);
  }
  const n = fwd.length;
  if (n < 40) return null;
  const icTiming = corr(rank(timing), rank(fwd));
  const icStrength = corr(rank(strength), rank(fwd));
  const combo = timing.map((t, i) => (priors.timing * t + priors.strength * strength[i]) / (priors.timing + priors.strength));
  const pick = (cond) => {
    const r = fwd.filter((_, i) => cond(combo[i]));
    return r.length ? { n: r.length, avgRet: r.reduce((s, v) => s + v, 0) / r.length, upRate: r.filter(v => v > 0).length / r.length } : { n: 0, avgRet: null, upRate: null };
  };
  const all = pick(() => true);
  const buy = pick(c => c >= 0.12);
  const sell = pick(c => c <= -0.12);
  const adj = (prior, ic) => prior * Math.max(0.5, Math.min(1.5, 1 + 3 * ic));
  return {
    n, horizon, icTiming, icStrength, all, buy, sell,
    from: rows[260]?.date, to: rows[rows.length - 1 - horizon]?.date,
    edgeBuy: buy.n ? buy.avgRet - all.avgRet : null,
    edgeSell: sell.n ? all.avgRet - sell.avgRet : null,
    weights: { timing: adj(priors.timing, icTiming), strength: adj(priors.strength, icStrength) }
  };
}

/**
 * Combines timing, relative strength, valuation and news with volatility into a trade plan.
 *  - Drift: a quarter of the Holt trend + 20% of the gap to fair value spread over a year (both capped);
 *    deliberately small, because short-term trends are mostly noise
 *  - Stop-loss: below the nearest support, at least 1.5 ATR away
 *  - Take-profit: among prices with at least a 30% chance of being reached first, the one that maximises
 *    expected profit per share over 60 trading days,
 *        E(T) = P(hit T first) × (T − entry) − P(hit stop first) × (entry − stop) + P(neither) × E(end − entry)
 *    with the probabilities counted on 1,500 simulated paths resampled from the stock's own past returns
 *  - Signal: timing (short-term mean reversion) 35%, relative strength vs HK blue chips 15%, valuation 30%
 *    (fully counted only outside the fair-value range), company news 20%. Timing and strength weights can be
 *    nudged by the stock's own track record (backtestSignals). Weights come from the real-market study above.
 */
export function tradePlan({ rows, price, fair = null, fairRange = null, review = null, forecast = null, news = null, weights = null, horizon = 60 }) {
  if (!rows || rows.length < 60 || !(price > 0)) return null;
  const closes = rows.map(r => r.close);
  const A = atr(rows).at(-1) || price * 0.02;
  const logs = closes.slice(-253).slice(1).map((c, i, arr) => Math.log(c / (i === 0 ? closes[closes.length - 253] || closes[0] : arr[i - 1])));
  const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
  const sigma = Math.sqrt(logs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, logs.length - 1)) || 0.02;
  const range = fairRange || (fair ? { low: fair * 0.9, mid: fair, high: fair * 1.1 } : null);

  // Drift (per trading day, log terms), kept small
  const lastClose = closes[closes.length - 1];
  const trendDaily = forecast ? forecast.path[0].mid / lastClose - 1 : 0;
  const valueGap = range ? Math.log(range.mid / price) : 0;
  let nu = 0.25 * Math.max(-0.004, Math.min(0.004, trendDaily)) + 0.2 * Math.max(-0.5, Math.min(0.5, valueGap)) / 252;
  nu = Math.max(-0.002, Math.min(0.002, nu));

  // Support / resistance levels
  const { highs, lows } = supportResistance(rows);
  const ma20 = sma(closes, 20).at(-1), ma60 = sma(closes, 60).at(-1);
  const bb = bollinger(closes);
  const fib = fibonacciLevels(rows);
  const fibPrices = fib ? fib.levels.filter(l => l.ratio > 0 && l.ratio < 1).map(l => l.price) : [];
  const supportsBelow = [...lows, ma20, ma60, bb.lower.at(-1), ...fibPrices].filter(v => v && v < price * 0.995).sort((a, b) => b - a);
  const resistAbove = [...highs, ma20, ma60, bb.upper.at(-1), ...fibPrices].filter(v => v && v > price * 1.005).sort((a, b) => a - b);
  const support = supportsBelow[0] || price - 2 * A;
  const resistance = resistAbove[0] || price + 2 * A;

  const entryHigh = price;
  const entryLow = Math.min(price, Math.max(support + 0.25 * A, price - 2 * A));
  const entry = (entryLow + entryHigh) / 2;
  const stop = Math.min(support - 0.5 * A, entry - 1.5 * A);

  // Profit-maximising target on simulated paths
  const paths = bootstrapPaths(closes, horizon, 1500, nu);
  const lnStop = Math.log(stop / entry);
  const maxUp = entry * Math.exp(2.33 * sigma * Math.sqrt(horizon) + Math.max(0, nu) * horizon);
  let best = null;
  const candidates = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const T = entry + A + ((maxUp - entry - A) * i) / steps;
    if (T <= entry) continue;
    const lnT = Math.log(T / entry);
    let hit = 0, stopped = 0, endSum = 0;
    for (const path of paths) {
      let outcome = 0;
      for (let d = 0; d < path.length; d++) {
        if (path[d] >= lnT) { outcome = 1; break; }
        if (path[d] <= lnStop) { outcome = -1; break; }
      }
      if (outcome === 1) hit++;
      else if (outcome === -1) stopped++;
      else endSum += entry * Math.exp(path[path.length - 1]) - entry;
    }
    const N = paths.length || 1;
    const ev = (hit * (T - entry) - stopped * (entry - stop) + endSum) / N;
    candidates.push({ target: T, p: hit / N, pStop: stopped / N, ev });
  }
  // Only targets with a realistic chance (≥ 30% of being reached first) qualify; among those take the
  // highest expected profit. Without this, a far-away target always "wins" because unfinished trades
  // keep their paper gains.
  const realistic = candidates.filter(c => c.p >= 0.3);
  best = (realistic.length ? realistic : candidates.slice(0, 1)).reduce((a, c) => (!a || c.ev > a.ev ? c : a), null);
  if (!best) best = { target: entry + 2 * A, p: 0, pStop: 0, ev: 0 };
  const reward = best.target - entry, risk = entry - stop;

  // Composite signal (weights follow the real-market study above; see STUDY_RESULTS)
  const fv = factorValues(rows);
  const series = signalSeries(rows);
  const timing = series.timing.at(-1);
  const rs = relativeStrengthScore(fv);
  const strength = rs ? rs.score : null;
  const val = valuationScore(price, range);
  const w = { timing: 0.35, strength: 0.15, val: 0.3, news: 0.2, ...(weights || {}) };
  const newsScore = news && news.score !== null && news.count >= 2 ? news.score : null;
  const parts = [[timing, w.timing], [strength, w.strength], [val, w.val], [newsScore, w.news]].filter(([v]) => v !== null && v !== undefined);
  const wTotal = parts.reduce((s, [, x]) => s + x, 0);
  let composite = parts.reduce((s, [v, x]) => s + v * x, 0) / wTotal;
  const severeNews = news?.severe?.length ? news.severe : [];
  if (severeNews.length) composite = Math.min(composite, 0.11);
  let signal;
  if (composite >= 0.35 && best.ev > 0) signal = 'Buy';
  else if (composite >= 0.12) signal = 'Accumulate';
  else if (composite > -0.12) signal = 'Hold';
  else if (composite > -0.35) signal = 'Reduce';
  else signal = 'Sell';

  const move20 = Math.exp(nu * 20) - 1;
  const tendency = move20 > 0.01 ? 'Rising' : move20 < -0.01 ? 'Falling' : 'Sideways';

  const buyBelow = range ? range.low * 0.95 : null;   // below the pessimistic fair value, with a margin
  const sellAbove = range ? range.high * 1.05 : null; // above the optimistic fair value
  const sellZoneLow = Math.min(best.target, resistance);
  const sellZoneHigh = Math.max(best.target, resistance);

  return {
    signal, composite, tendency, move20, nu, sigma, atr: A,
    entryLow, entryHigh, entry, stop, target: best.target, probTarget: best.p, probStop: best.pStop, simPaths: paths.length,
    evPerShare: best.ev, riskReward: risk > 0 ? reward / risk : null,
    support, resistance, supports: supportsBelow.slice(0, 3), resistances: resistAbove.slice(0, 3),
    buyBelow, sellAbove, sellZoneLow, sellZoneHigh, range,
    parts: { timing, strength, val, news: newsScore }, percentiles: rs ? rs.percentiles : null, factorValues: fv, severeNews, fib,
    timingParts: { revAdj: series.revAdj.at(-1), trendCons: series.trendCons.at(-1), events: series.events.at(-1), adx: series.adx.at(-1) },
    weightsUsed: { timing: timing !== null ? w.timing / wTotal : 0, strength: strength !== null ? w.strength / wTotal : 0, val: val !== null ? w.val / wTotal : 0, news: newsScore !== null ? w.news / wTotal : 0 }
  };
}

// ======================================================================================================
// Extended indicator set (the "10 most popular indicators" + common TradingView tools) and the timing
// model learned from the real market.
//
// Second study (same 45 HK blue chips + 10 US large caps, Oct 2019 – Aug 2026; tuned on 2019–23, tested on
// 2024–26). Every trend-following reading, used the classic way (EMA 12/26 cross, 50/200 golden cross, MACD
// above signal, +DI above −DI, price above the Ichimoku cloud, Tenkan above Kijun, Supertrend up, OBV rising,
// price high in its Bollinger band or Fibonacci range) was followed by *weaker* 20- and 60-day returns on the
// same stock, in both periods and in the US too (time-series rank IC −0.02 to −0.23). Short-term mean
// reversion was the strongest signal and was stronger when ADX > 25 (test IC 0.23 vs 0.05 when ADX < 20).
// Events that held up in both periods: RSI bullish divergence (+1.1% / +2.0% excess 20-day return, t 2.4 /
// 2.6) and a new 55-day low (+0.9% / +2.3%, t 2.3 / 3.3); breakouts to a 55-day high tended to fade. Candlestick
// patterns, double tops/bottoms, Fibonacci touches, Bollinger squeezes, MACD and Supertrend crosses showed no
// consistent edge. The timing score below combines what held up.
// ======================================================================================================

// ADX with +DI / −DI (Wilder, 14)
export function adxSeries(rows, n = 14) {
  const len = rows.length;
  const tr = [0], pdm = [0], ndm = [0];
  for (let i = 1; i < len; i++) {
    const up = rows[i].high - rows[i - 1].high, dn = rows[i - 1].low - rows[i].low;
    tr.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close)));
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  const smooth = (v) => {
    const o = new Array(len).fill(null);
    if (len <= n) return o;
    let p = v.slice(1, n + 1).reduce((s, x) => s + x, 0) / n;
    o[n] = p;
    for (let i = n + 1; i < len; i++) { p = (p * (n - 1) + v[i]) / n; o[i] = p; }
    return o;
  };
  const a = smooth(tr), sp = smooth(pdm), sn = smooth(ndm);
  const pdi = a.map((x, i) => (x ? (100 * sp[i]) / x : null));
  const ndi = a.map((x, i) => (x ? (100 * sn[i]) / x : null));
  const dx = pdi.map((p, i) => (p !== null && ndi[i] !== null && p + ndi[i] > 0 ? (100 * Math.abs(p - ndi[i])) / (p + ndi[i]) : null));
  const adx = new Array(len).fill(null);
  const s = dx.findIndex(x => x !== null);
  if (s >= 0 && s + n <= len) {
    let p = dx.slice(s, s + n).reduce((t, x) => t + x, 0) / n;
    adx[s + n - 1] = p;
    for (let i = s + n; i < len; i++) { p = (p * (n - 1) + dx[i]) / n; adx[i] = p; }
  }
  return { adx, pdi, ndi };
}

const highest = (rows, i, n, key = 'high') => { let m = -Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) m = Math.max(m, rows[j][key]); return m; };
const lowest = (rows, i, n, key = 'low') => { let m = Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) m = Math.min(m, rows[j][key]); return m; };

// Ichimoku (9, 26, 52). spanA/spanB are the cloud *at today* (computed 26 days earlier, as plotted)
export function ichimokuSeries(rows) {
  const len = rows.length;
  const tenkan = rows.map((_, i) => (i < 8 ? null : (highest(rows, i, 9) + lowest(rows, i, 9)) / 2));
  const kijun = rows.map((_, i) => (i < 25 ? null : (highest(rows, i, 26) + lowest(rows, i, 26)) / 2));
  const b52 = rows.map((_, i) => (i < 51 ? null : (highest(rows, i, 52) + lowest(rows, i, 52)) / 2));
  const spanA = new Array(len).fill(null), spanB = new Array(len).fill(null);
  for (let i = 26; i < len; i++) {
    if (tenkan[i - 26] !== null && kijun[i - 26] !== null) spanA[i] = (tenkan[i - 26] + kijun[i - 26]) / 2;
    if (b52[i - 26] !== null) spanB[i] = b52[i - 26];
  }
  return { tenkan, kijun, spanA, spanB };
}

// Supertrend (ATR 10, multiplier 3): dir +1 up / −1 down and the trailing line
export function supertrendSeries(rows, n = 10, mult = 3) {
  const len = rows.length;
  const a = atr(rows, n);
  const dir = new Array(len).fill(0), line = new Array(len).fill(null);
  let ub = null, lb = null, d = 1;
  for (let i = n; i < len; i++) {
    if (!a[i]) continue;
    const mid = (rows[i].high + rows[i].low) / 2;
    const bu = mid + mult * a[i], bl = mid - mult * a[i];
    ub = ub === null || bu < ub || rows[i - 1].close > ub ? bu : ub;
    lb = lb === null || bl > lb || rows[i - 1].close < lb ? bl : lb;
    if (d === 1 && rows[i].close < lb) d = -1;
    else if (d === -1 && rows[i].close > ub) d = 1;
    dir[i] = d;
    line[i] = d === 1 ? lb : ub;
  }
  return { dir, line };
}

// Stochastic oscillator (14, 3)
export function stochasticSeries(rows, n = 14, smoothD = 3) {
  const k = rows.map((r, i) => {
    if (i < n - 1) return null;
    const H = highest(rows, i, n), L = lowest(rows, i, n);
    return H === L ? 50 : (100 * (r.close - L)) / (H - L);
  });
  const d = k.map((_, i) => (i < n + smoothD - 2 ? null : k.slice(i - smoothD + 1, i + 1).reduce((s, x) => s + x, 0) / smoothD));
  return { k, d };
}

export function obvSeries(rows) {
  const o = [0];
  for (let i = 1; i < rows.length; i++) o.push(o[i - 1] + (rows[i].close > rows[i - 1].close ? rows[i].volume : rows[i].close < rows[i - 1].close ? -rows[i].volume : 0));
  return o;
}

// Fibonacci retracement levels of the last `lookback`-day swing (from the high down to the low or vice versa)
export function fibonacciLevels(rows, lookback = 120) {
  if (rows.length < 20) return null;
  const win = rows.slice(-lookback);
  let hi = -Infinity, lo = Infinity, iHi = 0, iLo = 0;
  win.forEach((r, i) => { if (r.high > hi) { hi = r.high; iHi = i; } if (r.low < lo) { lo = r.low; iLo = i; } });
  const upSwing = iLo < iHi; // low came first: retracements measured down from the high
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  return {
    high: hi, low: lo, upSwing,
    levels: ratios.map(r => ({ ratio: r, price: upSwing ? hi - (hi - lo) * r : lo + (hi - lo) * r }))
  };
}

/**
 * Everything the timing model needs, as causal series (value at i uses data up to i only), so the same code
 * scores today and replays the past for the track record.
 */
export function signalSeries(rows) {
  const len = rows.length;
  const c = rows.map(r => r.close);
  const e12 = ema(c, 12), e26 = ema(c, 26), s50 = sma(c, 50), s200 = sma(c, 200), s20 = sma(c, 20);
  const m = macd(c);
  const { adx, pdi, ndi } = adxSeries(rows);
  const ich = ichimokuSeries(rows);
  const st = supertrendSeries(rows);
  const r14 = rsi(c);
  const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const out = {
    emaX: [], golden: [], macdX: [], diDir: [], ichi: [], tkX: [], superT: [], trendCons: [],
    rev1m: [], adx, revAdj: [], rsiBullDiv: [], rsiBearDiv: [], newLow55: [], newHigh55: [], events: [], timing: []
  };
  let lastDiv = -99, lastLow = -99, lastHigh = -99;
  for (let i = 0; i < len; i++) {
    const ready = i >= 60 && e26[i] !== null && m.signal[i] !== null;
    const emaX = ready ? sgn(e12[i] - e26[i]) : 0;
    const golden = s200[i] !== null ? sgn(s50[i] - s200[i]) : 0;
    const macdX = ready ? sgn(m.dif[i] - m.signal[i]) : 0;
    const diDir = pdi[i] !== null ? sgn(pdi[i] - ndi[i]) : 0;
    const top = Math.max(ich.spanA[i] ?? -Infinity, ich.spanB[i] ?? -Infinity), bot = Math.min(ich.spanA[i] ?? Infinity, ich.spanB[i] ?? Infinity);
    const ichi = ich.spanA[i] === null ? 0 : c[i] > top ? 1 : c[i] < bot ? -1 : 0;
    const tkX = ich.kijun[i] !== null ? sgn(ich.tenkan[i] - ich.kijun[i]) : 0;
    const superT = st.dir[i] || 0;
    const trendCons = (emaX + golden + macdX + diDir + ichi + tkX + superT) / 7;
    out.emaX.push(emaX); out.golden.push(golden); out.macdX.push(macdX); out.diDir.push(diDir); out.ichi.push(ichi); out.tkX.push(tkX); out.superT.push(superT); out.trendCons.push(trendCons);

    const rev = i >= 21 ? -(c[i] / c[i - 21] - 1) : null;
    out.rev1m.push(rev);
    const revP = rev === null ? null : percentileOf('rev1m', rev) * 2 - 1;
    const mult = adx[i] === null ? 1 : adx[i] > 25 ? 1.5 : adx[i] < 20 ? 0.6 : 1;
    out.revAdj.push(revP === null ? null : revP * mult);

    // RSI divergence: last 5 days vs the 10 days before that (15–24 days ago)
    let bullDiv = 0, bearDiv = 0;
    if (i >= 30 && r14[i - 24] !== null) {
      const lo1 = lowest(rows, i, 5), lo0 = lowest(rows, i - 15, 10);
      const ra = Math.min(...r14.slice(i - 4, i + 1)), rb = Math.min(...r14.slice(i - 24, i - 14));
      bullDiv = lo1 < lo0 && ra > rb + 3 && ra < 40 ? 1 : 0;
      const hi1 = highest(rows, i, 5), hi0 = highest(rows, i - 15, 10);
      const qa = Math.max(...r14.slice(i - 4, i + 1)), qb = Math.max(...r14.slice(i - 24, i - 14));
      bearDiv = hi1 > hi0 && qa < qb - 3 && qa > 60 ? 1 : 0;
    }
    const newLow = i >= 56 && c[i] < lowest(rows, i - 1, 55) ? 1 : 0;
    const newHigh = i >= 56 && c[i] > highest(rows, i - 1, 55) ? 1 : 0;
    if (bullDiv) lastDiv = i;
    if (newLow) lastLow = i;
    if (newHigh) lastHigh = i;
    out.rsiBullDiv.push(bullDiv); out.rsiBearDiv.push(bearDiv); out.newLow55.push(newLow); out.newHigh55.push(newHigh);
    // Events count for 5 trading days after they happen
    const ev = Math.max(-1, Math.min(1, (i - lastDiv <= 5 ? 1 : 0) + (i - lastLow <= 5 ? 1 : 0) - 0.5 * (i - lastHigh <= 5 ? 1 : 0)));
    out.events.push(ev);

    // Timing (−1…+1): 50% mean reversion scaled by ADX, 30% contrarian to the trend consensus, 20% events
    const t = revP === null || !ready ? null : Math.max(-1, Math.min(1, 0.5 * revP * mult + 0.3 * -trendCons + 0.2 * ev));
    out.timing.push(t);
  }
  out.s20 = s20;
  return out;
}

/** Patterns and crossovers seen in the last `days` sessions, each tagged with what the study found. */
export function detectPatterns(rows, days = 5) {
  const len = rows.length;
  if (len < 80) return [];
  const c = rows.map(r => r.close);
  const s = signalSeries(rows);
  const m = macd(c);
  const s50 = sma(c, 50), s200 = sma(c, 200), s20 = s.s20;
  const st = supertrendSeries(rows);
  const bb = bollinger(c);
  const found = [];
  const add = (id, label, bias, evidence, i, note = '') => { if (!found.some(f => f.id === id)) found.push({ id, label, bias, evidence, date: rows[i].date, note }); };
  for (let i = len - 1; i >= Math.max(1, len - days); i--) {
    const b = rows[i], a = rows[i - 1];
    if (s.rsiBullDiv[i]) add('rsiBullDiv', 'RSI bullish divergence', 1, 'works', i, 'Price made a lower low but RSI a higher low');
    if (s.rsiBearDiv[i]) add('rsiBearDiv', 'RSI bearish divergence', -1, 'mixed', i, 'Price made a higher high but RSI a lower high');
    if (s.newLow55[i]) add('newLow55', 'New 55-day low', 1, 'works', i, 'In the study, new lows were followed by rebounds');
    if (s.newHigh55[i]) add('newHigh55', 'Breakout to a 55-day high', -1, 'contrarian', i, 'In the study, breakouts tended to fade');
    if (s200[i] !== null && s200[i - 1] !== null) {
      if (s50[i] > s200[i] && s50[i - 1] <= s200[i - 1]) add('golden', 'Golden cross (50 over 200-day)', -1, 'contrarian', i, 'Classic buy signal; followed by weaker returns in the study');
      if (s50[i] < s200[i] && s50[i - 1] >= s200[i - 1]) add('death', 'Death cross (50 under 200-day)', 1, 'mixed', i, 'Classic sell signal; no reliable edge');
    }
    if (m.signal[i] !== null && m.signal[i - 1] !== null) {
      if (m.dif[i] > m.signal[i] && m.dif[i - 1] <= m.signal[i - 1]) add('macdUp', 'MACD bullish cross', 1, 'none', i);
      if (m.dif[i] < m.signal[i] && m.dif[i - 1] >= m.signal[i - 1]) add('macdDn', 'MACD bearish cross', -1, 'none', i);
    }
    if (st.dir[i] !== st.dir[i - 1] && st.dir[i - 1] !== 0) add(st.dir[i] > 0 ? 'stUp' : 'stDn', `Supertrend turned ${st.dir[i] > 0 ? 'up' : 'down'}`, st.dir[i], 'none', i);
    const body = Math.abs(b.close - b.open), rng = b.high - b.low || 1e-9;
    if (a.close < a.open && b.close > b.open && b.close >= a.open && b.open <= a.close) add('bullEngulf', 'Bullish engulfing candle', 1, 'none', i);
    if (a.close > a.open && b.close < b.open && b.open >= a.close && b.close <= a.open) add('bearEngulf', 'Bearish engulfing candle', -1, 'none', i);
    if (s20[i] && Math.min(b.open, b.close) - b.low >= 2 * body && b.high - Math.max(b.open, b.close) <= body && body / rng > 0.1 && b.close < s20[i]) add('hammer', 'Hammer (after a fall)', 1, 'none', i);
    if (s20[i] && b.high - Math.max(b.open, b.close) >= 2 * body && Math.min(b.open, b.close) - b.low <= body && body / rng > 0.1 && b.close > s20[i]) add('star', 'Shooting star (after a rise)', -1, 'none', i);
  }
  // Double bottom / top over the last 60 sessions, confirmed by a close through the middle peak / trough
  const w = rows.slice(-61, -1), p = c[len - 1];
  if (w.length === 60) {
    const lows = w.map(x => x.low), highs = w.map(x => x.high);
    const iA = lows.indexOf(Math.min(...lows.slice(0, 40))), restLow = Math.min(...lows.slice(iA + 15)), iB = lows.lastIndexOf(restLow);
    if (iB - iA >= 15 && Math.abs(restLow - lows[iA]) / lows[iA] < 0.03) { const peak = Math.max(...w.slice(iA, iB).map(x => x.high)); if (peak >= lows[iA] * 1.07 && p > peak) add('dblBottom', 'Double bottom (confirmed)', 1, 'none', len - 1, `Lows near ${lows[iA].toFixed(2)}, neckline ${peak.toFixed(2)}`); }
    const jA = highs.indexOf(Math.max(...highs.slice(0, 40))), restHi = Math.max(...highs.slice(jA + 15)), jB = highs.lastIndexOf(restHi);
    if (jB - jA >= 15 && Math.abs(restHi - highs[jA]) / highs[jA] < 0.03) { const trough = Math.min(...w.slice(jA, jB).map(x => x.low)); if (trough <= highs[jA] * 0.93 && p < trough) add('dblTop', 'Double top (confirmed)', -1, 'none', len - 1, `Highs near ${highs[jA].toFixed(2)}, neckline ${trough.toFixed(2)}`); }
  }
  // Bollinger squeeze: band width at a 6-month low
  const widths = c.map((_, i) => (bb.upper[i] !== null ? (bb.upper[i] - bb.lower[i]) / bb.mid[i] : null)).slice(-126).filter(x => x !== null);
  if (widths.length > 60 && widths.at(-1) <= Math.min(...widths) * 1.05) add('squeeze', 'Bollinger squeeze (volatility at a 6-month low)', 0, 'none', len - 1, 'Often precedes a big move, direction unknown');
  return found;
}

// Results of the second study, shown in the app
// Checked by running this file's signalSeries() on the real data (60-day returns; timing ≥ +0.25 vs ≤ −0.25)
export const STUDY2 = {
  timingModel: {
    testIC: 0.19, trainIC: 0.053, usTestIC: 0.128, usTrainIC: 0.056, stocksPositive: '39 of 45',
    test: { top: 6.26, all: 4.03, bottom: 2.16 }, train: { top: 0.16, all: -0.33, bottom: 0.21 },
    usTest: { top: 7.84, all: 4.99, bottom: 3.76 }, usTrain: { top: 3.18, all: 3.69, bottom: 4.75 }
  },
  indicatorIC: { // time-series rank IC with the next 60 days, HK test period, classic reading (+ = works as taught)
    emaX: -0.20, golden: -0.13, macdX: -0.09, diDir: -0.18, ichi: -0.23, tkX: -0.18, superT: -0.18, obvTrend: -0.17, bbPos: -0.12, fibPos: -0.23, stoch: 0.01, rev1m: 0.17
  }
};
