import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, ShieldAlert, Wallet, TrendingUp, Plus, MoreHorizontal, Sliders, CreditCard, PiggyBank, Bot, X, Share, PlusSquare } from 'lucide-react';

// Phones only (hidden from 768px up, where the sidebar is shown).
// Bottom tab bar: Home · Analytics · [+] · Records · More. "More" opens a sheet with the planning tools.
const MAIN = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'report', label: 'Analytics', icon: ShieldAlert },
  { id: 'ledger', label: 'Records', icon: Wallet },
  { id: 'portfolio', label: 'Invest', icon: TrendingUp }
];
const MORE = [
  { id: 'simulator', label: 'Strategic Modeler', desc: 'Test savings and investing plans', icon: Sliders },
  { id: 'debt', label: 'Debt Health', desc: 'Cards, loans and payoff order', icon: CreditCard },
  { id: 'mpf', label: 'MPF & Tax', desc: 'Retirement and salaries tax', icon: PiggyBank },
  { id: 'advisor', label: 'A.F.A. AI Chat', desc: 'Ask about your money', icon: Bot }
];

const CSS = `
.afa-tabbar { position: fixed; left: 10px; right: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 45;
  display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; height: 62px; padding: 0 6px;
  background: rgba(13, 17, 23, 0.72); -webkit-backdrop-filter: blur(22px) saturate(1.4); backdrop-filter: blur(22px) saturate(1.4);
  border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 22px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 40px -12px rgba(0, 0, 0, 0.7); }
.afa-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 100%;
  color: #7d8a9c; font-size: 10px; font-weight: 600; letter-spacing: 0.01em; -webkit-tap-highlight-color: transparent; cursor: pointer; }
.afa-tab svg { width: 20px; height: 20px; }
.afa-tab.on { color: #00f2fe; }
.afa-tab.on svg { filter: drop-shadow(0 0 6px rgba(0, 242, 254, 0.45)); }
.afa-tab-add { justify-self: center; width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; cursor: pointer;
  background: #00f2fe; color: #0d1117; box-shadow: 0 0 22px rgba(0, 242, 254, 0.4); -webkit-tap-highlight-color: transparent; transition: transform .15s; }
.afa-tab-add:active { transform: scale(0.94); }
.afa-sheet-bg { position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.55); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); animation: afaFade .2s ease both; }
.afa-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 71; padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  background: rgba(17, 22, 30, 0.92); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px);
  border-top: 1px solid rgba(148, 163, 184, 0.18); border-radius: 24px 24px 0 0; animation: afaUp .26s cubic-bezier(.2,.8,.2,1) both; }
.afa-sheet .grab { width: 38px; height: 4px; border-radius: 4px; background: rgba(148, 163, 184, 0.35); margin: 0 auto 12px; }
@keyframes afaUp { from { transform: translateY(100%); } to { transform: none; } }
@keyframes afaFade { from { opacity: 0; } to { opacity: 1; } }
@media (min-width: 768px) { .afa-tabbar, .afa-sheet, .afa-sheet-bg { display: none !important; } }
@media (prefers-reduced-motion: reduce) { .afa-sheet, .afa-sheet-bg { animation: none; } }
`;

export default function MobileNav({ activeTab, setActiveTab, onAdd, hidden }) {
  const [more, setMore] = useState(false);
  const go = (id) => { setActiveTab(id); setMore(false); const c = document.querySelector('.afa-content'); if (c) c.scrollTo({ top: 0 }); };
  const moreActive = MORE.some(m => m.id === activeTab);
  if (hidden) return null;
  const Tab = ({ t }) => { const I = t.icon; return (
    <button type="button" className={`afa-tab ${activeTab === t.id ? 'on' : ''}`} onClick={() => go(t.id)} aria-current={activeTab === t.id ? 'page' : undefined}><I /><span>{t.label}</span></button>
  ); };
  return createPortal(
    <>
      <style>{CSS}</style>
      <nav className="afa-tabbar md:hidden" aria-label="Main">
        <Tab t={MAIN[0]} />
        <Tab t={MAIN[1]} />
        <button type="button" className="afa-tab-add" onClick={onAdd} aria-label="Record a transaction"><Plus className="w-6 h-6" /></button>
        <Tab t={MAIN[2]} />
        <button type="button" className={`afa-tab ${moreActive || more ? 'on' : ''}`} onClick={() => setMore(true)} aria-haspopup="dialog"><MoreHorizontal /><span>More</span></button>
      </nav>
      {more && (
        <>
          <div className="afa-sheet-bg" onClick={() => setMore(false)} />
          <div className="afa-sheet" role="dialog" aria-label="More">
            <div className="grab" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Investments & planning</span>
              <button onClick={() => setMore(false)} aria-label="Close" className="p-1.5 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              {[{ id: 'portfolio', label: 'Investments', desc: 'Holdings, simulated trading, stock analysis', icon: TrendingUp }, ...MORE].map(m => { const I = m.icon; const on = activeTab === m.id; return (
                <button key={m.id} type="button" onClick={() => go(m.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left cursor-pointer border ${on ? 'bg-[#00f2fe]/10 border-[#00f2fe]/30' : 'bg-white/[0.03] border-white/5 active:bg-white/10'}`}>
                  <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${on ? 'bg-[#00f2fe]/15 text-[#00f2fe]' : 'bg-[#0d1117] text-slate-400'}`}><I className="w-4 h-4" /></span>
                  <span className="min-w-0"><span className={`block text-sm font-semibold ${on ? 'text-[#00f2fe]' : 'text-white'}`}>{m.label}</span><span className="block text-[11px] text-slate-500 truncate">{m.desc}</span></span>
                </button>
              ); })}
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
}

// "Add to Home Screen" tip on phones that are not yet running A.F.A. as an installed app
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem('afa_install_hint') === 'off'; } catch (e) { /* storage blocked */ }
    const phone = window.matchMedia?.('(max-width: 767px)').matches;
    if (!standalone && !dismissed && phone) setShow(true);
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem('afa_install_hint', 'off'); } catch (e) { /* ignore */ } };
  return (
    <div className="md:hidden bg-[#161b22] p-4 rounded-2xl border border-[#00f2fe]/25 shadow-md flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#0d1117] border border-slate-800 grid place-items-center shrink-0"><PlusSquare className="w-4 h-4 text-[#00f2fe]" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white">Install A.F.A. on your phone</div>
        {prompt ? (
          <p className="text-xs text-slate-400 mt-0.5">Opens full screen from your home screen, like an app.</p>
        ) : ios ? (
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">In Safari, tap <Share className="inline w-3.5 h-3.5 -mt-0.5 text-[#00f2fe]" /> Share, then <b className="text-slate-200">Add to Home Screen</b>. It opens full screen, like an app.</p>
        ) : (
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Open your browser menu and choose <b className="text-slate-200">Install app</b> or <b className="text-slate-200">Add to Home screen</b>.</p>
        )}
        {prompt && <button onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); close(); }} className="mt-2 bg-[#00f2fe] text-[#0d1117] px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">Install</button>}
      </div>
      <button onClick={close} aria-label="Dismiss" className="p-1 text-slate-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
    </div>
  );
}
