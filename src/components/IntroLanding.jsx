import React, { useEffect, useRef, useState } from 'react';
import { startDotHero } from '../lib/dotHero';
import { startDotBot } from '../lib/dotBot';
import TemplatePages, { HomeSections, TP_CSS } from './TemplatePages';

// Entry screen: the minting animation plus the Overview / Why A.F.A. / Features pages.
// "Get started" flies the coin into the logo, fades this screen out and calls onEnter().
const CSS = `
.afl { position: fixed; inset: 0; z-index: 60; overflow-x: hidden; overflow-y: auto; transition: opacity .6s ease; }
.afl.leaving { opacity: 0; pointer-events: none; }
.afl *, .afl *::before, .afl *::after { box-sizing: border-box; }
.afl { --bg: #080b10;
  --panel: #0d1218;
  --panel-2: #10161e;
  --ink: #edf2f6;
  --muted: #8494a3;
  --soft: #b4c1cc;
  --cyan: #00f2fe;
  --cyan-ink: #3fe3f0;
  --blue: #4facfe;
  --up: #3fd9a0;
  --line: rgba(200, 225, 240, 0.09);
  --line-strong: rgba(200, 225, 240, 0.16);
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --ui: "Inter", "Segoe UI", system-ui, sans-serif;
  --sans: "Inter", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  --nav-h: 64px;
  color-scheme: dark; background: var(--bg); font-family: var(--sans); color: var(--ink); }
.afl.page { overflow-y: auto; }
.afl #afl-scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; transition: opacity .5s ease; }
.afl.page #afl-scene { opacity: 0; pointer-events: none; }

/* Top bar: flat, full width, hairline rule */
.afl .nav { position: fixed; z-index: 10; top: 0; left: 0; right: 0; height: calc(var(--nav-h) + env(safe-area-inset-top, 0px)); padding: env(safe-area-inset-top, 0px) max(28px, env(safe-area-inset-right, 0px)) 0 max(28px, env(safe-area-inset-left, 0px));
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px;
  background: rgba(8, 11, 16, 0.78); border-bottom: 1px solid var(--line); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.afl .brand { justify-self: start; display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.afl .brand svg { width: 28px; height: 28px; display: block; }
.afl .brand .word { font: 600 17px/1 var(--ui); letter-spacing: 0.04em; }
.afl .brand svg { transition: filter .4s ease; }
.afl .brand.absorb svg { animation: afl-absorb .9s cubic-bezier(.16,1,.3,1); }
@keyframes afl-absorb { 0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(0,242,254,0)); } 30% { transform: scale(1.22); filter: drop-shadow(0 0 16px rgba(0,242,254,0.95)); } 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(0,242,254,0.35)); } }
.afl .links { display: flex; align-items: stretch; gap: 6px; height: var(--nav-h); }
.afl .link { position: relative; display: flex; align-items: center; font: 500 14px/1 var(--ui); color: rgba(220, 232, 240, 0.72); text-decoration: none; padding: 0 14px; transition: color .2s; }
.afl .link::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: -1px; height: 2px; background: var(--cyan); transform: scaleX(0); transition: transform .25s ease; }
.afl .link:hover, .afl .link:focus-visible { color: #fff; outline: none; }
.afl .link:focus-visible::after { transform: scaleX(1); opacity: .5; }
.afl .link[aria-current="page"] { color: #fff; }
.afl .link[aria-current="page"]::after { transform: scaleX(1); }
.afl .cta-wrap { justify-self: end; display: flex; align-items: center; gap: 18px; }
.afl .pill { font: 600 14px/1 var(--ui); letter-spacing: 0.005em; color: #03141a; background: var(--cyan); border: 0; border-radius: 4px; padding: 12px 20px; cursor: pointer; transition: background .2s, transform .2s; }
.afl .pill:hover { background: #7ef8ff; }
.afl .pill:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.afl .btn-line { font: 500 14px/1 var(--ui); color: var(--ink); background: transparent; border: 1px solid var(--line-strong); border-radius: 4px; padding: 12px 20px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: border-color .2s, background .2s; }
.afl .btn-line::after { content: "\\2192"; color: var(--cyan-ink); transition: transform .2s; }
.afl .btn-line:hover, .afl .btn-line:focus-visible { border-color: rgba(0, 242, 254, 0.5); outline: none; }
.afl .btn-line:hover::after { transform: translateX(3px); }

.afl .home-text { transition: opacity .4s ease; }
.afl .mlinks { display: none; position: fixed; z-index: 4; left: 0; right: 0; bottom: calc(7vh + env(safe-area-inset-bottom, 0px)); justify-content: center; gap: 6px; }
.afl .mlinks a { font: 500 12px/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: rgba(220, 232, 240, 0.7); text-decoration: none; padding: 12px 12px; }
.afl .mlinks a:active { color: #fff; }
.afl.page .home-text { opacity: 0; pointer-events: none; }
.afl .app { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; background: var(--bg); opacity: 0; pointer-events: none; transition: opacity .7s ease;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.afl .app.on { opacity: 1; pointer-events: auto; }
.afl .app .box { text-align: center; display: grid; gap: 14px; justify-items: center; max-width: 400px; }
.afl .app h2 { margin: 0; font: 400 28px/1.15 var(--serif); }
.afl .app p { margin: 0; color: var(--muted); line-height: 1.6; font-size: 14px; }
/* Desktop hero: copy on the left over the calm end of the cube field, the particle assistant floating on the right */
.afl .dhero { position: fixed; inset: calc(var(--nav-h) + env(safe-area-inset-top, 0px)) 0 0 0; z-index: 4; pointer-events: none; display: grid; grid-template-rows: 1fr auto; }
.afl .dhero #afl-bot { position: fixed; left: 67vw; top: 50vh; width: min(46vh, 25vw); height: min(46vh, 25vw); transform: translate(-50%, -50%); pointer-events: none; display: block; }
.afl .dhero-copy { position: relative; align-self: center; max-width: 560px; margin-left: max(64px, calc((100vw - 1180px) / 2 + 28px)); pointer-events: auto; animation: afl-copy .9s .35s both cubic-bezier(.16,1,.3,1); }
@keyframes afl-fadein { from { opacity: 0; filter: blur(6px); letter-spacing: 0.02em; } to { opacity: 1; filter: blur(0); letter-spacing: -0.035em; } }
@keyframes afl-copy { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.afl .dhero-tag { display: inline-flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: rgba(8, 11, 16, 0.6); font: 500 11px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--soft); }
.afl .dhero-tag i { width: 6px; height: 6px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 10px var(--cyan); }
.afl .dhero h1 { margin: 22px 0 0; font: 400 clamp(44px, 4.8vw, 74px)/1.02 var(--serif); letter-spacing: -0.026em; text-wrap: balance; }
.afl .dhero h1 em { font-style: italic; color: #d9f6ff; }
.afl .dhero p { margin: 22px 0 0; max-width: 46ch; font-size: 16.5px; line-height: 1.7; color: var(--soft); }
.afl .dhero .actions { margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap; }
.afl .dhero .pill { border-radius: 999px; padding: 13px 24px; box-shadow: 0 8px 30px -10px rgba(0, 242, 254, 0.7); }
.afl .dhero .btn-line { border-radius: 999px; padding: 13px 22px; background: rgba(8, 11, 16, 0.45); }
.afl .dhero-steps { position: relative; list-style: none; margin: 0; padding: 0 max(28px, calc((100vw - 1180px) / 2 + 28px)); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--line); background: linear-gradient(rgba(8,11,16,0.55), rgba(8,11,16,0.9)); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); pointer-events: auto; animation: afl-copy .9s .6s both cubic-bezier(.16,1,.3,1); }
.afl .dhero-steps li { display: flex; gap: 16px; align-items: flex-start; padding: 22px 24px 26px 0; }
.afl .dhero-steps li + li { padding-left: 24px; border-left: 1px solid var(--line); }
.afl .dhero-steps b { flex: none; display: grid; place-items: center; width: 30px; height: 26px; border: 1px solid var(--line-strong); font: 500 11.5px/1 var(--mono); color: var(--cyan-ink); }
.afl .dhero-steps span { font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.afl .dhero-steps strong { display: block; margin-bottom: 4px; font: 500 15px/1.3 var(--ui); color: var(--ink); }
/* Home hero in the house style: Manrope headline with a teal serif accent, square teal button, underlined link */
.afl .home-scroll { position: relative; z-index: 5; pointer-events: none; }
.afl .home-scroll .hero-space { height: 100vh; height: 100dvh; }
.afl .home-scroll .home-sec { pointer-events: auto; z-index: 5; }
.afl .dhero-tag { display: flex; align-items: center; gap: 12px; padding: 0; border: 0; border-radius: 0; background: none; font: 600 10.5px/1 "DM Sans", var(--ui); letter-spacing: 0.22em; color: #d2dde3; }
.afl .dhero-tag::before { content: ""; width: 28px; height: 1px; background: #47c4b2; }
.afl .dhero h1 { margin-top: 24px; font: 500 clamp(44px, 4.8vw, 74px)/1 "Manrope", var(--ui); letter-spacing: -0.05em; }
.afl .dhero h1 em { font-family: "Playfair Display", Georgia, serif; font-style: italic; font-weight: 500; color: #47c4b2; letter-spacing: -0.02em; }
.afl .dhero p { font-family: "Manrope", var(--ui); font-size: 16px; color: #c7d0d5; }
.afl .dhero .actions { align-items: center; gap: 34px; margin-top: 34px; }
.afl .dhero .pill { display: inline-flex; align-items: center; gap: 18px; height: 52px; padding: 0 25px; border-radius: 0; background: #47c4b2; color: #081b2c; box-shadow: none; font: 600 12.5px/1 "DM Sans", var(--ui); letter-spacing: 0.03em; transition: background .2s, transform .2s; }
.afl .dhero .pill:hover { background: #6bd6c6; transform: translateY(-2px); }
.afl .dhero .pill svg.ar, .afl .nav .pill svg.ar { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; }
.afl .dhero .btn-line { padding: 0 0 6px; border: 0; border-bottom: 1px solid rgba(255,255,255,0.4); border-radius: 0; background: none; color: #fff; font: 500 12.5px/1 "DM Sans", var(--ui); }
.afl .dhero .btn-line::after { content: "\\2197"; color: #fff; }
.afl .dhero .btn-line:hover { border-color: #47c4b2; }
.afl .dhero-steps b { color: #47c4b2; }
.afl .dhero-steps strong { font-family: "Manrope", var(--ui); }
.afl .nav .pill { border-radius: 0; background: #47c4b2; color: #081b2c; font-family: "DM Sans", var(--ui); font-size: 12.5px; letter-spacing: 0.03em; padding: 14px 20px; }
.afl .nav .pill:hover { background: #6bd6c6; }
.afl .brand .word { font-family: "Manrope", var(--ui); letter-spacing: 0.16em; }
.afl .link::after { height: 1px; background: #47c4b2; }
@media (prefers-reduced-motion: reduce) { .afl .dhero-copy, .afl .dhero-steps, .afl .dhero h1, .afl .dhero .actions { animation: none !important; } }
@media (max-width: 1100px) {
.afl .dhero-copy { max-width: 46vw; margin-left: 40px; }
.afl .dhero h1 { font-size: clamp(38px, 5.2vw, 56px); }
.afl .dhero p { font-size: 15px; }
.afl .dhero #afl-bot { left: 70vw; width: min(40vh, 34vw); height: min(40vh, 34vw); }
.afl .dhero-steps li { padding: 18px 16px 20px 0; }
.afl .dhero-steps li + li { padding-left: 16px; }
.afl .dhero-steps span { font-size: 12.5px; }
}
@media (max-width: 980px) {
.afl .links { gap: 0; }
}
@media (max-width: 760px) {
.afl { --nav-h: 56px; }
.afl .nav { grid-template-columns: auto 1fr auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); gap: 8px; }
.afl .brand .word { font-size: 16px; }
.afl .links { justify-content: flex-end; }
.afl .link { font-size: 13px; padding: 0 10px; }
.afl .link::after { left: 10px; right: 10px; }
.afl .link.hide-sm { display: none; }
.afl .pill { padding: 11px 15px; font-size: 13.5px; }
}
@media (max-width: 520px) {
.afl .links { display: none; }
.afl .mlinks { display: flex; }
}
@media (max-width: 767px) {
.afl .dhero { display: flex; flex-direction: column; justify-content: flex-end; padding: 0 0 calc(12vh + env(safe-area-inset-bottom, 0px)); }
.afl .dhero #afl-bot { left: 50vw; top: calc(var(--nav-h) + 40vh); width: min(28vh, 56vw); height: min(28vh, 56vw); }
/* Phones: just the headline and the two buttons */
.afl .dhero-tag, .afl .dhero p { display: none; }
.afl .mlinks { display: none !important; }
.afl .dhero-copy { align-self: stretch; max-width: none; margin: 0; padding-left: max(20px, env(safe-area-inset-left, 0px)); padding-right: max(20px, env(safe-area-inset-right, 0px)); text-align: center; }
.afl .dhero-tag { font-size: 9.5px; justify-content: center; }
.afl .dhero h1 { margin-top: 0; font-size: clamp(17px, 5.4vw, 26px); line-height: 1.2; letter-spacing: -0.035em; white-space: nowrap; text-wrap: nowrap; }
/* the headline fades slowly into focus, then the buttons follow */
.afl .dhero-copy { animation: none; }
.afl .dhero h1 { animation: afl-fadein 1.8s .5s both cubic-bezier(.22,1,.36,1); }
.afl .dhero .actions { animation: afl-copy 1s 1.7s both cubic-bezier(.16,1,.3,1); }
.afl .dhero p { margin: 14px auto 0; font-size: 14.5px; line-height: 1.6; }
.afl .dhero .actions { margin-top: 22px; justify-content: center; gap: 22px; }
.afl .dhero .pill { height: 46px; padding: 0 20px; }
.afl .dhero-steps { display: none; }
}
`;

export default function IntroLanding({ onEnter }) {
  const rootRef = useRef(null);
  const apiRef = useRef(null);
  const [page, setPage] = useState('home');
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  const finish = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setTimeout(() => onEnter && onEnter(), 600);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    // The cube field and the particle assistant; if a canvas is missing, "Get started" goes straight in
    const root = rootRef.current;
    const botEl = root && root.querySelector('#afl-bot');
    const sceneEl = root && root.querySelector('#afl-scene');
    const bg = sceneEl ? startDotHero(sceneEl) : null;
    const bot = botEl ? startDotBot(botEl) : null;
    apiRef.current = {
      startExit: () => { if (bg) bg.exit(() => {}); if (bot) bot.exit(() => finishRef.current()); else finishRef.current(); },
      setHome: (v) => { if (bg) bg.setActive(v); if (bot) bot.setActive(v); },
    };
    return () => { if (bg) bg.dispose(); if (bot) bot.dispose(); };
  }, []);

  // On Home the template sections scroll up over the fixed hero; once they cover it, the top bar turns white
  // and the hero animations pause
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const onScroll = () => setCovered(root.scrollTop > root.clientHeight - 72);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (apiRef.current) apiRef.current.setHome(page === 'home' && !covered);
  }, [page, covered]);

  const scrollToSections = () => requestAnimationFrame(() => {
    const el = rootRef.current && rootRef.current.querySelector('#afl-figures');
    if (el) rootRef.current.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
  });
  const go = (p) => (e) => {
    e.preventDefault();
    if (p === 'overview') { setPage('home'); scrollToSections(); return; }
    setPage(p); setCovered(false);
    if (rootRef.current) rootRef.current.scrollTop = 0;
  };
  const cur = (p) => (p === 'overview' ? (page === 'home' && covered ? 'page' : undefined) : p === 'home' ? (page === 'home' && !covered ? 'page' : undefined) : (page === p ? 'page' : undefined));
  const enter = () => { if (apiRef.current) apiRef.current.startExit(); else finish(); };

  return (
    <div ref={rootRef} className={'afl' + (page !== 'home' ? ' page' : '') + (page === 'home' && covered ? ' lightnav' : '') + (leaving ? ' leaving' : '')}>
      <style>{CSS + TP_CSS}</style>
      <canvas id="afl-scene" aria-hidden="true"></canvas>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="afl-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100"><stop offset="0%" stopColor="#00f2fe"/><stop offset="100%" stopColor="#4facfe"/></linearGradient>
          <symbol id="afl-afa-mark" viewBox="0 0 100 100">
            <rect x="3" y="3" width="94" height="94" rx="26" fill="#0a0f1a" stroke="url(#afl-g)" strokeWidth="4"/>
            <path d="M27 74 L50 23 L73 74" stroke="url(#afl-g)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="50" cy="23" r="7.5" fill="#fff"/><circle cx="27" cy="74" r="6" fill="#00f2fe"/><circle cx="73" cy="74" r="6" fill="#00f2fe"/>
          </symbol>
          <symbol id="afl-i-yes" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.6L16 9.6"/></symbol>
          <symbol id="afl-i-no" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 12h6"/></symbol>
        </defs>
      </svg>

      <header className="nav">
        <a className="brand afl-brand" href="#" onClick={go('home')} translate="no" aria-label="A.F.A. home"><svg aria-hidden="true"><use href="#afl-afa-mark"/></svg><span className="word">A.F.A.</span></a>
        <nav className="links" aria-label="Main">
          <a className="link hide-sm" href="#" onClick={go('home')} aria-current={cur('home')}>Home</a>
          <a className="link hide-sm" href="#overview" onClick={go('overview')} aria-current={cur('overview')}>Overview</a>
          <a className="link" href="#why-afa" onClick={go('why-afa')} aria-current={cur('why-afa')}>Why A.F.A.</a>
          <a className="link" href="#features" onClick={go('features')} aria-current={cur('features')}>Features</a>
        </nav>
        <div className="cta-wrap"><button className="pill" type="button" onClick={enter}>Log in</button></div>
      </header>

      {/* Home */}
      <div className="home-text">
        <section className="dhero" aria-label="A.F.A.">
            <canvas id="afl-bot" aria-hidden="true"></canvas>
            <div className="dhero-copy">
              <div className="dhero-tag">Meet A.F.A. · your money sidekick</div>
              <h1>Your Personal <em>Financial</em> Assistant</h1>
              <p>Log what comes in and what goes out. A.F.A. turns it into a score, a story and a plan, explains every number, and nudges you toward your next smart move, from saving and tax to your very first investment.</p>
              <div className="actions"><button className="pill" type="button" onClick={enter}>Get started <svg className="ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></button><a className="btn-line" href="#overview" onClick={go('overview')}>See how it works</a></div>
            </div>
            <ol className="dhero-steps" aria-label="How A.F.A. works">
              <li><b>01</b><span><strong>Record</strong>Income and spending across 38 categories.</span></li>
              <li><b>02</b><span><strong>Review</strong>Your financial health, savings rate and net worth.</span></li>
              <li><b>03</b><span><strong>Act</strong>A ranked plan for this month, with the reasons shown.</span></li>
            </ol>
        </section>
        <nav className="mlinks" aria-label="About A.F.A.">
          <a href="#overview" onClick={go('overview')}>Overview</a>
          <a href="#why-afa" onClick={go('why-afa')}>Why A.F.A.</a>
          <a href="#features" onClick={go('features')}>Features</a>
        </nav>
      </div>

      {page === 'home' && <div className="home-scroll"><div className="hero-space" aria-hidden="true" /><HomeSections go={go} enter={enter} /></div>}
      <TemplatePages page={page} go={go} enter={enter} />
    </div>
  );
}
