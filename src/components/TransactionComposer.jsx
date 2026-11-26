import React, { useEffect, useMemo, useState } from 'react';
import { useMoney } from '../lib/currency';
import {
  X, Utensils, Coffee, ShoppingCart, ShoppingBag, Shirt, Bus, Car, Home, Zap, Smartphone, Gamepad2, Tv,
  HeartPulse, Sparkles, GraduationCap, Plane, Gift, Users, Shield, PawPrint, Baby, TrendingUp, MoreHorizontal,
  Briefcase, Award, Clock, Laptop, Coins, Banknote, Percent, RotateCcw, Repeat, Calendar, Delete, Wallet,
  Landmark, Receipt, Dumbbell
} from 'lucide-react';

// --- Categories -----------------------------------------------------------------------------------
// `id` is what gets stored on the transaction. The first ids match the categories the app already used,
// so older records, charts and budgets keep working.
export const EXPENSE_CATEGORIES = [
  { id: 'Dining', label: 'Dining', icon: Utensils },
  { id: 'Groceries', label: 'Groceries', icon: ShoppingCart },
  { id: 'Coffee & Snacks', label: 'Coffee', icon: Coffee },
  { id: 'Transport', label: 'Transport', icon: Bus },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'Clothing', label: 'Clothing', icon: Shirt },
  { id: 'Rent', label: 'Rent', icon: Home },
  { id: 'Utilities', label: 'Utilities', icon: Zap },
  { id: 'Phone & Internet', label: 'Phone', icon: Smartphone },
  { id: 'Subscriptions', label: 'Subscriptions', icon: Tv },
  { id: 'Entertainment', label: 'Fun', icon: Gamepad2 },
  { id: 'Health', label: 'Health', icon: HeartPulse },
  { id: 'Beauty', label: 'Beauty', icon: Sparkles },
  { id: 'Fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'Education', label: 'Education', icon: GraduationCap },
  { id: 'Travel', label: 'Travel', icon: Plane },
  { id: 'Car', label: 'Car', icon: Car },
  { id: 'Social', label: 'Social', icon: Users },
  { id: 'Gifts Given', label: 'Gifts', icon: Gift },
  { id: 'Insurance', label: 'Insurance', icon: Shield },
  { id: 'Pets', label: 'Pets', icon: PawPrint },
  { id: 'Children', label: 'Children', icon: Baby },
  { id: 'Fees & Tax', label: 'Fees & Tax', icon: Receipt },
  { id: 'Investment', label: 'Invest', icon: TrendingUp },
  { id: 'Other', label: 'Other', icon: MoreHorizontal }
];

export const INCOME_CATEGORIES = [
  { id: 'Salary', label: 'Salary', icon: Briefcase },
  { id: 'Bonus', label: 'Bonus', icon: Award },
  { id: 'Part Time', label: 'Part Time', icon: Clock },
  { id: 'Freelance', label: 'Freelance', icon: Laptop },
  { id: 'Allowance', label: 'Allowance', icon: Wallet },
  { id: 'Scholarship', label: 'Scholarship', icon: GraduationCap },
  { id: 'Red Packet', label: 'Red Packet', icon: Gift },
  { id: 'Capital Gain', label: 'Capital Gain', icon: TrendingUp },
  { id: 'Dividend', label: 'Dividend', icon: Coins },
  { id: 'Interest', label: 'Interest', icon: Percent },
  { id: 'Refund', label: 'Refund', icon: RotateCcw },
  { id: 'Gift', label: 'Gift', icon: Banknote },
  { id: 'Other', label: 'Other', icon: MoreHorizontal }
];

export const ACCOUNTS = ['Bank Account', 'Cash', 'Octopus', 'Credit Card', 'Crypto'];

export const REPEAT_OPTIONS = [
  { id: 'none', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' }
];
export const repeatLabel = (id) => REPEAT_OPTIONS.find(o => o.id === id)?.label || id;

export const categoryIcon = (id) => [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(c => c.id === id)?.icon || Landmark;

// --- Dates (local calendar days, so 7am in Hong Kong is still "today") ------------------------------
const pad = (n) => String(n).padStart(2, '0');
export const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayLocal = () => toLocalDate(new Date());
const parseLocal = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Next occurrence after `dateStr`. Monthly/yearly keep the original day (31st → last day of shorter months).
export function nextOccurrence(dateStr, frequency, anchorDay) {
  const d = parseLocal(dateStr);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 14);
  else if (frequency === 'monthly' || frequency === 'yearly') {
    const y = d.getFullYear() + (frequency === 'yearly' ? 1 : 0);
    const m = d.getMonth() + (frequency === 'monthly' ? 1 : 0);
    const lastDay = new Date(y, m + 1, 0).getDate();
    return toLocalDate(new Date(y, m, Math.min(anchorDay || d.getDate(), lastDay)));
  }
  return toLocalDate(d);
}

// --- Calculator: "12.5+30-4" → 38.5 (only + and −, evaluated left to right) -----------------------
function evaluate(expr) {
  const parts = expr.match(/[+-]?[^+-]+/g) || [];
  const total = parts.reduce((sum, p) => sum + (parseFloat(p) || 0), 0);
  return Math.round(total * 100) / 100;
}

const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prettyDate = (s) => (s === todayLocal() ? 'Today' : parseLocal(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));

const blankState = (type = 'expense') => ({
  type,
  category: type === 'income' ? 'Salary' : 'Dining',
  expr: '',
  note: '',
  date: todayLocal(),
  account: 'Bank Account',
  repeat: 'none',
  endDate: ''
});

/**
 * Transaction recorder: pick a category, then enter the amount. Phones get a built-in keypad (no phone
 * keyboard); computers get a normal amount field. Optionally make it repeat. `onSave({ tx, repeat })` gets:
 *   tx     – { description, amount, category, type, date, account }
 *   repeat – { frequency: 'none' | 'daily' | ..., endDate }
 * Return a promise; the sheet waits for it. "Save & next" keeps the sheet open for another record.
 */
export default function TransactionComposer({ open, onClose, onSave, colorFor }) {
  const cur = useMoney(); // amounts are recorded in the home currency
  const [s, setS] = useState(blankState());
  const [panel, setPanel] = useState(null); // 'repeat' | null
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => { if (open) { setS(blankState()); setPanel(null); setFlash(''); } }, [open]);

  const categories = s.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const amount = useMemo(() => evaluate(s.expr), [s.expr]);
  const hasOperator = /[+-]/.test(s.expr.slice(1));
  const accent = s.type === 'income' ? '#34d399' : '#fb7185';
  const update = (patch) => setS(prev => ({ ...prev, ...patch }));

  const press = (key) => {
    setFlash('');
    setS(prev => {
      let e = prev.expr;
      if (key === 'back') return { ...prev, expr: e.slice(0, -1) };
      if (key === '+' || key === '-') {
        if (!e) return prev;
        if (/[+-]$/.test(e)) e = e.slice(0, -1);
        return { ...prev, expr: e + key };
      }
      const current = e.split(/[+-]/).pop();
      if (key === '.') {
        if (current.includes('.')) return prev;
        return { ...prev, expr: e + (current === '' ? '0.' : '.') };
      }
      if (/\.\d{2}$/.test(current)) return prev;            // max 2 decimals
      if (current.replace('.', '').length >= 9) return prev;  // keep numbers sane
      if (current === '0') return { ...prev, expr: e.slice(0, -1) + key };
      return { ...prev, expr: e + key };
    });
  };

  // Desktop amount field: keep digits, one dot per number, + and −, max 2 decimals
  const typeAmount = (raw) => {
    setFlash('');
    let v = raw.replace(/[^0-9.+-]/g, '').replace(/^[+-]+/, '').replace(/([+-])[+-]+/g, '$1');
    v = v.split(/([+-])/).map(part => {
      if (part === '+' || part === '-') return part;
      const [whole, ...rest] = part.split('.');
      return rest.length ? `${whole.slice(0, 9)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 9);
    }).join('');
    update({ expr: v });
  };

  const save = async (keepOpen) => {
    if (saving) return;
    if (hasOperator) { update({ expr: amount > 0 ? String(amount) : '' }); return; } // "=" first, like a calculator
    if (!(amount > 0)) { setFlash('Enter an amount first'); return; }
    const cat = categories.find(c => c.id === s.category);
    setSaving(true);
    try {
      await onSave({
        tx: {
          description: s.note.trim() || cat?.label || s.category,
          amount,
          category: s.category,
          type: s.type,
          date: s.date,
          account: s.account
        },
        repeat: { frequency: s.repeat, endDate: s.endDate || '' }
      });
      if (keepOpen) {
        setS(prev => ({ ...blankState(prev.type), category: prev.category, account: prev.account, date: prev.date }));
        setPanel(null);
        setFlash(`Saved ${cur.fmt(amount)}`);
      } else {
        onClose();
      }
    } catch (err) {
      setFlash('Could not save. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  // A hardware keyboard also works with the keypad (e.g. a tablet); ignored while typing in a field
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (/^[0-9]$/.test(e.key) || e.key === '.' || e.key === '+' || e.key === '-') { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
      else if (e.key === 'Enter') { e.preventDefault(); save(false); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;

  const Key = ({ k, children, className = '', onClick, style }) => (
    <button
      type="button"
      style={style}
      onClick={onClick || (() => press(k))}
      className={`h-12 sm:h-14 [@media(max-height:720px)]:h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] active:scale-[0.97] transition-all text-xl text-white font-medium flex items-center justify-center cursor-pointer select-none ${className}`}
    >
      {children}
    </button>
  );

  const chip = 'shrink-0 relative flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/[0.06] border border-slate-700/60 text-xs text-slate-200 cursor-pointer hover:bg-white/[0.1] transition-colors';

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117]/80 backdrop-blur-md flex items-end sm:items-center justify-center anim-slide-in" onClick={onClose}>
      <div
        className="glass-panel w-full sm:max-w-md md:max-w-xl max-h-[96dvh] overflow-y-auto no-scrollbar flex flex-col rounded-t-3xl sm:rounded-3xl border border-slate-700/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Record transaction"
      >
        {/* Header: close + expense/income switch */}
        <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 [@media(max-height:720px)]:pt-3 [@media(max-height:720px)]:pb-2">
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/[0.06] border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 flex justify-center">
            <div className="flex p-1 rounded-full bg-white/[0.06] border border-slate-700/60">
              {[['expense', 'Expense'], ['income', 'Income']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ type: id, category: id === 'income' ? 'Salary' : 'Dining' })}
                  className={`px-5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${s.type === id ? 'bg-[#00f2fe] text-[#0d1117]' : 'text-slate-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-10" />
        </div>

        {/* Category grid */}
        <div className="px-3 overflow-y-auto no-scrollbar min-h-[96px] flex-1">
          <div className="grid grid-cols-5 md:grid-cols-7 gap-y-3 gap-x-1 pb-3">
            {categories.map(cat => {
              const Icon = cat.icon;
              const selected = s.category === cat.id;
              const color = colorFor ? colorFor(cat.id) : accent;
              return (
                <button key={cat.id} type="button" onClick={() => update({ category: cat.id })} className="flex flex-col items-center gap-1 cursor-pointer group">
                  <span
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${selected ? 'scale-105' : 'bg-white/[0.06] group-hover:bg-white/[0.1]'}`}
                    style={selected ? { background: color, boxShadow: `0 0 18px ${color}66` } : undefined}
                  >
                    <Icon className={`w-5 h-5 ${selected ? 'text-[#0d1117]' : 'text-slate-300'}`} />
                  </span>
                  <span className={`text-[10px] leading-tight text-center ${selected ? 'text-white font-semibold' : 'text-slate-400'}`}>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick options */}
        <div className="shrink-0 flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-t border-slate-800/80">
          <label className={chip}>
            <Wallet className="w-3.5 h-3.5 text-amber-300" />
            <span>{s.account === 'Crypto' ? 'Crypto Wallet' : s.account}</span>
            <select value={s.account} onChange={e => update({ account: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Account">
              {ACCOUNTS.map(a => <option key={a} value={a}>{a === 'Crypto' ? 'Crypto Wallet' : a}</option>)}
            </select>
          </label>
          <label className={chip}>
            <Calendar className="w-3.5 h-3.5 text-sky-300" />
            <span>{prettyDate(s.date)}</span>
            <input type="date" value={s.date} onChange={e => e.target.value && update({ date: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Date" />
          </label>
          <button type="button" onClick={() => setPanel(p => (p === 'repeat' ? null : 'repeat'))} className={`${chip} ${s.repeat !== 'none' ? 'border-[#00f2fe]/60 text-[#00f2fe]' : ''}`}>
            <Repeat className="w-3.5 h-3.5" />
            <span>{s.repeat === 'none' ? 'Repeat' : repeatLabel(s.repeat)}</span>
          </button>
        </div>

        {panel === 'repeat' && (
          <div className="shrink-0 px-4 pb-2 space-y-2">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {REPEAT_OPTIONS.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => update({ repeat: o.id })}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer transition-colors ${s.repeat === o.id ? 'bg-[#00f2fe]/15 border-[#00f2fe]/60 text-[#00f2fe]' : 'bg-white/[0.04] border-slate-700/60 text-slate-300 hover:bg-white/[0.08]'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {s.repeat !== 'none' && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span>From {prettyDate(s.date)}, recorded {repeatLabel(s.repeat).toLowerCase()} for you.</span>
                <label className="relative shrink-0 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-slate-700/60 text-slate-200 cursor-pointer">
                  {s.endDate ? `Ends ${prettyDate(s.endDate)}` : 'No end date'}
                  <input type="date" min={s.date} value={s.endDate} onChange={e => update({ endDate: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="End date" />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Amount + note */}
        <div className="shrink-0 mx-4 mb-3 px-4 py-3 [@media(max-height:720px)]:py-2 rounded-2xl bg-[#0d1117]/70 border border-slate-800">
          {/* Computer: type the amount (+ and − still work), Enter saves */}
          <label className="hidden md:flex items-baseline gap-2">
            <span className="text-xl font-black opacity-80" style={{ color: accent }}>{cur.symbol}</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={s.expr}
              onChange={e => typeAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(e.shiftKey); } }}
              placeholder="0.00"
              aria-label="Amount"
              className="flex-1 min-w-0 bg-transparent text-4xl font-black tracking-tight tabular-nums outline-none placeholder:text-slate-700"
              style={{ color: accent }}
            />
            {hasOperator && <span className="text-sm font-mono text-slate-400 whitespace-nowrap">= {money(amount)}</span>}
          </label>
          {/* Phone: amount is shown here and entered with the keypad below */}
          <div className="flex md:hidden items-baseline justify-between gap-3">
            <div className="text-3xl sm:text-4xl [@media(max-height:720px)]:text-2xl font-black tracking-tight tabular-nums truncate" style={{ color: accent }}>
              <span className="text-lg sm:text-xl mr-1 opacity-80">{cur.symbol}</span>{money(amount)}
            </div>
            {hasOperator && <div className="text-xs font-mono text-slate-500 truncate">{s.expr}</div>}
          </div>
          <input
            type="text"
            value={s.note}
            onChange={e => update({ note: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(e.shiftKey); } }}
            placeholder="Add a note (optional)"
            maxLength={80}
            className="mt-2 w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none border-t border-slate-800 pt-2"
          />
          {flash && <div className={`mt-1 text-[11px] ${flash.startsWith('Saved') ? 'text-emerald-400' : 'text-amber-400'}`}>{flash}</div>}
        </div>

        {/* Computer: plain buttons */}
        <div className="hidden md:flex shrink-0 items-center justify-between gap-3 px-4 pb-4">
          <span className="text-[10px] font-mono text-slate-500">Enter to save · Shift+Enter to save &amp; add another · Esc to close</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => save(true)} className="whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-200 bg-white/[0.06] hover:bg-white/[0.1] border border-slate-700/60 cursor-pointer">Save &amp; next</button>
            <button type="button" onClick={() => save(false)} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-[#0d1117] cursor-pointer" style={{ background: accent, boxShadow: `0 0 18px ${accent}55` }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        {/* Phone: keypad, so the phone keyboard never opens for the amount */}
        <div className="md:hidden shrink-0 grid grid-cols-4 gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Key k="1">1</Key><Key k="2">2</Key><Key k="3">3</Key><Key k="+" className="text-[#00f2fe]">+</Key>
          <Key k="4">4</Key><Key k="5">5</Key><Key k="6">6</Key><Key k="-" className="text-[#00f2fe]">−</Key>
          <Key k="7">7</Key><Key k="8">8</Key><Key k="9">9</Key>
          <Key onClick={() => save(true)} className={hasOperator ? 'text-slate-200' : '!text-[10.5px] !leading-[1.15] font-bold uppercase tracking-wide text-slate-200 text-center px-1'}>{hasOperator ? '=' : <span>Save &amp;<br />next</span>}</Key>
          <Key k=".">.</Key><Key k="0">0</Key>
          <Key k="back"><Delete className="w-5 h-5" /></Key>
          <Key
            onClick={() => save(false)}
            style={{ background: accent, boxShadow: `0 0 18px ${accent}55` }}
            className="!text-[#0d1117] !text-[13px] font-black uppercase tracking-wider"
          >
            {saving ? '…' : hasOperator ? '=' : 'Done'}
          </Key>
        </div>
      </div>
    </div>
  );
}
