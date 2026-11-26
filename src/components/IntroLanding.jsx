import React, { useEffect, useRef, useState } from 'react';
import { startDotHero } from '../lib/dotHero';
import { startDotBot } from '../lib/dotBot';

// Entry screen: the minting animation plus the Overview / Why A.F.A. / Features pages.
// "Get started" flies the coin into the logo, fades this screen out and calls onEnter().
const CSS = `
.afl { position: fixed; inset: 0; z-index: 60; overflow: hidden; transition: opacity .6s ease; }
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
.afl .view { display: none; position: relative; z-index: 2; min-height: 100%; overflow: hidden; }
.afl .view.on { display: block; animation: afl-rise .6s cubic-bezier(.16,1,.3,1); }
@keyframes afl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.afl .view::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 760px; z-index: -1; pointer-events: none;
  background: linear-gradient(90deg, rgba(200,225,240,0.035) 1px, transparent 1px) 0 0 / calc(100% / 12) 100%;
  -webkit-mask-image: linear-gradient(#000 30%, transparent); mask-image: linear-gradient(#000 30%, transparent); }
.afl .wrap { max-width: 1180px; margin: 0 auto; padding-left: max(28px, env(safe-area-inset-left, 0px)); padding-right: max(28px, env(safe-area-inset-right, 0px)); }

/* Editorial heads */
.afl .hero { padding-block: calc(150px + env(safe-area-inset-top, 0px)) 80px; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 64px; align-items: center; }
.afl .hero.single { grid-template-columns: minmax(0, 1fr); padding-bottom: 56px; }
.afl .hero.single h1 { max-width: 16em; }
.afl .eyebrow { display: inline-flex; align-items: center; gap: 12px; font: 500 11.5px/1 var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--cyan-ink); }
.afl .eyebrow::before { content: ""; width: 28px; height: 1px; background: var(--cyan-ink); }
.afl .hero h1 { margin: 22px 0 0; font: 400 clamp(40px, 5vw, 68px)/1.04 var(--serif); letter-spacing: -0.024em; text-wrap: balance; }
.afl .hero .lede { margin: 24px 0 0; max-width: 54ch; font-size: 17px; line-height: 1.7; color: var(--soft); }
.afl .hero .actions { margin-top: 34px; display: flex; gap: 12px; flex-wrap: wrap; }

/* Terminal-style panel */
.afl .term { border: 1px solid var(--line-strong); border-radius: 4px; background: var(--panel); font-variant-numeric: tabular-nums; box-shadow: 0 40px 80px -50px rgba(0,0,0,0.9); }
.afl .term-bar { display: flex; justify-content: space-between; align-items: center; height: 36px; padding: 0 14px; border-bottom: 1px solid var(--line); font: 500 11px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.afl .term-bar .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--up); margin-right: 8px; vertical-align: 1px; }
.afl .term-bar .tag { color: var(--cyan-ink); border: 1px solid rgba(0,242,254,0.35); padding: 4px 7px; border-radius: 2px; }
.afl .term-kpis { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--line); }
.afl .term-kpis > div { padding: 18px 16px 16px; }
.afl .term-kpis > div + div { border-left: 1px solid var(--line); }
.afl .term-kpis label { display: block; font: 500 10.5px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.afl .term-kpis b { display: block; margin-top: 12px; font: 400 38px/1 var(--serif); letter-spacing: -0.01em; color: var(--ink); }
.afl .term-kpis b small { font: 400 15px/1 var(--mono); color: var(--muted); margin-left: 4px; letter-spacing: 0; }
.afl .term-kpis em { display: block; margin-top: 10px; font: 500 11.5px/1 var(--mono); font-style: normal; color: var(--up); }
.afl .term-chart { padding: 14px 16px 6px; border-bottom: 1px solid var(--line); }
.afl .term-chart svg { width: 100%; height: 86px; display: block; }
.afl .term-axis { display: flex; justify-content: space-between; padding-top: 6px; font: 500 10px/1 var(--mono); letter-spacing: 0.08em; color: #5e6d7b; }
.afl .term-rows { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.afl .term-rows td { padding: 11px 16px; border-bottom: 1px solid var(--line); color: var(--soft); }
.afl .term-rows td:last-child { text-align: right; font: 500 13px/1 var(--mono); color: var(--ink); }
.afl .term-rows td.ok:last-child::after { content: " \\25B2"; color: var(--up); font-size: 9px; }
.afl .next { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; padding: 14px 16px; border-left: 2px solid var(--cyan); background: rgba(0, 242, 254, 0.04); font-size: 13.5px; line-height: 1.5; color: var(--soft); }
.afl .next .k { font: 500 10.5px/1.5 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--cyan-ink); padding-top: 2px; }
.afl .mock-note { padding: 10px 16px; border-top: 1px solid var(--line); font: 400 11px/1.4 var(--mono); color: #5e6d7b; }

/* Sections */
.afl .section { padding-block: 80px; border-top: 1px solid var(--line); }
.afl .section-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: end; margin-bottom: 44px; }
.afl .section-head h2 { margin: 16px 0 0; font: 400 clamp(30px, 3.2vw, 44px)/1.08 var(--serif); letter-spacing: -0.018em; text-wrap: balance; }
.afl .section-head p { margin: 0; color: var(--muted); font-size: 15.5px; line-height: 1.7; max-width: 52ch; }

/* How it works: ruled columns */
.afl .timeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border-top: 1px solid var(--line-strong); }
.afl .tstep { position: relative; padding: 26px 28px 8px 0; }
.afl .tstep + .tstep { padding-left: 28px; border-left: 1px solid var(--line); }
.afl .tstep::before { content: ""; position: absolute; top: -1px; left: 0; width: 48px; height: 2px; background: var(--cyan); }
.afl .tstep + .tstep::before { left: 28px; }
.afl .node { font: 500 12px/1 var(--mono); letter-spacing: 0.12em; color: var(--cyan-ink); }
.afl .node::after { content: " / STEP"; color: #5e6d7b; }
.afl .tstep h3 { margin: 18px 0 10px; font: 400 28px/1.15 var(--serif); letter-spacing: -0.01em; }
.afl .tstep p { margin: 0; color: var(--soft); font-size: 14.5px; line-height: 1.7; max-width: 36ch; }

/* Key figures */
.afl .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line); }
.afl .stat { padding: 28px 24px 30px 0; }
.afl .stat + .stat { padding-left: 24px; border-left: 1px solid var(--line); }
.afl .stat b { display: block; font: 400 52px/1 var(--serif); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
.afl .stat span { display: block; margin-top: 14px; font: 500 11.5px/1.6 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); max-width: 26ch; }

/* Cards: squared, indexed, no icon tiles */
.afl .cards { display: grid; gap: 0; counter-reset: afl-card; border-top: 1px solid var(--line-strong); }
.afl .cards.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .cards.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.afl .card { position: relative; padding: 26px 26px 30px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); background: transparent; transition: background .25s; }
.afl .cards.two .card:nth-child(2n), .afl .cards.three .card:nth-child(3n) { border-right: 0; }
.afl .card:hover { background: rgba(200, 225, 240, 0.025); }
.afl .card::before { counter-increment: afl-card; content: counter(afl-card, decimal-leading-zero); font: 500 11.5px/1 var(--mono); letter-spacing: 0.1em; color: var(--cyan-ink); }
.afl .card::after { content: ""; position: absolute; top: -1px; left: 0; width: 0; height: 2px; background: var(--cyan); transition: width .3s ease; }
.afl .card:hover::after { width: 100%; }
.afl .icon { display: none; }
.afl .card h3 { margin: 16px 0 10px; font: 500 18px/1.3 var(--ui); letter-spacing: -0.005em; }
.afl .card p { margin: 0; color: var(--soft); font-size: 14.5px; line-height: 1.65; }
.afl .card .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 4px 0; }
.afl .card .meta span { font: 500 10.5px/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding-right: 10px; margin-right: 10px; border-right: 1px solid var(--line-strong); }
.afl .card .meta span:last-child { border-right: 0; }
.afl .group { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 48px; padding-block: 48px; border-top: 1px solid var(--line); }
.afl .group:first-child { border-top: 0; padding-top: 0; }
.afl .group-head h3 { margin: 14px 0 10px; font: 400 28px/1.12 var(--serif); letter-spacing: -0.01em; }
.afl .group-head p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }

/* Comparison table */
.afl .compare-wrap { overflow-x: auto; border-top: 1px solid var(--line-strong); }
.afl .compare { width: 100%; min-width: 620px; border-collapse: collapse; font-size: 14.5px; }
.afl .compare th, .afl .compare td { text-align: left; padding: 18px 20px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.afl .compare th:first-child, .afl .compare td:first-child { padding-left: 0; }
.afl .compare th { font: 500 11px/1.2 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.afl .compare th.afa, .afl .compare td.afa { background: rgba(0, 242, 254, 0.04); }
.afl .compare th.afa { color: var(--cyan-ink); box-shadow: inset 0 2px 0 var(--cyan); }
.afl .compare td:first-child { color: var(--ink); font-weight: 500; }
.afl .compare td { color: var(--soft); }
.afl .compare .mark { display: inline-flex; align-items: center; gap: 10px; }
.afl .compare .mark svg { width: 16px; height: 16px; flex: none; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.afl .compare .yes svg { stroke: var(--cyan); }
.afl .compare .no svg { stroke: #55636f; }
.afl .note { font-size: 12.5px; color: var(--muted); line-height: 1.6; margin-top: 16px; }

/* Closing band */
.afl .closing { margin-block: 32px 96px; padding: 44px 0; border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
.afl .closing h2 { margin: 0; font: 400 clamp(28px, 3vw, 40px)/1.12 var(--serif); max-width: 18em; letter-spacing: -0.015em; }
.afl .closing p { margin: 10px 0 0; color: var(--muted); font-size: 15px; }
.afl .foot { padding-block: 0 40px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font: 400 11.5px/1.6 var(--mono); letter-spacing: 0.04em; color: #5e6d7b; }

.afl .app { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; background: var(--bg); opacity: 0; pointer-events: none; transition: opacity .7s ease;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.afl .app.on { opacity: 1; pointer-events: auto; }
.afl .app .box { text-align: center; display: grid; gap: 14px; justify-items: center; max-width: 400px; }
.afl .app h2 { margin: 0; font: 400 28px/1.15 var(--serif); }
.afl .app p { margin: 0; color: var(--muted); line-height: 1.6; font-size: 14px; }
/* Desktop hero: copy on the left over the calm end of the cube field, the particle assistant floating on the right */
.afl .dhero { position: fixed; inset: calc(var(--nav-h) + env(safe-area-inset-top, 0px)) 0 0 0; z-index: 4; pointer-events: none; display: grid; grid-template-rows: 1fr auto; }
.afl .dhero #afl-bot { position: fixed; left: 60vw; top: 50vh; width: min(46vh, 25vw); height: min(46vh, 25vw); transform: translate(-50%, -50%); pointer-events: none; display: block; }
.afl .dhero-copy { position: relative; align-self: center; max-width: 560px; margin-left: max(64px, calc((100vw - 1180px) / 2 + 28px)); pointer-events: auto; animation: afl-copy .9s .35s both cubic-bezier(.16,1,.3,1); }
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
@media (prefers-reduced-motion: reduce) { .afl .dhero-copy, .afl .dhero-steps { animation: none; } }
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
.afl .hero { grid-template-columns: minmax(0, 1fr); }
.afl .section-head { grid-template-columns: minmax(0, 1fr); gap: 14px; }
.afl .cards.three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .cards.three .card:nth-child(3n) { border-right: 1px solid var(--line); }
.afl .cards.three .card:nth-child(2n) { border-right: 0; }
.afl .group { grid-template-columns: minmax(0, 1fr); gap: 20px; }
.afl .links { gap: 0; }
.afl .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .stat:nth-child(3) { padding-left: 0; border-left: 0; }
.afl .stat:nth-child(n+3) { border-top: 1px solid var(--line); }
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
.afl .wrap { padding-left: max(18px, env(safe-area-inset-left, 0px)); padding-right: max(18px, env(safe-area-inset-right, 0px)); }
.afl .hero { padding-block: calc(128px + env(safe-area-inset-top, 0px)) 48px; gap: 40px; }
.afl .timeline, .afl .cards.two, .afl .cards.three { grid-template-columns: minmax(0, 1fr); }
.afl .tstep, .afl .tstep + .tstep { padding: 22px 0 22px; border-left: 0; }
.afl .tstep + .tstep { border-top: 1px solid var(--line); }
.afl .tstep + .tstep::before { left: 0; }
.afl .card, .afl .cards.three .card:nth-child(3n) { border-right: 0; padding-left: 0; padding-right: 0; }
.afl .stat b { font-size: 40px; }
.afl .closing { padding: 32px 0; }
.afl .section { padding-block: 56px; }
}
@media (max-width: 520px) {
.afl .links { display: none; }
.afl .mlinks { display: flex; }
.afl .stats { grid-template-columns: minmax(0, 1fr); }
.afl .stat, .afl .stat + .stat { padding-left: 0; border-left: 0; }
.afl .stat + .stat { border-top: 1px solid var(--line); }
}
@media (max-width: 767px) {
.afl .dhero { display: flex; flex-direction: column; justify-content: flex-end; padding: 0 0 calc(7vh + 64px + env(safe-area-inset-bottom, 0px)); }
.afl .dhero #afl-bot { left: 50vw; top: calc(var(--nav-h) + 22vh); width: min(36vh, 72vw); height: min(36vh, 72vw); }
.afl .dhero-copy { align-self: stretch; max-width: none; margin: 0; padding-left: max(20px, env(safe-area-inset-left, 0px)); padding-right: max(20px, env(safe-area-inset-right, 0px)); text-align: center; }
.afl .dhero-tag { font-size: 10px; padding: 6px 10px; }
.afl .dhero h1 { margin-top: 16px; font-size: clamp(32px, 9vw, 42px); }
.afl .dhero p { margin: 14px auto 0; font-size: 14.5px; line-height: 1.6; }
.afl .dhero .actions { margin-top: 22px; justify-content: center; }
.afl .dhero-steps { display: none; }
}
@media (max-width: 767px) and (max-height: 700px) { .afl .dhero p { display: none; } }
@media (prefers-reduced-motion: reduce) {
.afl .view.on { animation: none; }
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
        <section className="dhero" aria-label="A.F.A.">
            <canvas id="afl-bot" aria-hidden="true"></canvas>
            <div className="dhero-copy">
              <div className="dhero-tag"><i></i>Automated Financial Assistant</div>
              <h1>Your personal <em>financial</em> assistant</h1>
              <p>Record what you earn and spend. A.F.A. scores your position, explains every figure and shows what to do next, from retirement savings and tax to your first investment.</p>
              <div className="actions"><button className="pill" type="button" onClick={enter}>Get started</button><a className="btn-line" href="#overview" onClick={go('overview')}>See how it works</a></div>
            </div>
            <ol className="dhero-steps" aria-label="How A.F.A. works">
              <li><b>01</b><span><strong>Record</strong>Income and spending across 38 categories.</span></li>
              <li><b>02</b><span><strong>Review</strong>Your Health Index, savings rate and net worth.</span></li>
              <li><b>03</b><span><strong>Act</strong>A ranked plan for this month, with the reasons shown.</span></li>
            </ol>
        </section>
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
              <p className="lede">A.F.A. brings together your spending, savings, retirement funds, debts and investments, and turns them into a clear, prioritised plan. Every figure and recommendation comes with an explanation.</p>
              <div className="actions"><button className="pill" type="button" onClick={enter}>Get started</button><a className="btn-line" href="#features" onClick={go('features')}>Explore features</a></div>
            </div>
            <aside className="term" aria-label="Example dashboard">
              <div className="term-bar"><span><i className="dot"></i>A.F.A. / Position</span><span className="tag">Sample user</span></div>
              <div className="term-kpis">
                <div><label>Health index</label><b>78<small>/100</small></b><em>▲ 4 pts vs Oct</em></div>
                <div><label>Net worth</label><b>$186.4k</b><em>▲ 2.1% MoM</em></div>
              </div>
              <div className="term-chart">
                <svg viewBox="0 0 320 86" preserveAspectRatio="none" aria-hidden="true">
                  <defs><linearGradient id="afl-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00f2fe" stopOpacity="0.22"/><stop offset="100%" stopColor="#00f2fe" stopOpacity="0"/></linearGradient></defs>
                  <line x1="0" x2="320" y1="20" y2="20" stroke="rgba(200,225,240,0.07)" strokeDasharray="2 4"/><line x1="0" x2="320" y1="43" y2="43" stroke="rgba(200,225,240,0.07)" strokeDasharray="2 4"/><line x1="0" x2="320" y1="66" y2="66" stroke="rgba(200,225,240,0.07)" strokeDasharray="2 4"/><path d="M0.0 70.8 L29.1 68.2 L58.2 69.8 L87.3 63.8 L116.4 58.7 L145.5 61.3 L174.5 52.7 L203.6 46.5 L232.7 40.7 L261.8 31.7 L290.9 23.1 L320.0 14.3 L320 86 L0 86 Z" fill="url(#afl-area)"/><path d="M0.0 70.8 L29.1 68.2 L58.2 69.8 L87.3 63.8 L116.4 58.7 L145.5 61.3 L174.5 52.7 L203.6 46.5 L232.7 40.7 L261.8 31.7 L290.9 23.1 L320.0 14.3" fill="none" stroke="#00f2fe" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
                  <circle cx="318.5" cy="14.3" r="3" fill="#00f2fe"/>
                </svg>
                <div className="term-axis"><span>Dec</span><span>Mar</span><span>Jun</span><span>Sep</span><span>Nov</span></div>
              </div>
              <table className="term-rows"><tbody>
                <tr><td>Savings rate</td><td className="ok">24.0%</td></tr>
                <tr><td>Emergency fund</td><td className="ok">4.2 mo</td></tr>
                <tr><td>Rent / income</td><td>31.0%</td></tr>
                <tr><td>Card debt</td><td>$0</td></tr>
              </tbody></table>
              <div className="next"><span className="k">Next</span><span>Moving $500 a month into your retirement account could lower this year's tax.</span></div>
              <div className="mock-note">Illustrative figures for a sample user.</div>
            </aside>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">How it works</div><h2>From your first record to a plan you can act on</h2></div><p>A.F.A. learns from what you record and updates your position and priorities as your finances change.</p></div>
            <div className="timeline">
              <div className="tstep"><div className="node">01</div><h3>Record</h3><p>Log income and spending across 38 categories, from transport top-ups to rent. Salary, rent and subscriptions can repeat automatically.</p></div>
              <div className="tstep"><div className="node">02</div><h3>Review</h3><p>See your Health Index, savings rate, emergency-fund cover and net worth across cash, stocks, crypto and other assets.</p></div>
              <div className="tstep"><div className="node">03</div><h3>Act</h3><p>Follow a personal action plan that sets out this month's priorities, from reducing card debt to claiming tax relief.</p></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">At a glance</div><h2>The scope of the platform</h2></div><p>Tested on real market data, with every amount shown in the currency you choose.</p></div>
            <div className="stats">
              <div className="stat"><b>38</b><span>spending and income categories</span></div>
              <div className="stat"><b>12</b><span>technical indicators tested on market data</span></div>
              <div className="stat"><b>45</b><span>large-cap stocks in the rating study</span></div>
              <div className="stat"><b>FX</b><span>every figure in your currency, including foreign stocks and crypto</span></div>
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
              <h1>Designed around how you actually manage money</h1>
              <p className="lede">General budgeting apps stop at charts. A.F.A. connects your spending, retirement savings, tax and investments, and tells you what to do next.</p>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">Principles</div><h2>Four principles behind the platform</h2></div><p>Each one shapes how A.F.A. calculates, explains and protects your information.</p></div>
            <div className="cards two">
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg></div><h3>Your currency, your market</h3><p>Pick your preferred currency and see every figure in it, with live quotes for stocks on major exchanges converted for you.</p></div>
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></div><h3>Transparent recommendations</h3><p>The AI assistant explains each recommendation, and every rating shows the method and data behind it.</p></div>
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 5-6"/></svg></div><h3>Evidence-based analysis</h3><p>Stock ratings are validated against several years of market data, and the platform reports how reliable they have been.</p></div>
              <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div><h3>Private and secure</h3><p>Your records are stored in your own account and are not shared with other users. Simulated trading lets you practise before committing real capital.</p></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><div><div className="eyebrow">Comparison</div><h2>How A.F.A. compares</h2></div><p>Compared with a general-purpose budgeting app.</p></div>
            <div className="compare-wrap">
              <table className="compare">
                <thead><tr><th>Capability</th><th>Typical budgeting app</th><th className="afa">A.F.A.</th></tr></thead>
                <tbody>
                  <tr><td>Retirement and tax planning</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Not covered</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Calculated from your income</span></td></tr>
                  <tr><td>Stocks on major exchanges</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Limited, often USD only</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Quotes, charts and ratings in your currency</span></td></tr>
                  <tr><td>Leveraged products</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Not covered</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Simulated trading with gearing and call-level alerts</span></td></tr>
                  <tr><td>Recommended next steps</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Charts only</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>A ranked personal action plan</span></td></tr>
                  <tr><td>Explanation of figures</td><td><span className="mark no"><svg><use href="#afl-i-no"/></svg>Not shown</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes"/></svg>Methods and AI explanations</span></td></tr>
                </tbody>
              </table>
            </div>
            <p className="note">A.F.A. provides educational information and examples. It is not licensed investment advice.</p>
          </section>

          <section className="closing"><div><h2>Built for the way you manage money.</h2><p>Create your account to get started.</p></div><button className="pill" type="button" onClick={enter}>Get started</button></section>
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
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg></div><h3>Retirement and tax</h3><p>Pension contributions, voluntary top-ups and the tax they can save.</p><div className="meta"><span>Tax relief</span></div></div>
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg></div><h3>Net worth</h3><p>Bonds, crypto, deposits and other assets alongside your portfolio.</p><div className="meta"><span>Live crypto prices</span></div></div>
              </div>
            </div>
            <div className="group">
              <div className="group-head"><div className="eyebrow">Investing</div><h3>Research and practise</h3><p>Analyse markets and trade with simulated capital.</p></div>
              <div className="cards three">
                <div className="card"><div className="icon"><svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7"/></svg></div><h3>Simulated trading</h3><p>Practise on stocks and leveraged products, with fees and currency conversion included.</p><div className="meta"><span>Call-level alerts</span></div></div>
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
