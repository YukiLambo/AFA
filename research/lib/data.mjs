// Shared data helpers for the A.F.A. research scripts (no dependencies, Node 18+).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RESEARCH_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(RESEARCH_DIR, 'data');

// Bonus issues the automatic rule cannot see (see corporate_actions.json)
const ACTIONS = JSON.parse(readFileSync(join(RESEARCH_DIR, 'corporate_actions.json'), 'utf8')).actions;

// Tencent's daily feed currently returns unadjusted prices. The app fixes stock splits with the same rule
// as src/App.jsx (adjustSplits): an overnight gap that matches a split ratio (2-for-1, 10-for-1, 1-for-10 ...)
// scales all earlier rows. Dividends are NOT adjusted, by the app or here.
// Note: the 1.5 branch below can never run (it sits inside ratio >= 1.8). It is kept identical to the app
// on purpose; bonus issues are handled through corporate_actions.json instead.
export function adjustSplits(rows) {
  const out = rows.map(r => ({ ...r }));
  const splits = [];
  for (let i = out.length - 1; i > 0; i--) {
    const prevClose = out[i - 1].close, open = out[i].open;
    if (!(prevClose > 0 && open > 0)) continue;
    const ratio = prevClose / open;
    let k = 0;
    if (ratio >= 1.8) { const n = Math.round(ratio); if (n >= 2 && Math.abs(ratio / n - 1) < 0.06) k = n; else if (Math.abs(ratio / 1.5 - 1) < 0.04) k = 1.5; }
    else if (ratio <= 0.55) { const n = Math.round(1 / ratio); if (n >= 2 && Math.abs((1 / ratio) / n - 1) < 0.06) k = 1 / n; }
    if (!k) continue;
    splits.push({ date: out[i].date, factor: k });
    for (let j = 0; j < i; j++) {
      out[j].open /= k; out[j].high /= k; out[j].low /= k; out[j].close /= k; out[j].volume *= k;
    }
  }
  return { rows: out, splits };
}

// Newest snapshot folder, or the one named in AFA_SNAPSHOT
export function snapshotDir(name = process.env.AFA_SNAPSHOT) {
  if (name) return join(DATA_DIR, name);
  if (!existsSync(DATA_DIR)) throw new Error('No data/ folder. Run: node research/fetch_snapshot.mjs');
  const all = readdirSync(DATA_DIR).filter(d => d.startsWith('snapshot-')).sort();
  if (!all.length) throw new Error('No snapshot found. Run: node research/fetch_snapshot.mjs');
  return join(DATA_DIR, all[all.length - 1]);
}

// Loads prices.csv.gz → { meta, series: { [symbol]: { market, kind, rows, splits } } }
// Rows are split-adjusted, oldest first, { date, open, high, low, close, volume }.
export function loadSnapshot(dir = snapshotDir()) {
  const meta = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const text = gunzipSync(readFileSync(join(dir, 'prices.csv.gz'))).toString('utf8');
  const lines = text.trim().split('\n');
  const head = lines[0].split(',');
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  const raw = {};
  for (let k = 1; k < lines.length; k++) {
    const f = lines[k].split(',');
    const sym = f[idx.symbol];
    (raw[sym] ||= { market: f[idx.market], kind: f[idx.kind], rows: [] }).rows.push({
      date: f[idx.date], open: +f[idx.open], high: +f[idx.high], low: +f[idx.low], close: +f[idx.close], volume: +f[idx.volume] || 0
    });
  }
  const series = {};
  for (const [sym, s] of Object.entries(raw)) {
    s.rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    const clean = s.rows.filter(r => r.close > 0 && r.open > 0 && r.high > 0 && r.low > 0);
    const { rows, splits } = s.kind === 'index' ? { rows: clean, splits: [] } : adjustSplits(clean);
    for (const a of ACTIONS.filter(x => x.symbol === sym)) {
      const at = rows.findIndex(r => r.date >= a.date);
      if (at <= 0) continue;
      for (let j = 0; j < at; j++) { const r = rows[j]; r.open /= a.factor; r.high /= a.factor; r.low /= a.factor; r.close /= a.factor; r.volume *= a.factor; }
      splits.push({ date: a.date, factor: a.factor, manual: true });
    }
    series[sym] = { market: s.market, kind: s.kind, rows, splits };
  }
  return { meta, dir, series };
}

// Index close on a date (or the last close before it), for market-relative returns
export function indexCloser(snap, market) {
  const sym = Object.keys(snap.series).find(k => snap.series[k].kind === 'index' && snap.series[k].market === market);
  if (!sym) throw new Error(`No index for ${market} in the snapshot`);
  const rows = snap.series[sym].rows, dates = rows.map(r => r.date);
  return (date) => {
    let lo = 0, hi = dates.length - 1;
    if (date < dates[0]) return NaN;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (dates[mid] <= date) lo = mid; else hi = mid - 1; }
    return rows[lo].close;
  };
}
