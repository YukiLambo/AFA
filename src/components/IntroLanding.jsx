import React, { useEffect, useRef, useState } from 'react';
import { startLandingScene } from '../lib/landingScene';

// Entry screen: the light-pour animation plus the Overview / Why A.F.A. / Features pages.
// "Get started" brightens the scene, fades this screen out and calls onEnter().
const CSS = `
.afl { position: fixed; inset: 0; z-index: 60; overflow: hidden; transition: opacity .6s ease; }
.afl.leaving { opacity: 0; pointer-events: none; }
.afl *, .afl *::before, .afl *::after { box-sizing: border-box; }
.afl { --bg: #0b0f15;
  --panel: rgba(18, 24, 32, 0.72);
  --panel-solid: #121820;
  --ink: #eef5fa;
  --muted: #8fa3b4;
  --soft: #b9c8d4;
  --cyan: #00f2fe;
  --blue: #4facfe;
  --line: rgba(190, 235, 255, 0.10);
  --line-strong: rgba(190, 235, 255, 0.18);
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --ui: "Montserrat", "Inter", "Segoe UI", system-ui, sans-serif;
  --sans: "Inter", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  color-scheme: dark; }
.afl.page { overflow-y: auto; }
.afl #afl-scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; transition: opacity .5s ease; }
.afl.page #afl-scene { opacity: 0; pointer-events: none; }
.afl .nav { position: fixed; z-index: 10; top: calc(18px + env(safe-area-inset-top, 0px)); left: max(24px, env(safe-area-inset-left, 0px)); right: max(24px, env(safe-area-inset-right, 0px));
  max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; padding: 10px 10px 10px 22px; border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)); border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px) saturate(1.3); -webkit-backdrop-filter: blur(14px) saturate(1.3); box-shadow: 0 20px 50px -34px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07); }
.afl .brand { justify-self: start; display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.afl .brand svg { width: 30px; height: 30px; display: block; }
.afl .brand .word { font: 600 19px/1 var(--ui); letter-spacing: 0.06em; }
.afl .brand svg { transition: filter .4s ease; }
.afl .brand.absorb svg { animation: afl-absorb .9s cubic-bezier(.16,1,.3,1); }
@keyframes afl-absorb { 0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(0,242,254,0)); } 30% { transform: scale(1.22); filter: drop-shadow(0 0 16px rgba(0,242,254,0.95)); } 100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(0,242,254,0.35)); } }
.afl .links { display: flex; align-items: center; gap: 4px; }
.afl .link { font: 500 14.5px/1 var(--ui); color: rgba(226, 236, 244, 0.85); text-decoration: none; padding: 12px 17px; border-radius: 11px; transition: background .2s, color .2s; }
.afl .link:hover, .afl .link:focus-visible { background: rgba(255,255,255,0.07); color: #fff; outline: none; }
.afl .link[aria-current="page"] { background: rgba(255, 255, 255, 0.12); color: #fff; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), inset 0 1px 0 rgba(255,255,255,0.12); }
.afl .cta-wrap { justify-self: end; }
.afl .pill { font: 600 14.5px/1 var(--ui); color: #e6fdff; background: linear-gradient(90deg, rgba(0, 242, 254, 0.20), rgba(79, 172, 254, 0.20)); border: 0; border-radius: 11px; padding: 14px 22px; cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 242, 254, 0.45), inset 0 1px 0 rgba(255,255,255,0.15), 0 10px 30px -14px rgba(0, 242, 254, 0.7); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: transform .2s, box-shadow .2s, background .2s; }
.afl .pill:hover, .afl .pill:focus-visible { transform: translateY(-1px); background: linear-gradient(90deg, rgba(0, 242, 254, 0.30), rgba(79, 172, 254, 0.30)); box-shadow: inset 0 0 0 1px rgba(0, 242, 254, 0.7), inset 0 1px 0 rgba(255,255,255,0.2), 0 14px 34px -12px rgba(0, 242, 254, 0.9); outline: none; }
.afl .pill:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.afl .btn-line { font: 500 15px/1 var(--ui); color: var(--ink); background: rgba(255,255,255,0.03); border: 1px solid var(--line-strong); border-radius: 10px; padding: 14px 22px; cursor: pointer; text-decoration: none; display: inline-block; transition: border-color .2s, background .2s; }
.afl .btn-line:hover, .afl .btn-line:focus-visible { border-color: rgba(0, 242, 254, 0.5); background: rgba(0, 242, 254, 0.06); outline: none; }
.afl .home-text { transition: opacity .4s ease; }
.afl .mlinks { display: none; position: fixed; z-index: 4; left: 0; right: 0; bottom: calc(7vh + env(safe-area-inset-bottom, 0px)); justify-content: center; gap: 6px; }
.afl .mlinks a { font: 500 13px/1 var(--ui); color: rgba(226, 236, 244, 0.7); text-decoration: none; padding: 12px 12px; border-radius: 10px; }
.afl .mlinks a:active { background: rgba(255, 255, 255, 0.06); }
.afl.page .home-text { opacity: 0; pointer-events: none; }
.afl .headline { position: fixed; z-index: 4; left: 0; right: 0; bottom: calc(15vh + env(safe-area-inset-bottom, 0px)); margin: 0; text-align: center;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  font: 400 clamp(17px, 2.3vw, 34px)/1.5 var(--ui); letter-spacing: 0.42em; text-indent: 0.42em; text-transform: uppercase; color: #eef5fa;
  opacity: 0; transition: opacity .3s ease; }
.afl .headline.on { opacity: 1; }
.afl .headline .ch { display: inline-block; text-align: center; text-indent: 0; opacity: 0; transition: color .9s ease, text-shadow .9s ease, opacity .15s ease; }
.afl .headline .ch.live { opacity: 1; color: #8ff9ff; text-shadow: 0 0 14px rgba(0, 242, 254, 0.9), 0 0 2px rgba(0, 242, 254, 1); }
.afl .headline .ch.done { color: #eef5fa; text-shadow: 0 0 18px rgba(0, 242, 254, 0.18); }
.afl .view { display: none; position: relative; z-index: 2; min-height: 100%; overflow: hidden; }
.afl .view.on { display: block; animation: afl-rise .7s cubic-bezier(.16,1,.3,1); }
@keyframes afl-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.afl .view::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 900px; z-index: -1; pointer-events: none;
  background: radial-gradient(55% 60% at 82% 8%, rgba(0, 242, 254, 0.11), transparent 70%), radial-gradient(45% 50% at 8% 0%, rgba(79, 172, 254, 0.09), transparent 70%),
    linear-gradient(rgba(190,235,255,0.035) 1px, transparent 1px) 0 0 / 100% 72px; -webkit-mask-image: linear-gradient(#000 40%, transparent); mask-image: linear-gradient(#000 40%, transparent); }
.afl .wrap { max-width: 1140px; margin: 0 auto; padding-left: max(24px, env(safe-area-inset-left, 0px)); padding-right: max(24px, env(safe-area-inset-right, 0px)); }
.afl .hero { padding-block: calc(160px + env(safe-area-inset-top, 0px)) 72px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 56px; align-items: center; }
.afl .hero.single { grid-template-columns: minmax(0, 1fr); }
.afl .eyebrow { display: inline-flex; align-items: center; gap: 10px; font: 500 12px/1 var(--ui); letter-spacing: 0.16em; text-transform: uppercase; color: var(--cyan); }
.afl .eyebrow::before { content: ""; width: 22px; height: 1px; background: linear-gradient(90deg, transparent, var(--cyan)); }
.afl .hero h1 { margin: 20px 0 0; font: 400 clamp(40px, 5.2vw, 70px)/1.04 var(--serif); letter-spacing: -0.022em; text-wrap: balance; }
.afl .hero .lede { margin: 22px 0 0; max-width: 54ch; font-size: 17px; line-height: 1.7; color: var(--soft); }
.afl .hero .actions { margin-top: 34px; display: flex; gap: 12px; flex-wrap: wrap; }
.afl .mock { position: relative; border-radius: 20px; padding: 26px; background: linear-gradient(180deg, rgba(24, 32, 42, 0.92), rgba(14, 19, 26, 0.92)); border: 1px solid var(--line-strong);
  box-shadow: 0 40px 80px -40px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,242,254,0.04) inset; }
.afl .mock::before { content: ""; position: absolute; inset: -1px; border-radius: 20px; padding: 1px; background: linear-gradient(140deg, rgba(0,242,254,0.5), transparent 40%, transparent 70%, rgba(79,172,254,0.35));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
.afl .mock-top { display: flex; justify-content: space-between; align-items: center; }
.afl .mock-label { font: 500 11px/1 var(--ui); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.afl .mock-tag { font: 500 10.5px/1 var(--ui); letter-spacing: 0.08em; color: #071318; background: var(--cyan); border-radius: 999px; padding: 5px 9px; }
.afl .gauge { display: flex; align-items: center; gap: 20px; margin: 18px 0 20px; }
.afl .gauge svg { width: 104px; height: 104px; flex: none; }
.afl .gauge b { display: block; font: 400 44px/1 var(--serif); font-variant-numeric: tabular-nums; }
.afl .gauge span { font-size: 13px; color: var(--muted); }
.afl .rows { display: grid; gap: 0; border-top: 1px solid var(--line); }
.afl .row { display: flex; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--line); font-size: 14px; color: var(--soft); }
.afl .row b { font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }
.afl .next { margin-top: 16px; display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 12px; background: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.18); font-size: 13.5px; line-height: 1.5; color: var(--soft); }
.afl .next i { flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 10px var(--cyan); }
.afl .mock-note { margin-top: 12px; font-size: 11.5px; color: var(--muted); }
.afl .section { padding-block: 72px; border-top: 1px solid var(--line); }
.afl .section-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: end; margin-bottom: 40px; }
.afl .section-head h2 { margin: 14px 0 0; font: 400 clamp(30px, 3.2vw, 42px)/1.1 var(--serif); letter-spacing: -0.015em; }
.afl .section-head p { margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.7; max-width: 52ch; }
.afl .timeline { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
.afl .timeline::before { content: ""; position: absolute; top: 19px; left: 20px; right: 20px; height: 1px; background: linear-gradient(90deg, var(--cyan), rgba(79,172,254,0.4), transparent); }
.afl .tstep { position: relative; }
.afl .node { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--panel-solid); border: 1px solid rgba(0,242,254,0.45); font: 500 13px/1 var(--ui); color: var(--cyan); box-shadow: 0 0 0 6px var(--bg); position: relative; }
.afl .tstep h3 { margin: 22px 0 8px; font: 500 19px/1.3 var(--ui); }
.afl .tstep p { margin: 0; color: var(--soft); font-size: 14.5px; line-height: 1.65; max-width: 34ch; }
.afl .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 18px; background: var(--panel); overflow: hidden; }
.afl .stat { padding: 30px 28px; border-right: 1px solid var(--line); }
.afl .stat:last-child { border-right: 0; }
.afl .stat b { display: block; font: 400 46px/1 var(--serif); font-variant-numeric: tabular-nums; background: linear-gradient(180deg, #ffffff, #b9dce9); -webkit-background-clip: text; background-clip: text; color: transparent; }
.afl .stat span { display: block; margin-top: 12px; font-size: 13.5px; line-height: 1.5; color: var(--muted); }
.afl .cards { display: grid; gap: 18px; }
.afl .cards.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .cards.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.afl .card { position: relative; padding: 28px; border-radius: 18px; background: linear-gradient(180deg, rgba(22, 29, 38, 0.78), rgba(13, 18, 25, 0.78)); border: 1px solid var(--line); transition: border-color .25s, transform .25s; }
.afl .card:hover { border-color: rgba(0, 242, 254, 0.28); transform: translateY(-2px); }
.afl .icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: rgba(0, 242, 254, 0.07); border: 1px solid rgba(0, 242, 254, 0.2); }
.afl .icon svg { width: 22px; height: 22px; stroke: var(--cyan); fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.afl .card h3 { margin: 20px 0 8px; font: 500 19px/1.3 var(--ui); }
.afl .card p { margin: 0; color: var(--soft); font-size: 14.5px; line-height: 1.65; }
.afl .card .meta { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 6px; }
.afl .card .meta span { font: 500 11.5px/1 var(--ui); color: var(--muted); border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 10px; }
.afl .group { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 40px; padding-block: 40px; border-top: 1px solid var(--line); }
.afl .group:first-child { border-top: 0; padding-top: 0; }
.afl .group-head h3 { margin: 12px 0 8px; font: 400 26px/1.15 var(--serif); }
.afl .group-head p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
.afl .compare-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); }
.afl .compare { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 14.5px; }
.afl .compare th, .afl .compare td { text-align: left; padding: 18px 22px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.afl .compare tr:last-child td { border-bottom: 0; }
.afl .compare th { font: 500 12px/1.2 var(--ui); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.afl .compare th.afa, .afl .compare td.afa { background: rgba(0, 242, 254, 0.05); }
.afl .compare th.afa { color: var(--cyan); }
.afl .compare td:first-child { color: var(--ink); font-weight: 500; }
.afl .compare td { color: var(--soft); }
.afl .compare .mark { display: inline-flex; align-items: center; gap: 10px; }
.afl .compare .mark svg { width: 18px; height: 18px; flex: none; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.afl .compare .yes svg { stroke: var(--cyan); }
.afl .compare .no svg { stroke: #5d6e7d; }
.afl .note { font-size: 12.5px; color: var(--muted); line-height: 1.6; margin-top: 16px; }
.afl .closing { margin-block: 24px 96px; position: relative; border-radius: 24px; padding: 56px; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap;
  background: radial-gradient(70% 120% at 100% 0%, rgba(0,242,254,0.16), transparent 60%), linear-gradient(180deg, rgba(22, 30, 40, 0.95), rgba(13, 18, 25, 0.95)); border: 1px solid var(--line-strong); }
.afl .closing h2 { margin: 0; font: 400 clamp(28px, 3vw, 40px)/1.12 var(--serif); max-width: 18em; letter-spacing: -0.015em; }
.afl .closing p { margin: 10px 0 0; color: var(--muted); font-size: 15px; }
.afl .foot { padding-block: 28px 40px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); }
.afl .app { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; background: var(--bg); opacity: 0; pointer-events: none; transition: opacity .7s ease;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.afl .app.on { opacity: 1; pointer-events: auto; }
.afl .app .box { text-align: center; display: grid; gap: 14px; justify-items: center; max-width: 400px; }
.afl .app h2 { margin: 0; font: 400 28px/1.15 var(--serif); }
.afl .app p { margin: 0; color: var(--muted); line-height: 1.6; font-size: 14px; }
@media (max-width: 980px) {
.afl .hero { grid-template-columns: minmax(0, 1fr); }
.afl .section-head { grid-template-columns: minmax(0, 1fr); gap: 14px; }
.afl .cards.three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .group { grid-template-columns: minmax(0, 1fr); gap: 20px; }
.afl .links { gap: 2px; }
}
@media (max-width: 760px) {
.afl .nav { grid-template-columns: auto 1fr auto; left: max(12px, env(safe-area-inset-left, 0px)); right: max(12px, env(safe-area-inset-right, 0px)); top: calc(12px + env(safe-area-inset-top, 0px)); padding: 8px 8px 8px 14px; gap: 8px; }
.afl .brand svg { width: 28px; height: 28px; }
.afl .brand .word { font-size: 17px; }
.afl .links { justify-content: flex-end; gap: 2px; }
.afl .link { font-size: 13px; padding: 10px 11px; }
.afl .link.hide-sm { display: none; }
.afl .pill { padding: 11px 15px; font-size: 14px; }
.afl .headline { bottom: calc(13vh + env(safe-area-inset-bottom, 0px)); letter-spacing: 0.3em; text-indent: 0.3em; font-size: 16px; }
.afl .hero { padding-block: calc(120px + env(safe-area-inset-top, 0px)) 48px; gap: 36px; }
.afl .timeline, .afl .cards.two, .afl .cards.three, .afl .stats { grid-template-columns: minmax(0, 1fr); }
.afl .timeline::before { display: none; }
.afl .stat { border-right: 0; border-bottom: 1px solid var(--line); }
.afl .stat:last-child { border-bottom: 0; }
.afl .closing { padding: 32px; }
.afl .section { padding-block: 52px; }
}
@media (max-width: 520px) {
.afl .links { display: none; }
.afl .mlinks { display: flex; }
.afl .headline { bottom: calc(17vh + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion: reduce) {
.afl .view.on { animation: none; }
.afl .card:hover { transform: none; }
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
    const api = startLandingScene(rootRef.current, { onEnter: () => finishRef.current() });
    apiRef.current = api;
    return () => api.dispose();
  }, []);

  useEffect(() => {
    if (apiRef.current) apiRef.current.setHome(page === 'home');
    if (rootRef.current) rootRef.current.scrollTop = 0;
  }, [page]);

  const go = (p) => (e) => { e.preventDefault(); setPage(p); };
  const cur = (p) => (page === p ? 'page' : undefined);
  const view = (p) => 'view' + (page === p ? ' on' : '');
  const enter = () => { if (apiRef.current) apiRef.current.startExit(); else finish(); };

  return (
    <div ref={rootRef} className={'afl' + (page !== 'home' ? ' page' : '') + (leaving ? ' leaving' : '')}>
      <style>{CSS}</style>
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
        <div className="cta-wrap"><button className="pill" type="button" onClick={enter}>Get started</button></div>
      </header>

      {/* Home */}
      <div className="home-text">
        <h1 className="headline" id="afl-headline" aria-label="Your personal financial assistant"></h1>
        <nav className="mlinks" aria-label="About A.F.A.">
          <a href="#overview" onClick={go('overview')}>Overview</a>
          <a href="#why-afa" onClick={go('why-afa')}>Why A.F.A.</a>
          <a href="#features" onClick={go('features')}>Features</a>
        </nav>
      </div>

      {/* Overview */}
      <main className={view('overview')} aria-label="Overview">
        <div className="wrap">
          <section className="hero">
            <div>
              <div className="eyebrow">Overview</div>
              <h1>A complete view of your finances, in one place</h1>
              <p className="lede">A.F.A. brings together your spending, savings, MPF, debts and investments, and turns them into a clear, prioritised plan. Every figure and recommendation comes with an explanation.</p>
              <div className="actions"><button className="pill" type="button" onClick={enter}>Get started</button><a className="btn-line" href="#features" onClick={go('features')}>Explore features</a></div>
            </div>
            <aside className="mock" aria-label="Example dashboard">
              <div className="mock-top"><span className="mock-label">Financial health</span><span className="mock-tag">Example</span></div>
              <div className="gauge">
                <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="rgba(190,235,255,0.1)" strokeWidth="9"/><circle cx="60" cy="60" r="50" fill="none" stroke="url(#afl-g)" strokeWidth="9" strokeLinecap="round" strokeDasharray="245 314" transform="rotate(-90 60 60)"/></svg>
                <div><b>78</b><span>Health Index out of 100</span></div>
              </div>
              <div className="rows">
                <div className="row"><span>Savings rate</span><b>24%</b></div>
                <div className="row"><span>Emergency fund</span><b>4.2 months</b></div>
                <div className="row"><span>Net worth</span><b>HK$186,400</b></div>
              </div>
              <div className="next"><i></i><span><strong style={{ color: "var(--ink)", fontWeight: 500 }}>Next action:</strong> a HK$60,000 TVC contribution could lower this year's salaries tax.</span></div>
              <div className="mock-note">Illustrative figures for a sample user.</div>
            </aside>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">How it works</div><h2>From your first record to a plan you can act on</h2></div><p>A.F.A. learns from what you record and updates your position and priorities as your finances change.</p></div>
            <div className="timeline">
              <div className="tstep"><div className="node">01</div><h3>Record</h3><p>Log income and spending across 38 Hong Kong categories, from Octopus top-ups to rent. Salary, rent and subscriptions can repeat automatically.</p></div>
              <div className="tstep"><div className="node">02</div><h3>Review</h3><p>See your Health Index, savings rate, emergency-fund cover and net worth across cash, stocks, crypto and other assets.</p></div>
              <div className="tstep"><div className="node">03</div><h3>Act</h3><p>Follow a personal action plan that sets out this month's priorities, from reducing card debt to claiming TVC tax relief.</p></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">At a glance</div><h2>The scope of the platform</h2></div><p>Built and tested around Hong Kong data, with every amount shown in Hong Kong dollars.</p></div>
            <div className="stats">
              <div className="stat"><b>38</b><span>spending and income categories</span></div>
              <div className="stat"><b>12</b><span>technical indicators tested on market data</span></div>
              <div className="stat"><b>45</b><span>Hang Seng constituents in the rating study</span></div>
              <div className="stat"><b>HKD</b><span>for every figure, including US stocks and crypto</span></div>
            </div>
          </section>

          <section className="closing"><div><h2>Create your account and see your own numbers.</h2><p>It takes a minute to set up.</p></div><button className="pill" type="button" onClick={enter}>Get started</button></section>
          <footer className="foot"><span>A.F.A. · Automated Financial Assistant</span><span>Educational information only, not licensed financial advice.</span></footer>
        </div>
      </main>

      {/* Why A.F.A. */}
      <main className={view('why-afa')} aria-label="Why A.F.A.">
        <div className="wrap">
          <section className="hero single">
            <div>
              <div className="eyebrow">Why A.F.A.</div>
              <h1>Designed around the Hong Kong financial system</h1>
              <p className="lede">General budgeting apps do not account for MPF, salaries tax or HKEX-listed securities. A.F.A. is built around how young professionals in Hong Kong earn, spend and invest.</p>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">Principles</div><h2>Four principles behind the platform</h2></div><p>Each one shapes how A.F.A. calculates, explains and protects your information.</p></div>
            <div className="cards two">
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg></div><h3>Local by design</h3><p>HKD throughout, MPF contributions, TVC tax savings on the progressive salaries tax bands, and live quotes for HKEX and US stocks.</p></div>
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></div><h3>Transparent recommendations</h3><p>The AI assistant explains each recommendation, and every rating shows the method and data behind it.</p></div>
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 5-6"/></svg></div><h3>Evidence-based analysis</h3><p>Stock ratings are validated against several years of Hang Seng and US market data, and the platform reports how reliable they have been.</p></div>
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div><h3>Private and secure</h3><p>Your records are stored in your own account and are not shared with other users. Simulated trading lets you practise before committing real capital.</p></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">Comparison</div><h2>How A.F.A. compares</h2></div><p>Compared with a general-purpose budgeting app.</p></div>
            <div className="compare-wrap">
              <table className="compare">
                <thead><tr><th>Capability</th><th>Typical budgeting app</th><th className="afa">A.F.A.</th></tr></thead>
                <tbody>
                  <tr><td>MPF and TVC tax relief</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Not covered</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Calculated from your income</span></td></tr>
                  <tr><td>Hong Kong stocks</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Limited, often USD only</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>HKEX quotes, charts and ratings in HKD</span></td></tr>
                  <tr><td>Warrants and CBBCs</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Not covered</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Simulated trading with gearing and call-level alerts</span></td></tr>
                  <tr><td>Recommended next steps</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Charts only</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>A ranked personal action plan</span></td></tr>
                  <tr><td>Explanation of figures</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Not shown</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Methods and AI explanations</span></td></tr>
                </tbody>
              </table>
            </div>
            <p className="note">A.F.A. provides educational information and examples. It is not licensed investment advice.</p>
          </section>

          <section className="closing"><div><h2>Built for the way Hong Kong manages money.</h2><p>Create your account to get started.</p></div><button className="pill" type="button" onClick={enter}>Get started</button></section>
          <footer className="foot"><span>A.F.A. · Automated Financial Assistant</span><span>Educational information only, not licensed financial advice.</span></footer>
        </div>
      </main>

      {/* Features */}
      <main className={view('features')} aria-label="Features">
        <div className="wrap">
          <section className="hero single">
            <div>
              <div className="eyebrow">Features</div>
              <h1>Everything in one platform</h1>
              <p className="lede">Tools for everyday budgeting, long-term planning and investment research, brought together in a single assistant.</p>
            </div>
          </section>

          <section className="section">
            <div className="group">
              <div className="group-head"><div className="eyebrow">Everyday</div><h3>Manage your money</h3><p>Record, review and act on your monthly finances.</p></div>
              <div className="cards three">
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div><h3>Transaction recorder</h3><p>Log income and spending in a few taps, with a keypad on phones.</p><div className="meta"><span>38 categories</span><span>Repeating entries</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/></svg></div><h3>Health Index</h3><p>One score for savings rate, rent burden and investing, with alerts for unusual spending.</p><div className="meta"><span>Emergency fund</span><span>Spending alerts</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg></div><h3>Personal action plan</h3><p>This month's priorities, ranked and explained by the AI assistant.</p><div className="meta"><span>Goal-based</span><span>Risk profile</span></div></div>
              </div>
            </div>
            <div className="group">
              <div className="group-head"><div className="eyebrow">Planning</div><h3>Plan ahead</h3><p>Debt, retirement savings, tax and net worth.</p></div>
              <div className="cards three">
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-8"/><path d="M14 7h6v6"/></svg></div><h3>Debt payoff planner</h3><p>See your debt-free date with the avalanche or snowball method, month by month.</p><div className="meta"><span>Interest saved</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg></div><h3>MPF and salaries tax</h3><p>Mandatory contributions, TVC top-ups and the tax they save, on progressive and standard rates.</p><div className="meta"><span>TVC relief</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg></div><h3>Net worth</h3><p>Bonds, crypto, deposits and other assets alongside your portfolio.</p><div className="meta"><span>Live crypto prices</span></div></div>
              </div>
            </div>
            <div className="group">
              <div className="group-head"><div className="eyebrow">Investing</div><h3>Research and practise</h3><p>Analyse markets and trade with simulated capital.</p></div>
              <div className="cards three">
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7"/></svg></div><h3>Simulated trading</h3><p>Practise on HK and US stocks, warrants and CBBCs, with fees and FX included.</p><div className="meta"><span>Call-level alerts</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><path d="M8 12l2-2 2 2 2-3"/></svg></div><h3>Stock analysis</h3><p>Indicators, valuation and a buy, hold or sell plan with entry, target and stop prices.</p><div className="meta"><span>12 indicators</span><span>DCF and P/E</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/></svg></div><h3>Market news</h3><p>Live headlines, plus company news scored for sentiment in each stock's analysis.</p><div className="meta"><span>Auto-refresh</span></div></div>
              </div>
            </div>
          </section>

          <section className="closing"><div><h2>See every feature with your own numbers.</h2><p>Create your account to get started.</p></div><button className="pill" type="button" onClick={enter}>Get started</button></section>
          <footer className="foot"><span>A.F.A. · Automated Financial Assistant</span><span>Educational information only, not licensed financial advice.</span></footer>
        </div>
      </main>
    </div>
  );
}
