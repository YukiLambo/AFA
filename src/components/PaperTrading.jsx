import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tradeCost } from '../lib/tradingCosts';
import { formatMoney, niceAmount, useMoney } from '../lib/currency';
import { Search, Loader2, RefreshCw, RotateCcw, TrendingUp, TrendingDown, History, FlaskConical, X, Zap, AlertTriangle } from 'lucide-react';

// Simulated ("paper") trading account. Users practise with virtual cash at live HK/US prices; nothing
// here touches their real holdings. The whole account is one object, saved by the parent via onChange:
//   { startingCash, cash, realizedPnl, holdings: [{ symbol, name, shares, avgCost, currency }],
//     trades: [{ id, time, side, symbol, name, shares, price, currency, fee, value, pnl }], createdAt, currency }
// Cash, fees, values and P&L are in the account's `currency` (older accounts: HKD); share prices stay in
// each stock's own currency and are converted with live FX.

// Costs per order come from lib/tradingCosts.js: HK stamp duty 0.1% each side, exchange fees and levies, settlement,
// broker commission (assumed), US SEC/FINRA fees on sales, and half the bid-ask spread through the fill price.
const STARTING_OPTIONS = [100000, 500000, 1000000];
const MAX_TRADES_KEPT = 300;
const REFRESH_MS = 30000;

// HKEX code ranges: derivative warrants 10000–29999 and 89000–89999, CBBCs 47000–48999 and 50000–69999.
// The name is checked too (call/put, bull/bear in English or Chinese).
export function instrumentKind(symbol = '', name = '') {
  const m = String(symbol).match(/^(\d{4,5})\.HK$/);
  const n = m ? parseInt(m[1], 10) : 0;
  const nm = String(name).toLowerCase();
  if ((n >= 47000 && n <= 48999) || (n >= 50000 && n <= 69999) || /\b(bull|bear)\b|牛|熊/.test(nm)) return 'cbbc';
  if ((n >= 10000 && n <= 29999) || (n >= 89000 && n <= 89999) || /\b(call|put)\b|认购|认沽|購|沽/.test(nm)) return 'warrant';
  return 'stock';
}
const KIND_LABEL = { warrant: 'Warrant', cbbc: 'CBBC' };

export const newPaperAccount = (startingCash = 1000000, currency = 'HKD') => ({
  currency, startingCash, cash: startingCash, realizedPnl: 0, holdings: [], trades: [], createdAt: new Date().toISOString()
});

const px = (n, cur) => formatMoney(n, cur || 'HKD', { dp: Math.abs(Number(n) || 0) < 1 ? 3 : 2 });

export default function PaperTrading({ account, onChange, fetchQuote, searchSymbols, presetSymbol, onAnalyse }) {
  const money = useMoney();
  // Existing accounts keep the currency they started in; new or reset accounts use the home currency
  const acctCur = account ? (account.currency || 'HKD') : money.currency;
  const fx = (cur) => money.convert(1, cur || 'HKD', acctCur);
  const hkd = (n, d = 2) => formatMoney(n, acctCur, { dp: d });
  const signed = (n) => `${n >= 0 ? '+' : '−'}${hkd(Math.abs(n))}`;
  const startOptions = STARTING_OPTIONS.map(v => niceAmount(money.convert(v, 'HKD', money.currency)));
  const fmtStart = (v) => formatMoney(v, money.currency, { dp: 0 });
  const [quotes, setQuotes] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // live quote of the stock being traded
  const [side, setSide] = useState('buy');
  const [shares, setShares] = useState('');
  const [message, setMessage] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetTo, setResetTo] = useState(null);
  const accountRef = useRef(account);
  accountRef.current = account;

  // Live prices for everything held (every 30 s while the page is visible)
  const holdingKey = (account?.holdings || []).map(h => h.symbol).sort().join(',');
  const refresh = async () => {
    const list = accountRef.current?.holdings || [];
    if (list.length === 0) return;
    setRefreshing(true);
    const got = await Promise.all(list.map(h => fetchQuote(h.symbol)));
    const next = {};
    got.forEach((q, i) => { if (q?.price) next[list[i].symbol] = q; });
    setQuotes(prev => ({ ...prev, ...next }));
    setRefreshing(false);
  };
  useEffect(() => {
    if (!holdingKey) return undefined;
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [holdingKey]);

  // Symbol search (same feed as the main search bar)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) { setMatches([]); return undefined; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const found = await searchSymbols(q);
      // Typing a code (e.g. a 5-digit warrant or CBBC) always offers it directly
      if (/^\d{1,5}$/.test(q)) {
        const code = `${String(parseInt(q, 10)).padStart(4, '0')}.HK`;
        if (!found.some(f => f.symbol === code)) found.unshift({ symbol: code, name: instrumentKind(code) === 'stock' ? 'HK code' : `HK ${KIND_LABEL[instrumentKind(code)]}` });
      }
      if (!cancelled) { setMatches(found.slice(0, 6)); setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const pick = async (symbol) => {
    setMatches([]);
    setQuery('');
    setMessage(null);
    setSearching(true);
    const q = await fetchQuote(symbol);
    setSearching(false);
    if (!q?.price) { setMessage({ ok: false, text: `No live price for ${symbol} right now. Try again in a moment.` }); return; }
    setSelected(q);
    setQuotes(prev => ({ ...prev, [q.symbol]: q }));
    setShares('');
  };

  // Opened from Stock Analysis with a symbol ready to trade
  useEffect(() => { if (presetSymbol?.symbol && account) pick(presetSymbol.symbol); }, [presetSymbol]);

  const rows = useMemo(() => (account?.holdings || []).map(h => {
    const q = quotes[h.symbol];
    const price = q?.price || h.lastPrice || h.avgCost;
    const value = h.shares * price * fx(h.currency);
    const cost = h.shares * h.avgCost * fx(h.currency);
    return { ...h, price, dayPct: q?.changePct, value, pnl: value - cost, pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
  }), [account, quotes, money]);

  if (!account) {
    return (
      <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800/80 shadow-md text-center space-y-4">
        <FlaskConical className="w-10 h-10 text-[#00f2fe] mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-white">Practise investing with virtual money</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">Buy and sell any HK or US stock at live prices without risking real money. Your real portfolio is not affected.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {startOptions.map(v => (
            <button key={v} onClick={() => onChange(newPaperAccount(v, money.currency))} className="px-4 py-2.5 rounded-xl border border-[#00f2fe]/40 bg-[#00f2fe]/10 text-[#00f2fe] text-xs font-bold cursor-pointer hover:bg-[#00f2fe]/20">
              Start with {fmtStart(v)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const invested = rows.reduce((s, r) => s + r.value, 0);
  const equity = account.cash + invested;
  const totalReturn = equity - account.startingCash;
  const totalReturnPct = (totalReturn / account.startingCash) * 100;
  const unrealized = rows.reduce((s, r) => s + r.pnl, 0);
  const leveraged = rows.filter(r => instrumentKind(r.symbol, r.name) !== 'stock').reduce((s, r) => s + r.value, 0);

  const held = selected ? account.holdings.find(h => h.symbol === selected.symbol) : null;
  const qty = Math.floor(Number(shares) || 0);
  const costOf = (q, side_, price, symbol, name) => tradeCost({ market: /\.HK$/.test(symbol) ? 'HK' : 'US', side: side_, price, shares: q, stampExempt: instrumentKind(symbol, name) !== 'stock' });
  const preview = selected && qty > 0 ? costOf(qty, side, selected.price, selected.symbol, selected.name) : null;
  // the fill is half a spread worse than the quote: buyers pay the ask, sellers get the bid
  const fillPx = selected ? selected.price + (preview ? (side === 'buy' ? 1 : -1) * preview.halfSpread : 0) : 0;
  const gross = selected ? qty * fillPx * fx(selected.currency) : 0;
  const fee = preview ? preview.fees * fx(selected.currency) : 0;
  const maxBuy = selected ? Math.floor(account.cash / (selected.price * fx(selected.currency) * 1.0015)) : 0;
  const maxSell = held ? held.shares : 0;
  const problem = !selected ? '' : qty <= 0 ? 'Enter how many shares'
    : side === 'buy' && gross + fee > account.cash + 0.005 ? `Not enough virtual cash (max ${maxBuy.toLocaleString()} shares)`
    : side === 'sell' && qty > maxSell ? (maxSell ? `You only hold ${maxSell.toLocaleString()} shares` : `You don't hold ${selected.symbol}`)
    : '';

  const placeOrder = async () => {
    if (!selected || problem || busy) return;
    setBusy(true);
    // Fresh price at the moment of the order
    const live = (await fetchQuote(selected.symbol)) || selected;
    const cost = costOf(qty, side, live.price, live.symbol, live.name);
    const price = live.price + (side === 'buy' ? 1 : -1) * cost.halfSpread; // fill at the ask / bid
    const rate = fx(live.currency);
    const value = qty * price * rate;
    const orderFee = Math.round(cost.fees * rate * 100) / 100;
    const acc = accountRef.current;
    let holdings = acc.holdings.map(h => ({ ...h }));
    let cash = acc.cash;
    let realized = acc.realizedPnl || 0;
    let pnl = null;
    const existing = holdings.find(h => h.symbol === live.symbol);

    if (side === 'buy') {
      if (value + orderFee > cash + 0.005) { setBusy(false); setMessage({ ok: false, text: 'Price moved: not enough virtual cash. Try fewer shares.' }); return; }
      cash -= value + orderFee;
      if (existing) {
        existing.avgCost = (existing.avgCost * existing.shares + price * qty) / (existing.shares + qty);
        existing.shares += qty;
        existing.lastPrice = price;
      } else {
        holdings.push({ symbol: live.symbol, name: live.name, shares: qty, avgCost: price, currency: live.currency, lastPrice: price });
      }
    } else {
      cash += value - orderFee;
      pnl = (price - existing.avgCost) * qty * rate - orderFee;
      realized += pnl;
      existing.shares -= qty;
      existing.lastPrice = price;
      holdings = holdings.filter(h => h.shares > 0);
    }

    const trade = {
      id: `t${Date.now().toString(36)}`, time: new Date().toISOString(), side, symbol: live.symbol, name: live.name,
      shares: qty, price, currency: live.currency, fee: orderFee, value: Math.round(value * 100) / 100, pnl: pnl === null ? null : Math.round(pnl * 100) / 100
    };
    try {
      await onChange({ ...acc, cash: Math.round(cash * 100) / 100, realizedPnl: Math.round(realized * 100) / 100, holdings, trades: [trade, ...(acc.trades || [])].slice(0, MAX_TRADES_KEPT) });
      setQuotes(prev => ({ ...prev, [live.symbol]: live }));
      setSelected(live);
      setShares('');
      setMessage({ ok: true, text: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty.toLocaleString()} ${live.symbol} at ${px(price, live.currency)}${pnl !== null ? ` (${signed(pnl)} realised)` : ''}` });
    } catch (e) {
      setMessage({ ok: false, text: 'Could not save the trade. Check your connection.' });
    } finally {
      setBusy(false);
    }
  };

  const card = 'bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md';

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={card}>
          <span className="text-xs font-mono uppercase text-slate-500">Simulated Equity</span>
          <div className="text-2xl font-black text-white mt-1">{hkd(equity)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Started with {hkd(account.startingCash, 0)}</div>
        </div>
        <div className={card}>
          <span className="text-xs font-mono uppercase text-slate-500">Total Return</span>
          <div className={`text-2xl font-black mt-1 ${totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%</div>
          <div className={`text-[10px] mt-0.5 ${totalReturn >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{signed(totalReturn)}</div>
        </div>
        <div className={card}>
          <span className="text-xs font-mono uppercase text-slate-500">Virtual Cash</span>
          <div className="text-2xl font-black text-slate-200 mt-1">{hkd(account.cash)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{equity > 0 ? ((account.cash / equity) * 100).toFixed(0) : 0}% uninvested</div>
        </div>
        <div className={card}>
          <span className="text-xs font-mono uppercase text-slate-500">Realised / Unrealised</span>
          <div className="text-sm font-black mt-2 space-y-0.5">
            <div className={(account.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{signed(account.realizedPnl || 0)}</div>
            <div className={unrealized >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}>{signed(unrealized)}</div>
          </div>
        </div>
      </div>

      {equity > 0 && leveraged / equity > 0.2 && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{((leveraged / equity) * 100).toFixed(0)}% of your simulated account is in warrants/CBBCs. Real investors usually keep leveraged products to a small slice, because a few bad days can wipe them out.</span>
        </div>
      )}

      {/* Order ticket */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2"><FlaskConical className="w-4 h-4 text-[#00f2fe]" /> Place a Simulated Order</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Live HK and US prices · stamp duty, exchange fees and the bid-ask spread simulated · virtual money only</p>
          </div>
          {confirmReset ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400">Reset to</span>
              <select value={resetTo ?? startOptions[startOptions.length - 1]} onChange={e => setResetTo(Number(e.target.value))} className="glass-input rounded-lg px-2 py-1 text-xs text-white [&>option]:bg-[#161b22]">
                {startOptions.map(v => <option key={v} value={v}>{fmtStart(v)}</option>)}
              </select>
              <button onClick={() => { onChange(newPaperAccount(resetTo ?? startOptions[startOptions.length - 1], money.currency)); setConfirmReset(false); setSelected(null); setMessage({ ok: true, text: 'Simulation reset.' }); }} className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold cursor-pointer">Reset</button>
              <button onClick={() => setConfirmReset(false)} className="px-2 py-1 text-slate-400 cursor-pointer">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="self-start sm:self-auto text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> Reset simulation</button>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a stock, ETF, warrant or CBBC: 700, AAPL, tencent, or a 5-digit warrant code…" className="w-full pl-9 pr-9 py-2.5 glass-input rounded-xl text-sm text-white" aria-label="Search stock to simulate" />
          {searching && <Loader2 className="w-4 h-4 text-slate-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-[#0d1117] border border-slate-700 rounded-xl overflow-hidden shadow-xl">
              {matches.map(m => (
                <button key={m.symbol} onClick={() => pick(m.symbol)} className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex justify-between gap-3 cursor-pointer">
                  <span className="text-sm font-bold text-white flex items-center gap-1.5">{m.symbol}{instrumentKind(m.symbol, m.name) !== 'stock' && <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">{KIND_LABEL[instrumentKind(m.symbol, m.name)]}</span>}</span>
                  <span className="text-xs text-slate-400 truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-black text-white">{selected.symbol}</div>
                <div className="text-xs text-slate-400 truncate">{selected.name}</div>
                {instrumentKind(selected.symbol, selected.name) !== 'stock' && (
                  <div className="mt-2 text-[10px] text-rose-300 flex gap-1.5 leading-relaxed">
                    <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{instrumentKind(selected.symbol, selected.name) === 'cbbc'
                      ? 'CBBC: leveraged, and terminated early if the underlying touches the call level. You can lose most or all of it.'
                      : 'Warrant: leveraged, loses time value every day and can expire worthless.'} Simulated orders trade at the live price; real warrants trade in board lots.</span>
                  </div>
                )}
                {held && <div className="text-[11px] text-[#00f2fe] mt-2">You hold {held.shares.toLocaleString()} @ {px(held.avgCost, held.currency)}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-white font-mono">{px(selected.price, selected.currency)}</div>
                <div className={`text-xs font-mono ${selected.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{selected.changePct >= 0 ? '+' : ''}{Number(selected.changePct || 0).toFixed(2)}% today</div>
                <div className="mt-2 flex justify-end gap-3">
                  {onAnalyse && <button onClick={() => onAnalyse(selected.symbol)} className="text-[10px] text-[#00f2fe] hover:underline cursor-pointer">Analyse</button>}
                  <button onClick={() => setSelected(null)} className="text-[10px] text-slate-500 hover:text-white inline-flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" /> Close</button>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-3">
              <div className="flex p-1 rounded-xl bg-white/[0.04] border border-slate-800">
                {['buy', 'sell'].map(s => (
                  <button key={s} onClick={() => setSide(s)} className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer ${side === s ? (s === 'buy' ? 'bg-emerald-500 text-[#0d1117]' : 'bg-rose-500 text-white') : 'text-slate-400'}`}>{s}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="number" min="1" step="1" value={shares} onChange={e => setShares(e.target.value)} onKeyDown={e => e.key === 'Enter' && placeOrder()} placeholder="Shares" className="flex-1 min-w-0 px-3 py-2 glass-input rounded-lg text-sm text-white font-mono" aria-label="Shares" />
                <button onClick={() => setShares(String(side === 'buy' ? maxBuy : maxSell))} className="px-3 rounded-lg text-[11px] font-bold text-slate-300 bg-white/[0.06] cursor-pointer">Max</button>
              </div>
              <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                <div className="flex justify-between"><span>Order value</span><span>{hkd(gross)}</span></div>
                {preview && preview.lines.map(([name, v]) => <div key={name} className="flex justify-between text-slate-500"><span>{name}</span><span>{hkd(v * fx(selected.currency))}</span></div>)}
                <div className="flex justify-between"><span>Fees</span><span>{hkd(fee)}</span></div>
                {preview && <div className="flex justify-between text-slate-500"><span>Spread (fill {px(fillPx, selected.currency)}, half a price step {side === 'buy' ? 'above' : 'below'} the quote)</span><span>{hkd(preview.spreadCost * fx(selected.currency))}</span></div>}
                <div className="flex justify-between text-slate-200"><span>{side === 'buy' ? 'Total cost' : 'You receive'}</span><span>{hkd(side === 'buy' ? gross + fee : gross - fee)}</span></div>
              </div>
              {problem && qty > 0 && <div className="text-[11px] text-amber-400">{problem}</div>}
              <button onClick={placeOrder} disabled={!!problem || busy} className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${side === 'buy' ? 'bg-emerald-500 text-[#0d1117]' : 'bg-rose-500 text-white'}`}>
                {busy ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${qty > 0 ? qty.toLocaleString() : ''} ${selected.symbol}`}
              </button>
            </div>
          </div>
        )}
        {message && <div className={`mt-3 text-xs ${message.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{message.text}</div>}
      </div>

      {/* Holdings */}
      <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
        <div className="px-5 py-3 bg-[#0d1117] border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-mono uppercase text-[#00f2fe]">Simulated Holdings</span>
          <button onClick={refresh} className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh prices</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-300 min-w-[640px]">
            <thead className="text-[10px] font-mono uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th className="text-left py-3 px-5">Stock</th>
                <th className="text-right py-3 px-5">Shares</th>
                <th className="text-right py-3 px-5">Avg cost</th>
                <th className="text-right py-3 px-5">Live price</th>
                <th className="text-right py-3 px-5">Value ({acctCur})</th>
                <th className="text-right py-3 px-5">P&amp;L</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-xs text-slate-500">No simulated positions yet. Search a stock above and place your first order.</td></tr>}
              {rows.map(r => (
                <tr key={r.symbol} className="hover:bg-slate-800/20">
                  <td className="py-3 px-5"><div className="font-bold text-white flex items-center gap-1.5">{r.symbol}{instrumentKind(r.symbol, r.name) !== 'stock' && <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">{KIND_LABEL[instrumentKind(r.symbol, r.name)]}</span>}</div><div className="text-[11px] text-slate-500 truncate max-w-[180px]">{r.name}</div></td>
                  <td className="py-3 px-5 text-right font-mono">{r.shares.toLocaleString()}</td>
                  <td className="py-3 px-5 text-right font-mono text-slate-400">{px(r.avgCost, r.currency)}</td>
                  <td className="py-3 px-5 text-right font-mono text-white">{px(r.price, r.currency)}{r.dayPct !== undefined && <span className={`block text-[10px] ${r.dayPct >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{r.dayPct >= 0 ? '+' : ''}{Number(r.dayPct).toFixed(2)}% today</span>}</td>
                  <td className="py-3 px-5 text-right font-mono">{hkd(r.value)}</td>
                  <td className={`py-3 px-5 text-right font-mono font-bold ${r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{signed(r.pnl)}<span className="block text-[10px] font-normal">{r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%</span></td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => { pick(r.symbol); setSide('sell'); }} className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white cursor-pointer">Trade</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade history */}
      <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
        <div className="px-5 py-3 bg-[#0d1117] border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-mono uppercase text-[#00f2fe] flex items-center gap-2"><History className="w-3.5 h-3.5" /> Simulated Trade History</span>
          <span className="text-[10px] font-mono text-slate-500">{(account.trades || []).length} trades</span>
        </div>
        <ul className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
          {(account.trades || []).length === 0 && <li className="px-5 py-5 text-xs text-slate-500">Your simulated trades will appear here.</li>}
          {(account.trades || []).map(t => (
            <li key={t.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
              <span className={`w-12 text-center py-0.5 rounded font-black uppercase text-[10px] ${t.side === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>{t.side}</span>
              <span className="font-bold text-white w-20">{t.symbol}</span>
              <span className="font-mono text-slate-400 flex-1">{t.shares.toLocaleString()} @ {px(t.price, t.currency)}</span>
              {t.pnl !== null && t.pnl !== undefined && <span className={`font-mono ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t.pnl >= 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />} {signed(t.pnl)}</span>}
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">{new Date(t.time).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
