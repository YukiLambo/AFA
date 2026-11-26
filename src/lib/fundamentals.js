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
