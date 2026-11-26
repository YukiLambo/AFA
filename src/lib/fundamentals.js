// Company data saved each night by .github/workflows/fundamentals.yml (public/data/fundamentals.json).
// Loaded once per session; returns null for symbols the job does not cover, so callers fall back to manual inputs.
let cache = null;

export function loadFundamentals() {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}data/fundamentals.json`, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return cache;
}

export async function getFundamentals(symbol) {
  const all = await loadFundamentals();
  const rec = all?.stocks?.[symbol];
  return rec ? { ...rec, source: all.source, market: all.market || null } : null;
}

// Equity risk premium assumptions (% a year): a mature-market premium for the US and a little more for Hong Kong.
// These are judgement calls in the range academics such as Damodaran publish; change them here if needed.
export const EQUITY_PREMIUM = { US: 4.5, HK: 5.5 };

// CAPM required return: risk-free + adjusted beta × equity risk premium.
// Beta is pulled a third of the way towards 1 (Blume adjustment: raw betas drift towards 1 over time) and kept
// within 0.3–2.5; the result is kept between risk-free + 2 points and 20%.
export function capmDiscount(f, isHK) {
  const rf = f?.market?.riskFree;
  if (!Number.isFinite(rf)) return null;
  const rawBeta = Number.isFinite(f.beta) ? Math.max(0.3, Math.min(2.5, f.beta)) : 1;
  const beta = 0.67 * rawBeta + 0.33;
  const erp = isHK ? EQUITY_PREMIUM.HK : EQUITY_PREMIUM.US;
  const pct = Math.max(rf * 100 + 2, Math.min(20, rf * 100 + beta * erp));
  return { pct: Math.round(pct * 10) / 10, riskFreePct: Math.round(rf * 1000) / 10, rawBeta: Number.isFinite(f.beta) ? f.beta : null, beta: Math.round(beta * 100) / 100, erp };
}

// Long-run growth (% a year) to use in the valuation: analysts' 5-year estimate, else next year's, kept within
// −5…25% because single-year estimates swing a lot
export function growthFromFundamentals(f) {
  const g = f?.growth5y ?? f?.growthNextYear ?? f?.earningsGrowth;
  if (!Number.isFinite(g)) return null;
  return Math.round(Math.max(-5, Math.min(25, g * 100)) * 10) / 10;
}

// ---- Peer-relative valuation (step 7) ----
// How analysts sanity-check a DCF: compare the stock's multiples with similar companies in the same market.
// Peers = same market and same industry; if fewer than MIN_PEERS have data, same market and sector.
// Multiples are recomputed from the currency-converted per-share figures (price ÷ EPS, price ÷ book), so mainland
// companies that report in CNY but trade in HKD compare like with like. Negative or extreme multiples are left out.
const MIN_PEERS = 4;
const isHKsym = (s) => /\.HK$/.test(s);
const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const ok = (x, max) => Number.isFinite(x) && x > 0 && x < max;

export function multiplesOf(r) {
  if (!r || !(r.price > 0)) return {};
  const pe = r.trailingEps > 0 ? r.price / r.trailingEps : null;
  const pb = r.bookPerShare > 0 ? r.price / r.bookPerShare : null;
  const ev = r.evToEbitda;
  return { pe: ok(pe, 200) ? pe : null, pb: ok(pb, 50) ? pb : null, evEbitda: ok(ev, 100) ? ev : null };
}

const METRICS = [
  { key: 'pe', label: 'P/E', model: 'Peer P/E', implied: (r, m) => (r.trailingEps > 0 ? m * r.trailingEps : null), base: (r) => `trailing EPS ${r.trailingEps?.toFixed(2)}` },
  { key: 'evEbitda', label: 'EV/EBITDA', model: 'Peer EV/EBITDA',
    // EBITDA per share backed out of the stock's own EV/EBITDA; EV ≈ market cap + net debt (ignores minority interests)
    implied: (r, m) => { const own = multiplesOf(r).evEbitda; if (!own || !Number.isFinite(r.netDebtPerShare)) return null; const ebitda = (r.price + r.netDebtPerShare) / own; const v = m * ebitda - r.netDebtPerShare; return v > 0 ? v : null; },
    base: (r) => `EBITDA and net debt per share` },
  { key: 'pb', label: 'P/B', model: 'Peer P/B', implied: (r, m) => (r.bookPerShare > 0 ? m * r.bookPerShare : null), base: (r) => `book value ${r.bookPerShare?.toFixed(2)} per share` }
];

// Returns null when there are too few peers; otherwise the peer group and, per multiple, the stock's value, the peer
// median, where the stock ranks (0% = cheapest, 100% = dearest) and the price at the peer median.
export function peerComparison(rec, stocks) {
  if (!rec || !stocks) return null;
  const others = Object.values(stocks).filter(s => s.symbol !== rec.symbol && isHKsym(s.symbol) === isHKsym(rec.symbol));
  const pick = (field) => (rec[field] ? others.filter(s => s[field] === rec[field]) : []);
  let group = null, peers = [];
  for (const field of ['industry', 'sector']) {
    const p = pick(field);
    if (p.filter(s => Object.values(multiplesOf(s)).some(Boolean)).length >= MIN_PEERS) { group = { by: field, name: rec[field] }; peers = p; break; }
  }
  if (!group) return null;
  const own = multiplesOf(rec);
  const metrics = [];
  for (const M of METRICS) {
    const vals = peers.map(s => multiplesOf(s)[M.key]).filter(Boolean);
    if (vals.length < MIN_PEERS) continue;
    const med = median(vals), mine = own[M.key];
    const implied = M.implied(rec, med);
    metrics.push({
      key: M.key, label: M.label, value: mine, median: med, count: vals.length,
      // mid-rank: ties count half, so a stock level with most peers ranks in the middle
      percentile: mine ? Math.round(100 * (vals.filter(v => v < mine).length + 0.5 * vals.filter(v => v === mine).length) / vals.length) : null,
      implied, model: implied ? { id: `peer-${M.key}`, label: M.model, value: implied, formula: `Peer median ${M.label} ${med.toFixed(1)} (${vals.length} ${group.by === 'industry' ? 'industry' : 'sector'} peers) × ${M.base(rec)}` } : null
    });
  }
  return metrics.length ? { group, peers: peers.map(s => ({ symbol: s.symbol, name: s.name })), metrics } : null;
}

export async function getPeerComparison(symbol) {
  const all = await loadFundamentals();
  return peerComparison(all?.stocks?.[symbol], all?.stocks);
}
