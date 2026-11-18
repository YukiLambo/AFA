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
// The fair value shown is the median of the models that apply.
export function valuationModels({ eps, growthPct, discountPct, terminalPe, fairPe, dps, divGrowthPct }) {
  const g = (growthPct || 0) / 100, r = (discountPct || 0) / 100, gd = (divGrowthPct || 0) / 100;
  const out = [];
  if (eps > 0 && fairPe > 0) out.push({ id: 'pe', label: 'P/E multiple', value: eps * fairPe, formula: `EPS ${eps.toFixed(2)} × fair P/E ${fairPe}` });
  if (eps > 0 && r > 0 && terminalPe > 0) {
    let pv = 0, e = eps;
    for (let t = 1; t <= 5; t++) { e *= 1 + g; pv += e / Math.pow(1 + r, t); }
    pv += (e * terminalPe) / Math.pow(1 + r, 5);
    out.push({ id: 'dcf', label: 'Earnings DCF (5 yr)', value: pv, formula: `EPS grows ${growthPct}% for 5 yrs, discounted at ${discountPct}%, exit P/E ${terminalPe}` });
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

/**
 * Combines the technical score, the valuation (fair value) and volatility into a trade plan.
 *  - Expected drift: half the Holt trend + 30% of the gap to fair value spread over a year (both capped)
 *  - Stop-loss: below the nearest support, at least 1.5 ATR away
 *  - Take-profit: the price that maximises expected profit per share over the horizon (60 trading days),
 *        E(T) = P(hit T) × (T − entry) − P(hit stop) × (entry − stop) + P(neither) × (expected end − entry)
 *    searched between +1 ATR and the 99th-percentile 60-day move
 *  - Signal from a composite: technical score (35%), valuation gap (35%), 3-month momentum (15%), company
 *    news sentiment (15%); missing parts are re-weighted, and a severe news event caps the signal at Hold
 */
export function tradePlan({ rows, price, fair = null, review = null, forecast = null, news = null, horizon = 60 }) {
  if (!rows || rows.length < 60 || !(price > 0)) return null;
  const closes = rows.map(r => r.close);
  const A = atr(rows).at(-1) || price * 0.02;
  const logs = closes.slice(-253).slice(1).map((c, i, arr) => Math.log(c / (i === 0 ? closes[closes.length - 253] || closes[0] : arr[i - 1])));
  const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
  const sigma = Math.sqrt(logs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, logs.length - 1)) || 0.02;

  // Drift (per trading day, log terms)
  const lastClose = closes[closes.length - 1];
  const trendDaily = forecast ? forecast.path[0].mid / lastClose - 1 : 0; // one-day step of the fitted trend
  const valueGap = fair ? Math.log(fair / price) : 0;
  let nu = 0.5 * Math.max(-0.004, Math.min(0.004, trendDaily)) + 0.3 * Math.max(-0.5, Math.min(0.5, valueGap)) / 252;
  nu = Math.max(-0.003, Math.min(0.003, nu));

  // Support / resistance levels
  const { highs, lows } = supportResistance(rows);
  const ma20 = sma(closes, 20).at(-1), ma60 = sma(closes, 60).at(-1);
  const bb = bollinger(closes);
  const supportsBelow = [...lows, ma20, ma60, bb.lower.at(-1)].filter(v => v && v < price * 0.995).sort((a, b) => b - a);
  const resistAbove = [...highs, ma20, ma60, bb.upper.at(-1)].filter(v => v && v > price * 1.005).sort((a, b) => a - b);
  const support = supportsBelow[0] || price - 2 * A;
  const resistance = resistAbove[0] || price + 2 * A;

  // Entry zone: from the nearest support (+0.25 ATR) up to the current price; never above fair value with margin
  const entryHigh = price;
  const entryLow = Math.min(price, Math.max(support + 0.25 * A, price - 2 * A));
  const entry = (entryLow + entryHigh) / 2;
  const stop = Math.min(support - 0.5 * A, entry - 1.5 * A);

  // Profit-maximising target
  const maxUp = entry * Math.exp(2.33 * sigma * Math.sqrt(horizon) + Math.max(0, nu) * horizon);
  let best = null;
  const steps = 60;
  // Within the horizon each trade ends one of three ways: target hit, stop hit, or still open at the end
  const pStopTouch = probTouch(stop, entry, -nu, sigma, horizon) /* touching a level below = mirror image */;
  for (let i = 0; i <= steps; i++) {
    const T = entry + A + ((maxUp - entry - A) * i) / steps;
    if (T <= entry) continue;
    const first = probTargetBeforeStop(nu, sigma, Math.log(T / entry), Math.log(entry / stop));
    const pHit = first * probTouch(entry, T, nu, sigma, horizon);
    const pStop = Math.min(1 - pHit, (1 - first) * pStopTouch);
    const endValue = Math.min(T, Math.max(stop, entry * Math.exp(nu * horizon)));
    const ev = pHit * (T - entry) - pStop * (entry - stop) + (1 - pHit - pStop) * (endValue - entry);
    if (!best || ev > best.ev) best = { target: T, p: pHit, pStop, ev };
  }
  const reward = best.target - entry, risk = entry - stop;
  const touch60 = probTouch(price, best.target, nu, sigma, horizon);

  // Composite signal
  const tech = review ? review.total / 10 : 0;
  const val = fair ? Math.max(-1, Math.min(1, (fair - price) / price / 0.3)) : 0;
  const mom3 = closes.length > 63 ? closes.at(-1) / closes.at(-64) - 1 : 0;
  const momentum = Math.max(-1, Math.min(1, mom3 / 0.15));
  // Weights: technical 35%, valuation 35%, momentum 15%, company news 15% (re-weighted when a part is missing)
  const newsScore = news && news.score !== null && news.count >= 2 ? news.score : null;
  const parts = [[tech, 0.35], [fair ? val : null, 0.35], [momentum, 0.15], [newsScore, 0.15]].filter(([v]) => v !== null);
  const wTotal = parts.reduce((s, [, w]) => s + w, 0);
  let composite = parts.reduce((s, [v, w]) => s + v * w, 0) / wTotal;
  // A serious event in the last two weeks (fraud, trading halt, profit warning...) rules out a buy signal
  const severeNews = news?.severe?.length ? news.severe : [];
  if (severeNews.length) composite = Math.min(composite, 0.11);
  let signal;
  if (composite >= 0.35 && best.ev > 0) signal = 'Buy';
  else if (composite >= 0.12) signal = 'Accumulate';
  else if (composite > -0.12) signal = 'Hold';
  else if (composite > -0.35) signal = 'Reduce';
  else signal = 'Sell';

  // Expected 20-day move from the drift; tendency label
  const move20 = Math.exp(nu * 20) - 1;
  const tendency = move20 > 0.01 ? 'Rising' : move20 < -0.01 ? 'Falling' : 'Sideways';

  // Valuation prices (if a fair value is available)
  const buyBelow = fair ? fair * 0.8 : null;      // 20% margin of safety
  const sellAbove = fair ? fair * 1.2 : null;     // 20% above fair value

  // For holders: where to take profit / cut loss
  const sellZoneLow = Math.min(best.target, resistance);
  const sellZoneHigh = Math.max(best.target, resistance);

  return {
    signal, composite, tendency, move20, nu, sigma, atr: A,
    entryLow, entryHigh, entry, stop, target: best.target, probTarget: best.p, probTouch60: touch60,
    evPerShare: best.ev, riskReward: risk > 0 ? reward / risk : null,
    support, resistance, supports: supportsBelow.slice(0, 3), resistances: resistAbove.slice(0, 3),
    buyBelow, sellAbove, sellZoneLow, sellZoneHigh,
    parts: { tech, val, momentum, news: newsScore }, severeNews,
    weights: parts.map(([, w]) => w / wTotal)
  };
}
