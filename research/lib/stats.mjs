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
