import React, { useEffect, useState } from 'react';

// Live market strip under the top bar (indices, USD/HKD, Bitcoin), refreshed every minute.
// Quotes: Tencent (qt.gtimg.cn, GBK text). Bitcoin: CoinGecko.
const ITEMS = [
  { code: 'hkHSI', label: 'HSI' },
  { code: 'hkHSCEI', label: 'HSCEI' },
  { code: 'hkHSTECH', label: 'HS TECH' },
  { code: 'usINX', label: 'S&P 500' },
  { code: 'usIXIC', label: 'NASDAQ' },
  { code: 'usDJI', label: 'DOW' },
  { code: 'whUSDHKD', label: 'USD/HKD', fx: true }
];

// Hong Kong trading hours (HKT): 09:30–12:00 and 13:00–16:00, Monday to Friday
function hkMarketStatus(now = new Date()) {
  const hk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const d = hk.getDay(), m = hk.getHours() * 60 + hk.getMinutes();
  if (d === 0 || d === 6) return { open: false, text: 'HKEX closed' };
  if ((m >= 570 && m < 720) || (m >= 780 && m < 960)) return { open: true, text: 'HKEX open' };
  if (m >= 720 && m < 780) return { open: false, text: 'HKEX lunch break' };
  return { open: false, text: 'HKEX closed' };
}

export default function MarketStrip() {
  const [quotes, setQuotes] = useState({});
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`https://qt.gtimg.cn/q=${ITEMS.map(i => i.code).join(',')}&_=${Date.now()}`);
        const text = new TextDecoder('gbk').decode(await r.arrayBuffer());
        const next = {};
        text.split(';').forEach(line => {
          const m = line.match(/v_(\w+)="([^"]*)"/); if (!m) return;
          const f = m[2].split('~');
          next[m[1]] = { price: Number(f[3]), change: f[31] != null ? Number(f[31]) : null, pct: f[32] != null ? Number(f[32]) : null };
        });
        try {
          const b = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(x => x.json());
          if (b && b.bitcoin) next.btc = { price: b.bitcoin.usd, pct: b.bitcoin.usd_24h_change };
        } catch (e) { /* Bitcoin is optional */ }
        if (alive) setQuotes(next);
      } catch (e) { /* keep the last quotes */ }
    };
    load();
    const t = setInterval(load, 60000);
    const c = setInterval(() => setClock(new Date()), 30000);
    return () => { alive = false; clearInterval(t); clearInterval(c); };
  }, []);

  const status = hkMarketStatus(clock);
  const hkTime = clock.toLocaleTimeString('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit' });
  const cell = (label, q, fx) => {
    const up = q && q.pct > 0, down = q && q.pct < 0;
    return (
      <div key={label} className="flex items-baseline gap-2 px-4 border-r border-[#1d2531] whitespace-nowrap">
        <span className="text-[10px] font-semibold tracking-wide text-slate-400">{label}</span>
        <span className="font-mono text-[11px] text-slate-100">{q && isFinite(q.price) ? q.price.toLocaleString('en-US', { minimumFractionDigits: fx ? 4 : 2, maximumFractionDigits: fx ? 4 : 2 }) : '—'}</span>
        {q && q.pct !== null && isFinite(q.pct) && (
          <span className={`font-mono text-[10px] ${up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400'}`}>{up ? '▲' : down ? '▼' : ''} {Math.abs(q.pct).toFixed(2)}%</span>
        )}
      </div>
    );
  };
  return (
    <div className="afa-strip flex items-stretch h-8 border-b border-[#1d2531] bg-[#080b10] text-slate-300 overflow-hidden">
      <div className="flex items-center gap-2 px-4 border-r border-[#1d2531] shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${status.open ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className="text-[10px] font-semibold tracking-wide text-slate-300 whitespace-nowrap">{status.text}</span>
        <span className="font-mono text-[10px] text-slate-500">{hkTime} HKT</span>
      </div>
      <div className="flex items-center overflow-x-auto no-scrollbar">
        {ITEMS.map(i => cell(i.label, quotes[i.code], i.fx))}
        {cell('BTC', quotes.btc)}
      </div>
    </div>
  );
}
