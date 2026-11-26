// Nightly company-data job: fetches valuation inputs from Yahoo Finance for the study universe (and any extra
// symbols) and writes public/data/fundamentals.json, which the static site reads. Run by
// .github/workflows/fundamentals.yml; can also be run by hand:  node scripts/fundamentals/fetch.mjs
//
// Yahoo's quoteSummary endpoint is unofficial and has no service-level agreement. If a symbol fails, the
// previous night's record is kept (with its own date), so a bad night never wipes the data.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuoteSummary } from './parse.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'data', 'fundamentals.json');
const UA = 'Mozilla/5.0 (compatible; AFA-education-app/1.0)';
const MODULES = 'price,financialData,defaultKeyStatistics,summaryDetail,earningsTrend,assetProfile';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Symbols: the research universe (HK codes in the app's 4-digit form) plus scripts/fundamentals/extra-symbols.json
const U = JSON.parse(readFileSync(join(ROOT, 'research', 'universe.json'), 'utf8'));
const extraFile = join(dirname(fileURLToPath(import.meta.url)), 'extra-symbols.json');
const extra = existsSync(extraFile) ? JSON.parse(readFileSync(extraFile, 'utf8')).symbols || [] : [];
const symbols = [...new Set([
  ...U.hk.map(c => `${String(parseInt(c, 10)).padStart(4, '0')}.HK`), ...U.us, ...extra
])];

async function session() {
  const r = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  const cookie = (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Yahoo gave no session cookie');
  const c = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
  const crumb = (await c.text()).trim();
  if (!c.ok || !crumb || crumb.includes(' ')) throw new Error(`Yahoo crumb failed (HTTP ${c.status})`);
  return { cookie, crumb };
}

async function getJson(url, headers, tries = 3) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (res?.ok) return res.json();
    if (res && res.status !== 429 && res.status < 500) return null; // not found etc.: don't retry
    await sleep(5000 * (t + 1)); // polite back-off on rate limits / server errors
  }
  return null;
}

const fxCache = {};
async function fxRate(from, to, headers) {
  const key = `${from}${to}`;
  if (key in fxCache) return fxCache[key];
  const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${key}=X?range=5d&interval=1d`, headers);
  const closes = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(Number.isFinite) || [];
  return (fxCache[key] = closes.length ? closes[closes.length - 1] : null);
}

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { stocks: {} };
const today = new Date().toISOString().slice(0, 10);
const stocks = { ...(prev.stocks || {}) };
let ok = 0, failed = [];

const { cookie, crumb } = await session();
const headers = { 'User-Agent': UA, Cookie: cookie };
for (const sym of symbols) {
  const j = await getJson(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${MODULES}&crumb=${encodeURIComponent(crumb)}`, headers);
  const result = j?.quoteSummary?.result?.[0];
  if (result) {
    // FX rates needed by this company, fetched before parsing
    const cur = result.price?.currency, fin = result.financialData?.financialCurrency;
    if (cur && fin && cur !== fin) await fxRate(fin, cur, headers);
    const rec = parseQuoteSummary(sym, result, (a, b) => fxCache[`${a}${b}`] ?? null);
    if (rec && !rec.error) { stocks[sym] = { ...rec, asOf: today }; ok++; } else failed.push(`${sym} (${rec?.error || 'parse'})`);
  } else failed.push(sym);
  await sleep(600);
}

const out = {
  updated: today,
  source: 'Yahoo Finance quoteSummary (unofficial; for education, may be delayed or wrong)',
  note: 'Per-share figures are in the trading currency. asOf = the night each record was last fetched successfully.',
  stocks: Object.fromEntries(Object.entries(stocks).sort(([a], [b]) => (a < b ? -1 : 1)))
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Fetched ${ok} of ${symbols.length}. Failed: ${failed.length ? failed.join(', ') : 'none'}`);
if (!ok && !Object.keys(prev.stocks || {}).length) process.exit(1);
