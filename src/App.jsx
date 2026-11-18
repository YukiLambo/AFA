import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Wallet, TrendingUp, Bot, FileText, Plus, Trash2, 
  Send, ShieldCheck, AlertCircle, User, LogOut, Sliders, Target, Compass, CreditCard, PiggyBank,
  RefreshCw, Globe, ArrowUpRight, ArrowDownRight, CheckCircle2, Loader2, AlertTriangle, Bell,
  Download, ShieldAlert, Newspaper, Filter, Search, Zap, ExternalLink, Activity, Edit2, Save,
  X, ChevronRight, DollarSign, Settings, Sparkles, FlaskConical, Lightbulb, ListChecks, Landmark
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { useFx } from './effects/FxContext';
import LiquidBackdrop from './effects/LiquidBackdrop';
import LiquidGlass from './effects/LiquidGlass';
import LiquidLogo from './effects/LiquidLogo';
import LiquidGlassLayer from './effects/LiquidGlassLayer';
import PaperTrading from './components/PaperTrading';
import OtherAssets, { assetValueHkd, assetType } from './components/OtherAssets';
import { buildInsights } from './lib/insights';
import TransactionComposer, { categoryIcon, nextOccurrence, todayLocal, repeatLabel } from './components/TransactionComposer';

// --- FIREBASE INTEGRATION ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyArZZDniGw4tromow4bVLj2efh8NJWYieE",
  authDomain: "afaapp-3cba6.firebaseapp.com",
  projectId: "afaapp-3cba6",
  storageBucket: "afaapp-3cba6.firebasestorage.app",
  messagingSenderId: "507543217731",
  appId: "1:507543217731:web:e4050797a3903bbb9f56f6",
  measurementId: "G-Y1MCZW9FZZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function for strict collection paths
const getCollectionPath = (userId, collectionName) => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
  return collection(db, 'artifacts', appId, 'users', userId, collectionName);
};

// --- LIVE MARKET DATA (no proxy needed: these endpoints allow browser requests directly) ---
const DEFAULT_USD_HKD_RATE = 7.82;
const QUOTE_REFRESH_MS = 30 * 1000;      // stock prices refresh every 30 seconds
const NEWS_REFRESH_MS = 5 * 60 * 1000;   // news refreshes every 5 minutes

const fetchWithTimeout = async (url, ms = 7000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
};

// "700", "0700.hk", "9988.HK" -> 0700.HK / 9988.HK ; "aapl" -> AAPL
const normalizeTicker = (rawSymbol) => {
  const s = String(rawSymbol || '').trim().toUpperCase();
  if (!s) return null;
  const hk = s.match(/^(\d{1,5})(\.HK)?$/);
  if (hk) {
    const num = String(parseInt(hk[1], 10));
    return { symbol: `${num.padStart(4, '0')}.HK`, isHK: true, quoteCode: `r_hk${num.padStart(5, '0')}`, historyCode: `hk${num.padStart(5, '0')}` };
  }
  const us = s.replace(/\.(US|OQ|N|AM|PS)$/, '');
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(us)) return null;
  return { symbol: us, isHK: false, quoteCode: `us${us}`, historyCode: null };
};

// Live quote for one HK or US ticker. Returns null when the ticker does not exist or the feed is down
// (the app then keeps the last saved price instead of inventing one).
const fetchLiveStockQuote = async (rawSymbol) => {
  const t = normalizeTicker(rawSymbol);
  if (!t) return null;

  // 1) Tencent Securities quote feed: real-time HK, US at exchange delay, CORS-enabled
  try {
    const res = await fetchWithTimeout(`https://qt.gtimg.cn/q=${t.quoteCode}&_=${Date.now()}`);
    if (res.ok) {
      const text = new TextDecoder('gbk').decode(await res.arrayBuffer());
      const body = text.match(/="([^"]*)"/);
      const f = body ? body[1].split('~') : [];
      const price = parseFloat(f[3]);
      if (f.length > 35 && price > 0) {
        return {
          symbol: t.symbol,
          name: (f[46] || f[1] || t.symbol).trim(),
          price,
          prevClose: parseFloat(f[4]) || null,
          change: parseFloat(f[31]) || 0,
          changePct: parseFloat(f[32]) || 0,
          currency: t.isHK ? 'HKD' : (/^[A-Z]{3}$/.test(f[35]) ? f[35] : 'USD'),
          time: f[30] || '',
          historyCode: t.isHK ? t.historyCode : `us${f[2]}`,
          source: 'Tencent Securities'
        };
      }
    }
  } catch (err) {
    console.warn(`Primary quote feed failed for ${t.symbol}, trying fallback...`, err);
  }

  // 2) Fallback: Yahoo Finance through a public proxy (often slow or offline, so it is only a backup)
  try {
    const yahooUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
      `https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?interval=1d&range=1d`
    )}`;
    const res = await fetchWithTimeout(yahooUrl, 6000);
    if (res.ok) {
      const json = await res.json();
      const meta = JSON.parse(json.contents)?.chart?.result?.[0]?.meta;
      const price = parseFloat(meta?.regularMarketPrice);
      if (price > 0) {
        const prev = parseFloat(meta.chartPreviousClose ?? meta.previousClose) || null;
        return {
          symbol: t.symbol,
          name: meta.longName || meta.shortName || t.symbol,
          price,
          prevClose: prev,
          change: prev ? price - prev : 0,
          changePct: prev ? ((price - prev) / prev) * 100 : 0,
          currency: (meta.currency || (t.isHK ? 'HKD' : 'USD')).toUpperCase(),
          time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toLocaleString() : '',
          historyCode: null,
          source: 'Yahoo Finance'
        };
      }
    }
  } catch (err) {
    console.warn(`Fallback quote feed failed for ${t.symbol}`, err);
  }

  return null;
};

// Search any HK / US stock by ticker OR company name ("tencent", "nvda", "700").
// Uses a JSONP-style script because this endpoint answers with a JavaScript variable.
const searchMarketSymbols = (query) => new Promise((resolve) => {
  const q = String(query || '').trim();
  if (!q) return resolve([]);
  const script = document.createElement('script');
  let done = false;
  const finish = (list) => { if (done) return; done = true; clearTimeout(timer); script.remove(); resolve(list); };
  const timer = setTimeout(() => finish([]), 6000);
  script.charset = 'utf-8';
  script.src = `https://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(q)}&t=all&c=1&_=${Date.now()}`;
  script.onerror = () => finish([]);
  script.onload = () => {
    try {
      const raw = String(window.v_hint || '');
      const seen = new Set();
      const list = [];
      raw.split('^').forEach(entry => {
        const [market, code, name, , type] = entry.split('~');
        if (!code || !['hk', 'us'].includes(market)) return;
        if (type && !/^(GP|ETF)/.test(type)) return;
        const t = normalizeTicker(market === 'hk' ? code : code.split('.')[0]);
        if (!t || seen.has(t.symbol) || /^8\d{4}\.HK$/.test(t.symbol)) return;
        seen.add(t.symbol);
        let label = name || t.symbol;
        try { label = JSON.parse(`"${label.replace(/"/g, '')}"`); } catch (e) { /* keep raw */ }
        list.push({ symbol: t.symbol, name: label });
      });
      finish(list.slice(0, 6));
    } catch (e) {
      finish([]);
    }
  };
  document.head.appendChild(script);
});

// Daily closing prices (about the last 30 trading days) for the portfolio history chart
const fetchPriceHistory = async (historyCode, days = 30) => {
  if (!historyCode) return [];
  try {
    const res = await fetchWithTimeout(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${historyCode},day,,,${days},qfq`);
    if (!res.ok) return [];
    const json = await res.json();
    const node = json?.data?.[historyCode] || {};
    const rows = node.qfqday || node.day || [];
    return rows.map(r => ({ date: r[0], close: parseFloat(r[2]) })).filter(r => r.close > 0);
  } catch (err) {
    return [];
  }
};

// --- LIVE NEWS: RSS feeds converted to JSON by rss2json (CORS-enabled, no key needed) ---
const NEWS_FEEDS = [
  { source: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { source: 'SCMP Business', url: 'https://www.scmp.com/rss/92/feed' },
  { source: 'CNBC Markets', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { source: 'RTHK Finance', url: 'https://rthk.hk/rthk/news/rss/e_expressnews_efinance.xml' }
];

const fetchNewsFeed = async (feed) => {
  try {
    const res = await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, 9000);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) return [];
    return data.items.map(item => {
      const published = item.pubDate ? new Date(item.pubDate.replace(' ', 'T') + 'Z') : null;
      const summary = (item.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return {
        id: item.link || item.guid || item.title,
        title: (item.title || '').replace(/\s+-\s+Yahoo Finance$/, ''),
        summary: summary.length > 180 ? summary.substring(0, 180) + '...' : summary,
        category: 'Market Alert',
        source: feed.source,
        publishedAt: published && !isNaN(published) ? published.getTime() : 0,
        url: item.link
      };
    }).filter(n => n.title && n.url);
  } catch (err) {
    return [];
  }
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

// Hong Kong salaries tax (2024/25 onwards): progressive 2/6/10/14/17% on HK$50k bands after the
// HK$132,000 basic allowance, capped by the 15% standard rate. Single person, before one-off rebates.
const calcHKSalariesTax = (annualIncome, deductions = 0) => {
  const net = Math.max(0, annualIncome - deductions);
  let chargeable = Math.max(0, net - 132000);
  let progressive = 0;
  for (const rate of [0.02, 0.06, 0.10, 0.14]) {
    const slice = Math.min(chargeable, 50000);
    progressive += slice * rate;
    chargeable -= slice;
  }
  progressive += chargeable * 0.17;
  const standard = Math.min(net, 5000000) * 0.15 + Math.max(0, net - 5000000) * 0.16;
  return Math.min(progressive, standard);
};

const DEFAULT_CHAT_GREETING = "Hi! I'm A.F.A., your financial assistant. I already know your goal, budget, holdings and debt from your profile, so just ask me anything — for example \"How am I doing this month?\"";
const CHAT_QUICK_PROMPTS = ['How am I doing this month?', 'Am I on track for my goal?', 'Where can I cut spending?', 'How much tax can TVC save me?', 'Is my portfolio too risky?'];

// --- CATEGORY COLOR MATRIX ---
// Every category has its own vibrant colour, tuned to glow on the dark liquid-glass background
// --- DEBT PLANNER HELPERS ---
const DEBT_TYPES = ['Credit card', 'Personal loan', 'Student loan', 'Car loan', 'Mortgage', 'Buy now pay later', 'Other'];

const normalizeDebt = (d = {}) => ({
  id: d.id || `d${Math.random().toString(36).slice(2, 9)}`,
  name: String(d.name || 'Debt').slice(0, 60),
  type: DEBT_TYPES.includes(d.type) ? d.type : 'Other',
  balance: Math.max(0, Number(d.balance) || 0),
  apr: Math.max(0, Number(d.apr) || 0),
  minPay: Math.max(0, Number(d.minPay) || 0)
});

// Avalanche pays the highest APR first; snowball pays the smallest balance first.
// Every debt gets its minimum; the extra amount plus minimums freed by cleared debts go to the target.
const simulateDebtPayoff = (debtList, extra, strategy) => {
  const live = debtList.map(normalizeDebt).filter(d => d.balance > 0).map(d => ({ ...d }));
  const budget = live.reduce((sum, d) => sum + d.minPay, 0) + (Number(extra) || 0);
  const totalStart = live.reduce((sum, d) => sum + d.balance, 0);
  const trajectory = [{ month: 'Now', balance: Math.round(totalStart) }];
  const order = (a, b) => (strategy === 'snowball' ? a.balance - b.balance || b.apr - a.apr : b.apr - a.apr || a.balance - b.balance);
  const payoffOrder = [];
  let month = 0;
  let totalInterest = 0;
  let stuck = false;
  const MAX_MONTHS = 600;
  if (live.length === 0) return { trajectory, totalMonths: 0, totalInterest: 0, payoffOrder, stuck: false, budget: 0, debtFreeLabel: '' };

  while (live.some(d => d.balance > 0.005) && month < MAX_MONTHS) {
    month++;
    let interestThisMonth = 0;
    live.forEach(d => {
      if (d.balance <= 0) return;
      const interest = d.balance * (d.apr / 100 / 12);
      d.balance += interest;
      interestThisMonth += interest;
    });
    totalInterest += interestThisMonth;
    let cash = budget;
    // Minimum payments first
    live.forEach(d => {
      if (d.balance <= 0) return;
      const pay = Math.min(d.minPay, d.balance, cash);
      d.balance -= pay;
      cash -= pay;
    });
    // Then everything left to the target debt(s)
    [...live].filter(d => d.balance > 0).sort(order).forEach(d => {
      if (cash <= 0) return;
      const pay = Math.min(cash, d.balance);
      d.balance -= pay;
      cash -= pay;
    });
    live.forEach(d => {
      if (d.balance <= 0.005 && !payoffOrder.find(p => p.id === d.id)) {
        d.balance = 0;
        payoffOrder.push({ id: d.id, name: d.name, month });
      }
    });
    const remaining = live.reduce((sum, d) => sum + d.balance, 0);
    if (month <= 24 || month % 3 === 0 || remaining === 0) trajectory.push({ month: `M${month}`, balance: Math.round(remaining) });
    // Payments that never beat the interest would run forever
    if (budget <= interestThisMonth + 0.01) { stuck = true; break; }
  }
  if (month >= MAX_MONTHS) stuck = true;
  const done = new Date();
  done.setMonth(done.getMonth() + month);
  return {
    trajectory,
    totalMonths: month,
    totalInterest: Math.round(totalInterest),
    payoffOrder,
    stuck,
    budget,
    debtFreeLabel: stuck ? '' : done.toLocaleDateString('en-HK', { month: 'short', year: 'numeric' })
  };
};

const CATEGORY_COLORS = {
  'Dining': '#ff6b8b',
  'Shopping': '#c084fc',
  'Entertainment': '#ff4fd8',
  'Rent': '#ffd166',
  'Transport': '#4f8cff',
  'Salary': '#2dd4bf',
  'Capital Gain': '#a3e635',
  'Dividend': '#34d399',
  'Freelance': '#38bdf8',
  'Interest': '#93c5fd',
  'Gift': '#f9a8d4',
  'Investment': '#00f2fe',
  'Utilities': '#8b5cf6',
  'Other': '#94a3b8',
  // Added with the new recorder
  'Groceries': '#fb923c',
  'Coffee & Snacks': '#f59e0b',
  'Clothing': '#e879f9',
  'Phone & Internet': '#60a5fa',
  'Subscriptions': '#f472b6',
  'Health': '#4ade80',
  'Beauty': '#fda4af',
  'Fitness': '#22d3ee',
  'Education': '#818cf8',
  'Travel': '#06b6d4',
  'Car': '#3b82f6',
  'Social': '#fb7185',
  'Gifts Given': '#f9a8d4',
  'Insurance': '#a78bfa',
  'Pets': '#facc15',
  'Children': '#fcd34d',
  'Fees & Tax': '#cbd5e1',
  'Bonus': '#5eead4',
  'Part Time': '#67e8f9',
  'Allowance': '#86efac',
  'Scholarship': '#a5b4fc',
  'Red Packet': '#f87171',
  'Refund': '#bef264',
  // Other asset types (Investments page)
  'Bond': '#a78bfa', 'Crypto': '#f7931a', 'Cash & Deposits': '#34d399', 'Fund': '#38bdf8', 'Gold & Metals': '#facc15',
  'Property': '#fb7185', 'Insurance Savings': '#818cf8', 'MPF Balance': '#2dd4bf'
};

// Palette for charts whose items are not categories (payment methods, asset classes...)
// Dashboard blocks that get the liquid-glass treatment
const GLASS_PANEL_SELECTOR = '.afa-content [class~="bg-[#161b22]"]:not(.absolute):not(.fixed)';

const ALLOCATION_COLORS = {
  'Stocks': '#00f2fe', 'Funds': '#38bdf8', 'Crypto': '#f7931a', 'Bonds': '#a78bfa', 'Cash & Deposits': '#34d399',
  'Gold': '#facc15', 'Property': '#fb7185', 'Insurance, MPF & Other': '#94a3b8'
};

const CHART_PALETTE = ['#00f2fe', '#8b5cf6', '#ff4fd8', '#2dd4bf', '#ffd166', '#4f8cff', '#ff6b8b', '#a3e635', '#c084fc', '#38bdf8'];
const colorFor = (name, index) => CATEGORY_COLORS[name] || CHART_PALETTE[index % CHART_PALETTE.length];

// Glowing vertical gradients for bars: url(#afaBar0) ... url(#afaBar9), plus the portfolio bars.
// A plain <defs> element (not a component): Recharts only renders <defs> it finds directly in a chart.
const CHART_GRADIENT_DEFS = (
  <defs>
    {CHART_PALETTE.map((c, i) => (
      <linearGradient key={c} id={`afaBar${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={c} stopOpacity={0.95} />
        <stop offset="100%" stopColor={c} stopOpacity={0.25} />
      </linearGradient>
    ))}
    <linearGradient id="afaBarPortfolio" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#00f2fe" stopOpacity={0.95} />
      <stop offset="100%" stopColor="#7c5cff" stopOpacity={0.45} />
    </linearGradient>
  </defs>
);

// Pie labels drawn in their slice's colour
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, name, index }) => {
  const angle = (-midAngle * Math.PI) / 180;
  const r = outerRadius + 14;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  return (
    <text x={x} y={y} fill={colorFor(name, index)} fontSize={10} fontWeight={700} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// --- CUSTOM APP ICON ---
const AppIcon = ({ className = "w-9 h-9", animateStroke = false }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <style>{`
      @keyframes drawLeftLeg {
        0% { stroke-dashoffset: 65; opacity: 0; }
        50% { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      @keyframes drawRightLeg {
        0% { stroke-dashoffset: 65; opacity: 0; }
        50% { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      @keyframes drawCrossbar {
        0% { stroke-dashoffset: 30; opacity: 0; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      @keyframes snapInNode {
        0% { transform: scale(0); opacity: 0; filter: drop-shadow(0 0 0 rgba(0,242,254,0)); }
        60% { transform: scale(1.4); opacity: 1; filter: drop-shadow(0 0 12px rgba(0,242,254,1)); }
        100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 8px rgba(0,242,254,0.8)); }
      }
      .left-leg {
        stroke-dasharray: 65;
        animation: ${animateStroke ? 'drawLeftLeg 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none'};
      }
      .right-leg {
        stroke-dasharray: 65;
        animation: ${animateStroke ? 'drawRightLeg 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards' : 'none'};
        opacity: ${animateStroke ? '0' : '1'};
      }
      .crossbar {
        stroke-dasharray: 30;
        animation: ${animateStroke ? 'drawCrossbar 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards' : 'none'};
        opacity: ${animateStroke ? '0' : '1'};
      }
      .cyber-node {
        opacity: ${animateStroke ? '0' : '1'};
        animation: ${animateStroke ? 'snapInNode 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none'};
      }
    `}</style>
    <defs>
      <linearGradient id="iconGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
        <stop offset="0%" stopColor="#00f2fe" />
        <stop offset="100%" stopColor="#4facfe" />
      </linearGradient>
      <filter id="glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glassBlur">
        <feGaussianBlur stdDeviation="2" />
      </filter>
    </defs>
    
    <rect width="100" height="100" rx="28" fill="rgba(10, 15, 30, 0.5)" stroke="url(#iconGrad)" strokeWidth="1.5" />
    <rect width="100" height="100" rx="28" fill="rgba(255,255,255,0.02)" filter="url(#glassBlur)" />
    
    <path className="left-leg" d="M 28 72 L 50 25" stroke="url(#iconGrad)" strokeWidth="7.5" strokeLinecap="round" filter="url(#glow)" />
    <path className="right-leg" d="M 50 25 L 72 72" stroke="url(#iconGrad)" strokeWidth="7.5" strokeLinecap="round" filter="url(#glow)" />
    
    <circle className="cyber-node" cx="50" cy="25" r="5.5" fill="#ffffff" style={{ animationDelay: '0.8s', transformOrigin: '50px 25px' }} />
    <circle className="cyber-node" cx="28" cy="72" r="4.5" fill="#00f2fe" style={{ animationDelay: '1.0s', transformOrigin: '28px 72px' }} />
    <circle className="cyber-node" cx="72" cy="72" r="4.5" fill="#00f2fe" style={{ animationDelay: '1.2s', transformOrigin: '72px 72px' }} />
  </svg>
);

export default function App() {
  // Authentication & App State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const fx = useFx(); // liquid-metal / liquid-glass visual effects (on/off)
  
  // Auth UI State
  const [authMode, setAuthMode] = useState('login'); 
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [authError, setAuthError] = useState('');
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [loginQuote, setLoginQuote] = useState('');

  // Search and Alerts State
  const [globalSearch, setGlobalSearch] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Budget & Limit Management State
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // Curated Inspiring & Engaging Investor Quotes
  const inspirationalQuotes = useMemo(() => [
    "“Rule No. 1: Never lose money. Rule No. 2: Never forget rule no. 1.” — Warren Buffett",
    "“An investment in knowledge pays the best interest.” — Benjamin Franklin",
    "“The stock market is designed to transfer money from the active to the patient.” — Warren Buffett",
    "“Risk comes from not knowing what you're doing.” — Warren Buffett",
    "“Know what you own, and know why you own it.” — Peter Lynch",
    "“Compound interest is the eighth wonder of the world. He who understands it, earns it... he who doesn't... pays it.” — Albert Einstein",
    "“In investing, what is comfortable is rarely profitable.” — Robert Arnott",
    "“Price is what you pay. Value is what you get.” — Warren Buffett",
    "“Do not save what is left after spending, but spend what is left after saving.” — Warren Buffett",
    "“The most important quality for an investor is temperament, not intellect.” — Warren Buffett",
    "“Opportunities come infrequently. When it rains gold, put out the bucket, not the thimble.” — Warren Buffett",
    "“Financial freedom is available to those who learn about it and work for it.” — Robert Kiyosaki",
    "“Formal education will make you a living; self-education will make you a fortune.” — Jim Rohn"
  ], []);

  // Pick a random quote whenever login view mounts or refreshes
  useEffect(() => {
    if (authMode === 'login') {
      const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length);
      setLoginQuote(inspirationalQuotes[randomIndex]);
    }
  }, [authMode, inspirationalQuotes]);

  // Tailored User Profile State
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    password: '',
    goal: '',
    riskTolerance: '',
    targetAmount: '',
    monthlyIncome: '30000',
    weeklyMaxSpend: '3500',
    weeklyMinSavings: '1200',
    budgetProfile: 'Standard',
    profilePic: '',
    gender: 'Female',
    phone: '',
    birthday: '',
    homeAddress: ''
  });

  // Data States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  // Saved holdings (Firestore) + live quotes (memory). `portfolio` = holdings with the latest live price applied.
  const [portfolioDocs, setPortfolioDocs] = useState([]);
  const [liveQuotes, setLiveQuotes] = useState({});
  const portfolio = useMemo(() => portfolioDocs.map(item => {
    const quote = liveQuotes[item.symbol];
    return quote ? { ...item, currentPrice: quote.price, currency: quote.currency, dayChangePct: quote.changePct, quoteTime: quote.time } : item;
  }), [portfolioDocs, liveQuotes]);
  const holdingsKey = useMemo(() => portfolioDocs.map(p => p.symbol).sort().join(','), [portfolioDocs]);
  const portfolioDocsRef = useRef([]);
  portfolioDocsRef.current = portfolioDocs;
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  // Investments page: real holdings or the simulated (paper) trading account
  const [portfolioView, setPortfolioView] = useState('real');
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [paperAccount, setPaperAccount] = useState(null);
  // Other assets (bonds, crypto, deposits, gold, property...) + live crypto prices in HKD
  const [otherAssets, setOtherAssets] = useState([]);
  const [cryptoPrices, setCryptoPrices] = useState({});
  const [cryptoStatus, setCryptoStatus] = useState('idle');
  const [marketFeedDown, setMarketFeedDown] = useState(false);

  // Live market search (top search bar)
  const [marketMatches, setMarketMatches] = useState([]);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);

  // Saved-settings bookkeeping (so users never re-enter their inputs)
  const settingsLoadedRef = useRef(false);
  const chatLoadedRef = useRef(false);
  const chatEndRef = useRef(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Live Market API Sync Controls
  const [isSyncingMarket, setIsSyncingMarket] = useState(false);
  const [lastMarketSyncTime, setLastMarketSyncTime] = useState(null);
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);

  // Editable Target State
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState('');

  // Live Financial News State
  const [newsCategory, setNewsCategory] = useState('All');
  const [newsSearch, setNewsSearch] = useState('');
  const [filterByHoldingsOnly, setFilterByHoldingsOnly] = useState(false);
  const [isSyncingNews, setIsSyncingNews] = useState(false);
  const [lastNewsSyncTime, setLastNewsSyncTime] = useState('loading...');

  const [newsFeed, setNewsFeed] = useState([]);

  const fetchLiveNews = async () => {
    setIsSyncingNews(true);
    try {
      const holdings = portfolioDocsRef.current;
      const feeds = [...NEWS_FEEDS];
      if (holdings.length > 0) {
        // Headlines about the user's own tickers
        const tickers = holdings.map(p => p.symbol).slice(0, 10).join(',');
        feeds.unshift({ source: 'Yahoo Finance', url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickers}&region=US&lang=en-US` });
      }
      const results = await Promise.all(feeds.map(fetchNewsFeed));
      const seen = new Set();
      const merged = results.flat().filter(n => (seen.has(n.id) ? false : seen.add(n.id)));

      if (merged.length === 0) throw new Error('No live headlines returned');

      // Tag headlines that mention one of the user's holdings
      const keywords = holdings.map(p => ({
        symbol: p.symbol,
        words: [p.symbol.replace('.HK', ''), ...(p.name || '').split(/[\s,.-]+/).filter(w => w.length > 3 && !/^(inc|corp|holdings|group|limited|fund|trust|index|company)$/i.test(w)).slice(0, 2)]
      }));
      const tagged = merged.map(n => {
        const text = ` ${n.title} ${n.summary} `.toLowerCase();
        const symbols = keywords.filter(k => k.words.some(w => new RegExp(`\\b${w.toLowerCase().replace(/[^a-z0-9]/g, '')}\\b`).test(text))).map(k => k.symbol);
        return { ...n, symbols, impact: symbols.length > 0 ? 'Your Holding' : 'Market' };
      });
      tagged.sort((a, b) => b.publishedAt - a.publishedAt);
      setNewsFeed(tagged.slice(0, 40));
      setLastNewsSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn("Live news feed unreachable.", err);
      // No invented headlines: keep whatever was last loaded and say so.
      setLastNewsSyncTime(prev => (String(prev).includes('feed unreachable') ? prev : `${new Date().toLocaleTimeString()} (feed unreachable)`));
    } finally {
      setIsSyncingNews(false);
    }
  };

  // Load news on start, again whenever holdings change, and every 5 minutes after that
  useEffect(() => {
    if (!user) return;
    const first = setTimeout(fetchLiveNews, 800);
    const timer = setInterval(() => { if (!document.hidden) fetchLiveNews(); }, NEWS_REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [user, holdingsKey]);

  // Wealth Simulator Control States
  const [simInitial, setSimInitial] = useState(50000);
  const [simMonthly, setSimMonthly] = useState(6000);
  const [simRate, setSimRate] = useState(6.5);
  const [simYears, setSimYears] = useState(10);

  // Debt Strategy State
  const [isDebtLoaded, setIsDebtLoaded] = useState(false);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  // Each debt the user owes: { id, name, type, balance, apr, minPay } (saved to the profile as `debts`)
  const [debts, setDebts] = useState([]);
  const [debtExtra, setDebtExtra] = useState(0); // extra HKD per month on top of all minimum payments
  const [debtStrategy, setDebtStrategy] = useState('avalanche');
  const [debtDraft, setDebtDraft] = useState({ name: '', type: 'Credit card', balance: '', apr: '', minPay: '' });
  const [debtSaveState, setDebtSaveState] = useState({ status: 'idle', at: null, message: '' });
  // Totals across every debt (kept under the old names so the advisor and reports keep working)
  const debtAmount = useMemo(() => debts.reduce((sum, d) => sum + (Number(d.balance) || 0), 0), [debts]);
  const debtRate = useMemo(() => (debtAmount > 0 ? Math.round(debts.reduce((sum, d) => sum + (Number(d.balance) || 0) * (Number(d.apr) || 0), 0) / debtAmount * 100) / 100 : 0), [debts, debtAmount]);
  const debtMinPay = useMemo(() => debts.reduce((sum, d) => sum + (Number(d.minPay) || 0), 0) + (Number(debtExtra) || 0), [debts, debtExtra]);

  // MPF & Tax State
  const [mpfIncome, setMpfIncome] = useState(30000);
  const [tvcMonthly, setTvcMonthly] = useState(2000);

  // Modal Controls
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  // Repeating transactions: rules in users/{uid}/recurring, each one writes a transaction on its due dates
  const [recurringRules, setRecurringRules] = useState([]);
  const recurringRunRef = useRef(new Set());

  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStock, setNewStock] = useState({ symbol: '', name: '', shares: '', buyPrice: '', currentPrice: '', currency: 'HKD', category: 'HK Equity' });

  // Cash Flow View Mode State
  const [cashFlowView, setCashFlowView] = useState('Monthly');

  // AI Chat Assistant State
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: DEFAULT_CHAT_GREETING }
  ]);
  const [aiEngine, setAiEngine] = useState('');
  const [userInput, setUserInput] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // --- 1. FIREBASE AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. FIRESTORE DATA SYNC ---
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setRecurringRules([]);
      recurringRunRef.current = new Set();
      setPortfolioDocs([]);
      setOtherAssets([]);
      setPaperAccount(null);
      setPortfolioView('real');
      setLiveQuotes({});
      setPortfolioHistory([]);
      settingsLoadedRef.current = false;
      chatLoadedRef.current = false;
      setChatMessages([{ role: 'model', text: DEFAULT_CHAT_GREETING }]);
      setUserProfile({ name: '', email: '', password: '', goal: '', riskTolerance: '', targetAmount: '', monthlyIncome: '30000', weeklyMaxSpend: '3500', weeklyMinSavings: '1200' });
      setIsDebtLoaded(false);
      return;
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
    
    // Sync Profile
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(prev => ({ ...prev, ...data }));
        
        // Restore everything the user typed last time (runs once per login)
        if (!settingsLoadedRef.current) {
          const saved = data.settings || {};
          setPaperAccount(data.paperAccount && typeof data.paperAccount === 'object' ? data.paperAccount : null);
          if (Array.isArray(data.debts)) {
            setDebts(data.debts.map(normalizeDebt));
          } else if (Number(data.debtAmount) > 0) {
            // Older profiles stored one total; turn it into a single debt so nothing is lost
            setDebts([normalizeDebt({ name: 'Existing debt', type: 'Other', balance: data.debtAmount, apr: data.debtRate, minPay: data.debtMinPay })]);
          }
          if (data.debtExtra !== undefined) setDebtExtra(Number(data.debtExtra) || 0);
          if (data.debtsSavedAt) setDebtSaveState({ status: 'saved', at: data.debtsSavedAt, message: '' });
          if (saved.debtStrategy) setDebtStrategy(saved.debtStrategy);
          if (saved.simInitial !== undefined) setSimInitial(Number(saved.simInitial));
          if (saved.simMonthly !== undefined) setSimMonthly(Number(saved.simMonthly));
          if (saved.simRate !== undefined) setSimRate(Number(saved.simRate));
          if (saved.simYears !== undefined) setSimYears(Number(saved.simYears));
          if (saved.mpfIncome !== undefined) setMpfIncome(Number(saved.mpfIncome));
          else if (data.monthlyIncome) setMpfIncome(Number(data.monthlyIncome));
          if (saved.tvcMonthly !== undefined) setTvcMonthly(Number(saved.tvcMonthly));
          if (saved.cashFlowView) setCashFlowView(saved.cashFlowView);
          setIsDebtLoaded(true);
          // Give React one tick to apply the values before auto-save may run
          setTimeout(() => { settingsLoadedRef.current = true; }, 0);
        }

        // Restore the previous conversation, or greet the user by name
        if (!chatLoadedRef.current && data.email) {
          chatLoadedRef.current = true;
          if (Array.isArray(data.chatHistory) && data.chatHistory.length > 0) {
            setChatMessages(data.chatHistory);
          } else {
            const firstName = (data.name || '').trim().split(' ')[0];
            setChatMessages([{ role: 'model', text: firstName ? DEFAULT_CHAT_GREETING.replace('Hi!', `Hi ${firstName}!`) : DEFAULT_CHAT_GREETING }]);
          }
        }
      }
    }, (err) => console.error("Profile sync error:", err));

    // Sync Transactions
    const txRef = getCollectionPath(user.uid, 'transactions');
    const unsubTx = onSnapshot(txRef, (snapshot) => {
      const txs = [];
      snapshot.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));
      txs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(txs);
    }, (err) => console.error("TX sync error:", err));

    // Sync repeating-transaction rules
    const unsubRecurring = onSnapshot(getCollectionPath(user.uid, 'recurring'), (snapshot) => {
      const rules = [];
      snapshot.forEach(d => rules.push({ id: d.id, ...d.data() }));
      rules.sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)));
      setRecurringRules(rules);
    }, (err) => console.error("Recurring sync error:", err));

    // Sync Portfolio
    const portRef = getCollectionPath(user.uid, 'portfolio');
    const unsubPort = onSnapshot(portRef, (snapshot) => {
      const ports = [];
      snapshot.forEach(doc => ports.push({ id: doc.id, ...doc.data() }));
      setPortfolioDocs(ports);
    }, (err) => console.error("Portfolio sync error:", err));

    // Sync other assets
    const unsubAssets = onSnapshot(getCollectionPath(user.uid, 'assets'), (snapshot) => {
      const list = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      setOtherAssets(list);
    }, (err) => console.error("Assets sync error:", err));

    return () => {
      unsubProfile();
      unsubTx();
      unsubRecurring();
      unsubPort();
      unsubAssets();
    };
  }, [user]);

  // Splash Screen Delay
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  // --- LIVE MARKET PRICES: fetched for every holding, automatically, every 30 seconds ---
  const refreshQuotes = async ({ persist = false } = {}) => {
    const holdings = portfolioDocsRef.current;
    if (!user || holdings.length === 0) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';

    const quotes = await Promise.all(holdings.map(item => fetchLiveStockQuote(item.symbol)));
    const next = {};
    quotes.forEach((quote, i) => { if (quote && quote.price) next[holdings[i].symbol] = quote; });

    if (Object.keys(next).length === 0) {
      setMarketFeedDown(true); // keep last saved prices on screen, never invent numbers
      return;
    }
    setMarketFeedDown(false);
    setLiveQuotes(prev => ({ ...prev, ...next }));
    setLastMarketSyncTime(new Date().toLocaleTimeString());

    // Save the latest prices so the next login opens with recent values straight away
    if (persist) {
      await Promise.all(holdings.map(item => {
        const quote = next[item.symbol];
        if (!quote || Number(item.currentPrice) === quote.price) return null;
        return updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'portfolio', item.id), {
          currentPrice: quote.price,
          currency: quote.currency,
          lastUpdated: new Date().toISOString()
        }).catch(err => console.error("Price save failed:", err));
      }));
    }
  };

  const handleSyncMarketPrices = async () => {
    if (portfolio.length === 0 || isSyncingMarket) return;
    setIsSyncingMarket(true);
    try {
      await refreshQuotes({ persist: true });
    } finally {
      setIsSyncingMarket(false);
    }
  };

  useEffect(() => {
    if (!user || !holdingsKey) return;
    refreshQuotes({ persist: true });
    const timer = setInterval(() => { if (!document.hidden) refreshQuotes(); }, QUOTE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [user, holdingsKey]);

  // --- LIVE CRYPTO PRICES (CoinGecko, free and CORS-enabled) for the coins the user holds ---
  const coinKey = useMemo(() => [...new Set(otherAssets.filter(a => a.type === 'crypto' && a.coin).map(a => a.coin))].sort().join(','), [otherAssets]);
  const fetchCryptoPrices = async (ids) => {
    if (!ids) return;
    setCryptoStatus(prev => (prev === 'ok' ? 'ok' : 'loading'));
    try {
      const res = await fetchWithTimeout(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=hkd,usd&include_24hr_change=true`, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const next = {};
      Object.entries(json).forEach(([id, v]) => { if (v?.hkd) next[id] = { hkd: v.hkd, usd: v.usd, change24h: v.hkd_24h_change ?? v.usd_24h_change ?? 0 }; });
      setCryptoPrices(prev => ({ ...prev, ...next }));
      setCryptoStatus('ok');
    } catch (err) {
      console.warn('Crypto price feed unavailable', err);
      setCryptoStatus('down');
    }
  };
  useEffect(() => {
    if (!user) return undefined;
    // Always know BTC/ETH so the "add crypto" form can show a live value straight away
    const ids = [...new Set(['bitcoin', 'ethereum', ...coinKey.split(',').filter(Boolean)])].join(',');
    fetchCryptoPrices(ids);
    const timer = setInterval(() => { if (!document.hidden) fetchCryptoPrices(ids); }, 60000);
    return () => clearInterval(timer);
  }, [user, coinKey]);

  const assetsPath = (id) => doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'afa-default', 'users', user.uid, 'assets', id);
  const handleAddAsset = async (data) => { if (user) await addDoc(getCollectionPath(user.uid, 'assets'), data); };
  const handleUpdateAsset = async (id, data) => { if (user) await updateDoc(assetsPath(id), data); };
  const handleDeleteAsset = async (id) => { if (user) { try { await deleteDoc(assetsPath(id)); } catch (err) { console.error(err); } } };

  // Simulated trading account lives on the profile document
  const handleSavePaperAccount = async (next) => {
    if (!user) return;
    setPaperAccount(next);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { paperAccount: next }, { merge: true });
  };

  // Real 30-day portfolio history from daily closing prices of the current holdings
  const historyCodesKey = useMemo(() => portfolioDocs.map(p => `${p.symbol}:${p.shares}:${liveQuotes[p.symbol]?.historyCode || ''}`).join('|'), [portfolioDocs, liveQuotes]);
  useEffect(() => {
    let cancelled = false;
    const holdings = portfolioDocsRef.current.filter(p => liveQuotes[p.symbol]?.historyCode);
    if (holdings.length === 0) { setPortfolioHistory([]); return; }
    (async () => {
      const series = await Promise.all(holdings.map(p => fetchPriceHistory(liveQuotes[p.symbol].historyCode)));
      if (cancelled) return;
      const dates = [...new Set(series.flat().map(r => r.date))].sort().slice(-30);
      const rows = dates.map(date => {
        let value = 0;
        holdings.forEach((p, i) => {
          // HK and US trade on different days: use the most recent close on or before this date
          const past = series[i].filter(r => r.date <= date);
          const close = past.length ? past[past.length - 1].close : (series[i][0]?.close || 0);
          const rate = (liveQuotes[p.symbol].currency === 'USD') ? DEFAULT_USD_HKD_RATE : 1;
          value += Number(p.shares) * close * rate;
        });
        const d = new Date(`${date}T00:00:00`);
        return { date: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }), value: Math.round(value) };
      });
      setPortfolioHistory(rows);
    })();
    return () => { cancelled = true; };
  }, [historyCodesKey]);

  // Search bar: look up ANY HK/US stock by ticker or company name, with its live price
  useEffect(() => {
    const q = globalSearch.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) { setMarketMatches([]); setIsSearchingMarket(false); return; }
    let cancelled = false;
    setIsSearchingMarket(true);
    const timer = setTimeout(async () => {
      const candidates = await searchMarketSymbols(q);
      const direct = normalizeTicker(q);
      if (direct && !candidates.some(c => c.symbol === direct.symbol)) candidates.unshift({ symbol: direct.symbol, name: '' });
      const quotes = await Promise.all(candidates.slice(0, 6).map(c => fetchLiveStockQuote(c.symbol)));
      if (cancelled) return;
      setMarketMatches(quotes.filter(Boolean));
      setIsSearchingMarket(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [globalSearch]);

  const openAddStockFromQuote = (quote) => {
    setNewStock({
      symbol: quote.symbol,
      name: quote.name,
      shares: '',
      buyPrice: quote.price.toFixed(2),
      currentPrice: quote.price.toFixed(2),
      currency: quote.currency,
      category: quote.currency === 'HKD' ? 'HK Equity' : 'US Tech & Growth'
    });
    setActiveTab('portfolio');
    setShowAddStockModal(true);
    setShowSearchDropdown(false);
    setGlobalSearch('');
  };

  const handleLookupTicker = async (symbolToSearch) => {
    const querySymbol = symbolToSearch || newStock.symbol;
    if (!querySymbol) return;

    setIsSearchingTicker(true);
    try {
      const quote = await fetchLiveStockQuote(querySymbol);
      setIsSearchingTicker(false);

      if (quote && quote.price) {
        setNewStock(prev => ({
          ...prev,
          symbol: quote.symbol,
          name: quote.name || prev.name || quote.symbol,
          currentPrice: quote.price.toFixed(2),
          currency: quote.currency,
          category: quote.currency === 'HKD' ? 'HK Equity' : 'US Tech & Growth',
          buyPrice: prev.buyPrice || quote.price.toFixed(2)
        }));
      } else {
         setNewStock(prev => ({ ...prev, name: 'Ticker not found (or live feed offline)', currentPrice: '' }));
      }
    } catch (err) {
      setIsSearchingTicker(false);
    }
  };

  const handleRefreshNews = () => {
    fetchLiveNews();
  };

  // Filtered Data based on Search
  const filteredTransactions = useMemo(() => {
    if (!globalSearch) return transactions;
    return transactions.filter(tx => 
      tx.description.toLowerCase().includes(globalSearch.toLowerCase()) ||
      tx.category.toLowerCase().includes(globalSearch.toLowerCase()) ||
      (tx.account && tx.account.toLowerCase().includes(globalSearch.toLowerCase()))
    );
  }, [transactions, globalSearch]);

  const filteredPortfolio = useMemo(() => {
    if (!globalSearch) return portfolio;
    return portfolio.filter(p => 
      p.symbol.toLowerCase().includes(globalSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(globalSearch.toLowerCase())
    );
  }, [portfolio, globalSearch]);

  // LIVE SEARCH DROPDOWN MATCHES
  const searchNavMatches = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    const tabs = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview balance cash flow' },
      { id: 'ledger', label: 'Transactions Ledger', icon: Wallet, keywords: 'expense income transactions record history' },
      { id: 'report', label: 'Analytics & Audit', icon: ShieldAlert, keywords: 'report budget warning alert anomaly analytics' },
      { id: 'portfolio', label: 'Investments & Stocks', icon: TrendingUp, keywords: 'stock equity portfolio shares crypto asset' },
      { id: 'simulator', label: 'Strategic Modeler', icon: Sliders, keywords: 'wealth simulation compounding plan scenario' },
      { id: 'debt', label: 'Debt Health', icon: CreditCard, keywords: 'credit card debt loan repayment interest' },
      { id: 'mpf', label: 'MPF & Tax', icon: PiggyBank, keywords: 'tax mpf tvc deduction savings salary' },
      { id: 'advisor', label: 'A.F.A. AI Chat', icon: Bot, keywords: 'ai advisor assistant prompt chat help' }
    ];
    return tabs.filter(t => t.label.toLowerCase().includes(q) || t.keywords.includes(q));
  }, [globalSearch]);

  const searchTransactionMatches = useMemo(() => {
    if (!globalSearch.trim()) return [];
    return transactions.filter(tx => 
      tx.description.toLowerCase().includes(globalSearch.toLowerCase()) ||
      tx.category.toLowerCase().includes(globalSearch.toLowerCase())
    ).slice(0, 5);
  }, [transactions, globalSearch]);

  const searchPortfolioMatches = useMemo(() => {
    if (!globalSearch.trim()) return [];
    return portfolio.filter(p => 
      p.symbol.toLowerCase().includes(globalSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(globalSearch.toLowerCase())
    ).slice(0, 5);
  }, [portfolio, globalSearch]);

  const filteredNews = useMemo(() => {
    return newsFeed.filter(item => {
      const matchesCategory = newsCategory === 'All' || item.category === newsCategory;
      const matchesSearch = !newsSearch || 
        item.title.toLowerCase().includes(newsSearch.toLowerCase()) || 
        item.summary.toLowerCase().includes(newsSearch.toLowerCase()) ||
        item.symbols.some(s => s.toLowerCase().includes(newsSearch.toLowerCase()));

      if (filterByHoldingsOnly && portfolio.length > 0) {
        const userSymbols = portfolio.map(p => p.symbol.toUpperCase());
        const hasMatchingHolding = item.symbols.some(s => userSymbols.includes(s.toUpperCase()));
        return matchesCategory && matchesSearch && hasMatchingHolding;
      }

      return matchesCategory && matchesSearch;
    });
  }, [newsFeed, newsCategory, newsSearch, filterByHoldingsOnly, portfolio]);

  // --- HANDLERS: AUTHENTICATION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthActionLoading(true);
    try {
      await signInWithEmailAndPassword(auth, userProfile.email, userProfile.password);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.');
      setAuthActionLoading(false);
    }
  };

  const handleRegister = async () => {
    setAuthError('');
    setAuthActionLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userProfile.email, userProfile.password);
      const newUser = userCredential.user;
      
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', newUser.uid, 'profile', 'data');
      await setDoc(profileRef, {
        name: userProfile.name,
        email: userProfile.email,
        goal: userProfile.goal,
        targetAmount: userProfile.targetAmount,
        riskTolerance: userProfile.riskTolerance,
        monthlyIncome: userProfile.monthlyIncome,
        weeklyMaxSpend: userProfile.weeklyMaxSpend,
        weeklyMinSavings: userProfile.weeklyMinSavings,
        budgetProfile: userProfile.budgetProfile || 'Standard',
        gender: userProfile.gender || '',
        phone: userProfile.phone || '',
        birthday: userProfile.birthday || '',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.');
      setOnboardingStep(2); 
      setAuthActionLoading(false);
    }
  };

  const handleSignOut = () => signOut(auth);

  // --- HANDLERS: FIRESTORE MUTATIONS ---
  const handleSaveBudgetLimits = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, {
        weeklyMaxSpend: String(userProfile.weeklyMaxSpend || '3500'),
        weeklyMinSavings: String(userProfile.weeklyMinSavings || '1200'),
        monthlyIncome: String(userProfile.monthlyIncome || '30000'),
        budgetProfile: userProfile.budgetProfile || 'Standard'
      }, { merge: true });
    } catch (error) {
      console.error("Error saving budget limits:", error);
      alert("Failed to update budget settings.");
    } finally {
      setShowBudgetModal(false);
    }
  };

  const handleApplyPresetBudget = (presetName, spendLimit, savingsTarget) => {
    setUserProfile(prev => ({
      ...prev,
      budgetProfile: presetName,
      weeklyMaxSpend: String(spendLimit),
      weeklyMinSavings: String(savingsTarget)
    }));
  };

  // Called by the recorder. A one-off writes a transaction; a repeating one writes a rule, and the
  // effect below records every due date (the first one included) as a normal transaction.
  const handleComposerSave = async ({ tx, repeat }) => {
    if (!user) throw new Error('Not signed in');
    if (repeat.frequency === 'none') {
      await addDoc(getCollectionPath(user.uid, 'transactions'), tx);
      return;
    }
    await addDoc(getCollectionPath(user.uid, 'recurring'), {
      template: tx,
      frequency: repeat.frequency,
      anchorDay: Number(tx.date.slice(8, 10)),
      startDate: tx.date,
      nextDate: tx.date,
      endDate: repeat.endDate || '',
      active: true,
      createdAt: new Date().toISOString()
    });
  };

  // Catch up every active rule whose next date has arrived. Transaction ids are `${ruleId}_${date}`, so
  // running this twice (two tabs, a quick reload) can never record the same day twice.
  useEffect(() => {
    if (!user || recurringRules.length === 0) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
    const today = todayLocal();
    recurringRules.forEach(rule => {
      if (!rule.active || !rule.nextDate || rule.nextDate > today) return;
      const runKey = `${rule.id}:${rule.nextDate}`;
      if (recurringRunRef.current.has(runKey)) return;
      recurringRunRef.current.add(runKey);
      const writes = [];
      let date = rule.nextDate;
      let finished = false;
      for (let i = 0; i < 400 && date <= today; i++) {
        if (rule.endDate && date > rule.endDate) { finished = true; break; }
        writes.push(setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', `${rule.id}_${date}`), { ...rule.template, date, recurringId: rule.id }));
        date = nextOccurrence(date, rule.frequency, rule.anchorDay);
      }
      if (rule.endDate && date > rule.endDate) finished = true;
      Promise.all(writes)
        .then(() => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'recurring', rule.id), { nextDate: date, lastRun: today, ...(finished ? { active: false } : {}) }))
        .catch(err => { console.error('Recurring run failed', err); recurringRunRef.current.delete(runKey); });
    });
  }, [user, recurringRules]);

  const handleToggleRecurring = async (rule) => {
    if (!user) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
    const patch = { active: !rule.active };
    // Resuming skips the dates missed while paused instead of back-filling them
    if (!rule.active) {
      let next = rule.nextDate || todayLocal();
      for (let i = 0; i < 1000 && next < todayLocal(); i++) next = nextOccurrence(next, rule.frequency, rule.anchorDay);
      patch.nextDate = next;
    }
    try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'recurring', rule.id), patch); } catch (err) { console.error(err); }
  };

  const handleDeleteRecurring = async (rule) => {
    if (!user) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'recurring', rule.id)); } catch (err) { console.error(err); }
  };

  const handleDeleteTransaction = async (id) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'afa-default', 'users', user.uid, 'transactions', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!newStock.symbol || !newStock.shares || !newStock.buyPrice || !user) return;
    try {
      const portRef = getCollectionPath(user.uid, 'portfolio');
      const cleanSymbol = normalizeTicker(newStock.symbol)?.symbol || newStock.symbol.trim().toUpperCase();
      const isHK = cleanSymbol.endsWith('.HK');
      await addDoc(portRef, {
        symbol: cleanSymbol,
        name: (newStock.name && !newStock.name.startsWith('Ticker not found')) ? newStock.name : cleanSymbol,
        shares: parseFloat(newStock.shares),
        buyPrice: parseFloat(newStock.buyPrice),
        currentPrice: parseFloat(newStock.currentPrice || newStock.buyPrice),
        currency: newStock.currency || (isHK ? 'HKD' : 'USD'),
        category: newStock.category || (isHK ? 'HK Equity' : 'US Tech'),
      });
    } catch (error) {
      console.error("Error adding stock:", error);
      alert("Failed to add asset. Check permissions.");
    } finally {
      setShowAddStockModal(false);
      setNewStock({ symbol: '', name: '', shares: '', buyPrice: '', currentPrice: '', currency: 'HKD', category: 'HK Equity' });
    }
  };

  const handleDeleteStock = async (id) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'afa-default', 'users', user.uid, 'portfolio', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting stock:", error);
    }
  };

  const handleUpdateTargets = async (newMaxSpend, newMinSavings) => {
    setUserProfile(prev => ({ ...prev, weeklyMaxSpend: newMaxSpend, weeklyMinSavings: newMinSavings }));
    if (user) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, { weeklyMaxSpend: newMaxSpend, weeklyMinSavings: newMinSavings }, { merge: true });
    }
  };

  const handleSaveTargetAmount = async () => {
    if (user && tempTarget) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, { targetAmount: tempTarget }, { merge: true });
      setUserProfile(prev => ({ ...prev, targetAmount: tempTarget }));
    }
    setIsEditingTarget(false);
  };

  // Writes the full debt list to Firestore straight away (the auto-save below also keeps it in sync)
  const handleSaveDebtPlan = async () => {
    if (!user) return;
    setIsSavingDebt(true);
    setDebtSaveState(prev => ({ ...prev, status: 'saving', message: '' }));
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      const savedAt = new Date().toISOString();
      await setDoc(profileRef, {
        debts: debts.map(normalizeDebt),
        debtExtra: Number(debtExtra) || 0,
        debtAmount, debtRate, debtMinPay,
        debtsSavedAt: savedAt,
        settings: { debtStrategy }
      }, { merge: true });
      setDebtSaveState({ status: 'saved', at: savedAt, message: '' });
    } catch (error) {
      console.error("Error saving debts", error);
      setDebtSaveState(prev => ({ ...prev, status: 'error', message: 'Could not save. Check your connection and try again.' }));
    } finally {
      setIsSavingDebt(false);
    }
  };

  const handleAddDebt = (e) => {
    e?.preventDefault();
    const balance = Number(debtDraft.balance);
    if (!(balance > 0)) return;
    const name = debtDraft.name.trim() || debtDraft.type;
    setDebts(prev => [...prev, normalizeDebt({ ...debtDraft, name, id: `d${Date.now().toString(36)}` })]);
    setDebtDraft({ name: '', type: debtDraft.type, balance: '', apr: '', minPay: '' });
    setDebtSaveState(prev => ({ ...prev, status: 'dirty' }));
  };

  const handleUpdateDebt = (id, field, value) => {
    setDebts(prev => prev.map(d => (d.id === id ? { ...d, [field]: field === 'name' || field === 'type' ? value : value === '' ? '' : Number(value) } : d)));
    setDebtSaveState(prev => ({ ...prev, status: 'dirty' }));
  };

  const handleDeleteDebt = (id) => {
    setDebts(prev => prev.filter(d => d.id !== id));
    setDebtSaveState(prev => ({ ...prev, status: 'dirty' }));
  };

  const handleSaveProfileInfo = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, {
        name: userProfile.name || '',
        profilePic: userProfile.profilePic || '',
        gender: userProfile.gender || 'Female',
        phone: userProfile.phone || '',
        birthday: userProfile.birthday || '',
        homeAddress: userProfile.homeAddress || '',
        monthlyIncome: String(userProfile.monthlyIncome || ''),
        dependants: Number(userProfile.dependants) || 0,
        goal: userProfile.goal || '',
        targetAmount: String(userProfile.targetAmount || ''),
        goalYears: Number(userProfile.goalYears) || 0,
        riskTolerance: userProfile.riskTolerance || ''
      }, { merge: true });
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to update profile.");
    } finally {
      setShowProfileModal(false);
    }
  };

  // --- FINANCIAL THEORY CALCULATIONS ---
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense' && t.category !== 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalInvestmentDeposits = useMemo(() => transactions.filter(t => t.category === 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const netSavings = totalIncome - totalExpense - totalInvestmentDeposits;

  // New Data Aggregations based on `account` field
  const accountBalances = useMemo(() => {
    const balances = {
      'Bank Account': 0,
      'Cash': 0,
      'Octopus': 0,
      'Credit Card': 0,
      'Crypto': 0
    };
    transactions.forEach(t => {
      const acc = t.account || 'Bank Account';
      if (balances[acc] === undefined) balances[acc] = 0;
      if (t.type === 'income') balances[acc] += Number(t.amount);
      else balances[acc] -= Number(t.amount);
    });
    return Object.entries(balances)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);
  }, [transactions]);

  const paymentMethodsData = useMemo(() => {
    const data = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const acc = t.account || 'Bank Account';
      data[acc] = (data[acc] || 0) + Number(t.amount);
    });
    return Object.entries(data).map(([name, amount]) => ({ name, amount })).sort((a,b) => b.amount - a.amount);
  }, [transactions]);

  const receivingMethodsData = useMemo(() => {
    const data = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
      const acc = t.account || 'Bank Account';
      data[acc] = (data[acc] || 0) + Number(t.amount);
    });
    return Object.entries(data).map(([name, amount]) => ({ name, amount })).sort((a,b) => b.amount - a.amount);
  }, [transactions]);

  const incomeCategoryData = useMemo(() => {
    const data = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
      data[t.category] = (data[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(data).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions]);

  const balanceOverTime = useMemo(() => {
    let runningBalance = 0;
    const data = [];
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(t => {
      runningBalance += (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
      data.push({
        date: t.date,
        balance: runningBalance
      });
    });
    return data;
  }, [transactions]);

  // --- COMPREHENSIVE ANOMALY & FREQUENCY ANALYZER ---
  const anomalyAnalysis = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalSpent = expenses.reduce((sum, t) => sum + Number(t.amount), 0);

    if (expenses.length === 0) {
      return { totalSpent: 0, meanAmount: 0, anomalies: [], frequencyHabits: [], weekendTotal: 0, weekendRatio: 0 };
    }

    const mean = totalSpent / expenses.length;
    const variance = expenses.reduce((sum, t) => sum + Math.pow(Number(t.amount) - mean, 2), 0) / expenses.length;
    const stdDev = Math.sqrt(variance);
    const outlierThreshold = mean + (1.8 * stdDev);

    const highAmountAnomalies = expenses.filter(t => Number(t.amount) > Math.max(outlierThreshold, 1500));

    const categoryCounts = {};
    expenses.forEach(t => {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });

    const frequencyHabits = Object.entries(categoryCounts)
      .filter(([_, count]) => count >= 4)
      .map(([cat, count]) => ({ category: cat, count }));

    const weekendExpenses = expenses.filter(t => {
      const day = new Date(t.date).getDay();
      return day === 0 || day === 6;
    });
    const weekendTotal = weekendExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const weekendRatio = totalSpent > 0 ? (weekendTotal / totalSpent) * 100 : 0;

    return {
      totalSpent,
      meanAmount: Math.round(mean),
      anomalies: highAmountAnomalies,
      frequencyHabits,
      weekendTotal,
      weekendRatio: Math.round(weekendRatio)
    };
  }, [transactions]);

  // Current Week Spend Total
  const currentWeekExpenses = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return transactions.filter(t => t.type === 'expense' && new Date(t.date) >= oneWeekAgo);
  }, [transactions]);

  const weeklySpentTotal = useMemo(() => currentWeekExpenses.reduce((sum, t) => sum + Number(t.amount), 0), [currentWeekExpenses]);

  // Automated Warning & Milestone System
  const systemAlerts = useMemo(() => {
    const alerts = [];
    const maxSpendLimit = Number(userProfile.weeklyMaxSpend) || 3500;
    const minSavingsTarget = Number(userProfile.weeklyMinSavings) || 1200;

    if (weeklySpentTotal > maxSpendLimit) {
      alerts.push({
        type: 'danger',
        title: '⚠️ Budget Overrun Warning',
        message: `Your weekly spending (HK$ ${weeklySpentTotal.toLocaleString()}) has exceeded your defined limit of HK$ ${maxSpendLimit.toLocaleString()}.`
      });
    }

    if (anomalyAnalysis.anomalies.length > 0) {
      alerts.push({
        type: 'danger',
        title: '🚨 High-Value Outflow Outlier',
        message: `Detected ${anomalyAnalysis.anomalies.length} high-value expense transaction(s) significantly above your baseline.`
      });
    }

    if (anomalyAnalysis.weekendRatio > 50 && anomalyAnalysis.weekendTotal > 1000) {
      alerts.push({
        type: 'warning',
        title: '⚠️ Weekend Impulse Spikes Alert',
        message: `${anomalyAnalysis.weekendRatio}% of total expenses occurred on Saturday/Sunday (HK$ ${anomalyAnalysis.weekendTotal.toLocaleString()}).`
      });
    }

    if (netSavings >= minSavingsTarget) {
      alerts.push({
        type: 'success',
        title: '✅ Weekly Target Achieved',
        message: `Congratulations! Your weekly savings goal of HK$ ${minSavingsTarget.toLocaleString()} has been met.`
      });
    }

    return alerts;
  }, [weeklySpentTotal, anomalyAnalysis, netSavings, userProfile.weeklyMaxSpend, userProfile.weeklyMinSavings]);

  // Category Breakdown Calculation
  const categoryBreakdown = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalSpent = expenses.reduce((sum, t) => sum + Number(t.amount), 0);

    const counts = {};
    expenses.forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + Number(t.amount);
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      percentage: totalSpent > 0 ? ((value / totalSpent) * 100).toFixed(1) : 0,
      fill: CATEGORY_COLORS[name] || '#00f2fe'
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Enhanced PDF Report Generator
  const handlePrintPdfReport = () => {
    const printWindow = window.open('', '_blank');
    const reportDate = new Date().toLocaleDateString();

    const categoryRowsHtml = categoryBreakdown.map(c => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${c.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">HK$ ${c.value.toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${c.percentage}%</td>
      </tr>
    `).join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>A.F.A. Comprehensive Financial & Anomaly Audit Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; background: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #00f2fe; padding-bottom: 12px; margin-bottom: 24px; }
            .logo { font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #0f172a; }
            .subtitle { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .meta-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
            .meta-val { font-size: 18px; font-weight: 800; color: #0284c7; margin-top: 4px; }
            .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; border-left: 4px solid #00f2fe; padding-left: 8px; margin: 24px 0 12px 0; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #475569; }
            .alert-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 12px; color: #991b1b; }
            .success-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 12px; color: #166534; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">A.F.A. FINANCIAL AUDIT</div>
              <div class="subtitle">Automated Spending Anomaly & Budget Diagnostics</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              <strong>Client:</strong> ${userProfile.name || 'Valued User'}<br>
              <strong>Date:</strong> ${reportDate}
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-card"><div class="meta-label">Total Outflow</div><div class="meta-val">HK$ ${anomalyAnalysis.totalSpent.toLocaleString()}</div></div>
            <div class="meta-card"><div class="meta-label">Avg Transaction</div><div class="meta-val">HK$ ${anomalyAnalysis.meanAmount.toLocaleString()}</div></div>
            <div class="meta-card"><div class="meta-label">Flagged Outliers</div><div class="meta-val" style="color: ${anomalyAnalysis.anomalies.length > 0 ? '#ef4444' : '#10b981'};">${anomalyAnalysis.anomalies.length}</div></div>
            <div class="meta-card"><div class="meta-label">Weekend Ratio</div><div class="meta-val">${anomalyAnalysis.weekendRatio}%</div></div>
          </div>

          <div class="section-title">1. Automated System Warnings & Threshold Alerts</div>
          ${systemAlerts.length === 0 
            ? '<div class="success-box">✅ All spending activities are within normal target thresholds. No anomalies detected.</div>'
            : systemAlerts.map(a => `
                <div class="alert-box">
                  <strong>${a.title}</strong><br>${a.message}
                </div>
              `).join('')
          }

          <div class="section-title">2. Category-Wise Expense Distribution</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align: right;">Total Spent (HKD)</th>
                <th style="text-align: right;">% Share</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRowsHtml || '<tr><td colSpan="3" style="text-align:center; padding: 12px; color: #94a3b8;">No expense records available.</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">3. Spending Velocity & Pattern Breakdown</div>
          <p style="font-size: 12px; color: #334155;">
            • <strong>Weekend Allocation:</strong> Total of <strong>HK$ ${anomalyAnalysis.weekendTotal.toLocaleString()}</strong> spent on weekends (${anomalyAnalysis.weekendRatio}% of overall cash outflow).<br>
            • <strong>High-Frequency Habits:</strong> ${anomalyAnalysis.frequencyHabits.length > 0 ? anomalyAnalysis.frequencyHabits.map(h => `${h.category} (${h.count} transactions)`).join(', ') : 'No high-frequency spending spikes detected.'}
          </p>

          <div class="footer">
            A.F.A. Automated Financial Advisor • Educational Audit Document • Generated in Hong Kong S.A.R.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  const savingsRatio = useMemo(() => totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0, [totalIncome, netSavings]);
  const rentExpense = useMemo(() => transactions.find(t => t.category === 'Rent')?.amount || 0, [transactions]);
  const rentBurdenRatio = useMemo(() => totalIncome > 0 ? ((rentExpense / totalIncome) * 100) : 0, [totalIncome, rentExpense]);
  const investmentRatio = useMemo(() => totalIncome > 0 ? ((totalInvestmentDeposits / totalIncome) * 100) : 0, [totalIncome, totalInvestmentDeposits]);

  const healthScore = useMemo(() => {
    let score = 50;
    if (savingsRatio >= 20) score += 20;
    else if (savingsRatio >= 10) score += 10;
    if (rentBurdenRatio <= 35 && rentBurdenRatio > 0) score += 20;
    if (investmentRatio >= 15) score += 10;
    return Math.min(100, Math.max(0, score));
  }, [savingsRatio, rentBurdenRatio, investmentRatio]);

  const portfolioTotalValue = useMemo(() => portfolio.reduce((sum, item) => {
    const rate = item.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1;
    return sum + (item.shares * item.currentPrice * rate);
  }, 0), [portfolio]);

  const portfolioTotalCost = useMemo(() => portfolio.reduce((sum, item) => {
    const rate = item.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1;
    return sum + (item.shares * item.buyPrice * rate);
  }, 0), [portfolio]);

  const portfolioUnrealizedGain = portfolioTotalValue - portfolioTotalCost;
  const portfolioGainPercent = portfolioTotalCost > 0 ? ((portfolioUnrealizedGain / portfolioTotalCost) * 100).toFixed(2) : '0.00';

  // New Portfolio Dash Data
  const portfolioDiversity = useMemo(() => {
    const data = {};
    portfolio.forEach(item => {
      const rate = item.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1;
      const val = item.shares * item.currentPrice * rate;
      data[item.category] = (data[item.category] || 0) + val;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value, fill: CATEGORY_COLORS[name] || '#00f2fe' }));
  }, [portfolio]);

  // Real closing prices (see portfolioHistory effect); today's bar always equals the live valuation
  const portfolioGrowth = useMemo(() => {
    if (portfolioHistory.length === 0) return [];
    const rows = portfolioHistory.slice();
    rows[rows.length - 1] = { ...rows[rows.length - 1], value: Math.round(portfolioTotalValue) };
    return rows;
  }, [portfolioHistory, portfolioTotalValue]);

  const simulationTrajectory = useMemo(() => {
    const data = [];
    let currentBalance = simInitial;
    let totalInvested = simInitial;
    const r = simRate / 100 / 12;

    for (let yr = 0; yr <= simYears; yr++) {
      data.push({
        year: `Yr ${yr}`,
        balance: Math.round(currentBalance),
        invested: Math.round(totalInvested),
      });
      for (let m = 0; m < 12; m++) {
        currentBalance = (currentBalance + simMonthly) * (1 + r);
        totalInvested += simMonthly;
      }
    }
    return data;
  }, [simInitial, simMonthly, simRate, simYears]);

  // Month-by-month payoff of every debt: minimums on all, everything extra to the target debt
  const debtPayoffTrajectory = useMemo(() => simulateDebtPayoff(debts, debtExtra, debtStrategy), [debts, debtExtra, debtStrategy]);
  const debtAltPlan = useMemo(() => simulateDebtPayoff(debts, debtExtra, debtStrategy === 'avalanche' ? 'snowball' : 'avalanche'), [debts, debtExtra, debtStrategy]);

  const mpfCalc = useMemo(() => {
    const income = Number(mpfIncome) || 0;
    let mandatory = 0;
    if (income >= 30000) mandatory = 1500;
    else if (income >= 7100) mandatory = income * 0.05;

    const annualTvc = Math.min(60000, Number(tvcMonthly) * 12);
    // Tax saved = salaries tax without TVC minus salaries tax with TVC (mandatory MPF deduction capped at HK$18,000)
    const mpfDeduction = Math.min(18000, mandatory * 12);
    const estimatedTaxSaved = Math.round(calcHKSalariesTax(income * 12, mpfDeduction) - calcHKSalariesTax(income * 12, mpfDeduction + annualTvc));

    return { mandatory, annualTvc, estimatedTaxSaved };
  }, [mpfIncome, tvcMonthly]);

  // --- COMPLETE BALANCE SHEET: ledger cash + stocks + other assets − debts ---
  const liquidCash = useMemo(() => accountBalances.filter(a => ['Bank Account', 'Cash', 'Octopus'].includes(a.name)).reduce((sum, a) => sum + Math.max(0, a.value), 0), [accountBalances]);
  const otherAssetsValued = useMemo(() => otherAssets.map(a => ({ ...a, valueHkd: assetValueHkd(a, cryptoPrices, DEFAULT_USD_HKD_RATE) })), [otherAssets, cryptoPrices]);
  const otherAssetsTotal = useMemo(() => otherAssetsValued.reduce((sum, a) => sum + a.valueHkd, 0), [otherAssetsValued]);
  const creditCardOwed = Math.max(0, -(accountBalances.find(a => a.name === 'Credit Card')?.value || 0));
  const netWorth = liquidCash + portfolioTotalValue + otherAssetsTotal - debtAmount - creditCardOwed;
  // Diversity chart: stock categories plus each kind of other asset
  const diversityData = useMemo(() => {
    const byType = {};
    otherAssetsValued.forEach(a => { const label = assetType(a.type).label; byType[label] = (byType[label] || 0) + a.valueHkd; });
    return [...portfolioDiversity, ...Object.entries(byType).map(([name, value]) => ({ name, value }))].filter(d => d.value > 0);
  }, [portfolioDiversity, otherAssetsValued]);

  // --- PERSONAL REVIEW: scores + ranked recommendations from everything above (src/lib/insights.js) ---
  const insights = useMemo(() => {
    const income = Number(mpfIncome) || Number(userProfile.monthlyIncome) || 0;
    const mpfDeduction = Math.min(18000, (income >= 30000 ? 1500 : income >= 7100 ? income * 0.05 : 0) * 12);
    const savedAtMax = Math.round(calcHKSalariesTax(income * 12, mpfDeduction) - calcHKSalariesTax(income * 12, mpfDeduction + 60000));
    const paperEquity = paperAccount ? paperAccount.cash + (paperAccount.holdings || []).reduce((sum, h) => sum + h.shares * (h.lastPrice || h.avgCost) * (h.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1), 0) : 0;
    return buildInsights({
      profile: userProfile,
      transactions,
      recurringRules,
      liquidCash,
      stocks: portfolio.map(h => ({ symbol: h.symbol, valueHkd: h.shares * h.currentPrice * (h.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1) })),
      assets: otherAssetsValued,
      debts,
      debtPlan: debtPayoffTrajectory,
      weeklySpent: weeklySpentTotal,
      tax: { tvcMonthly: Number(tvcMonthly) || 0, savedNow: mpfCalc.estimatedTaxSaved, savedAtMax },
      paper: paperAccount ? { equity: paperEquity, startingCash: paperAccount.startingCash, trades: (paperAccount.trades || []).length } : null
    });
  }, [userProfile, transactions, recurringRules, liquidCash, portfolio, otherAssetsValued, debts, debtPayoffTrajectory, weeklySpentTotal, tvcMonthly, mpfIncome, mpfCalc, paperAccount]);

  // --- EVERYTHING THE ASSISTANT KNOWS ABOUT THIS USER (rebuilt from live data on every message) ---
  const buildFinancialSnapshot = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter(t => String(t.date || '').startsWith(monthKey));
    const monthIncome = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const byCategory = {};
    monthTx.filter(t => t.type === 'expense' && t.category !== 'Investment').forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount); });
    const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, amount]) => ({ category, amount: Math.round(amount) }));
    const monthSpend = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
    const target = Number(userProfile.targetAmount) || 0;
    const assets = Math.max(0, netSavings) + portfolioTotalValue;

    return {
      firstName: (userProfile.name || '').trim().split(' ')[0] || 'there',
      goal: userProfile.goal || 'General Wealth Accumulation',
      targetAmountHKD: target,
      goalProgressPct: target > 0 ? Math.min(100, Math.round((assets / target) * 100)) : null,
      savedTowardsGoalHKD: Math.round(assets),
      riskTolerance: userProfile.riskTolerance || 'not set',
      monthlyIncomeHKD: Number(userProfile.monthlyIncome) || 0,
      budget: { profile: userProfile.budgetProfile || 'Standard', weeklyMaxSpendHKD: Number(userProfile.weeklyMaxSpend || 3500), weeklyMinSavingsHKD: Number(userProfile.weeklyMinSavings || 1200), spentThisWeekHKD: Math.round(weeklySpentTotal) },
      thisMonth: { incomeHKD: Math.round(monthIncome), spendingHKD: Math.round(monthSpend), topCategories },
      allTime: { incomeHKD: Math.round(totalIncome), expensesHKD: Math.round(totalExpense), cashSavedHKD: Math.round(netSavings), transactionsLogged: transactions.length },
      healthScore,
      savingsRatePct: Number(savingsRatio.toFixed(1)),
      rentBurdenPct: Number(rentBurdenRatio.toFixed(1)),
      spendingOutliers: anomalyAnalysis.anomalies.length,
      weekendSpendPct: Number(anomalyAnalysis.weekendRatio) || 0,
      portfolio: {
        totalValueHKD: Math.round(portfolioTotalValue),
        unrealizedGainHKD: Math.round(portfolioUnrealizedGain),
        gainPct: Number(portfolioGainPercent),
        holdings: portfolio.map(p => ({ symbol: p.symbol, name: p.name, shares: p.shares, price: p.currentPrice, currency: p.currency, category: p.category, dayChangePct: p.dayChangePct }))
      },
      debt: { debts: debts.map(d => ({ name: d.name, type: d.type, balanceHKD: Number(d.balance) || 0, aprPct: Number(d.apr) || 0, minPaymentHKD: Number(d.minPay) || 0 })), extraMonthlyHKD: Number(debtExtra) || 0, debtFreeDate: debtPayoffTrajectory.debtFreeLabel, balanceHKD: Number(debtAmount) || 0, aprPct: Number(debtRate) || 0, monthlyPaymentHKD: Number(debtMinPay) || 0, strategy: debtStrategy, monthsToClear: debtPayoffTrajectory.totalMonths, totalInterestHKD: debtPayoffTrajectory.totalInterest },
      mpf: { mandatoryMonthlyHKD: Math.round(mpfCalc.mandatory), tvcAnnualHKD: mpfCalc.annualTvc, estimatedTaxSavedHKD: mpfCalc.estimatedTaxSaved },
      netWorthHKD: Math.round(netWorth),
      otherAssets: otherAssetsValued.map(a => ({ type: assetType(a.type).label, name: a.name, valueHKD: Math.round(a.valueHkd), ratePct: a.rate || undefined, maturity: a.maturity || undefined })),
      simulatedTrading: paperAccount ? { startingCashHKD: paperAccount.startingCash, cashHKD: Math.round(paperAccount.cash), positions: (paperAccount.holdings || []).length, trades: (paperAccount.trades || []).length, realizedPnlHKD: Math.round(paperAccount.realizedPnl || 0) } : null,
      // The same ranked plan shown on the Analytics page, so chat advice matches it
      personalPlan: {
        score: insights.overall,
        pillars: insights.pillars.map(pl => `${pl.label} ${pl.score}/100 (${pl.note})`),
        recommendations: insights.recommendations.slice(0, 6).map(r => ({ priority: r.priority, title: r.title, finding: r.finding, actions: r.actions }))
      }
    };
  };

  // --- BUILT-IN CONVERSATIONAL ENGINE (used when no AI key is set, or the AI service fails) ---
  const lastChatTopicRef = useRef('');
  const generateLocalAiAdvice = (userQuery) => {
    const s = buildFinancialSnapshot();
    const q = userQuery.toLowerCase().trim();
    const hkd = (n) => `HK$ ${Math.round(Number(n) || 0).toLocaleString()}`;
    const has = (...words) => words.some(w => q.includes(w));
    const noData = s.allTime.transactionsLogged === 0;

    // Short follow-ups ("yes", "tell me more", "why?") continue the previous topic
    let topic = '';
    if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(q) && q.length < 25) topic = 'greeting';
    else if ((/^(thanks|thank you|thx|great|cool|got it)\b/.test(q) || /^(ok|okay)[.!]?$/.test(q)) && !has('more', 'explain', 'why', 'how')) topic = 'thanks';
    else if (has('what should i do', 'recommend', 'action plan', 'next step', 'priority', 'priorities', 'plan for me')) topic = 'plan';
    else if (has('goal', 'on track', 'target', 'down payment', 'how long', 'when can i')) topic = 'goal';
    else if (has('afford', 'can i buy', 'should i buy') && !has('stock', 'share')) topic = 'afford';
    else if (has('tax', 'mpf', 'tvc', 'retire', 'pension')) topic = 'tax';
    else if (has('debt', 'loan', 'credit card', 'card', 'owe', 'interest', 'bnpl')) topic = 'debt';
    else if (has('stock', 'invest', 'portfolio', 'share', 'etf', 'risk', 'market', 'holding')) topic = 'invest';
    else if (has('rent', 'housing', 'flat')) topic = 'rent';
    else if (has('cut', 'spend', 'expens', 'budget', 'weekend', 'where does', 'overspend')) topic = 'spending';
    else if (has('save', 'saving')) topic = 'saving';
    else if (has('how am i', 'doing', 'health', 'score', 'improve', 'advice', 'summary', 'report', 'overview', 'review')) topic = 'overview';
    else if (q.length < 40 && lastChatTopicRef.current) topic = `${lastChatTopicRef.current}-more`;
    else topic = 'overview';
    // A follow-up on the overview or goal naturally leads into spending
    if (['overview-more', 'goal-more', 'greeting-more', 'thanks-more', 'afford-more', 'rent-more'].includes(topic)) topic = 'spending';
    if (topic === 'spending-more' || topic === 'saving-more') topic = 'cut-impact';
    lastChatTopicRef.current = topic.replace('-more', '').replace('cut-impact', 'goal');

    const monthsToClear = (balance, apr, payment) => {
      let b = balance, m = 0;
      while (b > 0 && m < 600) { b = b * (1 + apr / 1200) - payment; m++; }
      return m >= 600 ? null : m;
    };

    const top = s.thisMonth.topCategories;
    const weekLeft = s.budget.weeklyMaxSpendHKD - s.budget.spentThisWeekHKD;
    const monthlySurplus = Math.max(0, s.monthlyIncomeHKD - (s.thisMonth.spendingHKD || 0));

    switch (topic) {
      case 'greeting':
        return `Hi ${s.firstName}! Quick snapshot: your health score is ${s.healthScore}/100 and you've spent ${hkd(s.budget.spentThisWeekHKD)} of your ${hkd(s.budget.weeklyMaxSpendHKD)} weekly budget. What would you like to look at — spending, your "${s.goal}" goal, investments, debt, or tax?`;

      case 'thanks':
        return `Anytime, ${s.firstName}. Want me to check anything else — maybe whether you're on track for your goal?`;

      case 'plan': {
        const recs = s.personalPlan.recommendations.slice(0, 3);
        if (recs.length === 0) return `Your finances look healthy right now, ${s.firstName} (score ${s.personalPlan.score}/100). Keep saving and investing automatically, and check the Analytics page after you record more.`;
        return `Here are your top priorities, ${s.firstName} (overall score ${s.personalPlan.score}/100):\n\n` +
          recs.map((r, i) => `${i + 1}. ${r.title}\n   ${r.finding}\n   First step: ${r.actions[0]}`).join('\n\n') +
          `\n\nThe full plan with every step is on the Analytics page. Which one would you like to dig into?`;
      }

      case 'goal': {
        if (!s.targetAmountHKD) return `You haven't set a target amount yet, ${s.firstName}. Add one on the Dashboard goal card and I can tell you how long it will take at your current pace.`;
        const remaining = Math.max(0, s.targetAmountHKD - s.savedTowardsGoalHKD);
        const months = monthlySurplus > 0 ? Math.ceil(remaining / monthlySurplus) : null;
        return `You're ${s.goalProgressPct}% of the way to your "${s.goal}" goal: ${hkd(s.savedTowardsGoalHKD)} of ${hkd(s.targetAmountHKD)} (cash saved plus investments).\n\n` +
          (remaining === 0 ? `You've reached it — congratulations! Time to set the next target.` :
            months ? `At this month's pace (about ${hkd(monthlySurplus)} left after spending), the remaining ${hkd(remaining)} takes roughly ${months >= 24 ? `${(months / 12).toFixed(1)} years` : `${months} months`}, before any investment growth.` :
              `Right now there's no monthly surplus recorded, so the gap of ${hkd(remaining)} isn't closing yet.`) +
          `\n\nWant to see how much faster it gets if you invest the surplus? Try the Strategic Modeler, or ask me "where can I cut spending?"`;
      }

      case 'afford': {
        const amount = Number((q.match(/(\d[\d,]*\.?\d*)\s*(k)?/) || [])[1]?.replace(/,/g, '') || 0) * (/\d\s*k\b/.test(q) ? 1000 : 1);
        if (!amount) return `Tell me the price and I'll check it against your budget — for example "can I afford a HK$3,000 trip?"`;
        return amount <= weekLeft
          ? `Yes — ${hkd(amount)} fits. You still have ${hkd(weekLeft)} left in this week's ${hkd(s.budget.weeklyMaxSpendHKD)} budget, so you'd have ${hkd(weekLeft - amount)} to spare.`
          : `It would put you over. You have ${hkd(Math.max(0, weekLeft))} left this week, so ${hkd(amount)} overshoots your limit by ${hkd(amount - Math.max(0, weekLeft))}. If it matters to you, spreading it over ${Math.ceil(amount / Math.max(1, s.budget.weeklyMaxSpendHKD * 0.3))} weeks of smaller savings keeps your ${s.savingsRatePct}% savings rate intact. Is it a need or a want?`;
      }

      case 'tax-more':
        return `Here's the comparison. Putting ${hkd(s.mpf.tvcAnnualHKD)} into TVC gets you ${hkd(s.mpf.estimatedTaxSavedHKD)} back from tax straight away — an instant ${s.mpf.tvcAnnualHKD > 0 ? ((s.mpf.estimatedTaxSavedHKD / s.mpf.tvcAnnualHKD) * 100).toFixed(1) : 0}% "return" before any investment growth. Investing the same money yourself gives no tax break, but you can take it out whenever you need it.\n\nSince your goal is "${s.goal}", money you'll need before 65 should stay outside TVC; TVC suits only the part you're happy to lock away for retirement. You can try different amounts in the MPF & Tax tab — shall I look at your spending to see how much you could spare?`;

      case 'tax':
        return `On a monthly income of ${hkd(s.monthlyIncomeHKD)}, your mandatory MPF is ${hkd(s.mpf.mandatoryMonthlyHKD)} a month, and your employer adds the same.\n\n` +
          `With the ${hkd(s.mpf.tvcAnnualHKD)} a year of TVC you've set in the MPF & Tax tab, you'd save about ${hkd(s.mpf.estimatedTaxSavedHKD)} in salaries tax. The trade-off: TVC money is locked until 65, so it only makes sense after you have an emergency fund${s.debt.balanceHKD > 0 && s.debt.aprPct > 10 ? ` and your ${s.debt.aprPct}% debt is cleared` : ''}.\n\nWant me to compare that with investing the same amount yourself?`;

      case 'debt-more': {
        if (!s.debt.balanceHKD) return `There's no debt on your profile to optimise. Shall we look at growing your savings instead?`;
        const faster = monthsToClear(s.debt.balanceHKD, s.debt.aprPct, s.debt.monthlyPaymentHKD + 1000);
        const cuttable = top.find(c => ['Dining', 'Shopping', 'Entertainment', 'Travel', 'Subscriptions'].includes(c.category));
        return `If you add ${hkd(1000)} a month (paying ${hkd(s.debt.monthlyPaymentHKD + 1000)}), you'd be debt-free in about ${faster ?? '—'} months instead of ${s.debt.monthsToClear}.\n\n` +
          `${cuttable ? `Your ${cuttable.category} spending is ${hkd(cuttable.amount)} this month, so trimming it by a third would cover most of that extra payment.` : `Log a few more expenses and I can point to where that extra ${hkd(1000)} could come from.`} Avalanche (highest interest first) is the cheapest order if you have more than one debt. Want to see your spending breakdown?`;
      }

      case 'debt':
        if (!s.debt.balanceHKD) return `Good news, ${s.firstName} — you have no debt recorded. If you do carry a card balance or loan, add it in the Debt Health tab and I'll work out the fastest way to clear it.`;
        return `You owe ${hkd(s.debt.balanceHKD)}${s.debt.debts.length > 1 ? ` across ${s.debt.debts.length} debts (${s.debt.debts.map(d => d.name).join(', ')})` : ''} at ${s.debt.aprPct}% ${s.debt.debts.length > 1 ? 'average ' : ''}APR. Paying ${hkd(s.debt.monthlyPaymentHKD)} a month with the ${s.debt.strategy} method clears it in about ${s.debt.monthsToClear} months and costs ${hkd(s.debt.totalInterestHKD)} in interest.\n\n` +
          `That interest rate is ${s.debt.aprPct > 12 ? 'far higher than any realistic investment return, so paying this down first is your best "investment"' : 'moderate, so balance repayment with saving'}. Every extra ${hkd(1000)} a month shortens the timeline noticeably — want me to estimate how much you could free up from your spending?`;

      case 'invest-more':
        return `Diversification just means not relying on one company. An index ETF does that in a single purchase: Hong Kong's Tracker Fund (2800) holds the whole Hang Seng Index, and S&P 500 funds hold 500 US companies, so one bad earnings report barely moves you.\n\nFor a "${s.riskTolerance}" profile, people usually keep a broad index fund as the core and limit single stocks to a smaller slice, adding a fixed amount every month rather than timing the market. This is general education, not a recommendation — want me to check how concentrated your current holdings are?`;

      case 'invest': {
        if (s.portfolio.holdings.length === 0) return `You don't have any holdings recorded yet. Use the search bar at the top to look up any HK or US stock (try "2800" or "VOO") and add it, then I can comment on your mix. Your risk profile is "${s.riskTolerance}" — would you like a plain-English explanation of what suits that profile?`;
        const biggest = [...s.portfolio.holdings].sort((a, b) => (b.shares * b.price * (b.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1)) - (a.shares * a.price * (a.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1)))[0];
        const biggestPct = s.portfolio.totalValueHKD > 0 ? Math.round((biggest.shares * biggest.price * (biggest.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1)) / s.portfolio.totalValueHKD * 100) : 0;
        return `Your portfolio is worth ${hkd(s.portfolio.totalValueHKD)} across ${s.portfolio.holdings.length} holding${s.portfolio.holdings.length > 1 ? 's' : ''}, ${s.portfolio.gainPct >= 0 ? 'up' : 'down'} ${Math.abs(s.portfolio.gainPct)}% (${hkd(s.portfolio.unrealizedGainHKD)}) on what you paid.\n\n` +
          `${biggest.symbol} is your largest position at about ${biggestPct}% of the total${biggestPct > 50 ? ` — that's concentrated for a "${s.riskTolerance}" profile, since one company's bad quarter would move your whole portfolio` : ', which is a reasonable spread'}.\n\nI can't tell you what to buy or sell, but I can explain diversification or how index ETFs work. Which would help?`;
      }

      case 'rent':
        return `Rent takes ${s.rentBurdenPct}% of your income. ${s.rentBurdenPct > 35 ? `That's above the 30–35% affordability line, and it's the main thing holding your health score at ${s.healthScore}. A cheaper district or flat-share is the single biggest lever you have.` : s.rentBurdenPct > 0 ? `That's within the 30–35% affordability range, so housing isn't your problem area.` : `I don't see a rent transaction yet — log it under the "Rent" category so I can factor it in.`} Want to look at your other spending?`;

      case 'cut-impact': {
        const cuttable = top.find(c => ['Dining', 'Shopping', 'Entertainment', 'Travel', 'Subscriptions'].includes(c.category));
        const extra = cuttable ? cuttable.amount * 0.2 : 500;
        const remaining = Math.max(0, s.targetAmountHKD - s.savedTowardsGoalHKD);
        if (!s.targetAmountHKD || monthlySurplus <= 0) return `Saving an extra ${hkd(extra)} a month adds up to ${hkd(extra * 12)} a year. Set a target amount on the Dashboard and I'll translate that into time saved on your goal.`;
        const before = Math.ceil(remaining / monthlySurplus);
        const after = Math.ceil(remaining / (monthlySurplus + extra));
        return `Putting an extra ${hkd(extra)} a month towards "${s.goal}"${cuttable ? ` (20% less ${cuttable.category})` : ''} brings the timeline from about ${before} months down to ${after} — ${before - after} month${before - after === 1 ? '' : 's'} sooner, and more once investment growth is included.\n\nThe Strategic Modeler shows the compounding effect. Would you like to talk about where to keep that money — savings, investments or TVC?`;
      }

      case 'spending':
      case 'saving': {
        if (noData) return `I don't have any transactions to analyse yet, ${s.firstName}. Add your salary and a few expenses in the Transactions tab and I'll show you exactly where the money goes.`;
        const lines = top.slice(0, 3).map(c => `• ${c.category}: ${hkd(c.amount)}`).join('\n');
        const cuttable = top.find(c => ['Dining', 'Shopping', 'Entertainment', 'Travel', 'Subscriptions'].includes(c.category));
        return `This month you've spent ${hkd(s.thisMonth.spendingHKD)}. Your biggest categories:\n${lines || '• (no expenses logged this month)'}\n\n` +
          `${weekLeft < 0 ? `You're ${hkd(-weekLeft)} over this week's budget. ` : `You have ${hkd(weekLeft)} left in this week's budget. `}` +
          `${s.weekendSpendPct > 40 ? `${s.weekendSpendPct}% of your spending happens on weekends, so a fixed weekend allowance would help most. ` : ''}` +
          `${cuttable ? `Trimming ${cuttable.category} by 20% would free up about ${hkd(cuttable.amount * 0.2)} a month.` : ''}\n\nShould I work out what that does for your "${s.goal}" timeline?`;
      }

      default: {
        if (noData) return `Hi ${s.firstName}! Your profile is saved (goal: "${s.goal}", ${s.riskTolerance} risk), but I don't have any transactions yet. Add your salary and a few expenses in the Transactions tab and I can give you a proper review. In the meantime, ask me about MPF, tax or investing basics.`;
        const weakest = s.savingsRatePct < 20 ? `your savings rate of ${s.savingsRatePct}% (the benchmark is 20%)`
          : s.rentBurdenPct > 35 ? `rent at ${s.rentBurdenPct}% of income`
          : s.debt.balanceHKD > 0 && s.debt.aprPct > 12 ? `the ${hkd(s.debt.balanceHKD)} debt at ${s.debt.aprPct}%`
          : weekLeft < 0 ? `this week's spending, which is ${hkd(-weekLeft)} over budget` : '';
        return `Here's where you stand, ${s.firstName}: health score ${s.healthScore}/100, saving ${s.savingsRatePct}% of income, and ${s.goalProgressPct ?? 0}% of the way to "${s.goal}".\n\n` +
          `${weakest ? `The thing I'd work on first is ${weakest}.` : `Nothing is flashing red — your budget, rent and debt are all in a healthy range.`}` +
          `${s.spendingOutliers > 0 ? ` I also flagged ${s.spendingOutliers} unusually large purchase${s.spendingOutliers > 1 ? 's' : ''} in Analytics.` : ''}` +
          `\n\nWant me to dig into spending, your goal timeline, investments, debt or tax?`;
      }
    }
  };

  // Keep the conversation in the user's profile so it is still there next time they log in
  const persistChat = async (messages) => {
    if (!user) return;
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      const trimmed = messages.slice(-30).map(m => ({ role: m.role, text: String(m.text).slice(0, 2000) }));
      await setDoc(profileRef, { chatHistory: trimmed }, { merge: true });
    } catch (err) {
      console.error("Chat history save failed:", err);
    }
  };

  const handleClearChat = () => {
    const fresh = [{ role: 'model', text: DEFAULT_CHAT_GREETING.replace('Hi!', `Hi ${(userProfile.name || '').trim().split(' ')[0] || 'there'}!`) }];
    lastChatTopicRef.current = '';
    setChatMessages(fresh);
    persistChat(fresh);
  };

  const handleSendMessage = async (e, presetText) => {
    if (e) e.preventDefault();
    const userMsg = (presetText || userInput).trim();
    if (!userMsg || isLoadingAi) return;
    setUserInput('');
    const history = [...chatMessages, { role: 'user', text: userMsg }];
    setChatMessages(history);
    setIsLoadingAi(true);

    let reply = '';
    try {
      // Vite only reads variables that start with VITE_ from a file named ".env" (or a GitHub Actions secret at build time)
      const apiKey = import.meta.env?.VITE_DEEPSEEK_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || "";
      if (!apiKey) throw new Error('NO_KEY');

      const snapshot = buildFinancialSnapshot();
      const systemPrompt = `You are A.F.A. (Automated Financial Assistant), a friendly personal-finance assistant for young adults in Hong Kong. You are chatting with ${snapshot.firstName}.

How to talk:
- Sound like a knowledgeable friend, not a report. Keep replies short: 2-5 sentences, plus at most 3 short bullet lines (start them with "• ") when a list really helps.
- Plain text only. No markdown symbols such as ** or #, because the chat window shows raw text.
- Answer exactly what was asked using the user's real numbers from the snapshot below (currency HK$). Do not recite the whole profile.
- Remember the earlier messages in this conversation and build on them.
- When natural, end with one short follow-up question or a concrete next step inside the app (tabs: Dashboard, Transactions, Analytics, Investments, Strategic Modeler, Debt Health, MPF & Tax).
- If the data needed is missing (for example no transactions logged), say so and tell them where to add it. Never invent figures.

Rules:
- Education and general guidance only. Explain trade-offs; never tell the user to buy or sell a specific security, and say you are not a licensed adviser if asked for stock picks.
- Hong Kong facts: MPF is 5% from employee and employer on relevant income HK$7,100-30,000 (max HK$1,500 each per month); TVC is tax-deductible up to HK$60,000 a year but locked until 65; salaries tax is progressive 2/6/10/14/17% after the HK$132,000 basic allowance, capped by the 15% standard rate; credit card APRs are often above 30%.

Live snapshot of this user's finances (JSON):
${JSON.stringify(snapshot)}`;

      const apiMessages = history.slice(-13)
        .filter((msg, i) => !(i === 0 && msg.role === 'model'))
        .map(msg => ({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.text }));

      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "system", content: systemPrompt }, ...apiMessages],
          temperature: 0.6,
          max_tokens: 600,
          stream: false
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || "API request failed");
      reply = (data?.choices?.[0]?.message?.content || '').replace(/\*\*/g, '').trim();
      if (!reply) throw new Error('Empty AI reply');
      setAiEngine('DeepSeek AI');
    } catch (err) {
      if (err.message !== 'NO_KEY') console.error("AI Chat Error:", err);
      // Built-in engine: still answers from the user's own profile and numbers
      await new Promise(resolve => setTimeout(resolve, 500));
      reply = generateLocalAiAdvice(userMsg);
      setAiEngine('Built-in engine');
    }

    const updated = [...history, { role: 'model', text: reply }];
    setChatMessages(updated);
    setIsLoadingAi(false);
    persistChat(updated);
  };

  // Keep the newest chat message in view
  useEffect(() => {
    if (activeTab === 'advisor') chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, isLoadingAi, activeTab]);

  // Auto-save calculator inputs to the user's profile (1.2s after they stop changing)
  useEffect(() => {
    if (!user || !settingsLoadedRef.current) return;
    const timer = setTimeout(() => {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      setDoc(profileRef, {
        debts: debts.map(normalizeDebt),
        debtExtra: Number(debtExtra) || 0,
        debtAmount: Number(debtAmount) || 0,
        debtRate: Number(debtRate) || 0,
        debtMinPay: Number(debtMinPay) || 0,
        settings: {
          debtStrategy,
          simInitial: Number(simInitial) || 0,
          simMonthly: Number(simMonthly) || 0,
          simRate: Number(simRate) || 0,
          simYears: Number(simYears) || 0,
          mpfIncome: Number(mpfIncome) || 0,
          tvcMonthly: Number(tvcMonthly) || 0,
          cashFlowView
        }
      }, { merge: true })
        .then(() => setDebtSaveState(prev => (prev.status === 'dirty' ? { status: 'saved', at: new Date().toISOString(), message: '' } : prev)))
        .catch(err => console.error("Settings auto-save failed:", err));
    }, 1200);
    return () => clearTimeout(timer);
  }, [user, debts, debtExtra, debtAmount, debtRate, debtMinPay, debtStrategy, simInitial, simMonthly, simRate, simYears, mpfIncome, tvcMonthly, cashFlowView]);

  const cashFlowData = useMemo(() => {
    const now = new Date();

    if (cashFlowView === 'Daily') {
      // Generate past 7 days timeline
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayName = d.toLocaleDateString('default', { weekday: 'short' });
        const dateStr = d.toISOString().split('T')[0];
        days.push({ name: dayName, dateStr, income: 0, expense: 0 });
      }

      transactions.forEach(t => {
        const match = days.find(d => d.dateStr === t.date);
        if (match) {
          if (t.type === 'income') match.income += Number(t.amount);
          else match.expense += Number(t.amount);
        }
      });

      return days.map(({ name, income, expense }) => ({ name, income, expense }));
    }

    if (cashFlowView === 'Weekly') {
      // Generate past 4 weeks timeline
      const weeks = [
        { name: 'W1', income: 0, expense: 0, minDaysAgo: 28, maxDaysAgo: 21 },
        { name: 'W2', income: 0, expense: 0, minDaysAgo: 21, maxDaysAgo: 14 },
        { name: 'W3', income: 0, expense: 0, minDaysAgo: 14, maxDaysAgo: 7 },
        { name: 'W4', income: 0, expense: 0, minDaysAgo: 7, maxDaysAgo: 0 },
      ];

      transactions.forEach(t => {
        const txDate = new Date(t.date);
        const diffDays = Math.floor((now - txDate) / (1000 * 60 * 60 * 24));
        const targetWeek = weeks.find(w => diffDays >= w.maxDaysAgo && diffDays < w.minDaysAgo);
        if (targetWeek) {
          if (t.type === 'income') targetWeek.income += Number(t.amount);
          else targetWeek.expense += Number(t.amount);
        }
      });

      return weeks.map(({ name, income, expense }) => ({ name, income, expense }));
    }

    // Monthly View: Populate 6-month timeline strictly from user records
    const grouped = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      grouped[monthKey] = { name: monthLabel, income: 0, expense: 0 };
    }

    transactions.forEach(t => {
      if (!t.date) return;
      const txDate = new Date(t.date);
      if (isNaN(txDate.getTime())) return;
      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthKey]) {
        grouped[monthKey] = { name: txDate.toLocaleString('default', { month: 'short' }), income: 0, expense: 0 };
      }
      if (t.type === 'income') grouped[monthKey].income += Number(t.amount);
      else grouped[monthKey].expense += Number(t.amount);
    });

    return Object.values(grouped);
  }, [transactions, cashFlowView]);

  return (
    <div className={`flex h-screen bg-[#0d1117] text-slate-100 font-sans selection:bg-[#00f2fe]/30 selection:text-cyan-300 overflow-hidden ${fx.enabled ? 'afa-fx' : ''}`}>
      
      <style>{`
        @keyframes fadeUpStagger {
          0% { opacity: 0; transform: translateY(30px) scale(0.95); text-shadow: 0 0 0 rgba(0, 242, 254, 0); }
          100% { opacity: 1; transform: translateY(0) scale(1); text-shadow: 0 0 25px rgba(0, 242, 254, 0.8); }
        }
        @keyframes slideInRight {
          0% { opacity: 0; transform: translateX(40px) scale(0.98); filter: blur(8px); }
          100% { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        @keyframes dashboardEnter {
          0% { opacity: 0; transform: scale(0.95) translateY(20px); filter: blur(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        .anim-slide-in { animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .dashboard-enter { animation: dashboardEnter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .glass-panel {
          background: rgba(22, 27, 34, 0.85);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow: 0 16px 32px 0 rgba(0, 0, 0, 0.6);
        }
        
        .glass-input {
          background: rgba(13, 17, 23, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.3s ease;
        }
        .glass-input:focus {
          border-color: #00f2fe;
          background: rgba(13, 17, 23, 1);
          box-shadow: 0 0 12px rgba(0, 242, 254, 0.2);
          outline: none;
        }
        /* Liquid effects mode: let the animated backdrop show through */
        .afa-fx .afa-login-card { background: rgba(22, 27, 34, 0.35); }
        .afa-fx .afa-content [class~="bg-[#161b22]"]:not(.absolute):not(.fixed) {
          background-color: rgba(22, 27, 34, 0.8);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 32px -14px rgba(0, 0, 0, 0.7);
        }
        /* Liquid glass blocks: the WebGL layer paints the refraction underneath, CSS adds edge light */
        .afa-glass-on .afa-fx .afa-content [class~="bg-[#161b22]"]:not(.absolute):not(.fixed) {
          background: linear-gradient(140deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.012) 42%, rgba(0, 242, 254, 0.035));
          border-color: rgba(160, 225, 255, 0.18) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 1px 0 0 rgba(255, 255, 255, 0.06), 0 0 0 1px rgba(0, 242, 254, 0.04), 0 22px 44px -20px rgba(0, 0, 0, 0.75);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Animated liquid background (only when visual effects are on; never over the splash) */}
      {!showSplash && <LiquidBackdrop />}
      {/* Liquid glass under every dashboard block (one WebGL pass for all of them) */}
      {user && !showSplash && <LiquidGlassLayer selector={GLASS_PANEL_SELECTOR} clipSelector=".afa-content" />}

      {/* Ambient Lights */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#00f2fe]/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* SPLASH SCREEN */}
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center p-6 transition-opacity duration-1000">
          <div className="relative flex items-center justify-center mb-10">
            <AppIcon className="w-28 h-28 drop-shadow-[0_0_35px_rgba(0,242,254,0.4)]" animateStroke={true} />
          </div>
          <div translate="no" className="notranslate flex text-4xl sm:text-5xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400">
             <span style={{ animation: 'fadeUpStagger 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards', opacity: 0 }}>A.</span>
             <span style={{ animation: 'fadeUpStagger 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards', opacity: 0 }}>F.</span>
             <span style={{ animation: 'fadeUpStagger 1s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards', opacity: 0 }}>A.</span>
          </div>
          <p style={{ animation: 'fadeUpStagger 1s ease-out 1.3s forwards', opacity: 0 }} className="text-xs text-cyan-400/70 font-mono tracking-widest mt-5 uppercase text-center leading-relaxed">
            Automated Financial Assistant
          </p>
        </div>
      )}

      {/* AUTHENTICATION & REGISTRATION */}
      {!authLoading && !user && !showSplash && (
        <div className="fixed inset-0 z-40 bg-transparent flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md relative anim-slide-in flex flex-col items-center">
            <div className="mb-8 z-10">
              {/* The "A" draws itself as before, then turns into liquid metal */}
              <LiquidLogo size={96} delay={1700}>
                <AppIcon className="w-24 h-24 drop-shadow-[0_0_30px_rgba(0,242,254,0.4)]" animateStroke={true} />
              </LiquidLogo>
            </div>
            
            <div className="glass-panel afa-login-card rounded-3xl p-6 sm:p-8 w-full relative overflow-hidden isolate">
              <LiquidGlass radius={24} options={{ shade: 0.45 }} />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00f2fe] to-transparent opacity-60"></div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs mb-4 text-center">
                  {authError}
                </div>
              )}

              {authMode === 'login' && (
                <div className="space-y-5 anim-slide-in">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-white tracking-wider">Welcome Back</h2>
                    <p className="text-[11px] text-cyan-300/90 mt-2 font-mono tracking-wide leading-relaxed px-3 italic">
                      {loginQuote || "“An investment in knowledge pays the best interest.” — Benjamin Franklin"}
                    </p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Email</label>
                      <input type="email" required value={userProfile.email || ''} onChange={e => setUserProfile({...userProfile, email: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" placeholder="Enter your email" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Password</label>
                      <input type="password" required value={userProfile.password || ''} onChange={e => setUserProfile({...userProfile, password: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" placeholder="••••••••" />
                    </div>
                    <button type="submit" disabled={authActionLoading} className="w-full py-4 mt-2 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] hover:from-cyan-400 hover:to-blue-500 text-[#0a0a0a] rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(0,242,254,0.3)] disabled:opacity-50">
                      {authActionLoading ? 'Syncing...' : 'Initiate Sequence'}
                    </button>
                  </form>
                  <p className="text-center text-xs text-slate-400 mt-5">
                    Unregistered? <button onClick={() => { setAuthMode('register'); setOnboardingStep(1); setAuthError(''); }} className="text-[#00f2fe] font-bold">Create Profile</button>
                  </p>
                </div>
              )}

              {authMode === 'register' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-bold text-white tracking-widest uppercase">Profile Creation</h2>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full">Step {onboardingStep}/5</span>
                  </div>

                  {onboardingStep === 1 && (
                    <div className="space-y-5 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Full Name</label>
                        <input type="text" placeholder="e.g. Chloe Chan" value={userProfile.name || ''} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <button disabled={!userProfile.name} onClick={() => setOnboardingStep(2)} className="w-full py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#0a0a0a] rounded-xl text-xs font-black uppercase tracking-widest">Next Phase</button>
                    </div>
                  )}

                  {onboardingStep === 2 && (
                    <div className="space-y-4 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Email Address</label>
                        <input type="email" placeholder="chloe@hktech.io" value={userProfile.email || ''} onChange={e => setUserProfile({...userProfile, email: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white mb-4" />
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Password Key</label>
                        <input type="password" placeholder="Min 6 characters" value={userProfile.password || ''} onChange={e => setUserProfile({...userProfile, password: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setOnboardingStep(1)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.email || (userProfile.password || '').length < 6} onClick={() => setOnboardingStep(3)} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#0a0a0a] rounded-xl text-xs font-black uppercase">Next Phase</button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 3 && (
                    <div className="space-y-4 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Wealth Target</label>
                        <select value={userProfile.goal || ''} onChange={e => setUserProfile({...userProfile, goal: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white [&>option]:bg-slate-900">
                          <option value="">-- Select Objective --</option>
                          <option value="HK Property Down Payment">HK Property Down Payment</option>
                          <option value="Early Retirement (FIRE)">Early Retirement (FIRE)</option>
                          <option value="High-Yield Dividend Cash Flow">High-Yield Dividend Cash Flow</option>
                          <option value="General Wealth Accumulation">General Wealth Accumulation</option>
                        </select>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setOnboardingStep(2)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.goal} onClick={() => setOnboardingStep(4)} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#0a0a0a] rounded-xl text-xs font-black uppercase">Next Phase</button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 4 && (
                    <div className="space-y-4 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Capital Target (HKD)</label>
                        <input type="number" placeholder="e.g. 500000" value={userProfile.targetAmount || ''} onChange={e => setUserProfile({...userProfile, targetAmount: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setOnboardingStep(3)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.targetAmount} onClick={() => setOnboardingStep(5)} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#0a0a0a] rounded-xl text-xs font-black uppercase">Next Phase</button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 5 && (
                    <div className="space-y-4 anim-slide-in">
                      <p className="text-xs text-slate-300">Calibrate market volatility tolerance.</p>
                      <div className="space-y-2.5">
                        {['Conservative (Bonds & DIS)', 'Moderate (Balanced Tech & Value)', 'Aggressive (High-Beta Equities)'].map(risk => (
                          <button key={risk} onClick={() => setUserProfile({...userProfile, riskTolerance: risk})} className={`w-full p-3.5 rounded-xl border text-left text-xs font-medium ${userProfile.riskTolerance === risk ? 'bg-cyan-500/20 border-[#00f2fe] text-cyan-300' : 'bg-black/20 border-white/10 text-slate-300'}`}>
                            {risk}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button onClick={() => setOnboardingStep(4)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.riskTolerance || authActionLoading} onClick={handleRegister} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-[#0a0a0a] rounded-xl text-xs font-black uppercase">
                          {authActionLoading ? 'Initializing...' : 'Launch A.F.A.'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR NAVIGATION (Desktop) */}
      {user && !showSplash && (
        <aside className={`w-60 ${fx.enabled ? 'bg-[#161b22]/30' : 'bg-[#161b22]'} border-r border-slate-800/80 flex-col z-40 hidden md:flex shrink-0 shadow-xl relative isolate`}>
          <LiquidGlass radius={0} options={{ tintOpacity: 0.08, highlight: 0.08, shade: 0.3 }} />
          <div className="p-4 px-5 border-b border-slate-800/50">
             <div className="flex items-center gap-3">
                <LiquidLogo size={32}>
                  <AppIcon className="w-8 h-8 shrink-0" />
                </LiquidLogo>
                <div className="flex flex-col min-w-0">
                   <h1 translate="no" className="notranslate text-lg font-black tracking-wider text-white leading-none">A.F.A.</h1>
                   <p className="text-[8.5px] text-cyan-400/80 font-mono tracking-normal uppercase mt-1.5 whitespace-nowrap leading-none">Automated Financial Assistant</p>
                </div>
             </div>
          </div>

          <div onClick={() => setShowProfileModal(true)} className="p-3 flex items-center gap-2.5 mx-3 mt-4 bg-[#0d1117] rounded-xl border border-slate-800/80 cursor-pointer hover:border-[#00f2fe]/40 transition-all group">
             {userProfile.profilePic ? (
               <img src={userProfile.profilePic} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
             ) : (
               <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00f2fe] to-blue-600 flex items-center justify-center text-[#0d1117] font-bold text-xs">
                  {(userProfile.name || user.email).charAt(0).toUpperCase()}
               </div>
             )}
             <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold text-white truncate group-hover:text-[#00f2fe] transition-colors">{userProfile.name || 'User'}</p>
                <p className="text-[9px] text-slate-500 truncate">{user.email}</p>
             </div>
          </div>

          <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar text-xs font-medium">
            
            <div className="space-y-1">
              <p className="px-3 text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">Main Menu</p>
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'report', label: 'Analytics', icon: ShieldAlert },
                { id: 'ledger', label: 'Transactions', icon: Wallet },
                { id: 'portfolio', label: 'Investments', icon: TrendingUp },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#00f2fe]/10 text-[#00f2fe] font-bold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00f2fe]' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1">
              <p className="px-3 text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">Planning & Tools</p>
              {[
                { id: 'simulator', label: 'Strategic Modeler', icon: Sliders },
                { id: 'debt', label: 'Debt Health', icon: CreditCard },
                { id: 'mpf', label: 'MPF & Tax', icon: PiggyBank },
                { id: 'advisor', label: 'A.F.A. AI Chat', icon: Bot },
                { id: 'diagnostic', label: 'AI Diagnostic', icon: FileText },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#00f2fe]/10 text-[#00f2fe] font-bold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00f2fe]' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

          </div>
        </aside>
      )}

      {/* MAIN CONTENT WRAPPER */}
      {user && !showSplash && (
        <div className={`afa-content flex-1 flex flex-col relative h-full overflow-y-auto overflow-x-hidden dashboard-enter ${fx.enabled ? 'bg-transparent' : 'bg-[#0d1117]'}`}>
          
          {/* HEADER (Main Content Area) */}
          <header className={`sticky top-0 z-30 ${fx.enabled ? 'bg-[#0d1117]/80' : 'bg-[#161b22]/90'} backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between px-6 py-3.5 shadow-sm`}>
             <div className="flex items-center gap-4">
                <h2 className="text-base font-bold text-white tracking-wide">
                  {activeTab === 'dashboard' ? 'Dashboard' : 
                   activeTab === 'ledger' ? 'Transactions' : 
                   activeTab === 'report' ? 'Analytics' : 
                   activeTab === 'portfolio' ? 'Investments' : 
                   activeTab === 'simulator' ? 'Strategic Wealth Modeler' : 
                   activeTab === 'debt' ? 'Debt Health' : 
                   activeTab === 'mpf' ? 'MPF & Tax' : 
                   activeTab === 'advisor' ? 'A.F.A AI Chat' : 'Diagnostic'}
                </h2>
             </div>
             
             <div className="flex items-center gap-4">
                {/* LIVE SEARCH BAR WITH POP-OVER RESULT PANEL */}
                <div className="hidden sm:flex relative">
                   <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                   <input 
                     type="text" 
                     value={globalSearch || ''}
                     onChange={(e) => {
                       setGlobalSearch(e.target.value);
                       setShowSearchDropdown(true);
                     }}
                     onFocus={() => setShowSearchDropdown(true)}
                     placeholder="Search any stock (AAPL, 0700, Tencent), pages, records..." 
                     className="bg-[#0d1117] border border-slate-800 rounded-full pl-9 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-[#00f2fe] w-72 font-mono transition-all" 
                   />
                   {globalSearch && (
                     <button 
                       onClick={() => { setGlobalSearch(''); setShowSearchDropdown(false); }}
                       className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                     >
                       <X className="w-3.5 h-3.5" />
                     </button>
                   )}

                   {/* Live Search Results Dropdown */}
                   {showSearchDropdown && globalSearch.trim() !== '' && (
                     <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-[#161b22] border border-slate-700 shadow-2xl rounded-2xl z-50 p-3 max-h-96 overflow-y-auto no-scrollbar">
                        <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-slate-800">
                           <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Search Results</span>
                           <button onClick={() => setShowSearchDropdown(false)} className="text-[10px] text-slate-500 hover:text-white">Close</button>
                        </div>

                        {/* Matching Modules/Pages */}
                        {searchNavMatches.length > 0 && (
                          <div className="mb-3">
                             <div className="text-[9px] font-mono text-[#00f2fe] uppercase px-2 mb-1">Modules & Pages</div>
                             {searchNavMatches.map(t => {
                               const Icon = t.icon;
                               return (
                                 <div 
                                   key={t.id}
                                   onClick={() => {
                                     setActiveTab(t.id);
                                     setShowSearchDropdown(false);
                                     setGlobalSearch('');
                                   }}
                                   className="flex items-center justify-between p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer group transition-colors"
                                 >
                                   <div className="flex items-center gap-2">
                                     <Icon className="w-3.5 h-3.5 text-[#00f2fe]" />
                                     <span className="text-xs font-bold text-white group-hover:text-[#00f2fe]">{t.label}</span>
                                   </div>
                                   <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                                 </div>
                               );
                             })}
                          </div>
                        )}

                        {/* Matching Portfolio Assets */}
                        {searchPortfolioMatches.length > 0 && (
                          <div className="mb-3">
                             <div className="text-[9px] font-mono text-emerald-400 uppercase px-2 mb-1">Portfolio Assets</div>
                             {searchPortfolioMatches.map(p => (
                               <div 
                                 key={p.id}
                                 onClick={() => {
                                   setActiveTab('portfolio');
                                   setShowSearchDropdown(false);
                                 }}
                                 className="flex items-center justify-between p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer group transition-colors"
                               >
                                 <div>
                                   <span className="text-xs font-bold text-white group-hover:text-emerald-400">{p.symbol}</span>
                                   <span className="text-[10px] text-slate-400 block">{p.name}</span>
                                 </div>
                                 <span className="text-xs font-mono font-bold text-emerald-400">HK${(p.shares * p.currentPrice * (p.currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                               </div>
                             ))}
                          </div>
                        )}

                        {/* Live market lookup: any HK / US stock, with its live price */}
                        {(isSearchingMarket || marketMatches.length > 0) && (
                          <div className="mb-3">
                             <div className="text-[9px] font-mono text-amber-400 uppercase px-2 mb-1 flex items-center gap-1.5">
                               <span>Live Market</span>
                               {isSearchingMarket && <Loader2 className="w-3 h-3 animate-spin" />}
                             </div>
                             {marketMatches.map(quote => {
                               const owned = portfolio.some(p => p.symbol === quote.symbol);
                               const up = quote.changePct >= 0;
                               return (
                                 <div 
                                   key={quote.symbol}
                                   onClick={() => {
                                     if (owned) { setActiveTab('portfolio'); setShowSearchDropdown(false); }
                                     else openAddStockFromQuote(quote);
                                   }}
                                   className="flex items-center justify-between gap-3 p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer group transition-colors"
                                 >
                                   <div className="min-w-0">
                                     <span className="text-xs font-bold text-white group-hover:text-amber-400">{quote.symbol}</span>
                                     <span className="text-[10px] text-slate-400 block truncate">{quote.name}</span>
                                     <span className="text-[9px] font-mono text-slate-600 block">{owned ? 'In your portfolio' : 'Click to add to portfolio'}</span>
                                   </div>
                                   <div className="text-right shrink-0">
                                     <span className="text-xs font-mono font-bold text-white block">{quote.currency === 'USD' ? '$' : 'HK$'}{quote.price.toFixed(2)}</span>
                                     <span className={`text-[10px] font-mono ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? '+' : ''}{quote.changePct.toFixed(2)}%</span>
                                   </div>
                                 </div>
                               );
                             })}
                          </div>
                        )}

                        {/* Matching Ledger Transactions */}
                        {searchTransactionMatches.length > 0 && (
                          <div>
                             <div className="text-[9px] font-mono text-cyan-300 uppercase px-2 mb-1">Transactions</div>
                             {searchTransactionMatches.map(tx => (
                               <div 
                                 key={tx.id}
                                 onClick={() => {
                                   setActiveTab('ledger');
                                   setShowSearchDropdown(false);
                                 }}
                                 className="flex items-center justify-between p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer group transition-colors"
                               >
                                 <div>
                                   <span className="text-xs font-bold text-white group-hover:text-[#00f2fe]">{tx.description}</span>
                                   <span className="text-[10px] text-slate-500 block font-mono">{tx.date} • {tx.category}</span>
                                 </div>
                                 <span className={`text-xs font-mono font-bold ${tx.type === 'income' ? 'text-[#00f2fe]' : 'text-slate-300'}`}>
                                   {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toLocaleString()}
                                 </span>
                               </div>
                             ))}
                          </div>
                        )}

                        {searchNavMatches.length === 0 && searchPortfolioMatches.length === 0 && searchTransactionMatches.length === 0 && marketMatches.length === 0 && !isSearchingMarket && (
                          <div className="p-4 text-center text-xs text-slate-500 font-mono">
                            No stock, record or page found for "{globalSearch}".
                          </div>
                        )}
                     </div>
                   )}
                </div>
                
                {fx.supported && (
                  <button
                    onClick={() => fx.setEnabled(!fx.enabled)}
                    title={fx.enabled ? 'Turn visual effects off' : 'Turn visual effects on'}
                    aria-pressed={fx.enabled}
                    className={`p-1 transition-colors cursor-pointer ${fx.enabled ? 'text-[#00f2fe]' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                )}

                <div className="relative">
                  <button onClick={() => setShowAlerts(!showAlerts)} className="relative text-slate-400 hover:text-white transition-colors cursor-pointer p-1">
                     <Bell className="w-4 h-4" />
                     {systemAlerts.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}
                  </button>

                  {showAlerts && (
                    <div className="absolute right-0 mt-3 w-80 bg-[#161b22] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-slate-800 bg-[#0d1117] flex justify-between items-center">
                        <span className="text-xs font-bold text-white">System Alerts</span>
                        <button onClick={() => setShowBudgetModal(true)} className="text-[10px] font-mono text-[#00f2fe] hover:underline flex items-center gap-1">
                          <Sliders className="w-3 h-3" /> Adjust Limit
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {systemAlerts.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">No active alerts.</div>
                        ) : (
                          systemAlerts.map((a, i) => (
                            <div key={i} className="p-3 border-b border-slate-800/50 hover:bg-slate-800/30">
                               <div className="text-[10px] font-bold mb-1 flex items-center justify-between">
                                 <div className="flex items-center gap-1">
                                   {a.type === 'danger' ? <AlertTriangle className="w-3 h-3 text-rose-500"/> : (a.type === 'warning' ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500"/>)}
                                   <span className={a.type === 'danger' ? 'text-rose-400' : (a.type === 'warning' ? 'text-amber-400' : 'text-emerald-400')}>{a.title}</span>
                                 </div>
                               </div>
                               <div className="text-[10px] text-slate-400 leading-relaxed">{a.message}</div>
                               <button onClick={() => { setShowAlerts(false); setShowBudgetModal(true); }} className="mt-2 text-[9px] font-mono text-[#00f2fe] hover:underline">
                                 Modify limit settings →
                               </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 cursor-pointer bg-[#0d1117] px-3 py-1.5 rounded-xl border border-slate-800 hover:border-[#00f2fe]/40 transition-colors">
                   {userProfile.profilePic ? (
                     <img src={userProfile.profilePic} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                   ) : (
                     <div className="w-6 h-6 rounded-full bg-[#00f2fe] text-[#0d1117] font-bold text-[10px] flex items-center justify-center">
                       {(userProfile.name || user.email).charAt(0).toUpperCase()}
                     </div>
                   )}
                   <span className="text-xs font-bold text-slate-200 hidden sm:inline">{userProfile.name || 'User'}</span>
                </div>
             </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 anim-slide-in">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-[#00f2fe]"/> Total Balance</span>
                    </div>
                    <div className="text-2xl font-black text-white mt-1 mb-2">
                       ${(portfolioTotalValue + (netSavings > 0 ? netSavings : 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-blue-400"/> Total Income</span>
                    </div>
                    <div className="text-2xl font-black text-white mt-1 mb-2">
                       ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5"><ArrowDownRight className="w-3.5 h-3.5 text-rose-400"/> Total Expenses</span>
                    </div>
                    <div className="text-2xl font-black text-white mt-1 mb-2">
                       ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* CASH FLOW OVERVIEW CHART */}
                  <div className="lg:col-span-2 bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cash Flow Overview</h3>
                        <div className="flex bg-[#0d1117] rounded-lg border border-slate-800 p-0.5 text-[10px]">
                           {['Daily', 'Weekly', 'Monthly'].map((view) => (
                              <button 
                                key={view} 
                                onClick={() => setCashFlowView(view)}
                                className={`px-3 py-1 rounded-md transition-all cursor-pointer font-mono ${cashFlowView === view ? 'bg-[#21262d] text-white shadow font-bold' : 'text-slate-400 hover:text-white'}`}
                              >
                                {view}
                              </button>
                           ))}
                        </div>
                     </div>
                     
                     <div className="flex-1 min-h-[220px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cashFlowData}>
                            <defs>
                              <linearGradient id="incomeColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                            <XAxis dataKey="name" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${v/1000}k`} />
                            <Tooltip 
                               contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                               itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="income" stroke="#00f2fe" strokeWidth={2.5} fillOpacity={1} fill="url(#incomeColor)" name="Income" />
                            <Area type="monotone" dataKey="expense" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#expenseColor)" name="Expenses" />
                          </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </div>

                  {/* Financial Health Index replacement */}
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md flex flex-col justify-center items-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 self-start w-full">Financial Health Index</h3>
                    <p className="text-[10px] text-slate-400 mb-6 text-left w-full">50/30/20 & Rent Burden Evaluation</p>
                    
                    <div className="relative w-48 h-28 flex flex-col items-center justify-end">
                      <svg viewBox="-10 -15 220 115" className="w-full h-full drop-shadow-lg overflow-visible">
                        {/* Red Zone 0-30 */}
                        <path d="M 20 90 A 70 70 0 0 1 54 27" fill="none" stroke="#f43f5e" strokeWidth="25" strokeLinecap="butt" />
                        {/* Yellow Zone 30-70 */}
                        <path d="M 54 27 A 70 70 0 0 1 146 27" fill="none" stroke="#facc15" strokeWidth="25" strokeLinecap="butt" />
                        {/* Green Zone 70-100 */}
                        <path d="M 146 27 A 70 70 0 0 1 180 90" fill="none" stroke="#10b981" strokeWidth="25" strokeLinecap="butt" />
                        
                        {/* Gauge Needle Calculation */}
                        <g style={{ transform: `rotate(${(healthScore * 1.8) - 90}deg)`, transformOrigin: '100px 90px', transition: 'transform 1s ease-out' }}>
                          <polygon points="96,90 104,90 100,20" fill="#334155" />
                          <circle cx="100" cy="90" r="8" fill="#1e293b" />
                        </g>
                      </svg>
                      <div className="absolute bottom-2 text-xl font-black text-white">{healthScore.toFixed(0)} / 100</div>
                    </div>
                    <div className="mt-4 w-full space-y-2">
                       <div className="flex justify-between text-[10px] font-mono">
                         <span className="text-slate-400">Savings Rate:</span>
                         <span className={savingsRatio >= 20 ? 'text-emerald-400' : 'text-rose-400'}>{savingsRatio.toFixed(1)}%</span>
                       </div>
                       <div className="flex justify-between text-[10px] font-mono">
                         <span className="text-slate-400">Rent Burden:</span>
                         <span className={rentBurdenRatio <= 35 ? 'text-emerald-400' : 'text-rose-400'}>{rentBurdenRatio.toFixed(1)}%</span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* NEW DASHBOARD CHARTS */}
                <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md mb-6">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Account Balance Over Time</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={balanceOverTime}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                        <XAxis dataKey="date" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                        <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                        <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Payment Methods</h3>
                    <div className="h-48 w-full">
                      {paymentMethodsData.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">No payment data</div> : 
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={paymentMethodsData}>
                          {CHART_GRADIENT_DEFS}
                          <XAxis dataKey="name" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={72}>
                            {paymentMethodsData.map((entry, index) => <Cell key={`pay-${index}`} fill={`url(#afaBar${index % CHART_PALETTE.length})`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </div>
                  </div>

                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Receiving Methods</h3>
                    <div className="h-48 w-full">
                      {receivingMethodsData.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">No receiving data</div> : 
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={receivingMethodsData}>
                          {CHART_GRADIENT_DEFS}
                          <XAxis dataKey="name" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={72}>
                            {receivingMethodsData.map((entry, index) => <Cell key={`recv-${index}`} fill={`url(#afaBar${(index + 3) % CHART_PALETTE.length})`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Expenses per Category</h3>
                    <div className="h-64 w-full">
                      {categoryBreakdown.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">No expense data</div> : 
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} cornerRadius={6} label={renderPieLabel} labelLine={false}>
                            {categoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={colorFor(entry.name, index)} stroke="none" style={{ filter: `drop-shadow(0 0 6px ${colorFor(entry.name, index)}66)` }} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>}
                    </div>
                  </div>

                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Income per Category</h3>
                    <div className="h-64 w-full">
                      {incomeCategoryData.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">No income data</div> : 
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={incomeCategoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} cornerRadius={6} label={renderPieLabel} labelLine={false}>
                            {incomeCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={colorFor(entry.name, index)} stroke="none" style={{ filter: `drop-shadow(0 0 6px ${colorFor(entry.name, index)}66)` }} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>}
                    </div>
                  </div>
                </div>

                {/* TRANSACTION HISTORY SECTION */}
                <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
                  <div className="p-4 px-5 border-b border-slate-800 flex justify-between items-center bg-[#161b22]">
                     <h3 className="text-xs font-bold text-white uppercase tracking-wider">Transaction History</h3>
                     <div className="flex items-center gap-2">
                        <button onClick={() => setShowAddTxModal(true)} className="px-3 py-1.5 bg-[#00f2fe] text-[#0d1117] rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-cyan-400 transition-colors cursor-pointer">
                           <Plus className="w-3 h-3"/> Add
                        </button>
                     </div>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-[#0d1117] text-slate-500 uppercase font-mono text-[9px] border-b border-slate-800">
                           <tr>
                              <th className="py-3 px-5 font-medium">Description</th>
                              <th className="py-3 px-5 font-medium">Account</th>
                              <th className="py-3 px-5 font-medium">Category</th>
                              <th className="py-3 px-5 font-medium">Date</th>
                              <th className="py-3 px-5 font-medium text-right">Amount</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                           {filteredTransactions.length === 0 && (
                             <tr><td colSpan="5" className="py-8 text-center text-slate-600">No matching transactions.</td></tr>
                           )}
                           {filteredTransactions.slice(0, 5).map((tx, idx) => (
                              <tr key={tx.id || idx} className="hover:bg-slate-800/20 transition-colors group">
                                 <td className="py-3 px-5 font-medium text-white flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[10px]" style={{color: CATEGORY_COLORS[tx.category] || '#fff'}}>
                                       {tx.category.charAt(0)}
                                    </div>
                                    {tx.description}
                                 </td>
                                 <td className="py-3 px-5 font-mono text-slate-400">{tx.account || 'Bank Account'}</td>
                                 <td className="py-3 px-5">
                                    <span className="flex items-center gap-1.5 font-mono text-[11px]">
                                       <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: CATEGORY_COLORS[tx.category] || '#94a3b8'}}></span>
                                       {tx.category}
                                    </span>
                                 </td>
                                 <td className="py-3 px-5 text-slate-500 font-mono text-[11px]">{tx.date}</td>
                                 <td className={`py-3 px-5 text-right font-mono font-bold ${tx.type === 'income' ? 'text-[#00f2fe]' : 'text-white'}`}>
                                    {tx.type === 'income' ? '+' : '-'}${Number(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  {filteredTransactions.length > 5 && (
                     <div className="p-3 border-t border-slate-800 bg-[#0d1117] text-center">
                        <button onClick={() => setActiveTab('ledger')} className="text-[10px] text-slate-400 hover:text-white uppercase font-mono tracking-widest cursor-pointer">View All Data →</button>
                     </div>
                  )}
                </div>

              </div>
            )}

            {/* INTEGRATED LEDGER & AUDIT TAB */}
            {activeTab === 'ledger' && (
              <div className="space-y-6 anim-slide-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#00f2fe]" /> Integrated Ledger & Audit
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Real-time transaction tracking and spending analytics.</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowAddTxModal(true)}
                      className="bg-[#00f2fe] text-[#0d1117] px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md hover:bg-cyan-400 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Record
                    </button>
                  </div>
                </div>

                {/* Repeating transactions */}
                <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
                  <div className="px-5 py-3 bg-[#0d1117] border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-mono uppercase text-[#00f2fe] flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Repeating Transactions</span>
                    <span className="text-[10px] text-slate-500 font-mono">{recurringRules.filter(r => r.active).length} active</span>
                  </div>
                  {recurringRules.length === 0 ? (
                    <p className="px-5 py-5 text-xs text-slate-500">Nothing repeats yet. When you add a record, tap <span className="text-slate-300 font-semibold">Repeat</span> to log it automatically every week, month or year (e.g. your salary or a weekly Octopus top-up).</p>
                  ) : (
                    <ul className="divide-y divide-slate-800/60">
                      {recurringRules.map(rule => {
                        const t = rule.template || {};
                        const Icon = categoryIcon(t.category);
                        const color = CATEGORY_COLORS[t.category] || '#94a3b8';
                        return (
                          <li key={rule.id} className={`flex items-center gap-3 px-5 py-3 ${rule.active ? '' : 'opacity-50'}`}>
                            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, color }}><Icon className="w-4 h-4" /></span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-white truncate">{t.description}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {repeatLabel(rule.frequency)} · {t.account || 'Bank Account'} · {rule.active ? `next ${rule.nextDate}` : (rule.endDate && rule.nextDate > rule.endDate ? 'ended' : 'paused')}{rule.endDate ? ` · until ${rule.endDate}` : ''}
                              </div>
                            </div>
                            <span className={`font-mono font-bold text-sm whitespace-nowrap ${t.type === 'income' ? 'text-[#00f2fe]' : 'text-slate-200'}`}>{t.type === 'income' ? '+' : '-'} ${Number(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <button onClick={() => handleToggleRecurring(rule)} className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white cursor-pointer">{rule.active ? 'Pause' : 'Resume'}</button>
                            <button onClick={() => handleDeleteRecurring(rule)} aria-label="Stop repeating" title="Stop repeating (past records stay)" className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
                  <div className="px-5 py-3 bg-[#0d1117] border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-mono uppercase text-[#00f2fe]">Transaction History Log</span>
                    <span className="text-[10px] text-slate-500 font-mono">{filteredTransactions.length} Records</span>
                  </div>

                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300 min-w-[640px]">
                    <thead className="bg-[#161b22] border-b border-slate-800 text-slate-500 uppercase text-[10px] font-mono">
                      <tr>
                        <th className="py-3 px-5">Date</th>
                        <th className="py-3 px-5">Description</th>
                        <th className="py-3 px-5">Account</th>
                        <th className="py-3 px-5">Category</th>
                        <th className="py-3 px-5 text-right">Amount</th>
                        <th className="py-3 px-5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-xs text-slate-600">No transactions recorded yet. Click "Add Record" to start logging cash flows.</td>
                        </tr>
                      )}
                      {filteredTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-5 text-xs font-mono text-slate-500">{tx.date}</td>
                          <td className="py-3 px-5 font-semibold text-white">
                            <span className="inline-flex items-center gap-1.5">{tx.description}{tx.recurringId && <RefreshCw className="w-3 h-3 text-[#00f2fe]/70" aria-label="Repeating" />}</span>
                          </td>
                          <td className="py-3 px-5 text-xs text-slate-400">{tx.account || 'Bank Account'}</td>
                          <td className="py-3 px-5">
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border border-slate-700/60"
                              style={{ color: CATEGORY_COLORS[tx.category] || '#94a3b8', backgroundColor: `${CATEGORY_COLORS[tx.category]}15` }}
                            >
                              {tx.category}
                            </span>
                          </td>
                          <td className={`py-3 px-5 text-right font-mono font-bold ${tx.type === 'income' ? 'text-[#00f2fe]' : 'text-slate-200'}`}>
                            {tx.type === 'income' ? '+' : '-'} ${Number(tx.amount).toLocaleString(undefined, {minimumFractionDigits:2})}
                          </td>
                          <td className="py-3 px-5 text-center">
                            <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

              </div>
            )}

            {/* REPORT / ANALYTICS TAB */}
            {activeTab === 'report' && (
              <div className="space-y-6 anim-slide-in">
                {/* PERSONAL ACTION PLAN (src/lib/insights.js) */}
                <div className="bg-[#161b22] p-6 rounded-3xl border border-slate-800/80 shadow-md space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2"><Lightbulb className="w-4 h-4 text-[#00f2fe]" /> Your Personal Action Plan</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Built from your profile, your last 90 days of transactions, your assets and your debts. Updates as you record.</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {[
                          insights.snapshot.age ? `Age ${insights.snapshot.age}` : 'Age not set',
                          `${insights.snapshot.risk.label} risk${insights.snapshot.risk.unset ? ' (assumed)' : ''}`,
                          userProfile.goal || 'No goal set',
                          insights.snapshot.income > 0 ? `HK$${Math.round(insights.snapshot.income).toLocaleString()}/month income` : 'Income not set',
                          `${insights.snapshot.dependants} dependant${insights.snapshot.dependants === 1 ? '' : 's'}`
                        ].map(t => <span key={t} className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#0d1117] border border-slate-800 text-slate-300">{t}</span>)}
                        <button onClick={() => setShowProfileModal(true)} className="text-[10px] font-mono px-2.5 py-1 rounded-full text-[#00f2fe] hover:underline cursor-pointer">Edit profile →</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="relative w-20 h-20">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#21262d" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke={insights.overall >= 70 ? '#16c784' : insights.overall >= 45 ? '#ffd166' : '#ea3943'} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${insights.overall} 100`} pathLength="100" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-black text-white">{insights.overall}</span><span className="text-[8px] font-mono text-slate-500 uppercase">score</span></div>
                      </div>
                      <div className="space-y-1.5 w-44">
                        {insights.pillars.map(pl => (
                          <div key={pl.id} title={pl.note}>
                            <div className="flex justify-between text-[10px] font-mono"><span className="text-slate-400">{pl.label}</span><span className="text-slate-300">{pl.score}</span></div>
                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pl.score}%`, backgroundColor: pl.score >= 70 ? '#16c784' : pl.score >= 45 ? '#ffd166' : '#ea3943' }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      ['Monthly spending', `HK$${Math.round(insights.snapshot.expense).toLocaleString()}`, insights.snapshot.income > 0 ? `${Math.round((insights.snapshot.expense / insights.snapshot.income) * 100)}% of income` : ''],
                      ['Savings rate', `${Math.round(insights.snapshot.savingsRate)}%`, 'benchmark 20%'],
                      ['Needs / wants', insights.snapshot.income > 0 ? `${Math.round((insights.snapshot.needs / insights.snapshot.income) * 100)}% / ${Math.round((insights.snapshot.wants / insights.snapshot.income) * 100)}%` : '—', 'benchmark 50% / 30%'],
                      ['Emergency fund', `${insights.snapshot.emergencyMonths.toFixed(1)} mo`, `target ${insights.snapshot.emergencyTargetMonths} months`],
                      ['Net worth', `${netWorth < 0 ? '−' : ''}HK$${Math.abs(Math.round(netWorth)).toLocaleString()}`, insights.snapshot.debtTotal > 0 ? `after HK$${Math.round(insights.snapshot.debtTotal).toLocaleString()} debt` : 'no debt']
                    ].map(([k, v, sub]) => (
                      <div key={k} className="p-3 rounded-2xl bg-[#0d1117] border border-slate-800">
                        <div className="text-[10px] font-mono uppercase text-slate-500">{k}</div>
                        <div className="text-lg font-bold text-white mt-0.5">{v}</div>
                        <div className="text-[10px] text-slate-500">{sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono uppercase text-[#00f2fe] flex items-center gap-2"><ListChecks className="w-3.5 h-3.5" /> What to do next · {insights.recommendations.length} recommendation{insights.recommendations.length === 1 ? '' : 's'}</h3>
                      {insights.recommendations.length > 4 && (
                        <button onClick={() => setShowAllRecs(v => !v)} className="text-[10px] font-mono text-[#00f2fe] hover:underline cursor-pointer">{showAllRecs ? 'Show top 4' : `Show all ${insights.recommendations.length}`}</button>
                      )}
                    </div>
                    {insights.recommendations.length === 0 && (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Everything looks healthy. Keep your saving and investing on autopilot.</div>
                    )}
                    {(showAllRecs ? insights.recommendations : insights.recommendations.slice(0, 4)).map((rec, idx) => {
                      const tone = rec.priority === 'high' ? { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30', bar: '#ea3943' } : rec.priority === 'medium' ? { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', bar: '#ffd166' } : { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30', bar: '#38bdf8' };
                      const go = () => {
                        if (rec.cta?.action === 'record') setShowAddTxModal(true);
                        else if (rec.cta?.action === 'budget') setShowBudgetModal(true);
                        else if (rec.cta?.action === 'profile') setShowProfileModal(true);
                        else if (rec.cta?.tab) { if (rec.cta.view) setPortfolioView(rec.cta.view); setActiveTab(rec.cta.tab); }
                      };
                      return (
                        <div key={rec.id} className="relative p-4 pl-5 rounded-2xl bg-[#0d1117] border border-slate-800 overflow-hidden">
                          <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tone.bar }} />
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono text-slate-500">#{idx + 1}</span>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${tone.badge}`}>{rec.priority}</span>
                                <span className="text-[10px] font-mono uppercase text-slate-500">{rec.area}</span>
                              </div>
                              <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rec.finding}</p>
                              <ol className="mt-2 space-y-1">
                                {rec.actions.map((a, i) => (
                                  <li key={i} className="text-xs text-slate-200 flex gap-2"><span className="text-[#00f2fe] font-mono shrink-0">{i + 1}.</span><span>{a}</span></li>
                                ))}
                              </ol>
                              {rec.impact && <p className="text-[11px] text-emerald-400 mt-2 font-medium">{rec.impact}</p>}
                            </div>
                            {rec.cta && (
                              <button onClick={go} className="shrink-0 self-start text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl border border-[#00f2fe]/30 bg-[#00f2fe]/10 text-[#00f2fe] hover:bg-[#00f2fe]/20 cursor-pointer flex items-center gap-1">
                                {rec.cta.label} <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">Rules of thumb used: 50/30/20 budgeting, a 3–6 month emergency fund, housing ≤ 30% of income, paying debts above ~10% APR before investing, and a growth-asset share matched to your risk profile and age. Educational guidance, not regulated financial advice.</p>
                </div>

                <div className="bg-[#161b22] p-6 rounded-3xl border border-slate-800/80 shadow-md space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-[#00f2fe]" /> Analytics & Target Audit
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">Deep dive into anomalies, budget limits, and threshold alerts.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowBudgetModal(true)}
                        className="bg-[#00f2fe]/10 hover:bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/30 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Sliders className="w-4 h-4" /> Adjust Budget & Limits
                      </button>

                      <button
                        onClick={handlePrintPdfReport}
                        className="bg-[#21262d] hover:bg-[#30363d] text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Download className="w-4 h-4" /> Download Report (PDF)
                      </button>
                    </div>
                  </div>

                  {systemAlerts.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-mono uppercase text-[#00f2fe]">System Detected Warnings & Alerts</h3>
                        <button onClick={() => setShowBudgetModal(true)} className="text-[10px] font-mono text-[#00f2fe] hover:underline flex items-center gap-1">
                          <Edit2 className="w-3 h-3" /> Change weekly limit (Current: HK$ {Number(userProfile.weeklyMaxSpend || 3500).toLocaleString()})
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {systemAlerts.map((alert, idx) => (
                          <div key={idx} className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                              <div>
                                <h4 className="font-bold text-sm">{alert.title}</h4>
                                <p className="text-xs mt-0.5 opacity-90">{alert.message}</p>
                              </div>
                            </div>
                            <button onClick={() => setShowBudgetModal(true)} className="px-3 py-1.5 bg-black/40 hover:bg-black/60 rounded-xl text-[10px] font-mono text-white shrink-0 border border-white/10">
                              Edit Limit
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> All spending is within normal target parameters!
                      </div>
                      <button onClick={() => setShowBudgetModal(true)} className="text-[10px] font-mono text-[#00f2fe] hover:underline">
                        Adjust limits →
                      </button>
                    </div>
                  )}

                  {/* Analytics Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {/* Weekend Spending */}
                    <div className="bg-[#0d1117] p-5 rounded-2xl border border-slate-800">
                       <h3 className="text-sm font-bold text-white mb-4">Weekend vs Weekday Ratio</h3>
                       <div className="flex items-center gap-6">
                          <div className="relative w-24 h-24 shrink-0">
                             <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                <path className="text-[#00f2fe]" strokeDasharray={`${anomalyAnalysis.weekendRatio}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                             </svg>
                             <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{anomalyAnalysis.weekendRatio}%</div>
                          </div>
                          <div>
                             <p className="text-xs text-slate-400 mb-1">Weekend Spending Total</p>
                             <p className="text-xl font-bold text-[#00f2fe]">${anomalyAnalysis.weekendTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                             <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">High weekend ratios often indicate impulsive leisure and entertainment spending.</p>
                          </div>
                       </div>
                    </div>

                    {/* Frequent Categories */}
                    <div className="bg-[#0d1117] p-5 rounded-2xl border border-slate-800">
                       <h3 className="text-sm font-bold text-white mb-4">High-Frequency Habits</h3>
                       {anomalyAnalysis.frequencyHabits.length > 0 ? (
                          <div className="space-y-3">
                             {anomalyAnalysis.frequencyHabits.map((habit, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
                                   <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: CATEGORY_COLORS[habit.category] || '#fff'}}></span>
                                      {habit.category}
                                   </span>
                                   <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">{habit.count} txns</span>
                                </div>
                             ))}
                          </div>
                       ) : (
                          <div className="text-xs text-slate-500 h-full flex items-center justify-center">No high-frequency spending habits detected.</div>
                       )}
                    </div>
                  </div>

                  {/* Anomalies List */}
                  <div className="bg-[#0d1117] p-5 rounded-2xl border border-slate-800 mt-6">
                     <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        Anomalous High-Value Outflows
                     </h3>
                     <div className="space-y-3">
                        {anomalyAnalysis.anomalies.length > 0 ? (
                           anomalyAnalysis.anomalies.map(tx => (
                              <div key={tx.id} className="flex justify-between items-center p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                                 <div>
                                    <p className="text-xs font-bold text-white">{tx.description}</p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{tx.date} • {tx.category}</p>
                                 </div>
                                 <div className="text-sm font-bold text-rose-400 font-mono">
                                    -${Number(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-xl">No spending outliers detected above the statistical baseline.</div>
                        )}
                     </div>
                  </div>

                </div>
              </div>
            )}

            {/* STOCK PORTFOLIO TAB */}
            {activeTab === 'portfolio' && (
              <div className="space-y-6 anim-slide-in">
                {/* Real portfolio or simulated trading */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex p-1 rounded-2xl bg-[#161b22] border border-slate-800/80 self-start">
                    {[['real', 'My Assets', Wallet], ['simulation', 'Simulated Trading', FlaskConical]].map(([id, label, Icon]) => (
                      <button key={id} onClick={() => setPortfolioView(id)} className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2 cursor-pointer transition-all ${portfolioView === id ? 'bg-[#00f2fe] text-[#0d1117]' : 'text-slate-400 hover:text-white'}`}>
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">{portfolioView === 'real' ? 'Your real holdings and other assets, with live prices.' : 'Virtual money only. Your real assets are not affected.'}</p>
                </div>

                {portfolioView === 'simulation' && (
                  <PaperTrading account={paperAccount} onChange={handleSavePaperAccount} fetchQuote={fetchLiveStockQuote} searchSymbols={searchMarketSymbols} usdHkd={DEFAULT_USD_HKD_RATE} />
                )}

                {portfolioView === 'real' && (<>
                {/* Net worth across everything the user owns and owes */}
                <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono uppercase text-slate-500">Total Net Worth</span>
                      <div className={`text-3xl font-black mt-1 ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>{netWorth < 0 ? '−' : ''}HK${Math.abs(Math.round(netWorth)).toLocaleString()}</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Cash in your ledger + stocks + other assets − debts</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {[['Cash', liquidCash, 'text-emerald-300'], ['Stocks', portfolioTotalValue, 'text-[#00f2fe]'], ['Other assets', otherAssetsTotal, 'text-violet-300'], ['Debts', -(debtAmount + creditCardOwed), 'text-rose-300']].map(([k, v, c]) => (
                        <div key={k} className="px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800">
                          <div className="text-[10px] font-mono uppercase text-slate-500">{k}</div>
                          <div className={`font-bold font-mono ${c}`}>{v < 0 ? '−' : ''}HK${Math.abs(Math.round(v)).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {insights.snapshot.allocation.length > 0 && (
                    <div className="mt-4">
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800">
                        {insights.snapshot.allocation.map((a, i) => {
                          const total = insights.snapshot.allocation.reduce((sum, x) => sum + x.value, 0);
                          return <div key={a.name} style={{ width: `${(a.value / total) * 100}%`, backgroundColor: ALLOCATION_COLORS[a.name] || CHART_PALETTE[i % CHART_PALETTE.length] }} title={`${a.name}: HK$${Math.round(a.value).toLocaleString()}`} />;
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {insights.snapshot.allocation.map((a, i) => {
                          const total = insights.snapshot.allocation.reduce((sum, x) => sum + x.value, 0);
                          return (
                            <span key={a.name} className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ALLOCATION_COLORS[a.name] || CHART_PALETTE[i % CHART_PALETTE.length] }} />
                              {a.name} {((a.value / total) * 100).toFixed(0)}%
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <span className="text-xs font-mono uppercase text-slate-500">Total Market Valuation</span>
                    <div className="text-2xl font-black text-white mt-1">${portfolioTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <span className="text-xs font-mono uppercase text-slate-500">Cost Basis</span>
                    <div className="text-2xl font-black text-slate-300 mt-1">${portfolioTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <span className="text-xs font-mono uppercase text-slate-500">Unrealized P&L</span>
                    <div className={`text-2xl font-black mt-1 ${portfolioUnrealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {portfolioUnrealizedGain >= 0 ? '+' : ''}${portfolioUnrealizedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({portfolioGainPercent}%)
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#00f2fe]"/> Stocks & ETFs</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {marketFeedDown ? 'Live price feed unreachable right now — showing your last saved prices.' : lastMarketSyncTime ? `Live prices • auto-refresh every 30s • updated ${lastMarketSyncTime} (FX USD/HKD = 7.82)` : 'Connecting to live price feed...'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSyncMarketPrices}
                      disabled={isSyncingMarket}
                      className="bg-[#21262d] hover:bg-[#30363d] text-white border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMarket ? 'animate-spin' : ''}`} />
                      <span>{isSyncingMarket ? 'Syncing...' : 'Sync Prices'}</span>
                    </button>

                    <button onClick={() => setShowAddStockModal(true)} className="bg-[#00f2fe] text-[#0d1117] hover:bg-cyan-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer">
                      <Plus className="w-4 h-4" /> Add Stock
                    </button>
                  </div>
                </div>

                <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden mb-6">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-[#0d1117] border-b border-slate-800 text-slate-500 uppercase text-[10px] font-mono">
                      <tr>
                        <th className="py-3.5 px-5">Symbol</th>
                        <th className="py-3.5 px-5 text-right">Shares</th>
                        <th className="py-3.5 px-5 text-right">Avg Cost</th>
                        <th className="py-3.5 px-5 text-right">Live Price</th>
                        <th className="py-3.5 px-5 text-right">Market Value</th>
                        <th className="py-3.5 px-5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredPortfolio.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-xs text-slate-600">No assets in portfolio matching search.</td>
                        </tr>
                      )}
                      {filteredPortfolio.map(item => {
                        const currency = item.currency || (item.symbol.endsWith('.HK') ? 'HKD' : 'USD');
                        const rate = currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1;
                        const valueInHkd = item.shares * item.currentPrice * rate;
                        const gainPercent = item.buyPrice > 0 ? (((item.currentPrice - item.buyPrice) / item.buyPrice) * 100).toFixed(2) : '0.00';
                        const isPositive = Number(gainPercent) >= 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-800/20">
                            <td className="py-3.5 px-5 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <span>{item.symbol}</span>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{currency}</span>
                              </div>
                              <span className="block text-xs font-normal text-slate-500 mt-0.5">{item.name}</span>
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono">{item.shares}</td>
                            <td className="py-3.5 px-5 text-right font-mono text-slate-400">
                              {currency === 'USD' ? '$' : 'HK$'}{item.buyPrice.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono text-white">
                              <div className="flex items-center justify-end gap-1">
                                <span>{currency === 'USD' ? '$' : 'HK$'}{item.currentPrice.toFixed(2)}</span>
                                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                              </div>
                              <span className={`text-[10px] block font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{gainPercent}% vs cost
                              </span>
                              {item.dayChangePct !== undefined && (
                                <span className={`text-[10px] block font-mono ${item.dayChangePct >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                                  {item.dayChangePct >= 0 ? '+' : ''}{Number(item.dayChangePct).toFixed(2)}% today
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-400">
                              ${valueInHkd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-5 text-center">
                              <button onClick={() => handleDeleteStock(item.id)} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <OtherAssets
                  assets={otherAssets}
                  cryptoPrices={cryptoPrices}
                  cryptoStatus={cryptoStatus}
                  usdHkd={DEFAULT_USD_HKD_RATE}
                  onAdd={handleAddAsset}
                  onUpdate={handleUpdateAsset}
                  onDelete={handleDeleteAsset}
                />

                {/* NEW: Portfolio Dashboard Enhancements */}
                <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md mb-6">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Portfolio Growth</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Value of your current holdings at each day's real closing price (last 30 trading days).</p>
                  <div className="h-64 w-full">
                    {portfolio.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">Add assets to see growth.</div> :
                    portfolioGrowth.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">{marketFeedDown ? 'Price history unavailable while the live feed is unreachable.' : 'Loading price history...'}</div> :
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={portfolioGrowth}>
                        {CHART_GRADIENT_DEFS}
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                        <XAxis dataKey="date" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                        <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} formatter={(val) => [`HK$ ${Number(val).toLocaleString()}`, 'Value']} />
                        {/* Solid green on days the value rose, solid red on days it fell */}
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                          {portfolioGrowth.map((entry, index) => (
                            <Cell key={`pg-${index}`} fill={index === 0 || entry.value >= portfolioGrowth[index - 1].value ? '#16c784' : '#ea3943'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Portfolio Diversity</h3>
                    <div className="h-56 w-full">
                      {diversityData.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">No portfolio data</div> :
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={diversityData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} cornerRadius={6} dataKey="value" label={renderPieLabel} labelLine={false}>
                            {diversityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={colorFor(entry.name, index)} stroke="none" style={{ filter: `drop-shadow(0 0 6px ${colorFor(entry.name, index)}66)` }} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} formatter={(val) => [`$${val.toLocaleString(undefined, {maximumFractionDigits:0})}`, 'Value']} />
                        </PieChart>
                      </ResponsiveContainer>}
                    </div>
                  </div>
                  
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Account Activity</h3>
                    <div className="space-y-4 max-h-56 overflow-y-auto pr-2">
                      {accountBalances.map(acc => (
                        <div key={acc.name} className="flex justify-between items-center border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                          <div>
                            <div className="text-lg font-bold text-white">${acc.value.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                            <div className="text-[10px] font-mono text-slate-500 uppercase">{acc.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                </>)}

                {/* LIVE MARKET NEWS */}
                <div className="bg-[#161b22] p-6 rounded-3xl border border-slate-800/80 shadow-md space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-[#00f2fe]" /> Live Market Intelligence (RSS)
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Live headlines from Yahoo Finance, SCMP, CNBC and RTHK • auto-refresh every 5 min • stories about your holdings are tagged.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                        Updated {lastNewsSyncTime}
                      </span>
                      <button 
                        onClick={handleRefreshNews}
                        disabled={isSyncingNews}
                        className="bg-[#21262d] hover:bg-[#30363d] text-white border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNews ? 'animate-spin' : ''}`} />
                        <span>{isSyncingNews ? 'Syncing...' : 'Refresh'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {filteredNews.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 bg-[#0d1117] rounded-2xl border border-slate-800/60">
                        {isSyncingNews ? "Fetching live market news..." : "Live news feed is unreachable right now. Press Refresh to try again."}
                      </div>
                    ) : (
                      filteredNews.map(item => (
                        <div 
                          key={item.id} 
                          className="p-4 bg-[#0d1117] border border-slate-800/80 hover:border-slate-700 rounded-2xl transition-all space-y-2.5 group"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                item.symbols.length > 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {item.symbols.length > 0 ? item.symbols.join(' · ') : item.impact}
                              </span>
                              <span className="text-[11px] font-mono text-[#00f2fe]">{item.source}</span>
                              <span className="text-[10px] text-slate-500">• {formatTimeAgo(item.publishedAt)}</span>
                            </div>
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover:text-[#00f2fe] transition-colors flex items-center justify-between gap-2">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
                              <span>{item.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600 inline shrink-0" />
                            </a>
                          </h3>

                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* STRATEGIC WEALTH MODELER TAB */}
            {activeTab === 'simulator' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800/80 shadow-md">
                  <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#00f2fe]" /> Strategic Wealth Modeler
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Test live financial life events and compound wealth towards your target.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-5 bg-[#0d1117] p-5 rounded-2xl border border-slate-800/80">
                      
                      <div className="pb-4 border-b border-slate-800">
                         <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">Interactive Life Scenarios</h3>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setSimInitial(p => Math.max(0, Math.floor(p * 0.8)))} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold text-left transition-colors">📉 Market Crash (-20%)</button>
                            <button onClick={() => setSimMonthly(p => Math.min(500000, p + 10000))} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-left transition-colors">📈 Job Promotion (+10k/mo)</button>
                            <button onClick={() => setSimInitial(p => p + 500000)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold text-left transition-colors">🎁 Crypto Windfall (+500k)</button>
                            <button onClick={() => setSimInitial(p => Math.max(0, p - 1000000))} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold text-left transition-colors">🏠 Buy Flat Down Payment</button>
                         </div>
                      </div>

                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Initial Capital</span>
                          <span className="text-white font-bold">${simInitial.toLocaleString()}</span>
                        </label>
                        <input type="range" min="0" max="5000000" step="10000" value={simInitial} onChange={e => setSimInitial(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Monthly Deposit</span>
                          <span className="text-white font-bold">${simMonthly.toLocaleString()}</span>
                        </label>
                        {/* Expanded max to 500,000 */}
                        <input type="range" min="1000" max="500000" step="1000" value={simMonthly} onChange={e => setSimMonthly(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Expected Return</span>
                          <span className="text-white font-bold">{simRate}% / year</span>
                        </label>
                        <input type="range" min="1" max="15" step="0.5" value={simRate} onChange={e => setSimRate(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Time Horizon</span>
                          <span className="text-white font-bold">{simYears} Years</span>
                        </label>
                        <input type="range" min="1" max="30" step="1" value={simYears} onChange={e => setSimYears(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="h-72 w-full bg-[#0d1117] border border-slate-800 rounded-2xl p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={simulationTrajectory}>
                            <defs>
                              <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                            <XAxis dataKey="year" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} />
                            <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff', fontSize: '11px' }} formatter={(val) => [`$${val.toLocaleString()}`, 'Value']} />
                            <Area type="monotone" dataKey="balance" stroke="#00f2fe" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBal)" name="Portfolio Value" />
                            <Area type="monotone" dataKey="invested" stroke="#8b949e" strokeDasharray="4 4" strokeWidth={1.5} fillOpacity={0} name="Total Principal" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-400">Projected Value at Year {simYears}:</span>
                        <span className="text-xl font-bold text-[#00f2fe]">
                          ${simulationTrajectory[simulationTrajectory.length - 1]?.balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DEBT HEALTH TAB */}
            {activeTab === 'debt' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800/80 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                    <div>
                      <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-rose-400" /> My Debts
                      </h2>
                      <p className="text-xs text-slate-400">Record every card, loan or instalment you owe. A.F.A. saves the list to your account and builds a payoff plan from it.</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono" data-testid="debt-save-status">
                        {debtSaveState.status === 'saving' && <span className="text-slate-400">Saving…</span>}
                        {debtSaveState.status === 'dirty' && <span className="text-amber-400">Unsaved changes</span>}
                        {debtSaveState.status === 'saved' && debtSaveState.at && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Saved {new Date(debtSaveState.at).toLocaleString('en-HK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                        {debtSaveState.status === 'error' && <span className="text-rose-400">{debtSaveState.message}</span>}
                      </span>
                      <button
                        onClick={handleSaveDebtPlan}
                        disabled={isSavingDebt}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
                      >
                        {isSavingDebt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>Save debts</span>
                      </button>
                    </div>
                  </div>

                  {/* Add a debt */}
                  <form onSubmit={handleAddDebt} className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-[#0d1117] p-4 rounded-2xl border border-slate-800/80 mb-5">
                    <div className="col-span-2 md:col-span-2">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Name</label>
                      <input type="text" placeholder="e.g. HSBC Red card" value={debtDraft.name} onChange={e => setDebtDraft(d => ({ ...d, name: e.target.value }))} className="w-full px-3 py-2 glass-input rounded-lg text-sm text-white" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Type</label>
                      <select value={debtDraft.type} onChange={e => setDebtDraft(d => ({ ...d, type: e.target.value }))} className="w-full px-3 py-2 glass-input rounded-lg text-sm text-white [&>option]:bg-[#161b22]">
                        {DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Balance (HKD)</label>
                      <input type="number" min="0" required placeholder="20000" value={debtDraft.balance} onChange={e => setDebtDraft(d => ({ ...d, balance: e.target.value }))} className="w-full px-3 py-2 glass-input rounded-lg text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">APR %</label>
                      <input type="number" min="0" step="0.1" placeholder="24" value={debtDraft.apr} onChange={e => setDebtDraft(d => ({ ...d, apr: e.target.value }))} className="w-full px-3 py-2 glass-input rounded-lg text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Min / month</label>
                      <input type="number" min="0" placeholder="800" value={debtDraft.minPay} onChange={e => setDebtDraft(d => ({ ...d, minPay: e.target.value }))} className="w-full px-3 py-2 glass-input rounded-lg text-sm text-white" />
                    </div>
                    <button type="submit" className="col-span-2 md:col-span-6 bg-[#00f2fe]/10 hover:bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/30 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all">
                      <Plus className="w-4 h-4" /> Add debt
                    </button>
                  </form>

                  {/* Debt list (editable in place) */}
                  {debts.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-700 rounded-2xl text-sm text-slate-400">
                      No debts recorded yet. Add your first one above, then press <span className="text-rose-300 font-semibold">Save debts</span>.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-[#0d1117] text-[10px] font-mono uppercase text-slate-500">
                          <tr>
                            <th className="text-left px-3 py-2">Debt</th>
                            <th className="text-left px-3 py-2">Type</th>
                            <th className="text-right px-3 py-2">Balance (HKD)</th>
                            <th className="text-right px-3 py-2">APR %</th>
                            <th className="text-right px-3 py-2">Min / month</th>
                            <th className="text-right px-3 py-2">Paid off</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {debts.map(d => {
                            const done = debtPayoffTrajectory.payoffOrder.find(p => p.id === d.id);
                            const coversInterest = (Number(d.minPay) || 0) > (Number(d.balance) || 0) * (Number(d.apr) || 0) / 1200;
                            return (
                              <tr key={d.id} className="border-t border-slate-800/80">
                                <td className="px-3 py-2"><input value={d.name} onChange={e => handleUpdateDebt(d.id, 'name', e.target.value)} className="w-full bg-transparent text-white outline-none focus:bg-[#0d1117] rounded px-1" /></td>
                                <td className="px-3 py-2">
                                  <select value={d.type} onChange={e => handleUpdateDebt(d.id, 'type', e.target.value)} className="bg-transparent text-slate-300 text-xs outline-none [&>option]:bg-[#161b22]">
                                    {DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-2"><input type="number" min="0" value={d.balance} onChange={e => handleUpdateDebt(d.id, 'balance', e.target.value)} className="w-28 ml-auto block text-right bg-transparent text-white outline-none focus:bg-[#0d1117] rounded px-1" /></td>
                                <td className="px-3 py-2"><input type="number" min="0" step="0.1" value={d.apr} onChange={e => handleUpdateDebt(d.id, 'apr', e.target.value)} className="w-16 ml-auto block text-right bg-transparent text-white outline-none focus:bg-[#0d1117] rounded px-1" /></td>
                                <td className="px-3 py-2">
                                  <input type="number" min="0" value={d.minPay} onChange={e => handleUpdateDebt(d.id, 'minPay', e.target.value)} className={`w-24 ml-auto block text-right bg-transparent outline-none focus:bg-[#0d1117] rounded px-1 ${coversInterest || !(d.balance > 0) ? 'text-white' : 'text-amber-400'}`} title={coversInterest ? '' : 'This minimum does not cover the monthly interest'} />
                                </td>
                                <td className="px-3 py-2 text-right text-xs font-mono text-emerald-400">{done ? `M${done.month}` : '—'}</td>
                                <td className="px-3 py-2 text-right">
                                  <button onClick={() => handleDeleteDebt(d.id)} aria-label={`Delete ${d.name}`} className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-[#0d1117] text-xs font-mono">
                          <tr className="border-t border-slate-800/80">
                            <td className="px-3 py-2 text-slate-400" colSpan={2}>Total · {debts.length} debt{debts.length === 1 ? '' : 's'}</td>
                            <td className="px-3 py-2 text-right text-white font-bold">${debtAmount.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-slate-300">{debtRate}% avg</td>
                            <td className="px-3 py-2 text-right text-slate-300">${(debtMinPay - (Number(debtExtra) || 0)).toLocaleString()}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Payoff plan */}
                <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800/80 shadow-md">
                  <h2 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Payoff Plan
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Every debt gets its minimum payment. Your extra money, plus any minimum freed up when a debt is cleared, goes to the debt your strategy picks.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-4 bg-[#0d1117] p-5 rounded-2xl border border-slate-800/80">
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Extra payment per month (HKD)</label>
                        <input type="number" min="0" value={debtExtra || ''} placeholder="0" onChange={e => { setDebtExtra(Number(e.target.value) || 0); setDebtSaveState(prev => ({ ...prev, status: 'dirty' })); }} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                        <p className="text-[10px] text-slate-500 mt-1">On top of the minimums. Total each month: ${debtMinPay.toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Payoff Strategy</label>
                        <select value={debtStrategy} onChange={e => setDebtStrategy(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white [&>option]:bg-[#161b22]">
                          <option value="avalanche">Avalanche (highest APR first, least interest)</option>
                          <option value="snowball">Snowball (smallest balance first, quick wins)</option>
                        </select>
                      </div>
                      {debts.length > 1 && !debtPayoffTrajectory.stuck && !debtAltPlan.stuck && (
                        <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-3">
                          {debtAltPlan.totalInterest > debtPayoffTrajectory.totalInterest
                            ? <>This strategy saves <span className="text-emerald-400 font-semibold">${(debtAltPlan.totalInterest - debtPayoffTrajectory.totalInterest).toLocaleString()}</span> in interest compared with {debtStrategy === 'avalanche' ? 'snowball' : 'avalanche'}.</>
                            : debtAltPlan.totalInterest < debtPayoffTrajectory.totalInterest
                              ? <>{debtStrategy === 'avalanche' ? 'Snowball' : 'Avalanche'} would cost <span className="text-amber-400 font-semibold">${(debtPayoffTrajectory.totalInterest - debtAltPlan.totalInterest).toLocaleString()}</span> less interest, but this order clears accounts sooner.</>
                              : <>Both strategies cost the same interest for these debts.</>}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      {debtPayoffTrajectory.stuck && debts.length > 0 && (
                        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>Your monthly payments don't cover the interest, so these debts would never be cleared. Raise the minimums or add an extra payment.</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Debt-free in</span>
                          <div className="text-2xl font-bold text-emerald-400 mt-1">{debts.length === 0 ? '—' : debtPayoffTrajectory.stuck ? 'Never' : `${debtPayoffTrajectory.totalMonths} mo`}</div>
                          {debtPayoffTrajectory.debtFreeLabel && <div className="text-[10px] text-slate-500 mt-0.5">{debtPayoffTrajectory.debtFreeLabel}</div>}
                        </div>
                        <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Total interest</span>
                          <div className="text-2xl font-bold text-rose-400 mt-1">{debts.length === 0 || debtPayoffTrajectory.stuck ? '—' : `$${debtPayoffTrajectory.totalInterest.toLocaleString()}`}</div>
                        </div>
                        <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Pay first</span>
                          <div className="text-base font-bold text-white mt-1.5 truncate">{debtPayoffTrajectory.payoffOrder[0]?.name || [...debts].filter(d => d.balance > 0).sort((a, b) => debtStrategy === 'snowball' ? a.balance - b.balance : b.apr - a.apr)[0]?.name || '—'}</div>
                        </div>
                      </div>

                      <div className="h-56 w-full bg-[#0d1117] rounded-xl border border-slate-800 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={debtPayoffTrajectory.trajectory}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                            <XAxis dataKey="month" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} minTickGap={16} />
                            <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${Math.round(v/1000)}k`} />
                            <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }} formatter={v => [`$${Number(v).toLocaleString()}`, 'Remaining balance']} />
                            <Area type="monotone" dataKey="balance" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} name="Remaining Balance" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {debtPayoffTrajectory.payoffOrder.length > 0 && (
                        <ol className="flex flex-wrap gap-2 text-[11px] font-mono">
                          {debtPayoffTrajectory.payoffOrder.map((p, i) => (
                            <li key={p.id} className="px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{i + 1}. {p.name} · M{p.month}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MPF & TAX TAB */}
            {activeTab === 'mpf' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800/80 shadow-md">
                  <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-indigo-400" /> MPF & Tax Savings (TVC)
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Calculate HK MPF statutory contributions and Tax-Deductible Voluntary Contributions (TVC) benefits.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 bg-[#0d1117] p-5 rounded-2xl border border-slate-800/80">
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Monthly Employment Income (HKD)</label>
                        <input type="number" value={mpfIncome || ''} onChange={e => setMpfIncome(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Monthly TVC Voluntary Contribution (HKD)</label>
                        <input type="number" value={tvcMonthly || ''} onChange={e => setTvcMonthly(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-xs text-slate-400 font-mono block">Mandatory Monthly Employee Contribution</span>
                          <span className="text-[10px] text-slate-500">(5% up to HK$1,500 max cap)</span>
                        </div>
                        <span className="text-xl font-bold text-white">${mpfCalc.mandatory.toLocaleString()}</span>
                      </div>

                      <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-xs text-slate-400 font-mono block">Annual TVC Tax Deductible Total</span>
                          <span className="text-[10px] text-slate-500">(Cap: $60,000 / year)</span>
                        </div>
                        <span className="text-xl font-bold text-indigo-400">${mpfCalc.annualTvc.toLocaleString()}</span>
                      </div>

                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-xs text-emerald-400 font-mono block">Estimated Annual Salaries Tax Savings</span>
                        </div>
                        <span className="text-2xl font-black text-emerald-400">${mpfCalc.estimatedTaxSaved.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI CHAT TAB */}
            {activeTab === 'advisor' && (
              <div className="h-[75vh] flex flex-col bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden anim-slide-in">
                <div className="p-4 bg-[#0d1117] border-b border-slate-800 flex items-center gap-3">
                  <Bot className="w-4 h-4 text-[#00f2fe]" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-white">A.F.A. AI Advisor</h3>
                    <p className="text-[10px] text-slate-500 font-mono truncate">Tailored for {userProfile.name || 'User'} • Goal: {userProfile.goal || 'General Wealth Accumulation'} • Uses your live profile data</p>
                  </div>
                  {aiEngine && <span className="hidden sm:inline text-[9px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">{aiEngine}</span>}
                  <button type="button" onClick={handleClearChat} className="bg-[#21262d] hover:bg-[#30363d] text-white border border-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                    <RefreshCw className="w-3 h-3" /> New Chat
                  </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#161b22]">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#00f2fe] text-[#0d1117] font-bold' : 'bg-[#0d1117] border border-slate-800 text-slate-200'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isLoadingAi && <div className="text-xs text-slate-500 font-mono italic">A.F.A AI is analyzing...</div>}
                  <div ref={chatEndRef} />
                </div>

                <div className="px-3 pt-3 bg-[#0d1117] border-t border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                  {CHAT_QUICK_PROMPTS.map(prompt => (
                    <button key={prompt} type="button" disabled={isLoadingAi} onClick={() => handleSendMessage(null, prompt)} className="shrink-0 px-3 py-1.5 rounded-full border border-slate-700 text-[10px] text-slate-300 hover:border-[#00f2fe] hover:text-[#00f2fe] transition-colors cursor-pointer disabled:opacity-50">
                      {prompt}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="p-3 bg-[#0d1117] flex gap-2">
                  <input type="text" value={userInput || ''} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask anything, e.g. Can I afford a HK$3,000 trip this week?" className="flex-1 px-4 py-2 rounded-xl bg-[#161b22] border border-slate-800 text-xs text-white focus:outline-none focus:border-[#00f2fe]" />
                  <button type="submit" className="bg-[#00f2fe] hover:bg-cyan-400 text-[#0d1117] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </form>
              </div>
            )}

            {/* AI DIAGNOSTIC TAB */}
            {activeTab === 'diagnostic' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800/80 shadow-md">
                  <h2 className="text-base font-bold text-white mb-4">AI Financial Health Diagnostic</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                      <span className="text-xs font-mono text-slate-400">Savings Ratio (50/30/20)</span>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">{savingsRatio.toFixed(1)}%</div>
                      <p className="text-xs text-slate-500 mt-2">Target benchmark is 20%+.</p>
                    </div>
                    <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                      <span className="text-xs font-mono text-slate-400">Rent Burden Threshold</span>
                      <div className="text-2xl font-bold text-amber-400 mt-1">{rentBurdenRatio.toFixed(1)}%</div>
                      <p className="text-xs text-slate-500 mt-2">Maximum benchmark is 35%.</p>
                    </div>
                    <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                      <span className="text-xs font-mono text-slate-400">Tax Optimization Cap</span>
                      <div className="text-2xl font-bold text-indigo-400 mt-1">$60,000 Cap</div>
                      <p className="text-xs text-slate-500 mt-2">Consider TVC tax deductions.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* REGULATORY FOOTER */}
            <footer className="mt-8 p-4 rounded-2xl bg-[#161b22] border border-slate-800/80 text-[10px] text-slate-500 font-mono leading-relaxed text-center shadow-inner">
              <p><strong>Regulatory Compliance Disclaimer:</strong> A.F.A. (Automated Financial Advisor) is an educational tool designed for financial literacy, debt modeling, and budgeting habit formation in Hong Kong. It does not provide regulated investment advice under the Securities and Futures Ordinance (SFO).</p>
            </footer>

          </main>
        </div>
      )}

      {/* MODALS */}
      {/* BUDGET & LIMITS ADJUSTMENT MODAL */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-[#0d1117]/85 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-lg w-full relative border border-slate-700/50 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-black tracking-wider uppercase text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#00f2fe]" /> Adjust Spending Limits & Budget
                </h3>
                <p className="text-xs text-slate-400 mt-1">Configure flexible budgets for different months and situations.</p>
              </div>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-white text-xs font-mono">✕ Close</button>
            </div>

            {/* Quick Presets */}
            <div className="mb-6 bg-[#0d1117] p-4 rounded-2xl border border-slate-800">
               <label className="block text-[10px] font-mono uppercase text-[#00f2fe] tracking-widest mb-3">Situational Budget Presets</label>
               <div className="grid grid-cols-2 gap-2">
                 {[
                   { name: 'Standard Month', spend: 3500, save: 1200, desc: 'Regular baseline spending' },
                   { name: 'Holiday & Festival', spend: 8000, save: 800, desc: 'Higher social/shopping' },
                   { name: 'Travel & Special', spend: 15000, save: 500, desc: 'Vacation or event mode' },
                   { name: 'Aggressive Savings', spend: 2000, save: 3000, desc: 'Maximized capital accumulation' },
                 ].map((preset) => (
                   <button
                     key={preset.name}
                     type="button"
                     onClick={() => handleApplyPresetBudget(preset.name, preset.spend, preset.save)}
                     className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                       userProfile.budgetProfile === preset.name 
                         ? 'bg-[#00f2fe]/20 border-[#00f2fe] text-white' 
                         : 'bg-slate-800/30 border-slate-800 text-slate-300 hover:border-slate-700'
                     }`}
                   >
                     <div className="text-xs font-bold text-white flex justify-between">
                       <span>{preset.name}</span>
                       {userProfile.budgetProfile === preset.name && <CheckCircle2 className="w-3.5 h-3.5 text-[#00f2fe]" />}
                     </div>
                     <div className="text-[10px] font-mono text-slate-400 mt-1">HK$ {preset.spend.toLocaleString()} / week</div>
                   </button>
                 ))}
               </div>
            </div>

            <form onSubmit={handleSaveBudgetLimits} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Weekly Max Spending Limit (HKD)
                </label>
                <input 
                  type="number" 
                  required 
                  value={userProfile.weeklyMaxSpend || ''} 
                  onChange={e => setUserProfile({...userProfile, weeklyMaxSpend: e.target.value, budgetProfile: 'Custom'})} 
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" 
                  placeholder="e.g. 3500" 
                />
                <p className="text-[10px] text-slate-500 mt-1">Triggers a system warning if weekly spending exceeds this amount.</p>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Weekly Min Savings Target (HKD)
                </label>
                <input 
                  type="number" 
                  required 
                  value={userProfile.weeklyMinSavings || ''} 
                  onChange={e => setUserProfile({...userProfile, weeklyMinSavings: e.target.value, budgetProfile: 'Custom'})} 
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" 
                  placeholder="e.g. 1200" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">
                  Monthly Baseline Income (HKD)
                </label>
                <input 
                  type="number" 
                  value={userProfile.monthlyIncome || ''} 
                  onChange={e => setUserProfile({...userProfile, monthlyIncome: e.target.value})} 
                  className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" 
                  placeholder="e.g. 30000" 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setShowBudgetModal(false)} className="px-5 py-2.5 text-xs text-slate-400 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-black uppercase bg-[#00f2fe] text-[#0d1117] hover:bg-cyan-400 rounded-xl shadow-md cursor-pointer">Save Budget Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick "+" for recording on phones */}
      {user && !showSplash && !showAddTxModal && (
        <button
          onClick={() => setShowAddTxModal(true)}
          aria-label="Record a transaction"
          className="md:hidden fixed z-40 right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-[#00f2fe] text-[#0d1117] shadow-[0_0_24px_rgba(0,242,254,0.45)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <TransactionComposer
        open={showAddTxModal}
        onClose={() => setShowAddTxModal(false)}
        onSave={handleComposerSave}
        colorFor={(id) => colorFor(id, 0)}
      />

      {showAddStockModal && (
        <div className="fixed inset-0 z-50 bg-[#0d1117]/80 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full relative border border-slate-700/50">
            <h3 className="text-base font-bold tracking-wider uppercase text-white mb-2">Add Equity Asset</h3>
            <p className="text-xs text-slate-400 mb-5">Enter ticker (e.g., TSLA, AAPL, NVDA, 2800.HK, 0700.HK) for live price auto-fetch.</p>

            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-[#00f2fe] uppercase tracking-widest mb-1">Ticker Symbol</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g., TSLA or 2800.HK" 
                    value={newStock.symbol || ''} 
                    onChange={e => setNewStock({ ...newStock, symbol: e.target.value })} 
                    className="flex-1 px-4 py-2.5 glass-input rounded-xl text-xs text-white uppercase font-mono" 
                  />
                  <button 
                    type="button" 
                    onClick={() => handleLookupTicker(newStock.symbol)} 
                    disabled={isSearchingTicker || !newStock.symbol}
                    className="px-3.5 py-2.5 bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:bg-[#00f2fe]/20"
                  >
                    {isSearchingTicker ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    <span>Lookup</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Asset Name</label>
                <input type="text" placeholder="Auto-filled Asset Name" value={newStock.name || ''} readOnly className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white opacity-60 cursor-not-allowed" />
              </div>

              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Shares</label>
                  <input type="number" step="any" required placeholder="Shares" value={newStock.shares || ''} onChange={e => setNewStock({ ...newStock, shares: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white font-mono" />
                </div>
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Currency</label>
                  <select value={newStock.currency || 'HKD'} onChange={e => setNewStock({ ...newStock, currency: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white font-mono [&>option]:bg-[#161b22]">
                    <option value="HKD">HKD ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Buy Price</label>
                  <input type="number" step="0.01" required placeholder="Buy Price" value={newStock.buyPrice || ''} onChange={e => setNewStock({ ...newStock, buyPrice: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white font-mono" />
                </div>
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Live Price</label>
                  <input type="number" step="0.01" placeholder="Auto-filled" value={newStock.currentPrice || ''} readOnly className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white font-mono opacity-60 cursor-not-allowed" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddStockModal(false)} className="px-4 py-2 text-xs text-slate-400 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-black uppercase bg-[#00f2fe] text-[#0d1117] hover:bg-cyan-400 rounded-xl shadow-md cursor-pointer">Save Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERSONAL INFO PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-[#0d1117]/85 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-lg w-full relative border border-slate-700/50 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-black tracking-wider uppercase text-white">Personal info</h3>
               <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white text-xs font-mono">✕ Close</button>
            </div>

            <form onSubmit={handleSaveProfileInfo} className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-[#0d1117] rounded-2xl border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">Profile picture URL</span>
                  <span className="text-[10px] text-slate-500">Paste direct image link</span>
                </div>
                {userProfile.profilePic ? (
                  <img src={userProfile.profilePic} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-[#00f2fe]" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-[#00f2fe]">
                    {(userProfile.name || 'U').charAt(0)}
                  </div>
                )}
              </div>
              <input type="text" placeholder="https://images.unsplash.com/photo-..." value={userProfile.profilePic || ''} onChange={e => setUserProfile({...userProfile, profilePic: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Name</label>
                <input type="text" placeholder="Alex Mercer" required value={userProfile.name || ''} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Gender</label>
                <select value={userProfile.gender || 'Female'} onChange={e => setUserProfile({...userProfile, gender: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white [&>option]:bg-[#161b22]">
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Email</label>
                <input type="email" disabled value={userProfile.email || ''} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-slate-500 cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Phone</label>
                <input type="text" placeholder="+852 9123 4567" value={userProfile.phone || ''} onChange={e => setUserProfile({...userProfile, phone: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Birthday</label>
                <input type="date" value={userProfile.birthday || ''} onChange={e => setUserProfile({...userProfile, birthday: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Home address</label>
                <input type="text" placeholder="Harbour City, Tsim Sha Tsui, Hong Kong" value={userProfile.homeAddress || ''} onChange={e => setUserProfile({...userProfile, homeAddress: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
              </div>

              {/* Financial profile: drives the Personal Action Plan in Analytics */}
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#00f2fe] mb-1">Financial profile</h4>
                <p className="text-[10px] text-slate-500 mb-3">Used to tailor your analysis and recommendations.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Monthly income (HKD)</label>
                    <input type="number" min="0" value={userProfile.monthlyIncome || ''} onChange={e => setUserProfile({...userProfile, monthlyIncome: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Dependants</label>
                    <input type="number" min="0" max="20" value={userProfile.dependants ?? ''} onChange={e => setUserProfile({...userProfile, dependants: e.target.value})} placeholder="0" className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Main goal</label>
                    <select value={userProfile.goal || ''} onChange={e => setUserProfile({...userProfile, goal: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white [&>option]:bg-slate-900">
                      <option value="">Choose a goal</option>
                      <option value="HK Property Down Payment">HK Property Down Payment</option>
                      <option value="Early Retirement (FIRE)">Early Retirement (FIRE)</option>
                      <option value="High-Yield Dividend Cash Flow">High-Yield Dividend Cash Flow</option>
                      <option value="General Wealth Accumulation">General Wealth Accumulation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Target amount (HKD)</label>
                    <input type="number" min="0" value={userProfile.targetAmount || ''} onChange={e => setUserProfile({...userProfile, targetAmount: e.target.value})} placeholder="600000" className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Reach it in (years)</label>
                    <input type="number" min="1" max="50" value={userProfile.goalYears || ''} onChange={e => setUserProfile({...userProfile, goalYears: e.target.value})} placeholder="5" className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Risk tolerance</label>
                    <select value={userProfile.riskTolerance || ''} onChange={e => setUserProfile({...userProfile, riskTolerance: e.target.value})} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white [&>option]:bg-slate-900">
                      <option value="">Choose</option>
                      {['Conservative (Bonds & DIS)', 'Moderate (Balanced Tech & Value)', 'Aggressive (High-Beta Equities)'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowProfileModal(false)} className="px-5 py-2.5 text-xs text-slate-400 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-black uppercase bg-[#00f2fe] text-[#0d1117] hover:bg-cyan-400 rounded-xl shadow-md cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}