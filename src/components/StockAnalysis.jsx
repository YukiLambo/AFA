import React, { useEffect, useMemo, useState } from 'react';
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Cell, ReferenceLine, ReferenceArea } from 'recharts';
import { Search, Loader2, Activity, Gauge, BarChart3, Calculator, FlaskConical, AlertTriangle, Crosshair, Star, X as XIcon, Newspaper, ExternalLink } from 'lucide-react';
import { aggregateNews, companySearchName } from '../lib/newsSentiment';
import { horizonOutlook, indicatorTable, PATTERNS, verdict, evText, STUDY3, SIGNAL_SCALE } from '../lib/horizonModel';
import { valuationScore } from '../lib/indicators';
import { sma, bollinger, annualVolatility, periodReturn, sharpe, maxDrawdown, holtForecast, technicalReview, valuationModels, tradePlan, valuationRange, impliedGrowth, dcfValue, pegFairPe, backtestSignals, STUDY_RESULTS, STUDY2, signalSeries, adxSeries, ichimokuSeries, supertrendSeries, stochasticSeries, obvSeries, fibonacciLevels, detectPatterns, ema, macd, rsi } from '../lib/indicators';

// Stock analysis for the simulator: live quote, risk statistics, five technical indicators with a
// combined score, a candlestick chart with moving averages / Bollinger bands / a statistical projection,
// and a valuation calculator (P/E, earnings DCF, dividend discount, Graham). Educational only.

// Sector presets for the valuation calculator (typical long-run assumptions, editable)
const PRESETS = {
  tech: { label: 'Tech / internet', growthPct: 12, discountPct: 10, terminalPe: 18, divGrowthPct: 5 },
  consumer: { label: 'Consumer', growthPct: 8, discountPct: 9, terminalPe: 16, divGrowthPct: 4 },
  financial: { label: 'Banks & insurance', growthPct: 5, discountPct: 9, terminalPe: 10, divGrowthPct: 3 },
  utility: { label: 'Utilities & REITs', growthPct: 3, discountPct: 7, terminalPe: 14, divGrowthPct: 2 },
  property: { label: 'Property', growthPct: 2, discountPct: 10, terminalPe: 8, divGrowthPct: 1 },
  energy: { label: 'Energy & materials', growthPct: 4, discountPct: 10, terminalPe: 10, divGrowthPct: 2 },
  industrial: { label: 'Industrials', growthPct: 6, discountPct: 9, terminalPe: 13, divGrowthPct: 3 }
};
// What the real-market study found for each indicator (see STUDY_RESULTS in lib/indicators.js)
const EVIDENCE = { ma: ['No edge found', 'slate'], macd: ['No edge found', 'slate'], kd: ['Small contrarian edge', 'teal'], rsi: ['Small contrarian edge', 'teal'], bb: ['Small contrarian edge', 'teal'] };

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

const ago = (ts) => {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

function nextTradingDays(lastDate, n) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00`);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function StockAnalysis({ initialSymbol = '0700.HK', fetchQuote, fetchHistory, searchSymbols, onTrade, watchlist = [], onWatchlistChange, fetchNews, generalNews = [], portfolioValue = 0 }) {
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
  const [overlay, setOverlay] = useState({ fib: false, supertrend: false, cloud: false });
  const [showPlan, setShowPlan] = useState(true);
  const [planLevels, setPlanLevels] = useState(null);
  const [news, setNews] = useState({ status: 'idle', items: [] });
  const [watchQuotes, setWatchQuotes] = useState({});
  const [val, setVal] = useState({ eps: '', growthPct: 8, discountPct: 9, terminalPe: 16, fairPe: pegFairPe(8), fairPeAuto: true, dps: '', divGrowthPct: 4, preset: 'consumer' });
  const [riskPct, setRiskPct] = useState(1);
  const [sizeBase, setSizeBase] = useState('');

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
      const hist = await fetchHistory(q.historyCode, 1000);
      if (cancelled) return;
      setRows(hist);
      setStatus(hist.length >= 35 ? 'ok' : 'nodata');
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  // Company news (Google News search via RSS) plus matching headlines from the general feed
  useEffect(() => {
    if (!quote?.symbol) return undefined;
    let cancelled = false;
    const name = companySearchName(quote.name, quote.symbol);
    setNews({ status: 'loading', items: [] });
    (async () => {
      const found = fetchNews ? await fetchNews(name) : [];
      const key = name.toLowerCase().split(' ')[0];
      const fromFeed = generalNews.filter(n => key.length > 2 && `${n.title} ${n.summary}`.toLowerCase().includes(key));
      const seen = new Set();
      const merged = [...found, ...fromFeed].filter(n => { const k = n.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!cancelled) setNews({ status: merged.length ? 'ok' : 'none', items: merged.slice(0, 25), query: name });
    })();
    return () => { cancelled = true; };
  }, [quote?.symbol]);

  // Watchlist prices (every 60 s)
  const watchKey = watchlist.map(w => w.symbol).join(',');
  useEffect(() => {
    if (!watchKey) return undefined;
    const load = async () => {
      const list = watchKey.split(',');
      const got = await Promise.all(list.map(sym => fetchQuote(sym)));
      const next = {};
      got.forEach((q, i) => { if (q?.price) next[list[i]] = q; });
      setWatchQuotes(prev => ({ ...prev, ...next }));
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(t);
  }, [watchKey]);

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
      review: technicalReview(rows),
      track: backtestSignals(rows),
      // Extended indicator set (lib/indicators.js) for the indicator table, patterns and chart overlays
      series: signalSeries(rows),
      adx: adxSeries(rows),
      ichimoku: ichimokuSeries(rows),
      supertrend: supertrendSeries(rows),
      stoch: stochasticSeries(rows),
      obv: obvSeries(rows),
      fib: fibonacciLevels(rows),
      patterns: detectPatterns(rows, 5),
      ema12: ema(closes, 12), ema26: ema(closes, 26), macd: macd(closes), rsi14: rsi(closes)
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
      if (analysis.supertrend.line[i] !== null) row[analysis.supertrend.dir[i] > 0 ? 'stUp' : 'stDn'] = analysis.supertrend.line[i];
      const sa = analysis.ichimoku.spanA[i], sb = analysis.ichimoku.spanB[i];
      if (sa !== null && sb !== null) row.cloud = [Math.min(sa, sb), Math.max(sa, sb)];
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

  const valInputs = useMemo(() => ({
    eps: Number(val.eps) || 0, growthPct: Number(val.growthPct) || 0, discountPct: Number(val.discountPct) || 0,
    terminalPe: Number(val.terminalPe) || 0, fairPe: Number(val.fairPe) || 0, dps: Number(val.dps) || 0, divGrowthPct: Number(val.divGrowthPct) || 0
  }), [val]);
  const valuation = useMemo(() => valuationModels(valInputs), [valInputs]);
  const fairRange = useMemo(() => valuationRange(valInputs), [valInputs]);
  const setValField = (k, v) => setVal(prev => {
    const next = { ...prev, [k]: v };
    if (k === 'fairPe') next.fairPeAuto = false;
    if (k === 'growthPct' && prev.fairPeAuto) next.fairPe = pegFairPe(Number(v) || 0);
    return next;
  });
  const applyPreset = (key) => setVal(prev => ({ ...prev, ...PRESETS[key], preset: key, fairPe: pegFairPe(PRESETS[key].growthPct), fairPeAuto: true }));

  const price = quote?.price;
  // Buy / hold / sell plan from indicators + valuation + volatility (see tradePlan in lib/indicators.js)
  const newsSummary = useMemo(() => aggregateNews(news.items), [news.items]);
  const plan = useMemo(() => (analysis && quote ? tradePlan({
    rows, price: quote.price, fairRange, review: analysis.review, forecast: analysis.forecast,
    news: news.status === 'ok' ? newsSummary : null,
    // The stock's own track record nudges the timing / strength weights once there are enough past samples
    weights: analysis.track && analysis.track.n >= 100 ? analysis.track.weights : null
  }) : null), [analysis, rows, quote, fairRange, newsSummary, news.status]);
  const implied = quote && valInputs.eps > 0 ? impliedGrowth(quote.price, valInputs.eps, valInputs.discountPct, valInputs.terminalPe) : null;
  const inWatchlist = quote ? watchlist.some(w => w.symbol === quote.symbol) : false;
  const toggleWatch = () => {
    if (!quote || !onWatchlistChange) return;
    onWatchlistChange(inWatchlist ? watchlist.filter(w => w.symbol !== quote.symbol) : [...watchlist, { symbol: quote.symbol, name: quote.name }].slice(-20));
  };
  // Short-term (2 weeks) and long-term (6 months) outlook from the real-market study (lib/horizonModel.js)
  const [horizon, setHorizon] = useState('short');
  const outlook = useMemo(() => (analysis && quote ? horizonOutlook({
    rows, price: quote.price,
    valScore: valuationScore(quote.price, fairRange),
    severe: news.status === 'ok' && newsSummary.severe.length > 0
  }) : null), [analysis, rows, quote, fairRange, newsSummary, news.status]);
  useEffect(() => { const o = outlook && outlook[horizon]; setPlanLevels(o ? [o.stop, o.target, o.entry] : null); }, [outlook, horizon]);
  const cur = quote?.currency === 'USD' ? 'US$' : 'HK$';
  const mos = valuation.fair && price ? (valuation.fair - price) / valuation.fair : null;
  const sizingBase = Number(sizeBase) || portfolioValue || 0;
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
              {quote && onWatchlistChange && (
                <button onClick={toggleWatch} aria-pressed={inWatchlist} title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'} className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-colors ${inWatchlist ? 'border-amber-400/50 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                  <Star className={`w-3 h-3 ${inWatchlist ? 'fill-amber-300' : ''}`} /> {inWatchlist ? 'Watching' : 'Watch'}
                </button>
              )}
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

      {/* Watchlist */}
      {onWatchlistChange && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mt-1">
          <span className="text-[10px] font-mono uppercase text-slate-500 shrink-0 flex items-center gap-1"><Star className="w-3 h-3" /> Watchlist</span>
          {watchlist.length === 0 && <span className="text-[11px] text-slate-500">Press <span className="text-slate-300">Watch</span> next to a stock name to keep it here.</span>}
          {watchlist.map(w => {
            const q = watchQuotes[w.symbol];
            const active = (quote?.symbol || symbol) === w.symbol;
            return (
              <div key={w.symbol} className={`shrink-0 flex items-center rounded-xl border transition-colors ${active ? 'border-[#00f2fe]/50 bg-[#00f2fe]/10' : 'border-slate-800 bg-[#161b22] hover:border-slate-600'}`}>
                <button onClick={() => setSymbol(w.symbol)} className="pl-3 pr-2 py-1.5 text-left cursor-pointer">
                  <div className="text-[11px] font-bold text-white leading-tight">{w.symbol}</div>
                  <div className="text-[10px] font-mono leading-tight">
                    {q ? <><span className="text-slate-300">{fmt(q.price, q.price < 1 ? 3 : 2)}</span> <span className={q.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{q.changePct >= 0 ? '+' : ''}{fmt(q.changePct)}%</span></> : <span className="text-slate-500 truncate max-w-[90px] inline-block align-bottom">{w.name}</span>}
                  </div>
                </button>
                <button onClick={() => onWatchlistChange(watchlist.filter(x => x.symbol !== w.symbol))} aria-label={`Remove ${w.symbol} from watchlist`} className="pr-2 text-slate-600 hover:text-rose-400 cursor-pointer"><XIcon className="w-3 h-3" /></button>
              </div>
            );
          })}
        </div>
      )}

      {status === 'loading' && <div className={`${card} text-center text-xs text-slate-400 py-10`}><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading prices and history…</div>}
      {status === 'error' && <div className={`${card} text-center text-xs text-amber-400 py-10`}>No live quote for {symbol} right now. Check the code or try again shortly.</div>}
      {status === 'nodata' && <div className={`${card} text-center text-xs text-amber-400 py-10`}>Not enough price history for {quote?.symbol} to calculate indicators (need at least 35 trading days).</div>}

      {status === 'ok' && analysis && (
        <>
          {/* Key statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className={card}>
              <div className={label}>Last session · {lastRow.date}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1.5">
                {[['Open', lastRow.open, 'text-white'], ['Close', lastRow.close, lastRow.close >= lastRow.open ? 'text-emerald-400' : 'text-rose-400'], ['High', lastRow.high, 'text-white'], ['Low', lastRow.low, 'text-white']].map(([k, v, c]) => (
                  <div key={k}>
                    <div className="text-[9px] font-mono uppercase text-slate-500 leading-none">{k}</div>
                    <div className={`text-xs font-mono font-bold ${c}`}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Day range {((lastRow.high - lastRow.low) / lastRow.low * 100).toFixed(1)}%</div>
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
              <div className={label}>Textbook technical score</div>
              <div className={`text-lg font-black mt-1 ${analysis.review.total > 1 ? 'text-emerald-400' : analysis.review.total < -1 ? 'text-rose-400' : 'text-slate-200'}`}>{analysis.review.verdict}</div>
              <div className="text-[10px] text-slate-500">Classic reading of 5 indicators, {analysis.review.total > 0 ? '+' : ''}{analysis.review.total} / 10 (not used in the outlook)</div>
            </div>
          </div>

          {/* Trade plan: separate short-term (about 2 weeks) and long-term (about 6 months) outlooks */}
          {outlook && plan && (() => {
            const toneOf = (s) => ({
              Buy: { box: 'border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300', dot: '#16c784' },
              Accumulate: { box: 'border-teal-400/40 bg-teal-400/[0.07] text-teal-200', dot: '#2dd4bf' },
              Hold: { box: 'border-slate-500/50 bg-slate-400/[0.06] text-slate-100', dot: '#94a3b8' },
              Reduce: { box: 'border-orange-400/40 bg-orange-400/[0.07] text-orange-200', dot: '#fb923c' },
              Sell: { box: 'border-rose-500/40 bg-rose-500/[0.07] text-rose-300', dot: '#ea3943' }
            }[s]);
            const p2 = (v) => `${cur}${fmt(v, v < 1 ? 3 : 2)}`;
            const pp = (x) => `${(x * 100).toFixed(0)}%`;
            const advice = {
              short: { Buy: 'Odds favour a rise over the next two weeks. A trade can be opened now with the stop below.', Accumulate: 'Slightly better odds than usual for a rise. Start small or wait for a dip.', Hold: 'No clear short-term edge. Better to wait.', Reduce: 'Odds lean towards a dip in the next two weeks. Holders could trim.', Sell: 'Odds favour a fall over the next two weeks. Avoid buying now.' },
              long: { Buy: 'Odds favour a higher price in six months. Suits building a position over time.', Accumulate: 'Somewhat better odds than usual over six months. Add gradually.', Hold: 'No clear long-term edge. Keep what you have, add only on weakness.', Reduce: 'Odds lean towards a lower price in six months. Consider trimming.', Sell: 'Odds favour a lower price in six months. Not an investment to add to now.' }
            };
            const Horizon = ({ h }) => {
              const o = outlook[h], tone = toneOf(o.signal);
              const active = horizon === h;
              return (
                <div className={`p-4 rounded-2xl bg-[#0d1117] border transition-colors ${active ? 'border-[#00f2fe]/40' : 'border-slate-800'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={label}>{o.label}</div>
                      <div className={`inline-flex items-center gap-2.5 mt-2 px-3.5 py-1.5 rounded-lg border ${tone.box}`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tone.dot, boxShadow: `0 0 8px ${tone.dot}` }} />
                        <span className="text-base font-bold uppercase tracking-[0.18em]">{o.signal}</span>
                      </div>
                    </div>
                    <button onClick={() => setHorizon(h)} className={`text-[10px] font-mono px-2 py-1 rounded border cursor-pointer ${active ? 'border-[#00f2fe]/50 text-[#00f2fe]' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>{active ? 'Shown on chart' : 'Show on chart'}</button>
                  </div>
                  <div className="flex gap-1 mt-3">
                    {SIGNAL_SCALE.map(st => (
                      <div key={st} className="flex-1">
                        <div className="h-1 rounded-full" style={{ backgroundColor: st === o.signal ? tone.dot : '#21262d' }} />
                        <div className={`text-[8px] font-mono uppercase mt-1 text-center ${st === o.signal ? 'text-slate-200' : 'text-slate-600'}`}>{st}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">{advice[h][o.signal]}</p>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="p-2.5 rounded-xl bg-[#161b22] border border-slate-800">
                      <div className="text-[9px] font-mono uppercase text-slate-500">Chance higher</div>
                      <div className={`text-lg font-black ${o.probUp > o.baseUp + 0.02 ? 'text-emerald-400' : o.probUp < o.baseUp - 0.02 ? 'text-rose-400' : 'text-slate-200'}`}>{pp(o.probUp)}</div>
                      <div className="text-[9px] text-slate-500">usually {pp(o.baseUp)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#161b22] border border-slate-800">
                      <div className="text-[9px] font-mono uppercase text-slate-500">Expected move</div>
                      <div className={`text-lg font-black ${o.expRet > o.baseMean ? 'text-emerald-400' : 'text-rose-400'}`}>{pctTxt(o.expRet)}</div>
                      <div className="text-[9px] text-slate-500">usually {pctTxt(o.baseMean)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#161b22] border border-slate-800">
                      <div className="text-[9px] font-mono uppercase text-slate-500">Likely range</div>
                      <div className="text-[11px] font-mono font-bold text-white mt-1">{fmt(o.range[0])} – {fmt(o.range[1])}</div>
                      <div className="text-[9px] text-slate-500">2 in 3 chance</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">Why</div>
                    <ul className="space-y-1.5">
                      {o.drivers.slice(0, 7).map((d, k) => (
                        <li key={k} className="flex gap-2 text-[11px] leading-snug text-slate-300">
                          <span className={`shrink-0 mt-0.5 text-[10px] ${d.dir > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.dir > 0 ? '▲' : '▼'}</span><span>{d.text}</span>
                        </li>
                      ))}
                      {o.drivers.length === 0 && <li className="text-[11px] text-slate-500">Nothing stretched or unusual right now, so the outlook is close to normal for this stock.</li>}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-emerald-400/80 mb-1">What would push it up</div>
                      <ul className="space-y-1">{o.triggers.up.map((t, k) => <li key={k} className="text-[10px] text-slate-400 leading-snug">· {t}</li>)}</ul>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-rose-400/80 mb-1">What would push it down</div>
                      <ul className="space-y-1">{o.triggers.down.map((t, k) => <li key={k} className="text-[10px] text-slate-400 leading-snug">· {t}</li>)}</ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                    {(o.signal === 'Reduce' || o.signal === 'Sell') && <div className="text-[10px] text-amber-400">Not a buy signal: levels shown for reference.</div>}
                    <div className="flex justify-between items-baseline"><span className="text-slate-400">Entry</span><span className="font-mono font-bold text-emerald-300">{p2(o.entry)}</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-slate-400">Take-profit</span><span className="font-mono font-bold text-[#00f2fe]">{p2(o.target)} <span className="text-[10px] text-slate-500">{pctTxt(o.target / o.entry - 1)}</span></span></div>
                    <div className="flex justify-between items-baseline"><span className="text-slate-400">Stop-loss</span><span className="font-mono font-bold text-rose-400">{p2(o.stop)} <span className="text-[10px] text-slate-500">{pctTxt(o.stop / o.entry - 1)}</span></span></div>
                    <div className="flex justify-between items-baseline"><span className="text-slate-400">Reward : risk</span><span className="font-mono text-white">{o.rr.toFixed(1)} : 1</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-slate-400">Chance target is hit before stop</span><span className="font-mono text-white">≈{Math.round(o.probTarget * 20) * 5}%</span></div>
                  </div>
                </div>
              );
            };
            const sel = outlook[horizon];
            return (
              <div className={card}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><Crosshair className="w-4 h-4 text-[#00f2fe]" /> Trade plan · short-term and long-term</h4>
                  <span className="text-[10px] text-slate-500">Based on what each signal was actually followed by in {STUDY3.universe}, {STUDY3.period}</span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Horizon h="short" />
                  <Horizon h="long" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {/* Position size: risk a fixed share of the portfolio between entry and stop */}
                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800 text-[11px]">
                    <div className={label}>Position size · {horizon === 'short' ? 'short-term' : 'long-term'} plan</div>
                    <div className="flex items-center gap-1.5 text-slate-400 flex-wrap mt-2">
                      Risk
                      <select value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} className="bg-[#161b22] border border-slate-700 rounded px-1 py-0.5 text-white text-[11px]">
                        {[0.5, 1, 2].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                      of
                      <input type="number" min="0" value={sizeBase} onChange={e => setSizeBase(e.target.value)} placeholder={portfolioValue ? Math.round(portfolioValue).toString() : 'portfolio HK$'} className="w-24 bg-[#161b22] border border-slate-700 rounded px-1.5 py-0.5 text-white text-[11px] font-mono" />
                    </div>
                    {sizingBase > 0 && sel.entry > sel.stop ? (() => {
                      const fx = quote.currency === 'USD' ? 7.8 : 1;
                      const shares = Math.floor((sizingBase * riskPct / 100) / ((sel.entry - sel.stop) * fx));
                      return <div className="mt-1 text-slate-300">→ up to <span className="font-mono font-bold text-white">{shares.toLocaleString()}</span> shares (≈HK${Math.round(shares * sel.entry * fx).toLocaleString()}, {((shares * sel.entry * fx) / sizingBase * 100).toFixed(0)}% of the portfolio); a stop-out loses ≈HK${Math.round(sizingBase * riskPct / 100).toLocaleString()}.</div>;
                    })() : <div className="mt-1 text-slate-500">Enter your portfolio size to get a position size.</div>}
                    {onTrade && (
                      <button onClick={() => onTrade(quote.symbol)} className="mt-3 w-full py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] cursor-pointer hover:bg-[#00f2fe]/20">Practise this plan in the simulator</button>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                    <div className={label}>Valuation prices (long-term holders)</div>
                    <div className="mt-2 space-y-2 text-xs">
                      {valuation.fair ? (
                        <>
                          <div className="flex justify-between items-baseline"><span className="text-slate-400">Buy below (under low case)</span><span className="font-mono font-bold text-emerald-300">{p2(plan.buyBelow)}</span></div>
                          <div className="flex justify-between items-baseline"><span className="text-slate-400">Fair value range</span><span className="font-mono text-white">{fairRange ? `${p2(fairRange.low)} – ${p2(fairRange.high)}` : p2(valuation.fair)}</span></div>
                          <div className="flex justify-between items-baseline"><span className="text-slate-400">Sell above (over high case)</span><span className="font-mono font-bold text-rose-300">{p2(plan.sellAbove)}</span></div>
                        </>
                      ) : <p className="text-[11px] text-slate-500">Enter EPS in the valuation calculator below to add valuation-based buy and sell prices. Valuation then counts in the long-term outlook.</p>}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  How it works: each indicator and pattern was tested on {STUDY3.universe}. For every state we measured how often the price was higher 10 and 120 trading days later, compared with that stock's normal rate. The chance shown starts from this stock's own normal rate and adds what today's signals were worth in the test, cut by a quarter to stay conservative.
                  Stops sit below the recent swing low and at least 1.5 daily ranges away (short-term) or about one six-month volatility away (long-term). Educational estimate, not investment advice.
                </p>
              </div>
            );
          })()}

          {/* How much to trust the outlook: out-of-sample results of the study */}
          {outlook && plan && (() => {
            const pc = plan.percentiles;
            const Test = ({ m, name }) => (
              <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                <div className={label}>{name} · next {m.horizon} trading days</div>
                <table className="w-full mt-2 text-[11px] font-mono">
                  <thead><tr className="text-slate-500"><th className="text-left font-normal">Test period</th><th className="text-right font-normal">Most bullish 20%</th><th className="text-right font-normal">Most bearish 20%</th><th className="text-right font-normal">IC</th></tr></thead>
                  <tbody>
                    {['HK', 'US'].map(k => (
                      <tr key={k}>
                        <td className="text-slate-400 py-0.5 font-sans">{k === 'HK' ? 'Hong Kong' : 'United States'}</td>
                        <td className="text-right text-emerald-400">+{m.top[k][0].toFixed(1)}% · +{m.top[k][1].toFixed(0)} pts</td>
                        <td className="text-right text-rose-400">{m.bottom[k][0].toFixed(1)}% · {m.bottom[k][1].toFixed(0)} pts</td>
                        <td className="text-right text-slate-300">{(k === 'HK' ? m.icTestHK : m.icTestUS).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Return vs the stock's normal, and change in how often it was higher. Jul 2023 – Nov 2026, not used for tuning. Worked on {m.posTestHK} HK and {m.posTestUS} US stocks; tuning-period IC {m.icTrainHK.toFixed(2)} (HK) / {m.icTrainUS.toFixed(2)} (US).</p>
              </div>
            );
            return (
              <div className={card}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-[#00f2fe]" /> How reliable is this outlook?</h4>
                  <span className="text-[10px] text-slate-500">{STUDY3.universe} · {STUDY3.period}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Test m={STUDY3.short} name="Short-term model" />
                  <Test m={STUDY3.long} name="Long-term model" />
                  <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                    <div className={label}>Relative strength vs HK blue chips</div>
                    {pc ? (
                      <div className="mt-2 space-y-1.5">
                        {[['Near 52-week high', pc.hi52], ['12-month momentum', pc.mom12_1], ['Above 200-day average', pc.trend200], ['Low volatility', pc.lowvol]].map(([k, v]) => (
                          <div key={k}>
                            <div className="flex justify-between text-[10px] font-mono"><span className="text-slate-500">{k}</span><span className="text-slate-300">top {Math.max(1, Math.round((1 - v) * 100))}%</span></div>
                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v * 100}%`, backgroundColor: v >= 0.6 ? GREEN : v <= 0.4 ? RED : '#94a3b8' }} /></div>
                          </div>
                        ))}
                        <p className="text-[10px] text-slate-500 leading-relaxed pt-1">For choosing between stocks, strength against peers helped. Over time on the same stock, stretched prices tended to reverse, which is what the outlook above uses.</p>
                      </div>
                    ) : <p className="text-[11px] text-slate-500 mt-2">Needs a year of price history.</p>}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">Limits: the test uses today's large companies, so firms that fell and never recovered are missing, which flatters "buy the dip". That is why every effect is cut by a quarter. In a sharp bear market, stretched prices can stay stretched for longer.</p>
              </div>
            );
          })()}

          {/* Company news and its sentiment (feeds the trade plan) */}
          <div className={card}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2"><Newspaper className="w-4 h-4 text-[#00f2fe]" /> Company news &amp; sentiment</h4>
              <span className="text-[10px] text-slate-500">{news.query ? `Headlines for "${news.query}" · ` : ''}scored with a finance word list, recent news weighted more (3-day half-life)</span>
            </div>
            {news.status === 'loading' && <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking for recent news…</div>}
            {news.status === 'none' && <div className="text-xs text-slate-500">No recent company news found, so news is left out of the trade plan.</div>}
            {news.status === 'ok' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800">
                  <div className={label}>News sentiment</div>
                  <div className={`text-lg font-black mt-1 ${newsSummary.score > 0.15 ? 'text-emerald-400' : newsSummary.score < -0.15 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {newsSummary.score > 0.15 ? 'Positive' : newsSummary.score < -0.15 ? 'Negative' : 'Neutral'}
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 relative overflow-hidden mt-2">
                    <div className="absolute top-0 h-full" style={{ left: newsSummary.score >= 0 ? '50%' : `${50 + newsSummary.score * 50}%`, width: `${Math.abs(newsSummary.score) * 50}%`, backgroundColor: newsSummary.score >= 0 ? GREEN : RED }} />
                    <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-2">{newsSummary.count} headlines · <span className="text-emerald-400">{newsSummary.positive} positive</span> · <span className="text-rose-400">{newsSummary.negative} negative</span></div>
                  {newsSummary.count < 2 && <div className="text-[10px] text-slate-500 mt-1">Too few headlines to count in the plan.</div>}
                </div>
                <ul className="lg:col-span-3 divide-y divide-slate-800/70">
                  {newsSummary.scored.slice(0, 6).map((n, i) => (
                    <li key={n.id || i} className="py-2 flex items-start gap-3">
                      <span className={`shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${n.sentiment.label === 'Positive' ? 'border-emerald-500/30 text-emerald-300' : n.sentiment.label === 'Negative' ? 'border-rose-500/30 text-rose-300' : 'border-slate-600 text-slate-400'}`}>{n.sentiment.label}</span>
                      <div className="min-w-0 flex-1">
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-200 hover:text-white hover:underline leading-snug inline-flex gap-1">{n.title}<ExternalLink className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" /></a>
                        <div className="text-[10px] text-slate-500 font-mono">{n.source}{n.publishedAt ? ` · ${ago(n.publishedAt)}` : ''}{n.sentiment.severe.length ? <span className="text-rose-400"> · flagged: {n.sentiment.severe.join(', ')}</span> : ''}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Indicators and patterns: current reading and what that reading was actually followed by */}
          {outlook && (() => {
            const tableRows = indicatorTable(outlook);
            const Cell = ({ v }) => {
              if (!v) return <span className="text-slate-600">Normal range</span>;
              if (!v.dir) return <span className="text-slate-500" title={evText(v)}>No reliable edge</span>;
              return <span className={v.dir > 0 ? 'text-emerald-300' : 'text-rose-300'} title={`${v.agree} of 4 market/period tests agreed`}>{v.dir > 0 ? '▲' : '▼'} {evText(v).replace(' vs normal,', ' ·').replace(' often up', '')}</span>;
            };
            const taughtTxt = (d) => (d > 0 ? 'Bullish' : d < 0 ? 'Bearish' : 'Neutral');
            const verdictTag = (key) => {
              const s = verdict(key, 'short'), l = verdict(key, 'long'), taught = PATTERNS[key][1];
              const dirs = [s && s.dir, l && l.dir].filter(Boolean);
              if (!dirs.length) return ['No reliable edge', 'border-slate-700 text-slate-500'];
              if (!taught) return ['Has an edge', 'border-teal-400/40 text-teal-200'];
              if (dirs.every(d => d === taught)) return ['Works as taught', 'border-teal-400/40 text-teal-200'];
              if (dirs.every(d => d === -taught)) return ['Works in reverse', 'border-amber-400/40 text-amber-200'];
              return ['Mixed', 'border-slate-500/50 text-slate-300'];
            };
            return (
              <div className={card}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-[#00f2fe]" /> Indicators &amp; patterns</h4>
                  <span className="text-[10px] text-slate-500">What today's reading was followed by in the real market: return vs normal · change in how often the price was higher</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] min-w-[820px]">
                    <thead className="text-[10px] font-mono uppercase text-slate-500 border-b border-slate-800">
                      <tr><th className="text-left py-2 pr-3">Indicator</th><th className="text-left py-2 pr-3">Type</th><th className="text-left py-2 pr-3">Now</th><th className="text-left py-2 pr-3">Reading</th><th className="text-left py-2 pr-3">Next 2 weeks</th><th className="text-left py-2">Next 6 months</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {tableRows.map(r => (
                        <tr key={r.name}>
                          <td className="py-2 pr-3 font-bold text-white whitespace-nowrap">{r.name}</td>
                          <td className="py-2 pr-3 text-slate-500 text-[10px] font-mono uppercase">{r.group}</td>
                          <td className="py-2 pr-3 font-mono text-slate-300 whitespace-nowrap">{r.now || '—'}</td>
                          <td className="py-2 pr-3 text-slate-200">{r.reading}</td>
                          <td className="py-2 pr-3 font-mono text-[10px]"><Cell v={r.short} /></td>
                          <td className="py-2 font-mono text-[10px]"><Cell v={r.long} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5">
                  <div className={label}>Patterns found in the last 5 sessions</div>
                  {outlook.patterns.length === 0 ? <p className="text-[11px] text-slate-500 mt-1.5">None of the {Object.keys(PATTERNS).length} tested candlestick, chart, harmonic or divergence patterns appeared.</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2">
                      {outlook.patterns.map(pt => {
                        const [name, taught, kind, idea] = PATTERNS[pt.key];
                        const tag = verdictTag(pt.key);
                        return (
                          <div key={pt.key} className="px-3 py-2.5 rounded-xl bg-[#0d1117] border border-slate-800">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white">{name}</span>
                              <span className="text-[10px] font-mono text-slate-500">{pt.ago === 0 ? 'today' : `${pt.ago}d ago`}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">{idea} Textbook: {taughtTxt(taught).toLowerCase()} ({kind}).</p>
                            <div className="mt-1.5 text-[10px] font-mono space-y-0.5">
                              <div className="flex justify-between gap-2"><span className="text-slate-500">2 weeks</span><Cell v={verdict(pt.key, 'short')} /></div>
                              <div className="flex justify-between gap-2"><span className="text-slate-500">6 months</span><Cell v={verdict(pt.key, 'long')} /></div>
                            </div>
                            <span className={`inline-block mt-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded border ${tag[1]}`}>{tag[0]}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <details className="mt-4 group">
                  <summary className="cursor-pointer text-[11px] text-[#00f2fe] select-none">Pattern library: all {Object.keys(PATTERNS).length} tested patterns and what they really did</summary>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-[11px] min-w-[760px]">
                      <thead className="text-[10px] font-mono uppercase text-slate-500 border-b border-slate-800">
                        <tr><th className="text-left py-2 pr-3">Pattern</th><th className="text-left py-2 pr-3">Kind</th><th className="text-left py-2 pr-3">Textbook</th><th className="text-left py-2 pr-3">Next 2 weeks</th><th className="text-left py-2 pr-3">Next 6 months</th><th className="text-left py-2">Verdict</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {Object.entries(PATTERNS).map(([key, [name, taught, kind]]) => {
                          const tag = verdictTag(key);
                          return (
                            <tr key={key}>
                              <td className="py-1.5 pr-3 text-white">{name}</td>
                              <td className="py-1.5 pr-3 text-slate-500 text-[10px] font-mono uppercase">{kind}</td>
                              <td className={`py-1.5 pr-3 ${taught > 0 ? 'text-emerald-300/80' : taught < 0 ? 'text-rose-300/80' : 'text-slate-400'}`}>{taughtTxt(taught)}</td>
                              <td className="py-1.5 pr-3 font-mono text-[10px]"><Cell v={verdict(key, 'short')} /></td>
                              <td className="py-1.5 pr-3 font-mono text-[10px]"><Cell v={verdict(key, 'long')} /></td>
                              <td className="py-1.5"><span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tag[1]}`}>{tag[0]}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Patterns are detected by fixed rules (for example a double bottom needs two lows within 3%, at least 10 days apart, and a close above the peak between them). Rare patterns such as rounded tops and the Shark harmonic have too few cases to judge; the Shark is not tested.</p>
                </details>

                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  What the test found: in both Hong Kong and the US, and in both periods, prices that had moved too far tended to come back. Being far below the 50-day average, oversold on RSI or CCI, in a strong downtrend or 30% below the 52-week high was followed by better-than-normal returns; being overbought, far above the averages or near the 52-week high was followed by weaker ones. Trend-following signals (crosses, cloud, Supertrend, SAR) mostly had little or reverse edge. Most candlesticks had no reliable edge; breakouts tended to fade and breakdowns tended to recover.
                </p>
              </div>
            );
          })()}

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
                {[['fib', 'Fibonacci', 'bg-violet-500/20 text-violet-200 border-violet-400/50'], ['supertrend', 'Supertrend', 'bg-sky-500/20 text-sky-200 border-sky-400/50'], ['cloud', 'Ichimoku', 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50']].map(([k, l, on]) => (
                  <button key={k} onClick={() => setOverlay(o => ({ ...o, [k]: !o[k] }))} className={`px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${overlay[k] ? on : 'text-slate-400 border-slate-700'}`}>{l}</button>
                ))}
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
                  {overlay.cloud && <Area type="monotone" dataKey="cloud" name="Ichimoku cloud" stroke="none" fill="#d946ef" fillOpacity={0.1} isAnimationActive={false} />}
                  {overlay.supertrend && <Line type="stepAfter" dataKey="stUp" name="Supertrend (up)" stroke={GREEN} dot={false} strokeWidth={1.3} isAnimationActive={false} />}
                  {overlay.supertrend && <Line type="stepAfter" dataKey="stDn" name="Supertrend (down)" stroke={RED} dot={false} strokeWidth={1.3} isAnimationActive={false} />}
                  {overlay.fib && analysis.fib && analysis.fib.levels.map(l => (
                    <ReferenceLine key={l.ratio} y={l.price} stroke="#a78bfa" strokeOpacity={0.6} strokeDasharray="2 3" label={{ value: `${(l.ratio * 100).toFixed(1)}%`, position: 'insideRight', fill: '#a78bfa', fontSize: 9 }} />
                  ))}
                  {price && <ReferenceLine y={price} stroke="#00f2fe" strokeOpacity={0.4} strokeDasharray="2 4" />}
                  {showPlan && outlook && <ReferenceLine y={outlook[horizon].target} stroke="#00f2fe" strokeDasharray="6 3" label={{ value: `${horizon === 'short' ? '2-wk' : '6-mo'} target ${fmt(outlook[horizon].target)}`, position: 'insideTopLeft', fill: '#00f2fe', fontSize: 10 }} />}
                  {showPlan && outlook && <ReferenceLine y={outlook[horizon].stop} stroke={RED} strokeDasharray="6 3" label={{ value: `${horizon === 'short' ? '2-wk' : '6-mo'} stop ${fmt(outlook[horizon].stop)}`, position: 'insideBottomLeft', fill: RED, fontSize: 10 }} />}
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
            <span className="text-[10px] text-slate-500">{quote.pe ? `EPS pre-filled from the feed's P/E of ${fmt(quote.pe, 1)}. ` : ''}Pick the sector, then adjust any input.</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="grid grid-cols-2 gap-3 content-start">
              <div className="col-span-2">
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Sector preset</label>
                <select value={val.preset} onChange={e => applyPreset(e.target.value)} className={`${inputCls} [&>option]:bg-[#161b22]`}>
                  {Object.entries(PRESETS).map(([k, pz]) => <option key={k} value={k}>{pz.label} · growth {pz.growthPct}%, return {pz.discountPct}%</option>)}
                </select>
              </div>
              {[
                ['eps', `EPS (${cur} per share)`, '0.01'], ['dps', `Dividend per share (${cur})`, '0.01'],
                ['growthPct', 'EPS growth % / yr (5 yrs)', '0.5'], ['divGrowthPct', 'Dividend growth %', '0.5'],
                ['discountPct', 'Required return %', '0.5'], ['terminalPe', 'Exit P/E (year 5)', '0.5'],
                ['fairPe', val.fairPeAuto ? 'Fair P/E (auto from growth)' : 'Fair P/E today', '0.5']
              ].map(([k, l, step]) => (
                <div key={k}>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">{l}</label>
                  <input type="number" step={step} value={val[k]} onChange={e => setValField(k, e.target.value)} className={inputCls} />
                </div>
              ))}
              {!val.fairPeAuto && <button onClick={() => setVal(v => ({ ...v, fairPe: pegFairPe(Number(v.growthPct) || 0), fairPeAuto: true }))} className="self-end mb-2 text-[10px] text-[#00f2fe] hover:underline cursor-pointer text-left">Reset fair P/E to auto ({pegFairPe(Number(val.growthPct) || 0)})</button>}
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
              {valInputs.eps > 0 && (() => {
                const g = valInputs.growthPct, r = valInputs.discountPct;
                const gs = [g - 4, g, g + 4], rs = [r - 1, r, r + 1];
                return (
                  <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">DCF sensitivity · growth (rows) × required return (columns)</div>
                    <table className="w-full text-[10px] font-mono">
                      <thead><tr><th></th>{rs.map(x => <th key={x} className="text-right font-normal text-slate-500">{x}%</th>)}</tr></thead>
                      <tbody>
                        {gs.map(gr => (
                          <tr key={gr}>
                            <td className="text-slate-500">{gr}%</td>
                            {rs.map(x => { const v = dcfValue(valInputs.eps, gr, x, valInputs.terminalPe); return <td key={x} className={`text-right ${v >= price ? 'text-emerald-400' : 'text-rose-400'} ${gr === g && x === r ? 'font-bold underline' : ''}`}>{v ? fmt(v, v < 10 ? 2 : 0) : '—'}</td>; })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 rounded-2xl bg-[#0d1117] border border-slate-800 flex flex-col justify-center">
              <div className={label}>Fair value (median of models)</div>
              <div className="text-3xl font-black text-white font-mono mt-1">{valuation.fair ? `${cur}${fmt(valuation.fair)}` : '—'}</div>
              {fairRange && <div className="text-[11px] font-mono text-slate-400 mt-0.5">range {cur}{fmt(fairRange.low)} – {fmt(fairRange.high)} <span className="text-slate-600">(growth ±3 pts, return ∓1 pt)</span></div>}
              <div className="text-xs text-slate-400 mt-1">vs price {cur}{fmt(price, price < 1 ? 3 : 2)}</div>
              {implied !== null && (
                <div className="mt-2 text-[11px] text-slate-300">Today's price already assumes <span className={`font-mono font-bold ${implied > (Number(val.growthPct) || 0) ? 'text-rose-300' : 'text-emerald-300'}`}>{implied.toFixed(1)}%</span> EPS growth a year for 5 years (you assume {Number(val.growthPct) || 0}%).</div>
              )}
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
