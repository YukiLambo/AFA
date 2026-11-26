import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, ShieldAlert, Wallet, TrendingUp, Plus, Sliders, CreditCard, PiggyBank, Bot, X, Share, PlusSquare,
  Menu, Bell, ChevronRight, Sparkles, LogOut, UserCog, Smartphone
} from 'lucide-react';

// Phone layout (hidden from 768px up, where the desktop sidebar and header are used).
//  - MobileTopBar: menu button · A.F.A. wordmark · alerts/profile pill, plus a slide-in side drawer
//  - MobileHero: financial-health orb with three pillar capsules (dashboard only)
//  - MobileNav: five-tab bottom bar (AI in the middle) and a floating + for recording

const TABS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'report', label: 'Analytics', icon: ShieldAlert },
  { id: 'advisor', label: 'A.F.A. AI', icon: Bot, center: true },
  { id: 'portfolio', label: 'Invest', icon: TrendingUp },
  { id: 'ledger', label: 'Records', icon: Wallet }
];
const PAGE = { dashboard: 'Home', report: 'Analytics', ledger: 'Records', portfolio: 'Investments', simulator: 'Wealth Planner', debt: 'Debt Health', mpf: 'HK MPF & Tax', advisor: 'A.F.A. AI' };

const CSS = `
@media (max-width: 767px) {
  html { font-size: 14px; }
  .afa-content > header.afa-desk-head { display: none !important; }
}
.afa-mtop { position: sticky; top: 0; z-index: 30; display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 10px;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 14px 8px; background: linear-gradient(to bottom, rgba(13,17,23,0.92), rgba(13,17,23,0.72));
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(148,163,184,0.08); }
.afa-round { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; color: #cfe3ee; cursor: pointer;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.16); -webkit-tap-highlight-color: transparent; }
.afa-round:active { background: rgba(255,255,255,0.1); }
.afa-mark { text-align: center; line-height: 1; }
.afa-mark b { display: block; font: 700 15px/1 'Montserrat', 'Inter', sans-serif; letter-spacing: 0.32em; text-indent: 0.32em; color: #eef6fb; }
.afa-mark span { display: block; margin-top: 4px; font: 500 9.5px/1 'JetBrains Mono', monospace; letter-spacing: 0.14em; text-transform: uppercase; color: #00f2fe; opacity: 0.85; }
.afa-pillbtn { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 5px 0 12px; border-radius: 999px; cursor: pointer;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.16); -webkit-tap-highlight-color: transparent; }
.afa-ava { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; overflow: hidden; font: 600 12px/1 'Inter', sans-serif; color: #062027;
  background: radial-gradient(circle at 30% 25%, #b9fbff, #00d4e6 45%, #0a6f86 100%); }

/* Drawer */
.afa-drawer-bg { position: fixed; inset: 0; z-index: 75; background: rgba(0,0,0,0.5); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: afaFade .2s ease both; }
.afa-drawer { position: fixed; top: 0; bottom: 0; left: 0; z-index: 76; width: min(84vw, 340px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  padding: calc(22px + env(safe-area-inset-top, 0px)) 20px calc(22px + env(safe-area-inset-bottom, 0px));
  background: rgba(14, 19, 26, 0.94); -webkit-backdrop-filter: blur(26px); backdrop-filter: blur(26px); border-right: 1px solid rgba(148,163,184,0.14);
  animation: afaSlide .28s cubic-bezier(.2,.8,.2,1) both; }
.afa-drawer::-webkit-scrollbar { display: none; }
.afa-drawer h5 { margin: 22px 0 8px; font: 500 10px/1 'JetBrains Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #6f7d90; }
.afa-dname { font: italic 400 26px/1.1 'Newsreader', Georgia, serif; color: #f2f7fa; }
.afa-orb-sm { width: 62px; height: 62px; border-radius: 999px; flex-shrink: 0; display: grid; place-items: center; overflow: hidden;
  font: italic 400 24px/1 'Newsreader', Georgia, serif; color: #f4fdff;
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), transparent 28%), radial-gradient(circle at 65% 70%, #0b4f6c, transparent 60%), conic-gradient(from 200deg, #00f2fe, #3d7bff, #0b2a4a, #00c2d6, #00f2fe);
  box-shadow: 0 12px 30px -8px rgba(0,242,254,0.35); }
.afa-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.afa-stats b { display: block; font: 700 17px/1.1 'JetBrains Mono', monospace; color: #f2f7fa; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.afa-stats span { display: block; margin-top: 4px; font: 500 9px/1.2 'JetBrains Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; color: #7d8a9c; }
.afa-row { width: 100%; display: flex; align-items: center; gap: 14px; padding: 11px 2px; cursor: pointer; text-align: left; color: #e7eef4; -webkit-tap-highlight-color: transparent; }
.afa-row svg.lead { width: 18px; height: 18px; color: #9fb3c3; flex-shrink: 0; }
.afa-row .t { flex: 1; min-width: 0; font: 500 14px/1.25 'Inter', sans-serif; }
.afa-row .t small { display: block; font-size: 11.5px; color: #7d8a9c; font-weight: 400; margin-top: 2px; }
.afa-row .chev { width: 15px; height: 15px; color: #4b5869; }
.afa-row.on .t { color: #00f2fe; }
.afa-row.on svg.lead { color: #00f2fe; }
.afa-sep { height: 1px; background: rgba(148,163,184,0.1); margin: 14px 0 0; }
.afa-switch { width: 34px; height: 20px; border-radius: 99px; background: #2a3442; position: relative; transition: background .2s; flex-shrink: 0; }
.afa-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 99px; background: #fff; transition: transform .2s; }
.afa-switch.on { background: #00c9db; }
.afa-switch.on::after { transform: translateX(14px); }

/* Hero */
.afa-hero { display: flex; flex-direction: column; align-items: center; padding: 6px 0 2px; }
.afa-orb { position: relative; width: min(58vw, 230px); aspect-ratio: 1; border-radius: 999px; overflow: hidden; cursor: pointer; -webkit-tap-highlight-color: transparent;
  background: radial-gradient(circle at 50% 50%, #0b3a5c, #061a2c 70%);
  box-shadow: 0 28px 60px -18px rgba(0, 170, 220, 0.45), inset 0 0 40px rgba(0,0,0,0.5); }
.afa-orb i { position: absolute; inset: -30%; border-radius: 45%; filter: blur(18px); opacity: .9; }
.afa-orb i:nth-child(1) { background: conic-gradient(from 0deg, transparent, #00f2fe 18%, transparent 38%, #2f6bff 60%, transparent 80%); animation: afaSpin 14s linear infinite; }
.afa-orb i:nth-child(2) { background: conic-gradient(from 120deg, transparent, #3fe3c4 15%, transparent 35%, #0a7cff 55%, transparent 75%); animation: afaSpin 21s linear infinite reverse; mix-blend-mode: screen; opacity: .7; }
.afa-orb::before { content: ''; position: absolute; inset: 0; border-radius: 999px; z-index: 2;
  background: radial-gradient(circle at 32% 24%, rgba(255,255,255,0.42), transparent 30%), radial-gradient(circle at 70% 85%, rgba(0,0,0,0.55), transparent 55%); }
.afa-orb::after { content: ''; position: absolute; inset: 0; border-radius: 999px; z-index: 3; box-shadow: inset 0 0 0 1px rgba(190,240,255,0.18); }
.afa-orb .lbl { position: absolute; inset: 0; z-index: 4; display: grid; place-content: center; text-align: center; color: #f4fdff; }
.afa-orb .lbl b { font: italic 400 clamp(44px, 15vw, 60px)/1 'Newsreader', Georgia, serif; text-shadow: 0 2px 18px rgba(0,30,50,0.6); }
.afa-orb .lbl span { margin-top: 6px; font: 500 9.5px/1 'JetBrains Mono', monospace; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(225,248,255,0.8); }
.afa-orb .lbl em { font: italic 400 22px/1.1 'Newsreader', Georgia, serif; }
.afa-caps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; margin-top: 18px; }
.afa-cap { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.afa-cap > span { font: 500 9.5px/1 'JetBrains Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #9fb0bf; }
.afa-cap .pill { position: relative; width: 74px; height: 30px; border-radius: 99px; overflow: hidden; display: grid; place-items: center;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(148,163,184,0.18); font: 600 12px/1 'JetBrains Mono', monospace; color: #eaf6fb; }
.afa-cap .pill i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; opacity: .55; }
.afa-cap .pill b { position: relative; }

/* Bottom bar */
.afa-tabbar { position: fixed; left: 12px; right: 12px; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 45;
  display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; height: 58px; padding: 0 5px;
  background: rgba(13, 17, 23, 0.74); -webkit-backdrop-filter: blur(22px) saturate(1.4); backdrop-filter: blur(22px) saturate(1.4);
  border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 999px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 18px 40px -12px rgba(0, 0, 0, 0.7); }
.afa-tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 48px; border-radius: 999px;
  color: #7d8a9c; font: 600 8.5px/1 'JetBrains Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; -webkit-tap-highlight-color: transparent; cursor: pointer; transition: color .2s, background .2s; }
.afa-tab svg { width: 18px; height: 18px; }
.afa-tab.on { color: #eafcff; background: rgba(0, 242, 254, 0.12); box-shadow: inset 0 0 0 1px rgba(0, 242, 254, 0.18); }
.afa-tab.on svg { color: #00f2fe; }
.afa-tab.center svg { width: 20px; height: 20px; }
.afa-tab.center:not(.on) svg { color: #b6f8ff; }
.afa-fab { position: fixed; right: 16px; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); z-index: 46; width: 54px; height: 54px; border-radius: 999px; display: grid; place-items: center; cursor: pointer;
  color: #00f2fe; background: rgba(13, 17, 23, 0.7); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  border: 1px solid rgba(0, 242, 254, 0.35); box-shadow: 0 0 24px rgba(0, 242, 254, 0.22), 0 12px 28px -10px rgba(0,0,0,0.8); -webkit-tap-highlight-color: transparent; transition: transform .15s; }
.afa-fab:active { transform: scale(0.94); }
@keyframes afaSlide { from { transform: translateX(-100%); } to { transform: none; } }
@keyframes afaFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes afaSpin { to { transform: rotate(360deg); } }
@media (min-width: 768px) { .afa-tabbar, .afa-fab, .afa-mtop, .afa-drawer, .afa-drawer-bg, .afa-hero { display: none !important; } }
@media (prefers-reduced-motion: reduce) { .afa-drawer, .afa-drawer-bg { animation: none; } .afa-orb i { animation: none; } }
`;

export function MobileStyles() { return <style>{CSS}</style>; }

const scoreColor = (s) => (s >= 70 ? '#16c784' : s >= 45 ? '#ffd166' : '#ea3943');
const money = (v) => {
  const a = Math.abs(v || 0);
  const t = a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(0)}k` : a.toFixed(0);
  return `${v < 0 ? '-' : ''}$${t}`;
};

export function MobileTopBar({ activeTab, setActiveTab, user, userProfile, insights, alertCount, fx, onEditProfile, onSignOut }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const name = (userProfile?.name || '').trim() || (user?.email || 'A.F.A. user').split('@')[0];
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const go = (id) => { setActiveTab(id); setOpen(false); const c = document.querySelector('.afa-content'); if (c) c.scrollTo({ top: 0 }); };
  const snap = insights?.snapshot || {};
  const Row = ({ id, icon: I, label, sub, onClick, right }) => (
    <button type="button" className={`afa-row ${id && activeTab === id ? 'on' : ''}`} onClick={onClick || (() => go(id))}>
      <I className="lead" />
      <span className="t">{label}{sub && <small>{sub}</small>}</span>
      {right !== undefined ? right : <ChevronRight className="chev" />}
    </button>
  );
  return (
    <>
      <div className="afa-mtop md:hidden">
        <button type="button" className="afa-round" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="w-[18px] h-[18px]" /></button>
        <div className="afa-mark"><b>A.F.A.</b><span>{PAGE[activeTab] || 'Home'}</span></div>
        <button type="button" className="afa-pillbtn" onClick={() => go('report')} aria-label={`${alertCount} alerts`}>
          <span className="relative text-slate-300"><Bell className="w-4 h-4" />{alertCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />}</span>
          <span className="afa-ava">{userProfile?.profilePic ? <img src={userProfile.profilePic} alt="" className="w-full h-full object-cover" /> : initials}</span>
        </button>
      </div>

      {open && createPortal(
        <>
          <div className="afa-drawer-bg" onClick={() => setOpen(false)} />
          <aside className="afa-drawer" role="dialog" aria-label="Menu">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="afa-dname truncate">{name}</div>
                <div className="text-[11.5px] text-slate-500 mt-1.5 truncate">{user?.email}</div>
                <button type="button" onClick={() => { setOpen(false); onEditProfile(); }} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[12px] text-slate-200">
                  <UserCog className="w-3.5 h-3.5 text-[#00f2fe]" /> Edit profile <ChevronRight className="w-3 h-3 text-slate-500" />
                </button>
              </div>
              <div className="afa-orb-sm">{userProfile?.profilePic ? <img src={userProfile.profilePic} alt="" className="w-full h-full object-cover" /> : initials}</div>
            </div>

            <h5>Snapshot</h5>
            <div className="afa-stats">
              <div><b style={{ color: scoreColor(insights?.overall ?? 0) }}>{insights?.overall ?? '—'}</b><span>Health</span></div>
              <div><b>{snap.income > 0 ? `${Math.round(snap.savingsRate)}%` : '—'}</b><span>Saved</span></div>
              <div><b>{money(snap.netWorth)}</b><span>Net worth</span></div>
            </div>
            <div className="afa-sep" />

            <h5>Planning &amp; tools</h5>
            <Row id="simulator" icon={Sliders} label="Wealth Planner" sub="Test savings and investing plans" />
            <Row id="debt" icon={CreditCard} label="Debt Health" sub="Cards, loans and payoff order" />
            <Row id="mpf" icon={PiggyBank} label="HK MPF & Tax" sub="Hong Kong retirement and salaries tax" />
            <Row id="portfolio" icon={TrendingUp} label="Investments" sub="Holdings, simulated trading, analysis" />
            <div className="afa-sep" />

            <h5>General</h5>
            <Row icon={Smartphone} label="Apple Pay auto-sync" sub="Record taps automatically" onClick={() => go('ledger')} />
            {fx?.supported && (
              <Row icon={Sparkles} label="Liquid effects" sub={fx.enabled ? 'On' : 'Off'} onClick={() => fx.setEnabled(!fx.enabled)} right={<span className={`afa-switch ${fx.enabled ? 'on' : ''}`} />} />
            )}
            <Row icon={LogOut} label={<span className="text-rose-400">Log out</span>} onClick={() => { setOpen(false); onSignOut(); }} right={null} />
            <div className="mt-6 text-[11px] text-slate-600 font-mono">A.F.A. · Automated Financial Assistant</div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}

export function MobileHero({ insights, hasData, onOpen }) {
  const pick = ['spending', 'safety', 'investing'];
  const pillars = (insights?.pillars || []).filter(p => pick.includes(p.id)).sort((a, b) => pick.indexOf(a.id) - pick.indexOf(b.id));
  const names = { spending: 'Spending', safety: 'Safety', investing: 'Invest' };
  return (
    <div className="afa-hero md:hidden">
      <div className="afa-orb" onClick={onOpen} role="button" aria-label="Open your financial health analysis">
        <i /><i />
        <div className="lbl">
          {hasData ? (<><b>{insights.overall}</b><span>Financial health</span></>) : (<><em>Awaiting data</em><span>Add your first record</span></>)}
        </div>
      </div>
      <div className="afa-caps">
        {pillars.map(p => (
          <div key={p.id} className="afa-cap" onClick={onOpen}>
            <span>{names[p.id]}</span>
            <div className="pill"><i style={{ width: `${hasData ? p.score : 0}%`, background: `linear-gradient(90deg, transparent, ${scoreColor(p.score)})` }} /><b>{hasData ? p.score : '—'}</b></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MobileNav({ activeTab, setActiveTab, onAdd, hidden }) {
  if (hidden) return null;
  const go = (id) => { setActiveTab(id); const c = document.querySelector('.afa-content'); if (c) c.scrollTo({ top: 0 }); };
  return createPortal(
    <>
      {activeTab !== 'advisor' && <button type="button" className="afa-fab md:hidden" onClick={onAdd} aria-label="Record a transaction"><Plus className="w-6 h-6" /></button>}
      <nav className="afa-tabbar md:hidden" aria-label="Main">
        {TABS.map(t => { const I = t.icon; const on = activeTab === t.id; return (
          <button key={t.id} type="button" className={`afa-tab ${on ? 'on' : ''} ${t.center ? 'center' : ''}`} onClick={() => go(t.id)} aria-current={on ? 'page' : undefined}><I /><span>{t.label}</span></button>
        ); })}
      </nav>
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
