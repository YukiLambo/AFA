// Small statistics helpers (no dependencies).
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export function sd(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
// Plain t-statistic of the mean (treats every observation as independent; see README "Known issues")
export const tstat = (a) => (a.length > 1 ? mean(a) / (sd(a) / Math.sqrt(a.length)) : NaN);

// Average ranks (ties share the mean rank)
export function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let k = 0; k < idx.length;) {
    let j = k; while (j + 1 < idx.length && idx[j + 1][0] === idx[k][0]) j++;
    const avg = (k + j) / 2;
    for (let q = k; q <= j; q++) r[idx[q][1]] = avg;
    k = j + 1;
  }
  return r;
}
export function pearson(x, y) {
  const n = x.length; if (n < 3) return NaN;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
export const spearman = (x, y) => pearson(ranks(x), ranks(y));

// Quantile cut points (q in 0..1) of a numeric array
export function quantiles(a, qs) {
  const s = [...a].sort((p, q) => p - q);
  return qs.map(q => { const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); });
}
export const round = (x, d = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);

// Newey–West t-statistic of the mean of a time series (Bartlett weights). Use lags ≈ horizon − 1 when
// consecutive observations share most of their forward-return window.
export function nwTstat(x, lags) {
  const n = x.length; if (n < 3) return NaN;
  const m = mean(x), e = x.map(v => v - m);
  const L = Math.max(0, Math.min(lags, n - 1));
  let s = e.reduce((a, v) => a + v * v, 0) / n;
  for (let l = 1; l <= L; l++) {
    let g = 0; for (let t = l; t < n; t++) g += e[t] * e[t - l];
    s += 2 * (1 - l / (L + 1)) * (g / n);
  }
  return s > 0 ? m / Math.sqrt(s / n) : NaN;
}

// Standard normal CDF (Abramowitz–Stegun 7.1.26) and two-sided p-value of a z / t statistic
export function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
export const pTwoSided = (z) => (Number.isFinite(z) ? 2 * (1 - normCdf(Math.abs(z))) : 1);

// Benjamini–Hochberg q-values for an array of p-values (same order)
export function bhQvalues(p) {
  const m = p.length, idx = p.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(m); let run = 1;
  for (let k = m - 1; k >= 0; k--) { run = Math.min(run, (idx[k][0] * m) / (k + 1)); q[idx[k][1]] = run; }
  return q;
}
