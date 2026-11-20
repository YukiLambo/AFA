import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { doc, collection, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { Smartphone, Copy, Check, X, Zap, Unlink, Loader2 } from 'lucide-react';
import { todayLocal } from './TransactionComposer';

// Apple Pay auto-sync.
// An iPhone Shortcuts automation ("Transaction" trigger) posts each Apple Pay tap to a private inbox in
// Firestore: applePayInbox/{secret key}/tx. Anyone with the key can add to the inbox but only the owner
// can read it. While the user has A.F.A. open on any device, each new item is turned into a normal
// transaction and removed from the inbox. No server code and no paid Firebase plan are needed.

const PROJECT_ID = 'afaapp-3cba6';
const API_KEY = 'AIzaSyArZZDniGw4tromow4bVLj2efh8NJWYieE';
const appIdOf = () => (typeof __app_id !== 'undefined' ? __app_id : 'afa-default');

export const inboxUrl = (key) => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/applePayInbox/${key}/tx?key=${API_KEY}`;
export const BODY_TEMPLATE = '{"fields":{"merchant":{"stringValue":"MERCHANT"},"amount":{"stringValue":"AMOUNT"},"card":{"stringValue":"CARD"}}}';

const newKey = () => {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
};

// "HK$1,234.50", "-$45.00", "45.00 HKD", "US$12.99" -> { value, currency, refund }
export function parseAmount(raw) {
  const s = String(raw || '').trim();
  const num = s.replace(/[^0-9.,-]/g, '');
  let clean = num;
  if (/,\d{2}$/.test(num) && !/\./.test(num)) clean = num.replace(/\./g, '').replace(',', '.'); // 12,50 style
  else clean = num.replace(/,/g, '');
  const value = Math.abs(parseFloat(clean));
  const refund = /^-|^\(|refund/i.test(s) || parseFloat(clean) < 0;
  let currency = 'HKD';
  if (/US\$|USD/i.test(s)) currency = 'USD';
  else if (/HK\$|HKD/i.test(s)) currency = 'HKD';
  else if (/MOP|MOP\$/i.test(s)) currency = 'MOP';
  else if (/RMB|CNY|CN¥|元/i.test(s)) currency = 'CNY';
  else if (/JP¥|JPY|円/i.test(s)) currency = 'JPY';
  else if (/£|GBP/i.test(s)) currency = 'GBP';
  else if (/€|EUR/i.test(s)) currency = 'EUR';
  else if (/¥/.test(s)) currency = 'JPY';
  return { value: isFinite(value) ? value : 0, currency, refund };
}

// Merchant name -> spending category (common Hong Kong merchants first)
const RULES = [
  ['Transport', /\bmtr\b|octopus|kmb|citybus|ctb|nwfb|uber|taxi|hktaxi|didi|first ferry|star ferry|tram|airport express|shell|caltex|esso|sinopec|parking|towngas.*car/i],
  ['Coffee & Snacks', /starbucks|pacific coffee|% arabica|arabica|cafe|café|coffee|bakery|tea|chatime|gong cha|tamjai|7-eleven|7 eleven|circle k|vango/i],
  ['Groceries', /parknshop|park n shop|wellcome|aeon|yata|city.?super|market place|fusion|3hreesixty|u select|donki|don don donki|jusco|supermarket|grocery/i],
  ['Dining', /mcdonald|kfc|burger|pizza|maxim|café de coral|cafe de coral|fairwood|yoshinoya|sushi|ramen|restaurant|dim sum|noodle|kitchen|bistro|bar\b|foodpanda|deliveroo|keeta|food|tamjai|genki|steak|bbq/i],
  ['Subscriptions', /netflix|spotify|disney|apple\.com|icloud|youtube|chatgpt|openai|adobe|microsoft|google|viu|patreon|subscription/i],
  ['Phone & Internet', /csl|1o1o|smartone|3hk|china mobile|cmhk|hkbn|pccw|netvigator|hkt\b|birdie/i],
  ['Utilities', /clp|hk electric|towngas|water supplies|wsd/i],
  ['Health', /watsons|mannings|pharmacy|clinic|hospital|dental|medical|optical|health/i],
  ['Beauty', /sasa|bonjour|sephora|salon|beauty|cosmetic|nail/i],
  ['Clothing', /uniqlo|zara|h&m|h & m|gu\b|cos\b|muji|nike|adidas|lululemon|giordano|bossini|esprit/i],
  ['Entertainment', /cinema|ufo|broadway|mcl|emperor cinema|steam|playstation|nintendo|ktv|neway|red mr|ticket|ocean park|disneyland/i],
  ['Travel', /cathay|hk express|greater bay|airline|airways|hotel|booking\.com|agoda|trip\.com|klook|expedia|airbnb/i],
  ['Fitness', /gym|fitness|pure|anytime|yoga|decathlon/i],
  ['Education', /university|hkbu|course|udemy|coursera|book|commercial press|eslite|popular/i],
  ['Shopping', /hktvmall|amazon|taobao|apple store|fortress|broadway|ikea|log-on|daiso|japan home|shop|store|mall/i]
];
export const guessCategory = (merchant) => {
  const m = String(merchant || '');
  for (const [cat, re] of RULES) if (re.test(m)) return cat;
  return 'Other';
};

// Approximate HKD per unit, so foreign payments count in HKD totals (the original amount stays in the description)
const TO_HKD = { HKD: 1, USD: 7.8, MOP: 0.97, CNY: 1.08, JPY: 0.051, GBP: 10.2, EUR: 8.9 };

// Turn one inbox item into an A.F.A. transaction
export function toTransaction(item) {
  const merchant = String(item.merchant || '').trim() || 'Apple Pay purchase';
  const card = String(item.card || '').trim();
  const { value, currency, refund } = parseAmount(item.amount);
  const account = /octopus/i.test(card) ? 'Octopus' : 'Credit Card';
  return {
    description: `${merchant}${currency !== 'HKD' ? ` (paid ${currency} ${value.toFixed(2)})` : ''}`,
    amount: Math.round(value * (TO_HKD[currency] || 1) * 100) / 100,
    category: refund ? 'Refund' : guessCategory(merchant),
    type: refund ? 'income' : 'expense',
    date: todayLocal(),
    account,
    source: 'Apple Pay',
    card,
    rawAmount: String(item.amount || '')
  };
}

// Runs in App: keeps the user's key and moves new inbox items into their transactions
export function useApplePaySync(db, user) {
  const [state, setState] = useState({ key: null, loading: true, imported: 0, lastMerchant: '' });
  const busy = useRef(new Set());

  useEffect(() => {
    if (!user) return;
    let unsubInbox = null;
    let currentKey = null;
    const settingsRef = doc(db, 'artifacts', appIdOf(), 'users', user.uid, 'settings', 'applePay');
    const unsub = onSnapshot(settingsRef, (snap) => {
      const key = snap.exists() ? snap.data().key : null;
      setState(s => ({ ...s, key, loading: false }));
      if (key === currentKey) return;
      currentKey = key;
      if (unsubInbox) { unsubInbox(); unsubInbox = null; }
      if (!key) return;
      unsubInbox = onSnapshot(collection(db, 'applePayInbox', key, 'tx'), (list) => {
        list.forEach(d => {
          if (busy.current.has(d.id)) return;
          busy.current.add(d.id);
          const tx = toTransaction(d.data());
          // Same id on both sides, so two open devices never record the same tap twice
          setDoc(doc(db, 'artifacts', appIdOf(), 'users', user.uid, 'transactions', `ap_${d.id}`), tx)
            .then(() => deleteDoc(doc(db, 'applePayInbox', key, 'tx', d.id)))
            .then(() => setState(s => ({ ...s, imported: s.imported + 1, lastMerchant: tx.description })))
            .catch(err => { console.error('Apple Pay import error:', err); busy.current.delete(d.id); });
        });
      }, (err) => console.error('Apple Pay inbox error:', err));
    }, (err) => { console.error('Apple Pay settings error:', err); setState(s => ({ ...s, loading: false })); });
    return () => { unsub(); if (unsubInbox) unsubInbox(); };
  }, [db, user]);

  const connect = async () => {
    const key = newKey();
    await setDoc(doc(db, 'applePayInbox', key), { uid: user.uid, created: new Date().toISOString() });
    await setDoc(doc(db, 'artifacts', appIdOf(), 'users', user.uid, 'settings', 'applePay'), { key, connectedAt: new Date().toISOString() });
  };
  const disconnect = async () => {
    if (state.key) { try { await deleteDoc(doc(db, 'applePayInbox', state.key)); } catch (e) { /* already gone */ } }
    await deleteDoc(doc(db, 'artifacts', appIdOf(), 'users', user.uid, 'settings', 'applePay'));
  };
  return { ...state, connect, disconnect };
}

function CopyRow({ label, value, mono = true }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch (e) { /* ignore */ }
  };
  return (
    <div className="mt-2">
      <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">{label}</div>
      <div className="flex items-stretch gap-2">
        <div className={`flex-1 min-w-0 bg-[#0d1117] border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
        <button onClick={copy} className="shrink-0 px-3 rounded-xl border border-slate-700 text-slate-300 hover:text-[#00f2fe] hover:border-[#00f2fe]/50 cursor-pointer flex items-center gap-1 text-[11px]">
          {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{done ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// Card on the Transactions page, plus the setup guide
export function ApplePayCard({ sync }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const run = async (fn) => { setWorking(true); try { await fn(); } catch (e) {
    console.error(e);
    const code = String(e && (e.code || e.message) || '');
    alert(/permission|insufficient/i.test(code)
      ? 'Firebase blocked this (permission denied). The new Apple Pay rules are not published yet: Firebase Console → Firestore Database → Rules → paste firestore.rules → Publish, wait a minute, then try again.'
      : /unavailable|network|offline/i.test(code)
        ? 'No connection to Firebase. Check your internet connection and try again.'
        : `Could not update Apple Pay sync (${code || 'unknown error'}).`);
  } finally { setWorking(false); } };
  const connected = !!sync.key;

  return (
    <>
      <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0d1117] border border-slate-800 flex items-center justify-center shrink-0"><Smartphone className="w-4 h-4 text-[#00f2fe]" /></div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">Apple Pay auto-sync
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${connected ? 'border-emerald-400/40 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>{connected ? 'CONNECTED' : 'OFF'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {connected
                ? (sync.imported > 0 ? `${sync.imported} payment${sync.imported > 1 ? 's' : ''} added this session · latest: ${sync.lastMerchant}` : 'Every Apple Pay tap on your iPhone is added here automatically, with a category.')
                : 'Record every Apple Pay tap automatically. One-time setup on your iPhone, about 3 minutes.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && <button onClick={() => setOpen(true)} className="px-4 py-1.5 rounded-xl text-xs border border-slate-700 text-slate-300 hover:text-white cursor-pointer">Setup guide</button>}
          {!connected ? (
            <button disabled={working || sync.loading} onClick={() => run(async () => { await sync.connect(); setOpen(true); })} className="bg-[#00f2fe] text-[#0d1117] px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md hover:bg-cyan-400 transition-colors disabled:opacity-50">
              {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Connect Apple Pay
            </button>
          ) : (
            <button disabled={working} onClick={() => { if (window.confirm('Turn off Apple Pay auto-sync? Your iPhone shortcut will stop working until you connect again.')) run(sync.disconnect); }} className="px-3 py-1.5 rounded-xl text-xs border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 cursor-pointer flex items-center gap-1.5">
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </button>
          )}
        </div>
      </div>

      {open && connected && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="glass-panel w-full max-w-xl max-h-[88vh] overflow-y-auto no-scrollbar rounded-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2"><Smartphone className="w-4 h-4 text-[#00f2fe]" /> Set up the iPhone shortcut</h3>
                <p className="text-xs text-slate-400 mt-1">Needs iOS 17 or later and cards in Apple Wallet. Do this once on your iPhone.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <ol className="mt-4 space-y-3 text-xs text-slate-300 list-decimal pl-4 leading-relaxed">
              <li>Open <b className="text-white">Shortcuts</b> → <b className="text-white">Automation</b> → <b className="text-white">+</b> → <b className="text-white">Transaction</b>. Choose your cards, leave every category ticked, pick <b className="text-white">Run Immediately</b>, then <b className="text-white">Next</b> → <b className="text-white">New Blank Automation</b>.</li>
              <li>Add the action <b className="text-white">Text</b>. Paste the body below into it. Then select the word <span className="font-mono text-[#00f2fe]">MERCHANT</span>, tap <b className="text-white">Shortcut Input</b> in the bar above the keyboard, tap the inserted variable and choose <b className="text-white">Merchant</b>. Do the same for <span className="font-mono text-[#00f2fe]">AMOUNT</span> (choose <b className="text-white">Amount</b>) and <span className="font-mono text-[#00f2fe]">CARD</span> (choose <b className="text-white">Card or Pass</b> / <b className="text-white">Name</b>).
                <CopyRow label="Body" value={BODY_TEMPLATE} />
              </li>
              <li>Add the action <b className="text-white">Get Contents of URL</b> and paste your personal link below. Tap the arrow to show more: set <b className="text-white">Method</b> to <b className="text-white">POST</b>, add a header <span className="font-mono">Content-Type</span> = <span className="font-mono">application/json</span>, and set <b className="text-white">Request Body</b> to <b className="text-white">File</b> and choose the <b className="text-white">Text</b> from step 2.
                <CopyRow label="Your personal link (keep it private)" value={inboxUrl(sync.key)} />
              </li>
              <li>Tap <b className="text-white">Done</b>. Pay with Apple Pay once: the payment appears on this page within a few seconds, on your phone or your computer.</li>
            </ol>

            <div className="mt-5 p-3 rounded-xl bg-[#0d1117] border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <b className="text-slate-200">What it records:</b> payments made by tapping or paying with Apple Pay on this iPhone, anywhere in the world. Foreign-currency payments are noted in the description. It cannot see card swipes, autopay or direct debits; add those as repeating records.
              <br /><b className="text-slate-200">Privacy:</b> your link only lets the phone drop payments into your private inbox; it cannot read anything. If it leaks, press Disconnect and connect again to get a new link.
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
