import React, { useEffect, useState } from 'react';
import cityPhoto from '../assets/afa-city-dusk.jpg';
// Screenshots of the A.F.A. app itself (a sample account), shown as previews on Home and Features
import shotOverview from '../assets/app/overview.jpg';
import shotCashflow from '../assets/app/cashflow.jpg';
import shotExpenses from '../assets/app/expenses.jpg';
import shotTxns from '../assets/app/txns.jpg';
import shotStocks from '../assets/app/stocks.jpg';
import shotDiversity from '../assets/app/diversity.jpg';
import shotPayoff from '../assets/app/payoff.jpg';
import shotPlanner from '../assets/app/planner.jpg';
import shotPlan from '../assets/app/plan.jpg';

// The Overview, Why A.F.A. and Features pages around the landing, in the A.F.A. house style:
// navy and paper sections, a teal accent, Manrope headings with an italic serif accent word,
// square buttons with arrows, numbered kickers and hairline rules.
// IntroLanding renders these; `page` picks the visible one, `go(p)` switches page, `enter()` starts the app.

export const TP_CSS = `
.afl .tp { --navy: #081b2c; --deep: #061522; --tink: #132433; --teal: #47c4b2; --teal-2: #6bd6c6; --teal-ink: #248b7e; --paper: #f3f1eb;
  --tline: rgba(11, 30, 44, 0.15); --tsans: "Manrope", "Inter", system-ui, sans-serif; --tbody: "DM Sans", "Inter", system-ui, sans-serif; --tserif: "Playfair Display", Georgia, serif;
  display: none; position: relative; z-index: 2; min-height: 100%; background: var(--paper); color: var(--tink); font-family: var(--tbody); color-scheme: light; }
.afl .tp.on { display: block; animation: afl-rise .6s cubic-bezier(.16,1,.3,1); }
@keyframes afl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.afl .tp h1, .afl .tp h2, .afl .tp h3, .afl .tp p { margin: 0; }
.afl .tp h1 em, .afl .tp h2 em { font-family: var(--tserif); font-style: italic; font-weight: 500; color: var(--teal); letter-spacing: -0.02em; }
.afl .tp svg.ar { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.5; }
.afl .tp .pad { padding: 120px 8.5vw; }

/* Buttons and links */
.afl .tp .t-btn { display: inline-flex; align-items: center; gap: 18px; height: 52px; padding: 0 25px; border: 0; border-radius: 0; background: var(--teal); color: var(--navy); font: 600 12.5px/1 var(--tbody); letter-spacing: 0.03em; text-decoration: none; cursor: pointer; transition: background .2s, transform .2s; }
.afl .tp .t-btn:hover { background: var(--teal-2); transform: translateY(-2px); }
.afl .tp .t-btn:focus-visible, .afl .tp .t-link:focus-visible, .afl .tp .t-dark:focus-visible { outline: 2px solid var(--teal); outline-offset: 3px; }
.afl .tp .t-link { display: inline-flex; align-items: center; gap: 12px; color: #fff; font: 500 12.5px/1 var(--tbody); text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.4); padding-bottom: 6px; transition: border-color .2s; }
.afl .tp .t-link:hover { border-color: var(--teal); }
.afl .tp .t-dark { display: inline-flex; align-items: center; gap: 15px; color: var(--navy); font: 600 12px/1 var(--tbody); text-decoration: none; border-bottom: 1px solid #95a1a6; padding-bottom: 7px; transition: border-color .2s, gap .2s; }
.afl .tp .t-dark:hover { border-color: var(--teal); gap: 20px; }

/* Kickers */
.afl .tp .kick { display: flex; align-items: center; gap: 15px; font: 600 10.5px/1 var(--tbody); letter-spacing: 0.22em; text-transform: uppercase; color: #69808c; }
.afl .tp .kick::before { content: ""; width: 34px; height: 1px; background: var(--teal); }
.afl .tp .kick.light { color: #8da1ad; }

/* Hero: navy over the city photo, with column rules */
.afl .tp .t-hero { position: relative; min-height: min(760px, 100vh); padding-top: var(--nav-h); background: var(--deep); color: #fff; overflow: hidden; }
.afl .tp .t-hero.short { min-height: 520px; }
.afl .tp .t-hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.86; }
.afl .tp .t-hero.short img { object-position: center 40%; opacity: 0.6; }
.afl .tp .t-hero .ov { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(5,18,30,0.98) 0%, rgba(5,18,30,0.9) 34%, rgba(5,18,30,0.3) 67%, rgba(5,18,30,0.32) 100%), linear-gradient(0deg, rgba(4,15,24,0.75), transparent 45%); }
.afl .tp .t-hero .cols { position: absolute; inset: 0; opacity: 0.12; pointer-events: none;
  background-image: linear-gradient(90deg, transparent calc(25% - 1px), #fff 25%, transparent calc(25% + 1px)), linear-gradient(90deg, transparent calc(50% - 1px), #fff 50%, transparent calc(50% + 1px)), linear-gradient(90deg, transparent calc(75% - 1px), #fff 75%, transparent calc(75% + 1px)); }
.afl .tp .t-hero .in { position: relative; z-index: 2; min-height: calc(min(760px, 100vh) - var(--nav-h)); display: flex; flex-direction: column; justify-content: center; padding: 64px 8.5vw 96px; max-width: calc(750px + 8.5vw); }
.afl .tp .t-hero.short .in { min-height: calc(520px - var(--nav-h)); padding-bottom: 72px; }
.afl .tp .eyebrow2 { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; font: 600 10.5px/1 var(--tbody); letter-spacing: 0.22em; text-transform: uppercase; color: #d2dde3; }
.afl .tp .eyebrow2::before { content: ""; width: 28px; height: 1px; background: var(--teal); }
.afl .tp .t-hero h1 { font: 500 clamp(48px, 6vw, 92px)/0.98 var(--tsans); letter-spacing: -0.055em; text-wrap: balance; }
.afl .tp .t-hero.short h1 { font-size: clamp(44px, 5vw, 76px); }
.afl .tp .t-hero .copy { width: min(535px, 100%); margin: 28px 0 34px; font: 400 16px/1.7 var(--tsans); color: #c7d0d5; }
.afl .tp .t-hero.short .copy { margin-bottom: 0; }
.afl .tp .t-acts { display: flex; align-items: center; gap: 38px; flex-wrap: wrap; }
.afl .tp .aside { position: absolute; z-index: 2; right: 4.5vw; top: 31%; width: 230px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.4); }
.afl .tp .aside .ix { display: block; margin-bottom: 100px; font: 400 10.5px/1 var(--tsans); color: var(--teal); }
.afl .tp .aside .lb { font: 600 9.5px/1 var(--tsans); letter-spacing: 0.18em; color: #9facb4; }
.afl .tp .aside p { margin-top: 12px; font: 400 16px/1.55 var(--tsans); }
.afl .tp .cue { position: absolute; z-index: 3; bottom: 28px; left: 4.5vw; display: flex; align-items: center; gap: 14px; color: #fff; font: 400 9.5px/1 var(--tsans); letter-spacing: 0.2em; text-transform: uppercase; text-decoration: none; transform: rotate(-90deg); transform-origin: left center; }
.afl .tp .cue i { display: block; width: 40px; height: 1px; background: var(--teal); }

/* Figures bar (the template's market bar) */
.afl .tp .t-bar { display: flex; min-height: 112px; background: #fff; border-bottom: 1px solid #dadfe1; }
.afl .tp .t-bar .st { width: 18%; min-width: 200px; padding: 28px 4.5vw; border-right: 1px solid #dfe3e4; font: 600 9.5px/1 var(--tbody); letter-spacing: 0.17em; white-space: nowrap; color: var(--tink); }
.afl .tp .t-bar .st small { display: block; margin: 10px 0 0 15px; font-size: 8px; color: #89959d; }
.afl .tp .live { display: inline-block; width: 6px; height: 6px; margin-right: 8px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 0 4px rgba(71,196,178,0.13); }
.afl .tp .t-bar .ls { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); }
.afl .tp .t-bar .it { position: relative; min-width: 0; padding: 20px min(2vw, 32px); border-right: 1px solid #e4e7e8; }
.afl .tp .t-bar .it:last-child { border-right: 0; }
.afl .tp .t-bar .it span { display: block; font: 600 8.5px/1.3 var(--tsans); letter-spacing: 0.1em; text-transform: uppercase; color: #7e8c94; }
.afl .tp .t-bar .it strong { display: block; margin: 8px 0 6px; font: 500 22px/1 var(--tsans); letter-spacing: -0.02em; color: var(--navy); }
.afl .tp .t-bar .it small { font: 500 11px/1.4 var(--tsans); color: #6d7c84; }
.afl .tp .t-bar .it svg { position: absolute; right: 14px; bottom: 18px; width: 36%; height: 24px; }
.afl .tp .t-bar .ls.five { grid-template-columns: repeat(5, 1fr); }
.afl .tp .t-bar .it small.up { color: #138a75; font-weight: 600; }
.afl .tp .t-bar .it small.down { color: #bd605e; font-weight: 600; }
.afl .tp .chart.down { stroke: #c8807c; }
.afl .tp .t-bar .it strong { font-size: 18px; }
.afl .tp .chart { fill: none; stroke: var(--teal); stroke-width: 1.5; vector-effect: non-scaling-stroke; }

/* Intro: kicker | copy | figure */
.afl .tp .t-intro { display: grid; grid-template-columns: 18% minmax(0, 0.9fr) minmax(320px, 1.1fr); gap: 40px; background: var(--paper); }
.afl .tp h2 { font: 500 clamp(38px, 4vw, 62px)/1.08 var(--tsans); letter-spacing: -0.045em; text-wrap: balance; }
.afl .tp .t-intro h2 em, .afl .tp .t-light h2 em { color: var(--teal-ink); }
.afl .tp .t-intro > .kick { align-self: start; padding-top: 14px; }
.afl .tp .t-intro .body > p { max-width: 620px; margin: 32px 0; color: #62717a; font-size: 15.5px; line-height: 1.8; }


/* Navy band with hover cards (the template's expertise grid) */
.afl .tp .t-navy { background: var(--navy); color: #fff; }
.afl .tp .t-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; margin-bottom: 65px; }
.afl .tp .t-head .kick { margin-bottom: 24px; }
.afl .tp .t-head > p { max-width: 38ch; padding-bottom: 7px; font-size: 14px; line-height: 1.7; color: #8fa0aa; }
.afl .tp .t-light .t-head > p { color: #62717a; }
.afl .tp .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid rgba(255,255,255,0.16); border-bottom: 1px solid rgba(255,255,255,0.16); }
.afl .tp .sc { min-height: 400px; padding: 28px 32px; border-right: 1px solid rgba(255,255,255,0.16); display: flex; flex-direction: column; justify-content: space-between; gap: 28px; transition: background .35s, color .35s, transform .35s; }
.afl .tp .sc:nth-child(3n+1) { border-left: 1px solid rgba(255,255,255,0.16); }
.afl .tp .sc:nth-child(n+4) { border-top: 1px solid rgba(255,255,255,0.16); }
.afl .tp .t-light .sc:nth-child(n+4) { border-top-color: var(--tline); }
.afl .tp .grid3.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .tp .grid3.two .sc:nth-child(3n+1) { border-left-width: 0; }
.afl .tp .grid3.two .sc:nth-child(2n+1) { border-left-width: 1px; border-left-style: solid; }
.afl .tp .grid3.two .sc:nth-child(3) { border-top: 1px solid rgba(255,255,255,0.16); }
.afl .tp .t-light .grid3.two .sc:nth-child(3) { border-top-color: var(--tline); }
.afl .tp .sc.on { background: var(--teal); color: var(--navy); transform: translateY(-10px); }
.afl .tp .sc .top { display: flex; justify-content: space-between; align-items: center; font: 400 10.5px/1 var(--tsans); letter-spacing: 0.12em; color: #8ca1ad; }
.afl .tp .sc.on .top { color: var(--navy); }
.afl .tp .sc .top button { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(255,255,255,0.3); border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.afl .tp .sc.on .top button { border-color: rgba(8,27,44,0.3); }
.afl .tp .sc h3 { margin: 0 0 15px; font: 500 26px/1.2 var(--tsans); letter-spacing: -0.02em; }
.afl .tp .sc p { max-width: 330px; font-size: 14px; line-height: 1.7; color: #9cafb8; }
.afl .tp .sc.on p { color: #1a504e; }
.afl .tp .sc .fig { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.17); }
.afl .tp .sc.on .fig { border-color: rgba(8,27,44,0.2); }
.afl .tp .sc .fig strong { font: 500 35px/1 var(--tsans); letter-spacing: -0.04em; }
.afl .tp .sc .fig span { white-space: pre-line; font: 500 9.5px/1.4 var(--tbody); letter-spacing: 0.08em; text-transform: uppercase; color: #8fa2ac; text-align: right; }
.afl .tp .sc.on .fig span { color: #255d59; }
.afl .tp .t-note { margin-top: 28px; font-size: 10.5px; color: #667b87; }

/* The same grid on a light band */
.afl .tp .t-light { background: #fff; }
.afl .tp .t-light.paper { background: var(--paper); }
.afl .tp .t-light .grid3 { border-color: var(--tline); }
.afl .tp .t-light .sc { border-color: var(--tline); min-height: 340px; }
.afl .tp .t-light .sc .top { color: #6d7c84; }
.afl .tp .t-light .sc .top button { border-color: #ccd2d3; }
.afl .tp .t-light .sc p { color: #62717a; }
.afl .tp .t-light .sc .fig { border-color: var(--tline); }
.afl .tp .t-light .sc .fig span { color: #6d7c84; }
.afl .tp .t-light .sc.on { color: var(--navy); }
.afl .tp .t-light .sc.on p { color: #1a504e; }
.afl .tp .t-light .sc.on .fig span { color: #255d59; }

/* Numbered rows (the template's insights list) */
.afl .tp .t-rows { display: grid; grid-template-columns: 38% minmax(0, 1fr); gap: 7%; background: #fff; }
.afl .tp .t-rows .kick { margin-bottom: 30px; }
.afl .tp .t-rows .side p { margin-top: 28px; max-width: 40ch; font-size: 15px; line-height: 1.75; color: #62717a; }
.afl .tp .rows { border-top: 1px solid var(--tline); }
.afl .tp .row { display: grid; grid-template-columns: 35px 150px minmax(0, 1fr); gap: 22px; align-items: center; min-height: 135px; padding: 24px 0; border-bottom: 1px solid var(--tline); transition: padding .25s, background .25s; }
.afl .tp .row:hover { padding-left: 14px; background: #f8f7f3; }
.afl .tp .row .n { font-size: 10px; color: #89979e; }
.afl .tp .row .tg { font: 600 9px/1.5 var(--tbody); letter-spacing: 0.13em; text-transform: uppercase; color: var(--teal-ink); }
.afl .tp .row h3 { font: 500 19px/1.4 var(--tsans); letter-spacing: -0.01em; color: var(--tink); }
.afl .tp .row p { margin-top: 6px; font-size: 14px; line-height: 1.65; color: #62717a; }

/* Comparison table */
.afl .tp .cmp-wrap { overflow-x: auto; border-top: 1px solid var(--tline); }
.afl .tp .cmp { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14.5px; }
.afl .tp .cmp th, .afl .tp .cmp td { text-align: left; padding: 20px; border-bottom: 1px solid var(--tline); vertical-align: middle; }
.afl .tp .cmp th:first-child, .afl .tp .cmp td:first-child { padding-left: 0; }
.afl .tp .cmp th { font: 600 9.5px/1.2 var(--tbody); letter-spacing: 0.15em; text-transform: uppercase; color: #6d7c84; }
.afl .tp .cmp .afa { background: rgba(71,196,178,0.08); }
.afl .tp .cmp th.afa { color: var(--teal-ink); box-shadow: inset 0 2px 0 var(--teal); }
.afl .tp .cmp td { color: #62717a; }
.afl .tp .cmp td:first-child { color: var(--tink); font-weight: 500; }
.afl .tp .cmp .mark { display: inline-flex; align-items: center; gap: 10px; }
.afl .tp .cmp .mark svg { width: 16px; height: 16px; flex: none; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.afl .tp .cmp .yes svg { stroke: var(--teal-ink); }
.afl .tp .cmp .no svg { stroke: #a5b0b5; }

/* Closing band (the template's contact band) */
.afl .tp .t-cta { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 40px; min-height: 370px; padding: 75px 8.5vw; background: #0b2639; color: #fff; }
.afl .tp .t-cta > *:not(.mark-a) { position: relative; z-index: 1; }
.afl .tp .t-cta .kick { margin-bottom: 24px; }
.afl .tp .t-cta h2 { font-size: clamp(34px, 3.5vw, 56px); }
.afl .tp .mark-a { position: absolute; right: 22%; bottom: -180px; font: 600 500px/1 var(--tsans); color: rgba(255,255,255,0.025); pointer-events: none; }
.afl .tp .round { flex: none; display: flex; align-items: center; justify-content: center; gap: 12px; width: 180px; height: 180px; border: 0; border-radius: 50%; background: var(--teal); color: var(--navy); font: 600 12px/1 var(--tbody); cursor: pointer; transition: transform .3s, background .2s; }
.afl .tp .round:hover { transform: scale(1.04); background: var(--teal-2); }

/* Footer */
.afl .tp .t-foot { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: start; gap: 30px; padding: 50px 4.5vw 25px; background: var(--deep); color: #8b9aa3; }
.afl .tp .t-foot .fb { display: inline-flex; align-items: center; gap: 10px; color: #e6edf1; text-decoration: none; }
.afl .tp .t-foot .fb svg { width: 30px; height: 30px; }
.afl .tp .t-foot .fb b { display: block; font: 600 20px/1 var(--tsans); letter-spacing: 0.18em; }
.afl .tp .t-foot .fb small { display: block; margin-top: 5px; font: 600 7px/1 var(--tsans); letter-spacing: 0.12em; color: #8b9aa3; }
.afl .tp .t-foot .fc { padding-top: 8px; font: 400 13.5px/1.6 var(--tsans); }
.afl .tp .t-foot .fl { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 26px; padding-top: 10px; }
.afl .tp .t-foot .fl a { color: inherit; font-size: 11px; text-decoration: none; }
.afl .tp .t-foot .fl a:hover { color: #fff; }
.afl .tp .t-foot .cr { grid-column: 1 / 4; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.09); font-size: 9.5px; letter-spacing: 0.08em; }

/* The top bar turns white on these pages, as in the template */
.afl.page .nav, .afl.lightnav .nav { background: rgba(255,255,255,0.97); border-bottom-color: #e5e7e8; }
.afl.page .brand .word, .afl.lightnav .brand .word { color: #081b2c; letter-spacing: 0.16em; font-family: "Manrope", var(--ui); }
.afl.page .link, .afl.lightnav .link { color: #243644; font-family: "DM Sans", var(--ui); font-size: 13.5px; }
.afl.page .link:hover, .afl.page .link[aria-current="page"], .afl.lightnav .link:hover, .afl.lightnav .link[aria-current="page"] { color: #081b2c; }
.afl.page .link::after, .afl.lightnav .link::after { height: 1px; background: #47c4b2; }
.afl.page .nav .pill, .afl.lightnav .nav .pill { background: #47c4b2; color: #081b2c; border-radius: 0; font-family: "DM Sans", var(--ui); font-size: 12.5px; letter-spacing: 0.03em; padding: 14px 20px; }
.afl.page .nav .pill:hover, .afl.lightnav .nav .pill:hover { background: #6bd6c6; }

/* App previews: screenshots of the app in a simple window frame */
.afl .tp .show { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 24px; align-items: start; margin-bottom: 48px; }
.afl .tp .show.even { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.afl .tp .show.one { grid-template-columns: minmax(0, 1fr); max-width: 980px; }
.afl .tp .show .stack { display: grid; gap: 24px; min-width: 0; }
.afl .tp .shot { margin: 0; min-width: 0; background: #0d1117; border: 1px solid rgba(11,30,44,0.2); box-shadow: 0 40px 80px -50px rgba(8,27,44,0.55); overflow: hidden; }
.afl .tp .t-navy .shot { border-color: rgba(255,255,255,0.14); box-shadow: 0 40px 80px -40px rgba(0,0,0,0.7); }
.afl .tp .shot figcaption { display: flex; align-items: center; gap: 12px; height: 34px; padding: 0 14px; background: #161b22; border-bottom: 1px solid rgba(255,255,255,0.06); font: 600 9.5px/1 var(--tbody); letter-spacing: 0.14em; text-transform: uppercase; color: #8b98a5; }
.afl .tp .shot .dots { display: inline-flex; gap: 5px; }
.afl .tp .shot .dots i { width: 7px; height: 7px; border-radius: 50%; background: #2b333d; }
.afl .tp .shot img { display: block; width: 100%; height: auto; }
.afl .tp .t-intro .shot { align-self: end; }
@media (max-width: 1000px) { .afl .tp .show, .afl .tp .show.even { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1000px) {
.afl .tp .aside { display: none; }
.afl .tp .t-hero .in { max-width: none; padding-right: 8.5vw; }
.afl .tp .t-bar { overflow-x: auto; }
.afl .tp .t-bar .ls { min-width: 760px; }
.afl .tp .t-intro { grid-template-columns: minmax(0, 1fr); }
.afl .tp .t-rows { grid-template-columns: minmax(0, 1fr); gap: 36px; }
.afl .tp .grid3, .afl .tp .grid3.two { grid-template-columns: minmax(0, 1fr); }
.afl .tp .sc, .afl .tp .t-light .sc { min-height: 0; border: 1px solid rgba(255,255,255,0.16); border-top: 0; }
.afl .tp .t-light .sc { border-color: var(--tline); }
.afl .tp .sc.on { transform: none; }
.afl .tp .grid3.two .sc:nth-child(n) { border-left-width: 1px; border-left-style: solid; }
.afl .tp .grid3.two .sc:nth-child(3) { border-top: 0; }
.afl .tp .t-head { display: block; }
.afl .tp .t-head > p { margin-top: 22px; }
}
@media (max-width: 700px) {
.afl .tp h2 { font-size: clamp(28px, 8vw, 36px); letter-spacing: -0.04em; }
.afl .tp .sc h3 { font-size: 21px; }
.afl .tp .sc .fig strong { font-size: 28px; }
.afl .tp .t-intro .body > p, .afl .tp .t-rows .side p { font-size: 14.5px; margin: 22px 0; }
.afl .tp .row h3 { font-size: 16.5px; }
.afl .tp .t-cta h2 { font-size: clamp(26px, 7.4vw, 32px); }
.afl .tp .pad { padding: 80px 22px; }
.afl .tp .t-hero, .afl .tp .t-hero .in { min-height: 640px; }
.afl .tp .t-hero.short, .afl .tp .t-hero.short .in { min-height: 0; }
.afl .tp .t-hero .in { padding: 48px 22px 56px; }
.afl .tp .t-hero img { object-position: 67% center; }
.afl .tp .t-hero .ov { background: linear-gradient(90deg, rgba(5,18,30,0.96), rgba(5,18,30,0.7)), linear-gradient(0deg, rgba(4,15,24,0.8), transparent); }
.afl .tp .t-hero h1 { font-size: clamp(34px, 10vw, 46px); }
.afl .tp .t-hero.short h1 { font-size: clamp(32px, 9.4vw, 42px); }
.afl .tp .t-hero .copy { font-size: 14.5px; margin: 24px 0 30px; }
.afl .tp .t-acts { flex-direction: column; align-items: flex-start; gap: 22px; }
.afl .tp .cue { display: none; }
.afl .tp .t-bar .st { min-width: 132px; padding: 24px 18px 0 22px; }
.afl .tp .t-bar .st small { display: none; }
.afl .tp .sc { padding: 26px 22px; }
.afl .tp .row { grid-template-columns: 25px minmax(0, 1fr); gap: 6px 12px; padding: 22px 0; }
.afl .tp .row > div:last-child { grid-column: 2; }
.afl .tp .t-cta { display: block; padding: 70px 22px; min-height: 0; }
.afl .tp .round { width: auto; height: 52px; margin-top: 35px; padding: 0 22px; border-radius: 0; display: inline-flex; }
.afl .tp .t-foot { grid-template-columns: minmax(0, 1fr); }
.afl .tp .t-foot .fl { justify-content: flex-start; }
.afl .tp .t-foot .cr { grid-column: 1; }
}
@media (prefers-reduced-motion: reduce) { .afl .tp.on { animation: none; } .afl .tp .sc, .afl .tp .row, .afl .tp .t-btn, .afl .tp .round { transition: none; } }
`;

const Arrow = ({ diagonal = false }) => (
  <svg className="ar" viewBox="0 0 24 24" aria-hidden="true">{diagonal ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="M5 12h14m-5-5 5 5-5 5" />}</svg>
);

// Cards that turn teal on hover or focus; one is always highlighted
function CardGrid({ items, light = false }) {
  const [on, setOn] = useState(0);
  return (
    <div className={'grid3' + (items.length === 4 ? ' two' : '')}>
      {items.map((c, i) => (
        <article key={c.title} className={'sc' + (on === i ? ' on' : '')} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)}>
          <div className="top"><span>{String(i + 1).padStart(2, '0')}</span><button type="button" aria-label={c.title} onClick={() => setOn(i)}><Arrow diagonal /></button></div>
          <div><h3>{c.title}</h3><p>{c.text}</p></div>
          <div className="fig"><strong>{c.stat}</strong><span>{c.label}</span></div>
        </article>
      ))}
    </div>
  );
}

function Closing({ kicker, title, enter }) {
  return (
    <section className="t-cta">
      <div className="mark-a" aria-hidden="true">A</div>
      <div><div className="kick light">{kicker}</div><h2>{title}</h2></div>
      <button className="round" type="button" onClick={enter}>Get started <Arrow /></button>
    </section>
  );
}

function Footer({ go }) {
  return (
    <footer className="t-foot">
      <a className="fb" href="#" onClick={go('home')} aria-label="A.F.A. home" translate="no"><svg aria-hidden="true"><use href="#afl-afa-mark" /></svg><span><b>A.F.A.</b><small>AUTOMATED FINANCIAL ASSISTANT</small></span></a>
      <div className="fc">Clear numbers and a plan for what to do next.</div>
      <div className="fl"><a href="#overview" onClick={go('overview')}>Overview</a><a href="#why-afa" onClick={go('why-afa')}>Why A.F.A.</a><a href="#features" onClick={go('features')}>Features</a></div>
      <div className="cr">Educational information only, not licensed financial advice. © {new Date().getFullYear()} A.F.A.</div>
    </footer>
  );
}

const STEPS = [
  { title: 'Record', text: 'Log income and spending across 38 categories, from transport top-ups to rent. Salary, rent and subscriptions can repeat automatically.', stat: '38', label: 'Categories' },
  { title: 'Review', text: 'See your financial health score, savings rate, emergency-fund cover and net worth across cash, stocks, crypto and other assets.', stat: '0–100', label: 'Financial health\nscore' },
  { title: 'Act', text: "Follow a personal action plan that sets out this month's priorities, from reducing card debt to claiming tax relief.", stat: 'Top 3', label: 'Priorities\nthis month' },
];

const PRINCIPLES = [
  { tag: 'Worldwide', title: 'Your currency, your market', text: 'Pick your preferred currency and see every figure in it, with live quotes for stocks on major exchanges converted for you.' },
  { tag: 'Transparent', title: 'Recommendations you can follow', text: 'The AI assistant explains each recommendation, and every rating shows the method and data behind it.' },
  { tag: 'Evidence', title: 'Analysis tested on real data', text: 'Stock ratings are validated against several years of market data, and the platform reports how reliable they have been.' },
  { tag: 'Private', title: 'Your records stay yours', text: 'Your records are stored in your own account and are not shared with other users. Simulated trading lets you practise before committing real capital.' },
];

const COMPARE = [
  ['Retirement and tax planning', 'Not covered', 'Calculated from your income'],
  ['Stocks on major exchanges', 'Limited, often USD only', 'Quotes, charts and ratings in your currency'],
  ['Leveraged products', 'Not covered', 'Simulated trading with gearing and call-level alerts'],
  ['Recommended next steps', 'Charts only', 'A ranked personal action plan'],
  ['Explanation of figures', 'Not shown', 'Methods and AI explanations'],
];

const GROUPS = [
  { kicker: 'Everyday', title: <>Manage your <em>money.</em></>, text: 'Record, review and act on your monthly finances.', cls: 't-light paper', items: [
    { title: 'Dashboard', text: "This month's income, spending and savings at a glance, with the next step to take at the top.", stat: '1', label: 'Screen for\nyour whole position' },
    { title: 'Transaction recorder', text: 'Log income and spending in a few taps, with a keypad on phones. Salary, rent and subscriptions can repeat automatically.', stat: '38', label: 'Categories,\nrepeating entries' },
    { title: 'Apple Pay sync', text: 'Set up an iPhone Shortcut once, and each Apple Pay tap is added to your transactions the next time A.F.A. is open.', stat: 'Auto', label: 'Apple Pay taps\nrecorded for you' },
    { title: 'Analytics and audit', text: 'Budget warnings, unusual spending and a category breakdown, with a printable monthly report.', stat: 'PDF', label: 'Monthly report' },
    { title: 'Financial health', text: 'One score for savings rate, rent burden, emergency fund and investing, with alerts when something slips.', stat: '0–100', label: 'Financial health\nscore' },
    { title: 'Your currency', text: 'Choose a preferred currency and every figure, including foreign stocks and crypto, is converted at live rates.', stat: 'FX', label: 'Live exchange\nrates' },
  ] },
  { kicker: 'Investing', title: <>Research, track and <em>practise.</em></>, text: 'Stocks, crypto and every other asset you own, with analysis you can check.', cls: 't-navy', items: [
    { title: 'Investment portfolio', text: 'Track holdings on major exchanges with live quotes, gains and allocation, shown in your currency.', stat: 'Live', label: 'Quotes' },
    { title: 'Stock analysis', text: 'Indicators, valuation and a buy, hold or sell plan with entry, target and stop prices.', stat: '12', label: 'Indicators,\nDCF and P/E' },
    { title: 'Simulated trading', text: 'Practise on stocks and leveraged products, with fees, currency conversion and call-level alerts.', stat: '$0', label: 'Real capital\nat risk' },
    { title: 'Crypto and other assets', text: 'Bitcoin and other coins at live prices, plus bonds, funds, gold, deposits, property and insurance savings.', stat: '10', label: 'Asset types' },
    { title: 'Watchlist', text: 'Save the stocks you follow and open their analysis or a practice trade in one tap.', stat: '1 tap', label: 'To analysis\nor a trade' },
    { title: 'Market news', text: "Live headlines, plus company news scored for sentiment in each stock's analysis.", stat: 'Live', label: 'Auto-refresh' },
  ] },
  { kicker: 'Planning', title: <>Plan <em>ahead.</em></>, text: 'Long-term wealth, debt, retirement savings and tax.', cls: 't-light', items: [
    { title: 'Wealth planner', text: 'Model saving and investing scenarios and see how compounding grows your money over the years.', stat: '30y', label: 'Scenarios\nyou can adjust' },
    { title: 'Debt health', text: 'See your debt-free date with the avalanche or snowball method, month by month, and the interest you save.', stat: '2', label: 'Payoff methods' },
    { title: 'Retirement and tax', text: 'Pension contributions, voluntary top-ups and the tax they can save, worked out from your income.', stat: 'Tax', label: 'Relief from\nyour income' },
  ] },
  { kicker: 'Assistant', title: <>Guidance from <em>A.F.A. AI.</em></>, text: 'Ask questions and get a plan, with the reasons shown.', cls: 't-light paper', items: [
    { title: 'A.F.A. AI chat', text: 'Ask about your spending, your portfolio or a stock, and get answers based on your own numbers.', stat: '24/7', label: 'Answers' },
    { title: 'Personal action plan', text: "This month's priorities, ranked and explained, from reducing card debt to claiming tax relief.", stat: 'Top 3', label: 'Priorities\nthis month' },
    { title: 'Market pulse', text: 'Major indices, exchange rates and Bitcoin in a live strip at the top of the app.', stat: '1 min', label: 'Refresh' },
  ] },
];

// The four areas of the app, summarised on the Overview page (counts come from GROUPS)
const AREAS = GROUPS.map((g) => ({
  title: { Everyday: 'Everyday money', Investing: 'Investing', Planning: 'Planning ahead', Assistant: 'A.F.A. AI' }[g.kicker],
  text: g.text + ' ' + g.items.map((i) => i.title).join(', ') + '.',
  stat: String(g.items.length), label: 'Tools',
}));

// Live market bar (the template's market pulse): US indices from Tencent quotes with the latest session's minute line,
// Bitcoin and Ether from CoinGecko with their 7-day line. Refreshes every minute; a failed source keeps its last values.
const LIVE = [
  { id: 'usINX', label: 'S&P 500' },
  { id: 'usIXIC', label: 'NASDAQ' },
  { id: 'usDJI', label: 'DOW JONES' },
  { id: 'bitcoin', label: 'BITCOIN', crypto: true },
  { id: 'ethereum', label: 'ETHER', crypto: true },
];

function sparkPath(pts) {
  if (!pts || pts.length < 2) return null;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1, step = Math.max(1, Math.floor(pts.length / 60));
  const sel = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  return sel.map((v, i) => `${i ? 'L' : 'M'}${(i / (sel.length - 1) * 80).toFixed(1)} ${(25 - (v - lo) / span * 22).toFixed(1)}`).join(' ');
}

function useLiveQuotes() {
  const [q, setQ] = useState({});
  const [at, setAt] = useState(null);
  useEffect(() => {
    let alive = true;
    const idx = LIVE.filter(i => !i.crypto).map(i => i.id);
    const load = async () => {
      const next = {};
      await Promise.all([
        fetch(`https://qt.gtimg.cn/q=${idx.join(',')}&_=${Date.now()}`).then(r => r.arrayBuffer()).then(buf => {
          new TextDecoder('gbk').decode(buf).split(';').forEach(line => {
            const m = line.match(/v_(\w+)="([^"]*)"/); if (!m) return;
            const f = m[2].split('~');
            next[m[1]] = { ...(next[m[1]] || {}), price: Number(f[3]), pct: Number(f[32]) };
          });
        }).catch(() => {}),
        ...idx.map(code => fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`).then(r => r.json()).then(j => {
          const rows = j?.data?.[code]?.data?.data || [];
          const pts = rows.map(r => Number(String(r).split(' ')[1])).filter(Number.isFinite);
          const f = j?.data?.[code]?.qt?.[code];
          next[code] = { ...(next[code] || {}), ...(pts.length > 1 ? { spark: pts } : {}), ...(f && !next[code]?.price ? { price: Number(f[3]), pct: Number(f[32]) } : {}) };
        }).catch(() => {})),
        fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&sparkline=true&price_change_percentage=24h').then(r => r.json()).then(list => {
          (Array.isArray(list) ? list : []).forEach(c => { next[c.id] = { price: c.current_price, pct: c.price_change_percentage_24h, spark: c.sparkline_in_7d?.price }; });
        }).catch(() => {}),
      ]);
      if (!alive) return;
      if (Object.keys(next).length) { setQ(prev => { const m = { ...prev }; Object.entries(next).forEach(([k, v]) => { m[k] = { ...(m[k] || {}), ...v }; }); return m; }); setAt(new Date()); }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return [q, at];
}

function LiveBar() {
  const [q, at] = useLiveQuotes();
  const fmt = (v, crypto) => (v == null || !Number.isFinite(v) ? '—' : (crypto ? '$' : '') + v.toLocaleString(undefined, { maximumFractionDigits: crypto && v < 100 ? 2 : crypto ? 0 : 2, minimumFractionDigits: crypto ? 0 : 2 }));
  return (
    <section className="t-bar" id="afl-figures" aria-label="Live markets">
      <div className="st"><span className="live" />MARKET PULSE<small>{at ? `AS OF ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'LOADING PRICES'}</small></div>
      <div className="ls five">
        {LIVE.map(({ id, label, crypto }) => {
          const d = q[id] || {}, down = d.pct < 0, path = sparkPath(d.spark);
          return (
            <div className="it" key={id}>
              <span>{label}</span>
              <strong>{fmt(d.price, crypto)}</strong>
              <small className={down ? 'down' : 'up'}>{Number.isFinite(d.pct) ? `${d.pct > 0 ? '+' : d.pct < 0 ? '−' : ''}${Math.abs(d.pct).toFixed(2)}%` : ' '}</small>
              {path && <svg viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true"><path className={'chart' + (down ? ' down' : '')} d={path} /></svg>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- App previews: real screenshots of the app's own screens (sample account) ---
const Shot = ({ src, label, alt, w, h }) => (
  <figure className="shot"><figcaption><span className="dots" aria-hidden="true"><i /><i /><i /></span>{label}</figcaption><img src={src} alt={alt} width={w} height={h} loading="lazy" /></figure>
);
const SHOWS = {
  Everyday: () => (<div className="show"><div className="stack"><Shot src={shotCashflow} label="Dashboard · Cash flow" alt="Cash flow chart from the A.F.A. dashboard" w={1400} h={583} /><Shot src={shotTxns} label="Dashboard · Transaction history" alt="Transaction history table from the A.F.A. dashboard" w={1400} h={483} /></div><Shot src={shotExpenses} label="Dashboard · Expenses per category" alt="Expenses per category chart from the A.F.A. dashboard" w={1112} h={660} /></div>),
  Investing: () => (<div className="show"><Shot src={shotStocks} label="Investments · My assets" alt="Net worth and stock holdings table from A.F.A. Investments" w={1400} h={956} /><Shot src={shotDiversity} label="Investments · Portfolio diversity" alt="Portfolio diversity chart from A.F.A. Investments" w={1112} h={600} /></div>),
  Planning: () => (<div className="show even"><Shot src={shotPayoff} label="Debt Health · Payoff plan" alt="Debt payoff plan from A.F.A. Debt Health" w={1400} h={621} /><Shot src={shotPlanner} label="Wealth Planner" alt="Wealth planner projection from A.F.A." w={1400} h={714} /></div>),
  Assistant: () => (<div className="show one"><Shot src={shotPlan} label="Analytics · Your personal action plan" alt="Personal action plan from A.F.A. Analytics" w={1400} h={640} /></div>),
};

// The sections under the landing hero on Home (the template's homepage below its hero)
export function HomeSections({ go, enter }) {
  return (
    <div className="tp on home-sec">
        <LiveBar />
        <section className="t-intro pad">
          <div className="kick">The A.F.A. difference</div>
          <div className="body">
            <h2>Money is personal.<br /><em>Your plan should be too.</em></h2>
            <p>A.F.A. learns from what you record and updates your position and priorities as your finances change. It starts with what matters to you, then brings together your accounts, goals and market data to show the next step.</p>
            <a className="t-dark" href="#why-afa" onClick={go('why-afa')}>Why people choose A.F.A. <Arrow /></a>
          </div>
          <Shot src={shotOverview} label="A.F.A. · Dashboard" alt="The A.F.A. dashboard: next step, balances, cash flow and budget score" w={1400} h={759} />
        </section>

        <section className="t-navy pad">
          <div className="t-head">
            <div><div className="kick light">How it works</div><h2>From your first record<br /><em>to a plan you can act on.</em></h2></div>
            <p>Three steps, repeated every month. Your position and priorities update as your finances change.</p>
          </div>
          <CardGrid items={STEPS} />
          <p className="t-note">Figures describe the platform's scope. A.F.A. provides educational information, not licensed financial advice.</p>
        </section>

        <Closing kicker="Get started" title={<>See your own numbers.<br />It starts with <em>a minute of setup.</em></>} enter={enter} />
        <Footer go={go} />
    </div>
  );
}

export default function TemplatePages({ page, go, enter }) {
  const view = (p) => 'tp' + (page === p ? ' on' : '');
  return (
    <>
      {/* Overview */}
      <main className={view('overview')} aria-label="Overview">
        <section className="t-hero short">
          <img src={cityPhoto} alt="" />
          <div className="ov" /><div className="cols" aria-hidden="true" />
          <div className="in">
            <p className="eyebrow2">Overview</p>
            <h1>Your whole money life, <em>on one screen.</em></h1>
            <p className="copy">See where every dollar goes, how healthy your finances are and exactly what to do next. One app for spending, saving, investing and planning ahead.</p>
          </div>
        </section>

        <section className="t-intro pad">
          <div className="kick">The dashboard</div>
          <div className="body">
            <h2>Know where you stand<br /><em>in five seconds.</em></h2>
            <p>Open A.F.A. and the most useful next step sits at the top, followed by this month's income, spending, savings and your budget score. Every number links to the detail behind it.</p>
            <a className="t-dark" href="#features" onClick={go('features')}>See every feature <Arrow /></a>
          </div>
          <Shot src={shotOverview} label="A.F.A. · Dashboard" alt="The A.F.A. dashboard: next step, balances, cash flow and budget score" w={1400} h={759} />
        </section>

        <section className="t-navy pad">
          <div className="t-head">
            <div><div className="kick light">How it works</div><h2>From your first record<br /><em>to a plan you can act on.</em></h2></div>
            <p>Three steps, repeated every month. Your position and priorities update as your finances change.</p>
          </div>
          <CardGrid items={STEPS} />
        </section>

        <section className="t-light paper pad">
          <div className="t-head">
            <div><div className="kick">Inside the app</div><h2>Four areas,<br /><em>one assistant.</em></h2></div>
            <p>Everything A.F.A. does, grouped the way you think about money.</p>
          </div>
          {SHOWS.Investing()}
          <CardGrid items={AREAS} />
          <p className="t-note">Screens show a sample account. A.F.A. provides educational information, not licensed financial advice.</p>
        </section>

        <Closing kicker="Get started" title={<>Your future self<br />will <em>thank you.</em></>} enter={enter} />
        <Footer go={go} />
      </main>

      {/* Why A.F.A. */}
      <main className={view('why-afa')} aria-label="Why A.F.A.">
        <section className="t-hero short">
          <img src={cityPhoto} alt="" />
          <div className="ov" /><div className="cols" aria-hidden="true" />
          <div className="in">
            <p className="eyebrow2">Why A.F.A.</p>
            <h1>Designed around how you <em>actually manage money.</em></h1>
            <p className="copy">General budgeting apps stop at charts. A.F.A. connects your spending, retirement savings, tax and investments, and tells you what to do next.</p>
          </div>
        </section>

        <section className="t-rows pad">
          <div className="side">
            <div className="kick">Principles</div>
            <h2>Four principles<br /><em>behind the platform.</em></h2>
            <p>Each one shapes how A.F.A. calculates, explains and protects your information.</p>
          </div>
          <div className="rows">
            {PRINCIPLES.map((r, i) => (
              <div className="row" key={r.title}><span className="n">0{i + 1}</span><span className="tg">{r.tag}</span><div><h3>{r.title}</h3><p>{r.text}</p></div></div>
            ))}
          </div>
        </section>

        <section className="t-light paper pad">
          <div className="t-head">
            <div><div className="kick">Comparison</div><h2>How A.F.A. <em>compares.</em></h2></div>
            <p>Compared with a general-purpose budgeting app.</p>
          </div>
          <div className="cmp-wrap">
            <table className="cmp">
              <thead><tr><th>Capability</th><th>Typical budgeting app</th><th className="afa">A.F.A.</th></tr></thead>
              <tbody>
                {COMPARE.map(([k, no, yes]) => (
                  <tr key={k}><td>{k}</td><td><span className="mark no"><svg><use href="#afl-i-no" /></svg>{no}</span></td><td className="afa"><span className="mark yes"><svg><use href="#afl-i-yes" /></svg>{yes}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-note">A.F.A. provides educational information and examples. It is not licensed investment advice.</p>
        </section>

        <Closing kicker="Get started" title={<>Built for the way<br />you <em>manage money.</em></>} enter={enter} />
        <Footer go={go} />
      </main>

      {/* Features */}
      <main className={view('features')} aria-label="Features">
        <section className="t-hero short">
          <img src={cityPhoto} alt="" />
          <div className="ov" /><div className="cols" aria-hidden="true" />
          <div className="in">
            <p className="eyebrow2">Features</p>
            <h1>Everything in <em>one platform.</em></h1>
            <p className="copy">Tools for everyday budgeting, long-term planning and investment research, brought together in a single assistant.</p>
          </div>
        </section>

        {GROUPS.map((g) => (
          <section className={g.cls + ' pad'} key={g.kicker}>
            <div className="t-head">
              <div><div className={'kick' + (g.cls === 't-navy' ? ' light' : '')}>{g.kicker}</div><h2>{g.title}</h2></div>
              <p>{g.text}</p>
            </div>
            {SHOWS[g.kicker] && React.createElement(SHOWS[g.kicker])}
            <CardGrid items={g.items} />
          </section>
        ))}

        <Closing kicker="Get started" title={<>See every feature<br />with <em>your own numbers.</em></>} enter={enter} />
        <Footer go={go} />
      </main>
    </>
  );
}
