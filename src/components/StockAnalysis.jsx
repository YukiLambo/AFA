import React, { useEffect, useMemo, useState } from 'react';
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Cell, ReferenceLine, ReferenceArea } from 'recharts';
import { Search, Loader2, Activity, Gauge, BarChart3, Calculator, FlaskConical, AlertTriangle, Crosshair } from 'lucide-react';
import { sma, bollinger, annualVolatility, periodReturn, sharpe, maxDrawdown, holtForecast, technicalReview, valuationModels, tradePlan } from '../lib/indicators';

// Stock analysis for the simulator: live quote, risk statistics, five technical indicators with a
// combined score, a candlestick chart with moving averages / Bollinger bands / a statistical projection,
// and a valuation calculator (P/E, earnings DCF, dividend discount, Graham). Educational only.

const MAS = [
  { n: 5, color: '#ffd166' }, { n: 20, color: '#fb923c' }, { n: 60, color: '#34d399' },
  { n: 120, color: '#60a5fa' }, { n: 240, color: '#c084fc' }
];
const RANGES = [['3M', 63], ['6M', 126], ['1Y', 252], ['2Y', 504]];
const GREEN = '#16c784', RED = '#ea3943'; // green = up, red = down (as elsewhere in A.F.A.)

const fmt = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-HK', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pctTxt = (r, d = 1) => (r === null || r === undefined ? '—' : `${r >= 0 ? '+' : ''}${(r * 100).toFixed(d)}%`);
const tone = (score) => (score > 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : score < 0 ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' : 'bg-slate-500/15 text-slate-300 border-slate-500/30');

// Candle drawn from a [low, high] range bar
function Candle(props) {
  const { x, y, width, height, payload } = props;
  if (!payload || payload.open === undefined || payload.wick === null) return null;
  const { open, close, high, low } = payload;
  const color = close >= open ? GREEN : RED;
  const cx = x + width / 2;
  const scale = high > low ? height / (high - low) : 0;
  const yO = y + (high - open) * scale;
  const yC = y + (high - close) * scale;
  const bodyTop = Math.min(yO, yC);
  const bodyH = Math.max(1, Math.abs(yC - yO));
  const bw = Math.max(1, width * 0.7);
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + Math.max(height, 1)} stroke={color} strokeWidth={1} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
    </g>
  );
}

function nextTradingDays(lastDate, n) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00`);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function StockAnalysis({ initialSymbol = '0700.HK', fetchQuote, fetchHistory, searchSymbols, onTrade }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  useEffect(() => { if (initialSymbol) setSymbol(initialSymbol); }, [initialSymbol]);
  const [quote, setQuote] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ok | nodata | error
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [range, setRange] = useState(252);
  const [chartType, setChartType] = useState('candle');
  const [shownMas, setShownMas] = useState({ 5: true, 20: true, 60: true, 120: false, 240: false });
  const [showBands, setShowBands] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [showPlan, setShowPlan] = useState(true);
  const [planLevels, setPlanLevels] = useState(null);
  const [val, setVal] = useState({ eps: '', growthPct: 8, discountPct: 9, terminalPe: 15, fairPe: 15, dps: '', divGrowthPct: 3 });

  // Load quote + ~2 years of daily candles
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      const q = await fetchQuote(symbol);
      if (cancelled) return;
      if (!q) { setQuote(null); setRows([]); setStatus('error'); return; }
      setQuote(q);
      setVal(v => ({ ...v, eps: q.pe ? (q.price / q.pe).toFixed(2) : '', dps: '' }));
      const hist = await fetchHistory(q.historyCode, 520);
      if (cancelled) return;
      setRows(hist);
      setStatus(hist.length >= 35 ? 'ok' : 'nodata');
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) { setMatches([]); return undefined; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchSymbols(q);
      if (/^\d{1,5}$/.test(q)) {
        const code = `${String(parseInt(q, 10)).padStart(4, '0')}.HK`;
        if (!found.some(f => f.symbol === code)) found.unshift({ symbol: code, name: 'HK code' });
      }
      if (!cancelled) { setMatches(found.slice(0, 6)); setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const analysis = useMemo(() => {
    if (rows.length < 35) return null;
    // Use the live price as today's close when the feed is ahead of the daily history
    const closes = rows.map(r => r.close);
    const mas = Object.fromEntries(MAS.map(m => [m.n, sma(closes, m.n)]));
    const bb = bollinger(closes);
    const last252 = rows.slice(-252);
    const hi52 = Math.max(...last252.map(r => r.high));
    const lo52 = Math.min(...last252.map(r => r.low));
    const vol5 = rows.slice(-5).reduce((s, r) => s + r.volume, 0) / Math.min(5, rows.length);
    const vol20 = rows.slice(-20).reduce((s, r) => s + r.volume, 0) / Math.min(20, rows.length);
    return {
      closes, mas, bb, hi52, lo52, vol5, vol20,
      r1m: periodReturn(closes, 21), r3m: periodReturn(closes, 63), r1y: periodReturn(closes, 252),
      vol: annualVolatility(closes), sharpe: sharpe(closes), mdd: maxDrawdown(closes.slice(-252)),
      forecast: holtForecast(closes, 20),
      review: technicalReview(rows)
    };
  }, [rows]);

  const chartData = useMemo(() => {
    if (!analysis) return [];
    const start = Math.max(0, rows.length - range);
    const data = rows.slice(start).map((r, j) => {
      const i = start + j;
      const row = { date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume, wick: [r.low, r.high] };
      MAS.forEach(m => { row[`ma${m.n}`] = analysis.mas[m.n][i]; });
      if (analysis.bb.upper[i] !== null) { row.band = [analysis.bb.lower[i], analysis.bb.upper[i]]; row.bbUpper = analysis.bb.upper[i]; row.bbLower = analysis.bb.lower[i]; }
      return row;
    });
    if (showForecast && analysis.forecast) {
      const last = data[data.length - 1];
      last.fMid = last.close; last.fBand = [last.close, last.close];
      nextTradingDays(last.date, analysis.forecast.path.length).forEach((date, k) => {
        const f = analysis.forecast.path[k];
        data.push({ date, wick: null, fMid: f.mid, fBand: [f.lower, f.upper] });
      });
    }
    return data;
  }, [analysis, rows, range, showForecast]);

  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'];
    let lo = Infinity, hi = -Infinity;
    if (showPlan && planLevels) planLevels.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    chartData.forEach(d => {
      [d.low, d.high, showBands ? d.bbLower : null, showBands ? d.bbUpper : null, d.fBand?.[0], d.fBand?.[1]].forEach(v => { if (v !== null && v !== undefined) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    });
    const pad = (hi - lo) * 0.05;
    return [Math.max(0, lo - pad), hi + pad];
  }, [chartData, showBands, showPlan, planLevels]);

  const valuation = useMemo(() => valuationModels({
    eps: Number(val.eps) || 0, growthPct: Number(val.growthPct) || 0, discountPct: Number(val.discountPct) || 0,
    terminalPe: Number(val.terminalPe) || 0, fairPe: Number(val.fairPe) || 0, dps: Number(val.dps) || 0, divGrowthPct: Number(val.divGrowthPct) || 0
  }), [val]);

  const price = quote?.price;
  // Buy / hold / sell plan from indicators + valuation + volatility (see tradePlan in lib/indicators.js)
  const plan = useMemo(() => (analysis && quote ? tradePlan({ rows, price: quote.price, fair: valuation.fair, review: analysis.review, forecast: analysis.forecast }) : null), [analysis, rows, quote, valuation.fair]);
  useEffect(() => { setPlanLevels(plan ? [plan.stop, plan.target, plan.entryLow] : null); }, [plan]);
  const cur = quote?.currency === 'USD' ? 'US$' : 'HK$';
  const mos = valuation.fair && price ? (valuation.fair - price) / valuation.fair : null;
  const lastRow = rows[rows.length - 1];
  const card = 'bg-[#161b22] p-4 rounded-2xl border border-slate-800/80 shadow-md';
  const label = 'text-[10px] font-mono uppercase text-slate-500';
  const inputCls = 'w-full px-3 py-2 glass-input rounded-lg text-sm text-white font-mono';

  return (
    <div className="space-y-5">
      {/* Header: search + quote */}
      <div className={`${card} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#00f2fe]/10 border border-[#00f2fe]/30 flex items-center justify-center shrink-0"><Activity className="w-5 h-5 text-[#00f2fe]" /></div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-lg font-black text-white">{quote?.symbol || symbol}</h3>
              <span className="text-xs text-slate-400 truncate">{quote?.name}</span>
            </div>
            {quote && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{cur}{fmt(price, price < 1 ? 3 : 2)}</span>
                <span className={`text-sm font-mono ${quote.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{quote.changePct >= 0 ? '+' : ''}{fmt(quote.changePct)}%</span>
                <span className="text-[10px] text-slate-500 font-mono">{quote.time}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Analyse another stock: 700, AAPL, 2800…" aria-label="Search stock to analyse" className="w-full pl-9 pr-9 py-2.5 glass-input rounded-xl text-sm text-white" />
            {searching && <Loader2 className="w-4 h-4 text-slate-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
            {matches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-[#0d1117] border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                {matches.map(m => (
                  <button key={m.symbol} onClick={() => { setSymbol(m.symbol); setQuery(''); setMatches([]); }} className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex justify-between gap-3 cursor-pointer">
                    <span className="text-sm font-bold text-white">{m.symbol}</span><span className="text-xs text-slate-400 truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {quote && onTrade && (
            <button onClick={() => onTrade(quote.symbol)} className="shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00f2fe] text-[#0d1117] flex items-center gap-1.5 cursor-pointer"><FlaskConical className="w-3.5 h-3.5" /> Trade</button>
          )}
        </div>
      </div>

      {status === 'loading' && <div className={`${card} text-center text-xs text-slate-400 py-10`}><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading prices and history…</div>}
      {status === 'error' && <div className={`${card} text-center text-xs text-amber-400 py-10`}>No live quote for {symbol} right now. Check the code or try again shortly.</div>}
      {status === 'nodata' && <div className={`${card} text-center text-xs text-amber-400 py-10`}>Not enough price history for {quote?.symbol} to calculate indicators (need at least 35 trading days).</div>}

      {status === 'ok' && analysis && (
        <>
          {/* Key statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className={card}>
              <div className={label}>Last session ({lastRow.date})</div>
              <div className="text-sm font-bold text-white mt-1 font-mono">O {fmt(lastRow.open)} · C {fmt(lastRow.close)}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">H {fmt(lastRow.high)} · L {fmt(lastRow.low)} · range {((lastRow.high - lastRow.low) / lastRow.low * 100).toFixed(1)}%</div>
            </div>
            <div className={card}>
              <div className={label}>Volume</div>
              <div className="text-sm font-bold text-white mt-1 font-mono">{fmt(lastRow.volume, 0)}</div>
              <div className="text-[10px] text-slate-500 mt-1">5-day avg {fmt(analysis.vol5, 0)} · {analysis.vol20 > 0 ? `${(lastRow.volume / analysis.vol20).toFixed(1)}× 20-day avg` : ''}</div>
            </div>
            <div className={card}>
              <div className={label}>52-week high / low</div>
              <div className="flex justify-between text-sm font-bold font-mono mt-1"><span className="text-rose-300">{fmt(analysis.lo52)}</span><span className="text-emerald-300">{fmt(analysis.hi52)}</span></div>
              <div className="h-1.5 rounded-full bg-slate-800 mt-1.5 relative">
                <div className="absolute h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400" style={{ width: `${Math.min(100, Math.max(0, ((price - analysis.lo52) / (analysis.hi52 - analysis.lo52 || 1)) * 100))}%` }} />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{pctTxt(price / analysis.hi52 - 1)} from high</div>
            </div>
            <div className={card}>
              <div className={label}>Returns</div>
              <div className="text-[11px] font-mono mt-1 space-y-0.5">
                {[['1M', analysis.r1m], ['3M', analysis.r3m], ['1Y', analysis.r1y]].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className={v === null ? 'text-slate-500' : v >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pctTxt(v)}</span></div>
                ))}
              </div>
            </div>
            <div className={card}>
              <div className={label}>Risk (1 year)</div>
              <div className="text-[11px] font-mono mt-1 space-y-0.5">
                <div className="flex justify-between"><span className="text-slate-500">Volatility</span><span className="text-white">{analysis.vol ? `${(analysis.vol * 100).toFixed(1)}%` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Sharpe (rf 3%)</span><span className={analysis.sharpe >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{analysis.sharpe === null ? '—' : analysis.sharpe.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Max drawdown</span><span className="text-rose-400">{pctTxt(analysis.mdd)}</span></div>
              </div>
            </div>
            <div className={card}>
              <div className={label}>Technical score</div>
              <div className={`text-lg font-black mt-1 ${analysis.review.total > 1 ? 'text-emerald-400' : analysis.review.total < -1 ? 'text-rose-400' : 'text-slate-200'}`}>{analysis.review.verdict}</div>
              <div className="text-[10px] text-slate-500">Score {analysis.review.total > 0 ? '+' : ''}{analysis.review.total} / 10 from 5 indicators</div>
            </div>
          </div>

          {/* Trade plan */}
          {plan && (() => {
            const sigTone = { Buy: 'from-emerald-500 to-teal-400 text-[#0d1117]', Accumulate: 'from-teal-500 to-cyan-400 text-[#0d1117]', Hold: 'from-amber-400 to-yellow-300 text-[#0d1117]', Reduce: 'from-orange-500 to-amber-400 text-[#0d1117]', Sell: 'from-rose-600 to-rose-400 text-white' }[plan.signal];
            const p2 = (v) => `${cur}${fmt(v, v < 1 ? 3 : 2)}`;
            const explain = {
              Buy: `Indicators, valuation and momentum line up. Buy in the entry zone; protect the position with the stop-loss.`,
              Accumulate: `Leaning positive. Build a position gradually, ideally on dips into the entry zone rather than chasing.`,
              Hold: `Mixed signals. Holders can keep the position with the stop-loss in place; new buyers can wait for a better entry.`,
              Reduce: `Leaning negative. Consider trimming into strength near resistance and tightening the stop-loss.`,
              Sell: `Indicators, valuation and momentum point down. Holders should consider selling; avoid new buying.`
            }[plan.signal];
            return (
              <div className={card}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><Crosshair className="w-4 h-4 text-[#00f2fe]" /> Trade plan · buy, hold or sell</h4>
                  <span className="text-[10px] text-slate-500">Combines technical score (40%), valuation gap (40%) and 3-month momentum (20%) · 60-trading-day horizon</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className={label}>Signal</div>
                      <div className={`inline-block mt-2 px-4 py-1.5 rounded-xl bg-gradient-to-r ${sigTone} text-xl font-black uppercase tracking-wider`}>{plan.signal}</div>
                      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">{explain}</p>
                    </div>
                    <div className="mt-3 space-y-1 text-[10px] font-mono">
                      {[['Technical', plan.parts.tech], ['Valuation', valuation.fair ? plan.parts.val : null], ['Momentum', plan.parts.momentum]].map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-16 text-slate-500">{k}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 relative overflow-hidden">
                            {v !== null && <div className="absolute top-0 h-full" style={{ left: v >= 0 ? '50%' : `${50 + v * 50}%`, width: `${Math.abs(v) * 50}%`, backgroundColor: v >= 0 ? GREEN : RED }} />}
                            <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
                          </div>
                          <span className="w-10 text-right text-slate-400">{v === null ? 'n/a' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                    <div className={label}>Tendency</div>
                    <div className={`text-lg font-black mt-1 ${plan.tendency === 'Rising' ? 'text-emerald-400' : plan.tendency === 'Falling' ? 'text-rose-400' : 'text-slate-200'}`}>{plan.tendency === 'Rising' ? '▲' : plan.tendency === 'Falling' ? '▼' : '◆'} {plan.tendency}</div>
                    <div className="text-[11px] text-slate-400">Expected drift over 20 trading days: <span className={plan.move20 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{pctTxt(plan.move20)}</span> → about {p2(price * (1 + plan.move20))}</div>
                    <div className="mt-3 text-[10px] font-mono space-y-0.5">
                      <div className="flex justify-between"><span className="text-slate-500">Resistance</span><span className="text-rose-300">{plan.resistances.length ? plan.resistances.map(v => fmt(v)).join(' · ') : 'none nearby'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Price</span><span className="text-white">{fmt(price)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Support</span><span className="text-emerald-300">{plan.supports.length ? plan.supports.map(v => fmt(v)).join(' · ') : 'none nearby'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Daily range (ATR)</span><span className="text-slate-300">{fmt(plan.atr)} ({((plan.atr / price) * 100).toFixed(1)}%)</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                    <div className={label}>If buying</div>
                    {(plan.signal === 'Reduce' || plan.signal === 'Sell') && <div className="mt-1 text-[10px] text-amber-400">Not a buy signal now: levels shown for reference only.</div>}
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Entry zone</span><span className="font-mono font-bold text-emerald-300">{p2(plan.entryLow)} – {p2(plan.entryHigh)}</span></div>
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Take-profit (profit-max)</span><span className="font-mono font-bold text-[#00f2fe]">{p2(plan.target)} <span className="text-[10px] text-slate-500">{pctTxt(plan.target / plan.entry - 1)}</span></span></div>
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Stop-loss</span><span className="font-mono font-bold text-rose-400">{p2(plan.stop)} <span className="text-[10px] text-slate-500">{pctTxt(plan.stop / plan.entry - 1)}</span></span></div>
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Reward : risk</span><span className="font-mono text-white">{plan.riskReward ? `${plan.riskReward.toFixed(1)} : 1` : '—'}</span></div>
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Chance target is hit first</span><span className="font-mono text-white">{(plan.probTarget * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Expected profit / share</span><span className={`font-mono font-bold ${plan.evPerShare >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{plan.evPerShare >= 0 ? '+' : '−'}{cur}{fmt(Math.abs(plan.evPerShare))}</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                    <div className={label}>If holding · valuation prices</div>
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Take profit between</span><span className="font-mono font-bold text-[#00f2fe]">{p2(plan.sellZoneLow)} – {p2(plan.sellZoneHigh)}</span></div>
                      <div className="flex justify-between items-baseline"><span className="text-slate-400">Cut loss below</span><span className="font-mono font-bold text-rose-400">{p2(plan.stop)}</span></div>
                      <div className="h-px bg-slate-800 my-1" />
                      {valuation.fair ? (
                        <>
                          <div className="flex justify-between items-baseline"><span className="text-slate-400">Buy below (20% margin)</span><span className="font-mono font-bold text-emerald-300">{p2(plan.buyBelow)}</span></div>
                          <div className="flex justify-between items-baseline"><span className="text-slate-400">Fair value</span><span className="font-mono text-white">{p2(valuation.fair)}</span></div>
                          <div className="flex justify-between items-baseline"><span className="text-slate-400">Sell above (+20%)</span><span className="font-mono font-bold text-rose-300">{p2(plan.sellAbove)}</span></div>
                        </>
                      ) : <p className="text-[11px] text-slate-500">Enter EPS in the valuation calculator below to add valuation-based buy and sell prices.</p>}
                    </div>
                    {onTrade && (
                      <button onClick={() => onTrade(quote.symbol)} className="mt-3 w-full py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] cursor-pointer hover:bg-[#00f2fe]/20">Practise this plan in the simulator</button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  How the prices are set: entry zone from the nearest support (swing lows, MA20/MA60, lower Bollinger band) to today's price; stop-loss below support and at least 1.5× the average daily range (ATR) away.
                  The take-profit is the level that gives the highest expected profit over 60 trading days, using the stock's own volatility and a drift from the trend and the valuation gap. Educational estimate, not investment advice.
                </p>
              </div>
            );
          })()}

          {/* Indicator verdicts */}
          <div className={card}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-[#00f2fe]" /> Technical indicators</h4>
              <span className="text-[10px] text-slate-500">Each indicator scores −2 to +2; they describe past prices, not future returns.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {analysis.review.items.map(it => (
                <div key={it.id} className="p-3 rounded-xl bg-[#0d1117] border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{it.label}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${tone(it.score)}`}>{it.tag}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">{it.note}</p>
                  <div className="text-[10px] font-mono mt-1 text-slate-500">score {it.score > 0 ? '+' : ''}{it.score}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className={card}>
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#00f2fe]" /> {quote.symbol} price chart</h4>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex p-0.5 rounded-lg bg-[#0d1117] border border-slate-800 mr-1">
                  {[['candle', 'Candles'], ['area', 'Line']].map(([id, l]) => (
                    <button key={id} onClick={() => setChartType(id)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer ${chartType === id ? 'bg-[#00f2fe] text-[#0d1117]' : 'text-slate-400'}`}>{l}</button>
                  ))}
                </div>
                {MAS.map(m => (
                  <button key={m.n} onClick={() => setShownMas(s => ({ ...s, [m.n]: !s[m.n] }))} className={`px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${shownMas[m.n] ? 'text-[#0d1117]' : 'text-slate-400 border-slate-700 bg-transparent'}`} style={shownMas[m.n] ? { backgroundColor: m.color, borderColor: m.color } : undefined}>MA{m.n}</button>
                ))}
                <button onClick={() => setShowBands(v => !v)} className={`px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${showBands ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50' : 'text-slate-400 border-slate-700'}`}>Bollinger</button>
                <button onClick={() => setShowPlan(v => !v)} className={`px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${showPlan ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50' : 'text-slate-400 border-slate-700'}`}>Plan levels</button>
                <button onClick={() => setShowForecast(v => !v)} className={`px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${showForecast ? 'bg-amber-500/20 text-amber-200 border-amber-400/50' : 'text-slate-400 border-slate-700'}`}>20-day projection</button>
                <div className="flex p-0.5 rounded-lg bg-[#0d1117] border border-slate-800 ml-1">
                  {RANGES.map(([l, n]) => (
                    <button key={l} onClick={() => setRange(n)} className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${range === n ? 'bg-white/10 text-white' : 'text-slate-500'}`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" opacity={0.6} />
                  <XAxis dataKey="date" stroke="#8b949e" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={d => String(d).slice(5)} />
                  <YAxis orientation="right" domain={yDomain} stroke="#8b949e" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={55} tickFormatter={v => v.toFixed(v < 10 ? 2 : 1)} allowDataOverflow />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    labelStyle={{ color: '#8b949e' }}
                    formatter={(v, name) => (Array.isArray(v) ? [`${fmt(v[0])} – ${fmt(v[1])}`, name] : [fmt(v), name])}
                  />
                  {showBands && <Area type="monotone" dataKey="band" name="Bollinger band" stroke="#818cf8" strokeOpacity={0.5} strokeDasharray="3 3" fill="#6366f1" fillOpacity={0.08} isAnimationActive={false} connectNulls />}
                  {showForecast && <Area type="monotone" dataKey="fBand" name="Projection range (95%)" stroke="none" fill="#f59e0b" fillOpacity={0.12} isAnimationActive={false} />}
                  {chartType === 'candle'
                    ? <Bar dataKey="wick" name="Low – high" shape={<Candle />} isAnimationActive={false} />
                    : <Area type="monotone" dataKey="close" name="Close" stroke="#00f2fe" fill="#00f2fe" fillOpacity={0.08} strokeWidth={1.5} isAnimationActive={false} />}
                  {MAS.filter(m => shownMas[m.n]).map(m => (
                    <Line key={m.n} type="monotone" dataKey={`ma${m.n}`} name={`MA${m.n}`} stroke={m.color} dot={false} strokeWidth={1.2} isAnimationActive={false} connectNulls />
                  ))}
                  {showForecast && <Line type="monotone" dataKey="fMid" name="Projection" stroke="#f59e0b" strokeDasharray="5 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />}
                  {price && <ReferenceLine y={price} stroke="#00f2fe" strokeOpacity={0.4} strokeDasharray="2 4" />}
                  {showPlan && plan && <ReferenceArea y1={plan.entryLow} y2={plan.entryHigh} fill={GREEN} fillOpacity={0.08} stroke="none" />}
                  {showPlan && plan && <ReferenceLine y={plan.target} stroke="#00f2fe" strokeDasharray="6 3" label={{ value: `Target ${fmt(plan.target)}`, position: 'insideTopLeft', fill: '#00f2fe', fontSize: 10 }} />}
                  {showPlan && plan && <ReferenceLine y={plan.stop} stroke={RED} strokeDasharray="6 3" label={{ value: `Stop ${fmt(plan.stop)}`, position: 'insideBottomLeft', fill: RED, fontSize: 10 }} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="h-20 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Bar dataKey="volume" isAnimationActive={false}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.close >= d.open ? GREEN : RED} fillOpacity={0.5} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {showForecast && analysis.forecast && (
              <p className="text-[10px] text-slate-500 mt-2">
                Projection: Holt linear trend smoothing fitted to the last year (α {analysis.forecast.alpha.toFixed(2)}, β {analysis.forecast.beta.toFixed(2)}), with a 95% range that widens over time.
                In 20 trading days it points to {cur}{fmt(analysis.forecast.path[19].mid)} ({cur}{fmt(analysis.forecast.path[19].lower)}–{fmt(analysis.forecast.path[19].upper)}). It only extends the recent trend; it is not a prediction.
              </p>
            )}
          </div>
        </>
      )}

      {quote && (
        /* Valuation calculator */
        <div className={card}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2"><Calculator className="w-4 h-4 text-[#00f2fe]" /> Valuation calculator</h4>
            <span className="text-[10px] text-slate-500">{quote.pe ? `EPS pre-filled from the feed's P/E of ${fmt(quote.pe, 1)}. ` : ''}Change any input to test your own assumptions.</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="grid grid-cols-2 gap-3 content-start">
              {[
                ['eps', `EPS (${cur} per share)`, '0.01'], ['dps', `Dividend per share (${cur})`, '0.01'],
                ['growthPct', 'EPS growth % / yr (5 yrs)', '0.5'], ['divGrowthPct', 'Dividend growth %', '0.5'],
                ['discountPct', 'Required return %', '0.5'], ['terminalPe', 'Exit P/E (year 5)', '0.5'],
                ['fairPe', 'Fair P/E today', '0.5']
              ].map(([k, l, step]) => (
                <div key={k}>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">{l}</label>
                  <input type="number" step={step} value={val[k]} onChange={e => setVal(v => ({ ...v, [k]: e.target.value }))} className={inputCls} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {valuation.models.length === 0 && <p className="text-xs text-slate-500">Enter EPS (and a dividend for the dividend model) to see fair-value estimates.</p>}
              {valuation.models.map(m => (
                <div key={m.id} className="p-3 rounded-xl bg-[#0d1117] border border-slate-800">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-white">{m.label}</span>
                    <span className={`text-sm font-mono font-bold ${price && m.value >= price ? 'text-emerald-400' : 'text-rose-400'}`}>{cur}{fmt(m.value)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.formula}</div>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800 flex flex-col justify-center">
              <div className={label}>Fair value (median of models)</div>
              <div className="text-3xl font-black text-white font-mono mt-1">{valuation.fair ? `${cur}${fmt(valuation.fair)}` : '—'}</div>
              <div className="text-xs text-slate-400 mt-1">vs price {cur}{fmt(price, price < 1 ? 3 : 2)}</div>
              {mos !== null && (
                <>
                  <div className={`mt-3 text-sm font-black ${mos > 0.15 ? 'text-emerald-400' : mos < -0.15 ? 'text-rose-400' : 'text-amber-300'}`}>
                    {mos > 0.15 ? 'Looks undervalued' : mos < -0.15 ? 'Looks overvalued' : 'Around fair value'} · margin of safety {pctTxt(mos, 0)}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Value investors often want a 20–30% margin of safety before buying. Results move a lot with growth and required-return assumptions.</p>
                </>
              )}
              {quote.pe && <div className="text-[10px] text-slate-500 mt-2">Current P/E {fmt(quote.pe, 1)} · earnings yield {fmt(100 / quote.pe, 1)}%</div>}
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600 flex gap-1.5"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> For learning and simulated trading only. Indicators, projections and valuation models are based on past prices and your assumptions; they are not investment advice.</p>
    </div>
  );
}
