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
  return rec ? { ...rec, source: all.source } : null;
}

// Long-run growth (% a year) to use in the valuation: analysts' 5-year estimate, else next year's, kept within
// −5…25% because single-year estimates swing a lot
export function growthFromFundamentals(f) {
  const g = f?.growth5y ?? f?.growthNextYear ?? f?.earningsGrowth;
  if (!Number.isFinite(g)) return null;
  return Math.round(Math.max(-5, Math.min(25, g * 100)) * 10) / 10;
}
