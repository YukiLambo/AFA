// Writes the snapshot's split-adjusted daily stock prices (the same cleaning every study uses) to a CSV that the
// Python Kronos benchmark reads. Output is a build artefact, not committed.
//   node research/kronos/export_adjusted.mjs [out.csv]
import { writeFileSync } from 'node:fs';
import { loadSnapshot } from '../lib/data.mjs';
const out = process.argv[2] || 'research/kronos/adjusted.csv';
const snap = loadSnapshot();
const lines = ['symbol,market,date,open,high,low,close,volume'];
for (const [sym, s] of Object.entries(snap.series)) {
  if (s.kind !== 'stock') continue;
  for (const r of s.rows) lines.push([sym, s.market, r.date, r.open, r.high, r.low, r.close, r.volume].join(','));
}
writeFileSync(out, lines.join('\n') + '\n');
console.log(`Wrote ${lines.length - 1} rows to ${out}`);
