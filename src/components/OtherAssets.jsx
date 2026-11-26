import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Landmark, Bitcoin, PiggyBank, Gem, Building2, ShieldCheck, Briefcase, LineChart, Package, X, Loader2, Zap, AlertTriangle } from 'lucide-react';

// Assets other than listed stocks: bonds, crypto, deposits, gold, property, insurance, MPF, funds...
// Each one is a document in users/{uid}/assets:
//   { type, name, coin?, quantity?, value, cost?, currency, rate?, maturity?, note?, lastPriceHkd? }
// `value` is today's value in `currency` (for crypto it is quantity × live price instead).

export const ASSET_TYPES = [
  { id: 'bond', label: 'Bond', icon: Landmark, color: '#a78bfa', hint: 'Government, iBond, Silver Bond, corporate' },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin, color: '#f7931a', hint: 'Bitcoin, Ethereum and others (live price)' },
  { id: 'warrant', label: 'Warrants & CBBCs', icon: Zap, color: '#f43f5e', hint: 'HK derivative warrants and callable bull/bear contracts (live price by code). Leveraged: can expire worthless or be called early' },
  { id: 'cash', label: 'Cash & Deposits', icon: PiggyBank, color: '#34d399', hint: 'Savings, time deposits, money market' },
  { id: 'fund', label: 'Fund', icon: LineChart, color: '#38bdf8', hint: 'Unit trusts or funds not on the stock feed' },
  { id: 'gold', label: 'Gold & Metals', icon: Gem, color: '#facc15', hint: 'Gold, silver, precious metals' },
  { id: 'property', label: 'Property', icon: Building2, color: '#fb7185', hint: 'Home or investment property (record a mortgage in Debt Health)' },
  { id: 'insurance', label: 'Insurance Savings', icon: ShieldCheck, color: '#818cf8', hint: 'Savings plans, annuities: cash value' },
  { id: 'mpf', label: 'MPF Balance', icon: Briefcase, color: '#2dd4bf', hint: 'Your MPF account balance' },
  { id: 'other', label: 'Other', icon: Package, color: '#94a3b8', hint: 'Anything else you own' }
];
export const assetType = (id) => ASSET_TYPES.find(t => t.id === id) || ASSET_TYPES[ASSET_TYPES.length - 1];

// CoinGecko ids (free API, CORS enabled)
export const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'tether', symbol: 'USDT', name: 'Tether (USDT)' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' }
];

export const WARRANT_KINDS = [
  { id: 'call', label: 'Call warrant', cbbc: false, up: true },
  { id: 'put', label: 'Put warrant', cbbc: false, up: false },
  { id: 'bull', label: 'Bull CBBC', cbbc: true, up: true },
  { id: 'bear', label: 'Bear CBBC', cbbc: true, up: false }
];
export const warrantKind = (id) => WARRANT_KINDS.find(k => k.id === id) || WARRANT_KINDS[0];

// "12345", "12345.hk" -> "12345.HK"; "700" -> "0700.HK"
export const hkCode = (raw) => {
  const m = String(raw || '').trim().toUpperCase().match(/^(\d{1,5})(\.HK)?$/);
  return m ? `${String(parseInt(m[1], 10)).padStart(4, '0')}.HK` : String(raw || '').trim().toUpperCase();
};

// Risk numbers for one warrant / CBBC, from the live warrant price W and underlying price S
//   intrinsic per unit: call/bull max(0, S − K) / ratio, put/bear max(0, K − S) / ratio
//   effective gearing ≈ S / (W × ratio): how many times the underlying's % move the holder feels
//   CBBC distance to call level: |S − call| / S (mandatory call when the underlying touches it)
export function warrantMetrics(a, quotes = {}, now = new Date()) {
  const kind = warrantKind(a.kind);
  const W = quotes[hkCode(a.code)]?.price || Number(a.unitPrice) || 0;
  const S = quotes[hkCode(a.underlying)]?.price || 0;
  const K = Number(a.strike) || 0;
  const ratio = Number(a.ratio) || 1;
  const call = Number(a.callLevel) || 0;
  const days = a.expiry ? Math.ceil((new Date(a.expiry) - now) / 86400000) : null;
  const intrinsic = S > 0 && K > 0 ? Math.max(0, kind.up ? S - K : K - S) / ratio : null;
  const gearing = S > 0 && W > 0 ? S / (W * ratio) : null;
  const callDistancePct = kind.cbbc && S > 0 && call > 0 ? ((kind.up ? S - call : call - S) / S) * 100 : null;
  return { kind, W, S, K, ratio, call, days, intrinsic, gearing, callDistancePct, liveW: !!quotes[hkCode(a.code)]?.price };
}

// Today's value of one asset in HKD
export function assetValueHkd(a, cryptoPrices = {}, usdHkd = 7.8, quotes = {}) {
  if (a.type === 'warrant') {
    const live = quotes[hkCode(a.code)]?.price;
    if (live > 0) return (Number(a.quantity) || 0) * live;
  }
  if (a.type === 'crypto') {
    const live = cryptoPrices[a.coin]?.hkd;
    const price = live || Number(a.lastPriceHkd) || 0;
    if (price > 0) return (Number(a.quantity) || 0) * price;
  }
  return (Number(a.value) || 0) * (a.currency === 'USD' ? usdHkd : 1);
}
export const assetCostHkd = (a, usdHkd = 7.8) => (Number(a.cost) || 0) * (a.currency === 'USD' ? usdHkd : 1);
// Yearly coupon / interest for bonds and deposits, in HKD
export const assetIncomeHkd = (a, usdHkd = 7.8) => ((a.type === 'bond' || a.type === 'cash') && Number(a.rate) > 0
  ? (Number(a.faceValue) || Number(a.value) || 0) * (a.currency === 'USD' ? usdHkd : 1) * Number(a.rate) / 100 : 0);

const hkd = (n) => `HK$${Math.round(n || 0).toLocaleString('en-HK')}`;
const blank = (type = 'bond') => ({ type, name: '', coin: 'bitcoin', quantity: '', value: '', faceValue: '', cost: '', currency: 'HKD', rate: '', maturity: '', note: '', code: '', kind: 'call', underlying: '', strike: '', callLevel: '', ratio: '', expiry: '', unitPrice: '' });

export default function OtherAssets({ assets, cryptoPrices, cryptoStatus, usdHkd, quotes = {}, onAdd, onUpdate, onDelete }) {
  const [form, setForm] = useState(null);       // null | asset draft (with id when editing)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    const f = form;
    if (f.type === 'warrant') {
      if (!(Number(f.quantity) > 0)) { setError('Enter how many units you hold'); return; }
      if (!(Number(f.unitPrice) > 0) && !quotes[hkCode(f.code)]?.price) { setError('Enter the current price per unit (or a valid code for a live price)'); return; }
    } else if (f.type === 'crypto' ? !(Number(f.quantity) > 0) : !(Number(f.value) > 0)) { setError(f.type === 'crypto' ? 'Enter how many coins you hold' : 'Enter the current value'); return; }
    const coin = COINS.find(c => c.id === f.coin);
    const livePrice = quotes[hkCode(f.code)]?.price;
    const doc = {
      type: f.type,
      name: (f.name || '').trim() || (f.type === 'crypto' ? coin?.name : f.type === 'warrant' ? `${hkCode(f.underlying) || ''} ${warrantKind(f.kind).label}`.trim() : assetType(f.type).label),
      currency: f.type === 'crypto' ? 'HKD' : f.currency,
      value: f.type === 'crypto' ? Math.round((Number(f.quantity) || 0) * (cryptoPrices[f.coin]?.hkd || 0) * 100) / 100 : Number(f.value) || 0,
      cost: Number(f.cost) || 0,
      note: (f.note || '').slice(0, 120),
      updatedAt: new Date().toISOString()
    };
    if (f.type === 'warrant') {
      const unit = livePrice || Number(f.unitPrice) || 0;
      Object.assign(doc, {
        code: f.code ? hkCode(f.code) : '', kind: f.kind, underlying: f.underlying ? hkCode(f.underlying) : '',
        strike: Number(f.strike) || 0, callLevel: Number(f.callLevel) || 0, ratio: Number(f.ratio) || 1, expiry: f.expiry || '',
        quantity: Number(f.quantity) || 0, unitPrice: unit, currency: 'HKD',
        value: Math.round((Number(f.quantity) || 0) * unit * 100) / 100,
        cost: Number(f.cost) || 0
      });
    }
    if (f.type === 'crypto') Object.assign(doc, { coin: f.coin, quantity: Number(f.quantity) || 0, lastPriceHkd: cryptoPrices[f.coin]?.hkd || Number(f.lastPriceHkd) || 0 });
    if (f.type === 'bond' || f.type === 'cash') Object.assign(doc, { rate: Number(f.rate) || 0, maturity: f.maturity || '', faceValue: Number(f.faceValue) || 0 });
    setSaving(true);
    try {
      if (f.id) await onUpdate(f.id, doc); else await onAdd({ ...doc, createdAt: new Date().toISOString() });
      setForm(null);
      setError('');
    } catch (err) {
      setError('Could not save. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const total = assets.reduce((s, a) => s + assetValueHkd(a, cryptoPrices, usdHkd, quotes), 0);
  const yearlyIncome = assets.reduce((s, a) => s + assetIncomeHkd(a, usdHkd), 0);
  const label = 'block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1';
  const input = 'w-full px-3 py-2.5 glass-input rounded-xl text-sm text-white';

  return (
    <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-[#00f2fe]" /> Other Assets</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Bonds, crypto, warrants &amp; CBBCs, deposits, gold, property, insurance and MPF · {hkd(total)} in total{yearlyIncome > 0 ? ` · ${hkd(yearlyIncome)}/yr coupons & interest` : ''}
            {cryptoStatus === 'down' && <span className="text-amber-400"> · crypto prices unavailable, showing last saved</span>}
          </p>
        </div>
        <button onClick={() => { setForm(blank()); setError(''); }} className="self-start sm:self-auto bg-[#00f2fe] text-[#0d1117] hover:bg-cyan-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> Add Other Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-slate-500">
          Add bonds, Bitcoin, fixed deposits, gold or property to see your complete net worth and allocation.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-300 min-w-[640px]">
            <thead className="text-[10px] font-mono uppercase text-slate-500 border-b border-slate-800 bg-[#0d1117]">
              <tr>
                <th className="text-left py-3 px-5">Asset</th>
                <th className="text-left py-3 px-5">Details</th>
                <th className="text-right py-3 px-5">Value (HKD)</th>
                <th className="text-right py-3 px-5">Gain / Loss</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {assets.map(a => {
                const t = assetType(a.type);
                const Icon = t.icon;
                const value = assetValueHkd(a, cryptoPrices, usdHkd, quotes);
                const wm = a.type === 'warrant' ? warrantMetrics(a, quotes) : null;
                const cost = assetCostHkd(a, usdHkd);
                const gain = cost > 0 ? value - cost : null;
                const coin = COINS.find(c => c.id === a.coin);
                const live = cryptoPrices[a.coin];
                const days = a.maturity ? Math.ceil((new Date(a.maturity) - new Date()) / 86400000) : null;
                return (
                  <tr key={a.id} className="hover:bg-slate-800/20">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.color}22`, color: t.color }}><Icon className="w-4 h-4" /></span>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{a.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 uppercase">{t.label}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs text-slate-400">
                      {a.type === 'crypto' && <>{Number(a.quantity).toLocaleString('en-HK', { maximumFractionDigits: 8 })} {coin?.symbol} · {live ? <>{hkd(live.hkd)} <span className={live.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{live.change24h >= 0 ? '+' : ''}{Number(live.change24h || 0).toFixed(1)}% 24h</span></> : 'last saved price'}</>}
                      {(a.type === 'bond' || a.type === 'cash') && <>{a.rate ? `${a.rate}% p.a.` : ''}{a.maturity ? `${a.rate ? ' · ' : ''}matures ${a.maturity}${days !== null && days >= 0 && days <= 90 ? ` (${days} days)` : days !== null && days < 0 ? ' (matured)' : ''}` : ''}</>}
                      {wm && (
                        <div className="space-y-0.5">
                          <div>{wm.kind.label}{a.code ? ` · ${a.code}` : ''} · {Number(a.quantity).toLocaleString()} units @ HK${wm.W.toFixed(3)}{wm.liveW ? '' : ' (manual)'}</div>
                          <div className="text-[10px] text-slate-500">
                            {a.underlying ? `${a.underlying}${wm.S ? ` HK$${wm.S.toFixed(2)}` : ''}` : 'underlying not set'}
                            {wm.K ? ` · strike ${wm.K}` : ''}{wm.call ? ` · call ${wm.call}` : ''}
                            {wm.gearing ? ` · gearing ${wm.gearing.toFixed(1)}×` : ''}
                            {wm.days !== null ? ` · ${wm.days >= 0 ? `${wm.days} days left` : 'expired'}` : ''}
                          </div>
                          {((wm.days !== null && wm.days <= 30) || (wm.callDistancePct !== null && wm.callDistancePct <= 5)) && (
                            <div className="text-[10px] text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />
                              {wm.callDistancePct !== null && wm.callDistancePct <= 5 ? `Only ${Math.max(0, wm.callDistancePct).toFixed(1)}% from the call level` : `Expires in ${Math.max(0, wm.days)} days`}
                            </div>
                          )}
                        </div>
                      )}
                      {a.currency === 'USD' && a.type !== 'crypto' && a.type !== 'warrant' && <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">USD</span>}
                      {a.note && <div className="text-[10px] text-slate-500 truncate max-w-[220px]">{a.note}</div>}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-white">{hkd(value)}</td>
                    <td className={`py-3 px-5 text-right font-mono ${gain === null ? 'text-slate-600' : gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {gain === null ? '—' : `${gain >= 0 ? '+' : '−'}${hkd(Math.abs(gain))}`}
                      {gain !== null && cost > 0 && <span className="block text-[10px]">{gain >= 0 ? '+' : ''}{((gain / cost) * 100).toFixed(1)}%</span>}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button onClick={() => { setForm({ ...blank(a.type), ...a, quantity: a.quantity ?? '', value: a.value ?? '', cost: a.cost || '', rate: a.rate || '', faceValue: a.faceValue || '', strike: a.strike || '', callLevel: a.callLevel || '', ratio: a.ratio || '', unitPrice: a.unitPrice || '' }); setError(''); }} aria-label={`Edit ${a.name}`} className="text-slate-500 hover:text-white p-1 cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(a.id)} aria-label={`Delete ${a.name}`} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-[#0d1117]/80 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in" onClick={() => setForm(null)}>
          <form onSubmit={save} onClick={e => e.stopPropagation()} className="glass-panel rounded-3xl p-6 max-w-lg w-full border border-slate-700/50 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold tracking-wider uppercase text-white">{form.id ? 'Edit Asset' : 'Add Other Asset'}</h3>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ASSET_TYPES.map(t => {
                const Icon = t.icon;
                const on = form.type === t.id;
                return (
                  <button type="button" key={t.id} onClick={() => set({ type: t.id })} className={`p-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 cursor-pointer transition-colors ${on ? 'border-[#00f2fe]/60 bg-[#00f2fe]/10 text-white' : 'border-slate-700/60 bg-white/[0.03] text-slate-400 hover:text-white'}`}>
                    <Icon className="w-4 h-4" style={{ color: t.color }} />{t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">{assetType(form.type).hint}</p>

            {form.type === 'warrant' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Warrant / CBBC code</label>
                    <input type="text" value={form.code} onChange={e => set({ code: e.target.value })} placeholder="e.g. 12345" className={`${input} font-mono uppercase`} />
                  </div>
                  <div>
                    <label className={label}>Type</label>
                    <select value={form.kind} onChange={e => set({ kind: e.target.value })} className={`${input} [&>option]:bg-[#161b22]`}>
                      {WARRANT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Underlying</label>
                    <input type="text" value={form.underlying} onChange={e => set({ underlying: e.target.value })} placeholder="e.g. 700 or HSI" className={`${input} font-mono uppercase`} />
                  </div>
                  <div>
                    <label className={label}>Expiry</label>
                    <input type="date" value={form.expiry} onChange={e => set({ expiry: e.target.value })} className={input} />
                  </div>
                  <div>
                    <label className={label}>Strike</label>
                    <input type="number" step="any" min="0" value={form.strike} onChange={e => set({ strike: e.target.value })} placeholder="400" className={input} />
                  </div>
                  {warrantKind(form.kind).cbbc ? (
                    <div>
                      <label className={label}>Call level</label>
                      <input type="number" step="any" min="0" value={form.callLevel} onChange={e => set({ callLevel: e.target.value })} placeholder="380" className={input} />
                    </div>
                  ) : (
                    <div>
                      <label className={label}>Entitlement ratio</label>
                      <input type="number" step="any" min="0" value={form.ratio} onChange={e => set({ ratio: e.target.value })} placeholder="10 units = 1 share" className={input} />
                    </div>
                  )}
                  {warrantKind(form.kind).cbbc && (
                    <div>
                      <label className={label}>Entitlement ratio</label>
                      <input type="number" step="any" min="0" value={form.ratio} onChange={e => set({ ratio: e.target.value })} placeholder="10" className={input} />
                    </div>
                  )}
                  <div>
                    <label className={label}>Units held</label>
                    <input type="number" step="1" min="0" value={form.quantity} onChange={e => set({ quantity: e.target.value })} placeholder="10000" className={input} />
                  </div>
                  <div>
                    <label className={label}>Price per unit (HK$)</label>
                    <input type="number" step="any" min="0" value={form.unitPrice} onChange={e => set({ unitPrice: e.target.value })} placeholder={quotes[hkCode(form.code)]?.price ? `live ${quotes[hkCode(form.code)].price}` : '0.250'} className={input} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  {quotes[hkCode(form.code)]?.price
                    ? <>Live price HK${quotes[hkCode(form.code)].price} → worth <span className="text-white font-bold">{hkd((Number(form.quantity) || 0) * quotes[hkCode(form.code)].price)}</span></>
                    : 'The live price is looked up from the code after saving; until then the price you enter is used.'}
                </p>
                <p className="text-[11px] text-rose-300/80 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Warrants lose time value every day and can expire worthless; CBBCs are terminated early if the underlying touches the call level.</p>
              </div>
            ) : form.type === 'crypto' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Coin</label>
                  <select value={form.coin} onChange={e => set({ coin: e.target.value })} className={`${input} [&>option]:bg-[#161b22]`}>
                    {COINS.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Quantity</label>
                  <input type="number" step="any" min="0" value={form.quantity} onChange={e => set({ quantity: e.target.value })} placeholder="0.05" className={input} />
                </div>
                <div className="col-span-2 text-[11px] text-slate-400">
                  {cryptoPrices[form.coin]?.hkd
                    ? <>Live price {hkd(cryptoPrices[form.coin].hkd)} → worth <span className="text-white font-bold">{hkd((Number(form.quantity) || 0) * cryptoPrices[form.coin].hkd)}</span></>
                    : cryptoStatus === 'loading' ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Fetching live price…</span> : 'Live price unavailable right now; the value updates once prices load.'}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className={label}>Name</label>
                  <input type="text" value={form.name} onChange={e => set({ name: e.target.value })} placeholder={form.type === 'bond' ? 'e.g. HK Silver Bond 2025' : form.type === 'cash' ? 'e.g. HSBC 6-month time deposit' : form.type === 'property' ? 'e.g. Flat in Sha Tin' : 'Name'} className={input} maxLength={60} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={label}>Current value</label>
                    <input type="number" step="any" min="0" value={form.value} onChange={e => set({ value: e.target.value })} placeholder="100000" className={input} />
                  </div>
                  <div>
                    <label className={label}>Currency</label>
                    <select value={form.currency} onChange={e => set({ currency: e.target.value })} className={`${input} [&>option]:bg-[#161b22]`}>
                      <option value="HKD">HKD</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {(form.type === 'bond' || form.type === 'cash') && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>{form.type === 'bond' ? 'Coupon %' : 'Interest %'}</label>
                  <input type="number" step="0.01" min="0" value={form.rate} onChange={e => set({ rate: e.target.value })} placeholder="4.5" className={input} />
                </div>
                {form.type === 'bond' && (
                  <div>
                    <label className={label}>Face value</label>
                    <input type="number" step="any" min="0" value={form.faceValue} onChange={e => set({ faceValue: e.target.value })} placeholder="same" className={input} />
                  </div>
                )}
                <div className={form.type === 'bond' ? '' : 'col-span-2'}>
                  <label className={label}>Maturity</label>
                  <input type="date" value={form.maturity} onChange={e => set({ maturity: e.target.value })} className={input} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Amount paid (optional)</label>
                <input type="number" step="any" min="0" value={form.cost} onChange={e => set({ cost: e.target.value })} placeholder="for gain / loss" className={input} />
              </div>
              <div>
                <label className={label}>Note (optional)</label>
                <input type="text" value={form.note} onChange={e => set({ note: e.target.value })} placeholder="e.g. held at HSBC" className={input} maxLength={120} />
              </div>
            </div>

            {error && <div className="text-xs text-amber-400">{error}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 text-xs text-slate-400 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-black uppercase bg-[#00f2fe] text-[#0d1117] rounded-xl cursor-pointer disabled:opacity-60">{saving ? 'Saving…' : form.id ? 'Save changes' : 'Add asset'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
