// Downloads a fixed daily-price snapshot for the A.F.A. studies from Tencent's public kline feed
// (the same source the app uses) and writes research/data/snapshot-<date>/prices.csv.gz + manifest.json.
//
//   node research/fetch_snapshot.mjs                 # 2018-01-01 → today
//   node research/fetch_snapshot.mjs --end 2026-11-26
//
// Prices are stored exactly as the feed returns them (unadjusted). lib/data.mjs applies the app's split
// adjustment when loading, so the raw file stays reproducible.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { DATA_DIR, RESEARCH_DIR } from './lib/data.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const START = arg('start', '2018-01-01');
const END = arg('end', new Date().toISOString().slice(0, 10));
const URL = (code, a, b) => `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},day,${a},${b},640,qfq`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The feed returns at most ~640 rows per call, so ask in windows of about 2 years
function windows(start, end) {
  const out = []; let a = new Date(start);
  const e = new Date(end);
  while (a <= e) {
    const b = new Date(a); b.setFullYear(b.getFullYear() + 2); b.setDate(b.getDate() - 1);
    out.push([a.toISOString().slice(0, 10), (b < e ? b : e).toISOString().slice(0, 10)]);
    a = new Date(b); a.setDate(a.getDate() + 1);
  }
  return out;
}

async function getJson(url, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
    } catch (e) { /* retry */ }
    await sleep(1000 * 2 ** t);
  }
  throw new Error(`failed: ${url}`);
}

async function fetchCode(code) {
  const rows = new Map();
  for (const [a, b] of windows(START, END)) {
    const json = await getJson(URL(code, a, b));
    const node = json?.data?.[code];
    const list = (node && (node.qfqday || node.day)) || [];
    for (const r of list) rows.set(r[0], r);
    await sleep(150);
  }
  // Tencent row: [date, open, close, high, low, volume, ...]
  return [...rows.values()].sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(r => ({ date: r[0], open: +r[1], close: +r[2], high: +r[3], low: +r[4], volume: +r[5] || 0 }));
}

// US tickers need the exchange suffix Tencent uses
async function resolveUs(tk) {
  for (const sfx of ['.OQ', '.N', '.AM']) {
    const code = `us${tk}${sfx}`;
    const json = await getJson(URL(code, '2026-01-01', END));
    const node = json?.data?.[code];
    if (node && (node.qfqday || node.day || []).length) return code;
  }
  return null;
}

const U = JSON.parse(readFileSync(join(RESEARCH_DIR, 'universe.json'), 'utf8'));
const jobs = [
  ...U.hk.map(c => ({ symbol: `${c}.HK`, market: 'HK', kind: 'stock', code: `hk${c}` })),
  ...U.us.map(t => ({ symbol: t, market: 'US', kind: 'stock', us: t })),
  ...Object.entries(U.indices).map(([m, code]) => ({ symbol: code, market: m, kind: 'index', code }))
];

const lines = ['symbol,market,kind,date,open,high,low,close,volume'];
const summary = [];
for (const j of jobs) {
  const code = j.code || await resolveUs(j.us);
  if (!code) { console.warn(`skip ${j.symbol}: no Tencent code found`); summary.push({ symbol: j.symbol, rows: 0 }); continue; }
  const rows = await fetchCode(code);
  for (const r of rows) lines.push([j.symbol, j.market, j.kind, r.date, r.open, r.high, r.low, r.close, r.volume].join(','));
  summary.push({ symbol: j.symbol, code, market: j.market, kind: j.kind, rows: rows.length, first: rows[0]?.date, last: rows.at(-1)?.date });
  console.log(`${j.symbol.padEnd(9)} ${code.padEnd(12)} ${rows.length} rows ${rows[0]?.date} → ${rows.at(-1)?.date}`);
}

const dir = join(DATA_DIR, `snapshot-${END}`);
mkdirSync(dir, { recursive: true });
const gz = gzipSync(Buffer.from(lines.join('\n') + '\n'), { level: 9 });
writeFileSync(join(dir, 'prices.csv.gz'), gz);
const manifest = {
  source: 'Tencent Securities daily kline (web.ifzq.gtimg.cn), unadjusted; split-adjusted on load by lib/data.mjs',
  start: START, end: END, created: new Date().toISOString(),
  sha256: createHash('sha256').update(gz).digest('hex'),
  symbols: summary
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nWrote ${dir} (${(gz.length / 1e6).toFixed(1)} MB, ${lines.length - 1} rows)`);
