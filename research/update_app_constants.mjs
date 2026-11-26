// Writes the evidence numbers from a study3 result into src/lib/horizonModel.js (EVIDENCE values, CALIB and
// the numeric parts of STUDY3), so the app never carries hand-typed study numbers.
//
//   node research/update_app_constants.mjs                       # uses results/study3-market.json
//   node research/update_app_constants.mjs results/study3-market.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESEARCH_DIR } from './lib/data.mjs';

const resFile = join(RESEARCH_DIR, process.argv[2] || 'results/study3-market.json');
const R = JSON.parse(readFileSync(resFile, 'utf8'));
const appFile = join(RESEARCH_DIR, '..', 'src/lib/horizonModel.js');
let src = readFileSync(appFile, 'utf8');

// EVIDENCE: replace each `key: [ ... ]` inside the EVIDENCE block, keeping comments and layout
const start = src.indexOf('export const EVIDENCE = {'), end = src.indexOf('\n};', start);
let block = src.slice(start, end);
let n = 0;
for (const [key, row] of Object.entries(R.evidence)) {
  const re = new RegExp(`(\\b${key}: )\\[[^\\]]*\\]`);
  if (!re.test(block)) { console.warn(`EVIDENCE has no ${key}`); continue; }
  block = block.replace(re, `$1[${row.map(v => (v === null ? 0 : v)).join(', ')}]`);
  n++;
}
src = src.slice(0, start) + block + src.slice(end);

// CALIB
const C = R.calib;
const calib = `const CALIB = {\n  short: { x: [${C.short.x.join(', ')}], ex: [${C.short.ex.join(', ')}], hit: [${C.short.hit.join(', ')}] },\n  long: { x: [${C.long.x.join(', ')}], ex: [${C.long.ex.join(', ')}], hit: [${C.long.hit.join(', ')}] }\n};`;
src = src.replace(/const CALIB = \{[\s\S]*?\n\};/, calib);

// STUDY3 numbers
const ic = R.ic, tb = R.topBottom, num = (s) => s.split(' ')[0];
const part = (h, H) => `  ${h}: { horizon: ${H}, icTrainHK: ${ic[h]['HK-train'].ic}, icTestHK: ${ic[h]['HK-test'].ic}, icTrainUS: ${ic[h]['US-train'].ic}, icTestUS: ${ic[h]['US-test'].ic}, posTestHK: '${num(ic[h]['HK-test'].positive)} of ${ic[h]['HK-test'].positive.split(' of ')[1]}', posTestUS: '${num(ic[h]['US-test'].positive)} of ${ic[h]['US-test'].positive.split(' of ')[1]}',\n    top: { HK: [${tb[h].HK.top.join(', ')}], US: [${tb[h].US.top.join(', ')}] }, bottom: { HK: [${tb[h].HK.bottom.join(', ')}], US: [${tb[h].US.bottom.join(', ')}] } }`;
const study = `export const STUDY3 = {\n  universe: '${R.universe.HK} Hang Seng and ${R.universe.US} US large caps',\n  period: 'tuned Oct 2019 – Jun 2023, tested Jul 2023 – Nov 2026',\n  method: '${R.method}', snapshot: '${R.snapshot}',\n${part('short', R.horizons.short)},\n${part('long', R.horizons.long)}\n};`;
src = src.replace(/export const STUDY3 = \{[\s\S]*?\n\};/, study);

// FDR_PASS: states whose combined test passed Benjamini–Hochberg control (only verdicts on these count)
if (R.fdr) {
  const keysPass = (h) => R.fdr.list[h].map(x => `'${x.split(' ')[0]}'`).join(', ');
  const fdr = `export const FDR_PASS = {\n  q: ${R.fdr.q},\n  short: [${keysPass('short')}],\n  long: [${keysPass('long')}]\n};`;
  if (/export const FDR_PASS = \{[\s\S]*?\n\};/.test(src)) src = src.replace(/export const FDR_PASS = \{[\s\S]*?\n\};/, fdr);
  else src = src.replace('// Pattern names, the textbook direction', `// States that passed false-discovery control (Benjamini–Hochberg, Newey–West t-statistics). Written by\n// research/update_app_constants.mjs.\n${fdr}\n\n// Pattern names, the textbook direction`);
}

// STUDY3.walkForward from results/walkforward.json (refit every 6 months, scored on the next 6)
try {
  const W = JSON.parse(readFileSync(join(RESEARCH_DIR, 'results/walkforward.json'), 'utf8'));
  const wf = (h) => `{ icHK: ${W.summary[h].HK.walk.ic.mean}, icUS: ${W.summary[h].US.walk.ic.mean}, posHK: '${W.summary[h].HK.walk.ic.positive}', posUS: '${W.summary[h].US.walk.ic.positive}' }`;
  src = src.replace(/\n  walkForward: \{[\s\S]*?\n  \},?/, '');
  src = src.replace(/(export const STUDY3 = \{[\s\S]*?)\n\};/, `$1,\n  walkForward: {\n    from: '${W.firstTest.slice(0, 4)}', short: ${wf('short')},\n    long: ${wf('long')}\n  }\n};`);
} catch (e) { console.warn('No walkforward.json: STUDY3.walkForward not written'); }

// CROSS_SECTION from results/crosssection.json: top-minus-bottom quintile tests of each score
try {
  const X = JSON.parse(readFileSync(join(RESEARCH_DIR, 'results/crosssection.json'), 'utf8'));
  const one = (m, name, hd) => { const r = X.markets[m][name][hd]; return `{ spread: ${r.spread}, t: ${r.spreadT}, ic: ${r.ic} }`; };
  const block = (name, hd) => `{ hold: ${hd}, HK: ${one('HK', name, hd)}, US: ${one('US', name, hd)} }`;
  const cs = `export const CROSS_SECTION = {\n  outlookShort: ${block('outlookShort', 21)},\n  outlookLong: ${block('outlookLong', 126)},\n  strength: ${block('strength', 126)},\n  timing: ${block('timing', 126)}\n};`;
  if (/export const CROSS_SECTION = \{[\s\S]*?\n\};/.test(src)) src = src.replace(/export const CROSS_SECTION = \{[\s\S]*?\n\};/, cs);
  else src = src.replace(/(export const STUDY3 = \{[\s\S]*?\n\};)/, `$1\n\n// Cross-sectional test (research/crosssection.mjs): each month, rank a market's stocks by the score and compare the\n// top 20% with the bottom 20% over the hold, return vs the index in % points. Written by update_app_constants.mjs.\n${cs}`);
} catch (e) { console.warn('No crosssection.json: CROSS_SECTION not written'); }

writeFileSync(appFile, src);
console.log(`Updated ${n} EVIDENCE rows, CALIB and STUDY3 in src/lib/horizonModel.js from ${resFile}`);
