import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Check, Loader2, Search, Mic, Plus, Play, Info, Share, Undo2, Settings, Bell, ChevronDown, CheckCircle2 } from 'lucide-react';

// Guided Apple Pay setup, modelled on how finance apps with a shared shortcut do it:
//  1. Add the shared "Add to A.F.A." shortcut (its Wallet trigger is built in, switched off)
//  2. Walk through 6 illustrated taps that switch the trigger on
//  3. Wait for the first card tap, which turns the status green by itself

const SHORTCUT_NAME = 'Add to A.F.A.';

// ---- Tiny iOS-style mock screens (light, like the real Shortcuts app) ----
const Ring = ({ on, children, className = '' }) => (
  <div className={`relative rounded-[10px] ${on ? 'ring-2 ring-[#00d4e6] ring-offset-2 ring-offset-transparent' : ''} ${className}`}>{children}</div>
);
const Status = () => (
  <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[10px] font-semibold text-black"><span>09:41</span><span className="tracking-tight">▮▮▮ ◠ ▭</span></div>
);
const Tile = ({ ring }) => (
  <Ring on={ring} className="w-[46%]">
    <div className="h-16 rounded-[10px] p-2 flex flex-col justify-between" style={{ background: 'linear-gradient(135deg,#00e5f5,#0a86c7)' }}>
      <div className="flex justify-between items-start">
        <span className="w-5 h-5 rounded-md bg-[#0d1117] grid place-items-center"><svg viewBox="0 0 100 100" className="w-3.5 h-3.5"><path d="M30 72 L50 30 L70 72" fill="none" stroke="#00f2fe" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        <span className="w-4 h-4 rounded-full bg-white/40 grid place-items-center"><Play className="w-2 h-2 text-white fill-white" /></span>
      </div>
      <span className="text-[10px] font-semibold text-white">{SHORTCUT_NAME}</span>
    </div>
  </Ring>
);
const Block = ({ children, dashed }) => (
  <div className={`mx-2.5 mb-2 rounded-[10px] bg-white px-2.5 py-2 text-[10px] leading-[1.5] text-black ${dashed ? 'border border-dashed border-slate-300 bg-slate-50' : ''}`}>{children}</div>
);
const Pill = ({ children }) => <span className="text-[#0a7cff]">{children}</span>;
const Toggle = ({ on }) => (
  <span className={`inline-flex w-6 h-3.5 rounded-full p-[2px] ${on ? 'bg-[#34c759] justify-end' : 'bg-slate-300 justify-start'}`}><span className="w-2.5 h-2.5 rounded-full bg-white shadow" /></span>
);
const EditorTop = ({ backRing }) => (
  <div className="flex items-center justify-between px-2.5 py-1.5">
    <Ring on={backRing} className="rounded-full"><span className="w-5 h-5 rounded-full bg-white grid place-items-center"><ChevronLeft className="w-3 h-3 text-black" /></span></Ring>
    <span className="text-[10px] font-semibold text-black flex items-center gap-1">{SHORTCUT_NAME}<ChevronDown className="w-2.5 h-2.5 text-slate-400" /></span>
    <span className="w-5 h-5 rounded-full bg-white grid place-items-center"><Settings className="w-3 h-3 text-black" /></span>
  </div>
);
const EditorBody = ({ step }) => (
  <>
    <Block><b className="font-semibold">Receive</b> <Pill>Notifications</Pill> from <span className="text-slate-400">Nowhere</span><div className="text-slate-400 text-[10px] mt-0.5">If there's no input: <Pill>Continue</Pill></div></Block>
    <Block dashed={step < 6}>
      {step < 6 && <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Bell className="w-2.5 h-2.5" /> Automation is turned off</div>}
      <div className="flex items-center flex-wrap gap-x-1"><Bell className={`w-2.5 h-2.5 ${step >= 6 ? 'text-rose-500' : 'text-slate-500'}`} /> When I receive a notification from <span className="inline-flex items-center gap-0.5 text-[#0a7cff]"><span className="w-2.5 h-2.5 rounded-[3px] bg-gradient-to-b from-orange-400 via-rose-500 to-blue-500" />Wallet</span>
        <Ring on={step === 4} className="rounded-full inline-block"><span className="w-3.5 h-3.5 rounded-full border border-[#0a7cff] grid place-items-center"><ChevronDown className="w-2.5 h-2.5 text-[#0a7cff]" /></span></Ring>
      </div>
      {step >= 5 && (
        <div className="mt-1.5 border-t border-slate-200 pt-1.5 space-y-1">
          <Ring on={step === 5} className="px-1 -mx-1"><div className="flex items-center justify-between py-0.5"><span>Automation</span><Toggle on={step >= 6} /></div></Ring>
          {step >= 6 && <div className="flex items-center justify-between py-0.5"><span>Notify</span><Toggle on={false} /></div>}
        </div>
      )}
    </Block>
    <Block><b className="font-semibold">If</b> <Pill>Title</Pill> <Pill>has any value</Pill></Block>
    <Block><b className="font-semibold">Get contents of</b> <Pill>your A.F.A. link</Pill></Block>
  </>
);
const Dock = () => (
  <div className="absolute left-2 right-2 bottom-2 rounded-2xl bg-white/90 border border-slate-200 p-1.5">
    <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-400"><Search className="w-2.5 h-2.5" /> Search<Mic className="w-2.5 h-2.5 ml-auto" /></div>
    <div className="flex justify-around pt-1.5 text-black"><Undo2 className="w-3 h-3" /><Info className="w-3 h-3" /><Share className="w-3 h-3" /><Play className="w-3 h-3 fill-black" /></div>
  </div>
);

const SLIDES = [
  { caption: <>Tap <b>All Shortcuts</b>.</>, screen: () => (
    <>
      <div className="flex justify-end gap-1.5 px-2.5 py-1"><span className="px-2 py-0.5 rounded-full bg-white text-[10px] text-black">Edit</span></div>
      <div className="px-3 text-[15px] font-bold text-black mb-1.5">Library</div>
      <div className="mx-2.5 rounded-[10px] bg-white text-[10px] text-black divide-y divide-slate-100">
        <Ring on className="rounded-[10px]"><div className="flex justify-between px-2.5 py-1.5"><span>All Shortcuts</span><span className="text-slate-400">1 ›</span></div></Ring>
        {['Share Sheet', 'Apple Watch', 'Gallery', 'Automation'].map(t => <div key={t} className="flex justify-between px-2.5 py-1.5"><span>{t}</span><span className="text-slate-400">›</span></div>)}
      </div>
    </>
  ) },
  { caption: <>Tap <b>{SHORTCUT_NAME}</b>.</>, screen: () => (
    <>
      <div className="flex justify-between px-2.5 py-1"><span className="w-5 h-5 rounded-full bg-white grid place-items-center"><ChevronLeft className="w-3 h-3 text-black" /></span><span className="px-2 py-0.5 rounded-full bg-white text-[10px] text-black">Select</span></div>
      <div className="px-3 text-[15px] font-bold text-black mb-1.5">All Shortcuts</div>
      <div className="mx-2.5 mb-2 flex items-center gap-1 rounded-lg bg-slate-200/70 px-2 py-1 text-[10px] text-slate-500"><Search className="w-2.5 h-2.5" /> Search</div>
      <div className="px-2.5 flex"><Tile ring /></div>
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-slate-200 grid place-items-center"><Plus className="w-3.5 h-3.5 text-black" /></span>
    </>
  ) },
  { caption: <>Tap <b>Edit</b>.</>, screen: () => (
    <>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="w-5 h-5 rounded-full bg-white grid place-items-center"><ChevronLeft className="w-3 h-3 text-black" /></span>
        <span className="text-[10px] font-semibold text-black">{SHORTCUT_NAME}</span>
        <Ring on className="rounded-full"><span className="px-2 py-0.5 rounded-full bg-white text-[10px] text-black">Edit</span></Ring>
      </div>
      <div className="mx-4 mt-6 rounded-2xl bg-white h-24 grid place-items-center text-[10px] text-slate-500 text-center px-3">Logs each Apple Pay payment to your A.F.A. records</div>
    </>
  ) },
  { caption: <>Tap the <b>⌄</b> after <b>Wallet</b>.</>, screen: () => (<><EditorTop /><EditorBody step={4} /><Dock /></>) },
  { caption: <>Turn <b>Automation</b> on.</>, screen: () => (<><EditorTop /><EditorBody step={5} /><Dock /></>) },
  { caption: <>Tap <b>Back</b>. That saves it.</>, screen: () => (<><EditorTop backRing /><EditorBody step={6} /><Dock /></>) }
];

function Phone({ children }) {
  return (
    <div className="mx-auto w-[min(62vw,230px)] aspect-[9/18.5] rounded-[30px] bg-[#05080c] p-[7px] shadow-[0_24px_60px_-20px_rgba(0,200,230,0.35)] border border-white/10">
      <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-[#f2f2f7]">
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-3.5 rounded-full bg-black z-10" />
        <Status />
        {children}
      </div>
    </div>
  );
}

export default function ApplePaySetup({ shortcutUrl, onAdd, connected, received }) {
  const [i, setI] = useState(0);
  const [added, setAdded] = useState(false);
  const S = SLIDES[i];
  return (
    <div className="mt-4 space-y-4">
      {/* Step 1 */}
      <div className={`p-4 rounded-2xl border ${added ? 'border-emerald-400/25 bg-emerald-400/[0.04]' : 'border-slate-800 bg-[#0d1117]'}`}>
        <div className="flex items-start gap-3">
          <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-black shrink-0 ${added ? 'bg-emerald-400 text-[#06231a]' : 'bg-[#00f2fe]/15 text-[#00f2fe]'}`}>{added ? <Check className="w-3.5 h-3.5" /> : 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">Add the A.F.A. shortcut</div>
            <p className="text-[11.5px] text-slate-400 mt-0.5 leading-relaxed">Your private link is copied for you. Tap <b className="text-slate-200">Add Shortcut</b>, and when it asks for your A.F.A. link, tap <b className="text-slate-200">Paste</b>.</p>
            <button disabled={!shortcutUrl} onClick={() => { onAdd(); setAdded(true); window.location.href = shortcutUrl; }} className="mt-3 w-full bg-[#00f2fe] text-[#0d1117] py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40">
              <Download className="w-4 h-4" /> {shortcutUrl ? 'Add shortcut' : 'Shortcut link coming soon'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: illustrated walkthrough */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-[#0d1117]">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-black shrink-0 bg-[#00f2fe]/15 text-[#00f2fe]">2</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">Switch it on for every card tap</div>
            <p className="text-[11.5px] text-slate-400 mt-0.5 leading-relaxed">Apple only lets you switch this on inside its Shortcuts app. A few taps, once. Here they are.</p>
          </div>
        </div>
        <Phone>{S.screen()}</Phone>
        <p className="text-center text-[13px] text-slate-200 mt-3">{S.caption}</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous step" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-slate-300 disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-[11px] font-mono text-slate-500 w-12 text-center">{i + 1} of {SLIDES.length}</span>
          <button onClick={() => setI(Math.min(SLIDES.length - 1, i + 1))} disabled={i === SLIDES.length - 1} aria-label="Next step" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-slate-300 disabled:opacity-30 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <ol className="mt-4 space-y-2.5">
          {[<>Open <b>All Shortcuts</b> and tap <b>{SHORTCUT_NAME}</b>, then <b>Edit</b>.</>, <>In the Wallet box at the top, tap the <b>⌄</b> after <b>Wallet</b>.</>, <>Turn <b>Automation</b> on. Leave Notify off.</>, <>Tap <b>Back</b>. That saves it.</>].map((t, k) => (
            <li key={k} className="flex items-start gap-2.5 text-[12px] text-slate-300 leading-snug [&_b]:text-white">
              <span className="w-5 h-5 rounded-full bg-[#00f2fe] text-[#0d1117] text-[10px] font-black grid place-items-center shrink-0">{k + 1}</span><span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
        <button onClick={() => { window.location.href = 'shortcuts://'; }} className="mt-4 w-full border border-[#00f2fe]/40 text-[#00f2fe] py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> Open Shortcuts
        </button>
      </div>

      {/* Step 3: live status */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${received ? 'border-emerald-400/30 bg-emerald-400/[0.06]' : 'border-slate-800 bg-[#0d1117]'}`}>
        {received ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Loader2 className="w-5 h-5 text-slate-500 animate-spin shrink-0" />}
        <div>
          <div className={`text-sm font-bold ${received ? 'text-emerald-300' : 'text-white'}`}>{received ? 'Connected' : 'Waiting for your first card tap'}</div>
          <p className="text-[11.5px] text-slate-400 mt-0.5">{received ? `Received: ${received}. Every Apple Pay payment now lands in Records.` : 'Pay with Apple Pay once. This line turns green by itself.'}</p>
        </div>
      </div>
    </div>
  );
}
