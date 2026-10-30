import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Wallet, TrendingUp, Bot, FileText, Plus, Trash2, 
  Send, ShieldCheck, AlertCircle, User, LogOut, Sliders, Target, Compass, CreditCard, PiggyBank,
  RefreshCw, Globe, ArrowUpRight, ArrowDownRight, CheckCircle2, Loader2, AlertTriangle, Bell,
  Download, ShieldAlert, Newspaper, Filter, Search, Zap, ExternalLink, Activity, Edit2, Save,
  X, ChevronRight, DollarSign, Settings
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

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

// --- REAL-TIME MARKET PRICE API FETCH UTILITY ---
const DEFAULT_USD_HKD_RATE = 7.82;

const fetchLiveStockQuote = async (rawSymbol) => {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return null;

  let stooqSymbol = symbol;
  const isHK = symbol.endsWith('.HK') || /^\d{4}$/.test(symbol);
  
  if (isHK) {
    let numPart = symbol.replace('.HK', '').padStart(4, '0');
    let cleanNum = parseInt(numPart, 10).toString();
    stooqSymbol = `${cleanNum}.hk`;
  } else if (!symbol.includes('.')) {
    stooqSymbol = `${symbol}.us`;
  }

  try {
    const stooqUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `https://stooq.com/q/l/?s=${stooqSymbol}&f=sd2t2ohlcv&h&e=csv`
    )}`;

    const res = await fetch(stooqUrl);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length >= 2) {
        const data = lines[1].split(',');
        const closePrice = parseFloat(data[6]);
        if (!isNaN(closePrice) && closePrice > 0) {
          return {
            symbol: symbol,
            price: closePrice,
            currency: isHK ? 'HKD' : 'USD',
            source: 'Stooq Real-time'
          };
        }
      }
    }
  } catch (err) {
    console.warn(`Primary market fetch failed for ${symbol}, trying fallback proxy...`, err);
  }

  try {
    let yahooSymbol = symbol;
    if (/^\d{4}$/.test(symbol)) {
      yahooSymbol = `${symbol}.HK`;
    }
    const yahooUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`
    )}`;
    
    const res = await fetch(yahooUrl);
    if (res.ok) {
      const json = await res.json();
      const parsed = JSON.parse(json.contents);
      const result = parsed?.chart?.result?.[0];
      const closePrice = result?.meta?.regularMarketPrice || result?.indicators?.quote?.[0]?.close?.slice(-1)[0];
      const currency = result?.meta?.currency || (isHK ? 'HKD' : 'USD');
      
      if (closePrice && !isNaN(closePrice)) {
        return {
          symbol: symbol,
          price: parseFloat(closePrice),
          currency: currency.toUpperCase(),
          source: 'Yahoo Finance'
        };
      }
    }
  } catch (err) {
    console.error(`Secondary quote fetch failed for ${symbol}:`, err);
  }

  const staticBenchmarkPrices = {
    'TSLA': { price: 404.22, currency: 'USD' },
    'AAPL': { price: 232.50, currency: 'USD' },
    'NVDA': { price: 138.25, currency: 'USD' },
    '2800.HK': { price: 20.85, currency: 'HKD' },
    '0700.HK': { price: 412.60, currency: 'HKD' },
    '9988.HK': { price: 98.40, currency: 'HKD' },
  };

  const cleanKey = isHK && !symbol.endsWith('.HK') ? `${symbol.padStart(4, '0')}.HK` : symbol;
  if (staticBenchmarkPrices[cleanKey]) {
    return {
      symbol: cleanKey,
      price: staticBenchmarkPrices[cleanKey].price,
      currency: staticBenchmarkPrices[cleanKey].currency,
      source: 'Benchmark Cached'
    };
  }

  return null;
};

// --- CATEGORY COLOR MATRIX ---
const CATEGORY_COLORS = {
  'Dining': '#f43f5e',
  'Shopping': '#ec4899',
  'Entertainment': '#a855f7',
  'Rent': '#f59e0b',
  'Transport': '#3b82f6',
  'Salary': '#10b981',
  'Capital Gain': '#059669',
  'Dividend': '#34d399',
  'Freelance': '#a7f3d0',
  'Interest': '#6ee7b7',
  'Gift': '#fbbf24',
  'Investment': '#00f2fe',
  'Utilities': '#6366f1',
  'Other': '#64748b'
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
      <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00f2fe" />
        <stop offset="100%" stopColor="#4facfe" />
      </linearGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
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
    <path className="crossbar" d="M 38 52 L 62 52" stroke="url(#iconGrad)" strokeWidth="6.5" strokeLinecap="round" filter="url(#glow)" />
    
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
  const [portfolio, setPortfolio] = useState([]);
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
  const [lastNewsSyncTime, setLastNewsSyncTime] = useState('Just Now');

  const [newsFeed, setNewsFeed] = useState([]);

  const fetchLiveNews = async () => {
    setIsSyncingNews(true);
    try {
      const targetUrl = encodeURIComponent('https://api.rss2json.com/v1/api.json?rss_url=https://finance.yahoo.com/news/rssindex');
      const res = await fetch(`https://api.allorigins.win/raw?url=${targetUrl}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      if (data && data.items && data.items.length > 0) {
        const liveNews = data.items.map((item, index) => ({
          id: index,
          title: item.title,
          summary: (item.description || '').replace(/<[^>]+>/g, '').substring(0, 120) + '...',
          category: 'Market Alert',
          source: 'Yahoo Finance',
          time: new Date(item.pubDate).toLocaleTimeString(),
          symbols: [],
          impact: index % 3 === 0 ? 'High Impact' : 'Neutral',
          url: item.link
        }));
        setNewsFeed(liveNews);
        setLastNewsSyncTime(new Date().toLocaleTimeString());
      } else {
        throw new Error('Empty news data');
      }
    } catch (err) {
      console.warn("Failed to fetch live news, using fallback.", err);
      const fallbackNews = [
        { id: 1, title: "Federal Reserve Signals Data-Dependent Interest Rate Trajectory", summary: "Central bank policymakers reiterated their commitment to calibrated rate decisions.", category: "Market Alert", source: "Bloomberg", time: "25m ago", symbols: ["USD", "HKD"], impact: "Neutral", url: "https://www.bloomberg.com" },
        { id: 2, title: "NVIDIA Capex Demand Accelerates As Hyperscalers Double Down", summary: "Surging Enterprise AI deployments continue to support valuation fundamentals.", category: "Market Alert", source: "Reuters", time: "1h ago", symbols: ["NVDA", "TSLA"], impact: "High Impact", url: "https://www.reuters.com" },
        { id: 3, title: "Hong Kong Tracker Fund (2800.HK) Experiences Inflow Growth", summary: "Institutional capital flows into Southbound Stock Connect remain robust.", category: "Market Alert", source: "SCMP Business", time: "3h ago", symbols: ["2800.HK", "0700.HK"], impact: "High Impact", url: "https://www.scmp.com" }
      ];
      setNewsFeed(fallbackNews);
      setLastNewsSyncTime(new Date().toLocaleTimeString() + ' (Cached)');
    } finally {
      setIsSyncingNews(false);
    }
  };

  useEffect(() => {
    fetchLiveNews();
  }, []);

  // Wealth Simulator Control States
  const [simInitial, setSimInitial] = useState(50000);
  const [simMonthly, setSimMonthly] = useState(6000);
  const [simRate, setSimRate] = useState(6.5);
  const [simYears, setSimYears] = useState(10);

  // Debt Strategy State
  const [isDebtLoaded, setIsDebtLoaded] = useState(false);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [debtAmount, setDebtAmount] = useState(45000);
  const [debtRate, setDebtRate] = useState(24.5);
  const [debtMinPay, setDebtMinPay] = useState(2500);
  const [debtStrategy, setDebtStrategy] = useState('avalanche');

  // MPF & Tax State
  const [mpfIncome, setMpfIncome] = useState(30000);
  const [tvcMonthly, setTvcMonthly] = useState(2000);

  // Modal Controls
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ description: '', amount: '', category: 'Dining', type: 'expense', date: new Date().toISOString().split('T')[0], account: 'Bank Account' });

  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStock, setNewStock] = useState({ symbol: '', name: '', shares: '', buyPrice: '', currentPrice: '', currency: 'HKD', category: 'HK Equity' });

  // Cash Flow View Mode State
  const [cashFlowView, setCashFlowView] = useState('Monthly');

  // AI Chat Assistant State
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: "Hello! I am your A.F.A. AI Financial Assistant. I can analyze your HKD cash flow, live stock valuation, tax incentives (TVC), MPF strategy, debt health, and spending anomalies. How can I help you today?" }
  ]);
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
      setPortfolio([]);
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
        
        // Auto-load Debt parameters on first fetch
        if (!isDebtLoaded && data.email) {
          if (data.debtAmount !== undefined) setDebtAmount(Number(data.debtAmount));
          if (data.debtRate !== undefined) setDebtRate(Number(data.debtRate));
          if (data.debtMinPay !== undefined) setDebtMinPay(Number(data.debtMinPay));
          setIsDebtLoaded(true);
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

    // Sync Portfolio
    const portRef = getCollectionPath(user.uid, 'portfolio');
    const unsubPort = onSnapshot(portRef, (snapshot) => {
      const ports = [];
      snapshot.forEach(doc => ports.push({ id: doc.id, ...doc.data() }));
      setPortfolio(ports);
    }, (err) => console.error("Portfolio sync error:", err));

    return () => {
      unsubProfile();
      unsubTx();
      unsubPort();
    };
  }, [user, isDebtLoaded]);

  // Splash Screen Delay
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  // --- LIVE MARKET PRICES REFRESH FUNCTION ---
  const handleSyncMarketPrices = async () => {
    if (portfolio.length === 0 || isSyncingMarket) return;
    setIsSyncingMarket(true);

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';

    try {
      for (const item of portfolio) {
        const quote = await fetchLiveStockQuote(item.symbol);
        if (quote && quote.price) {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'portfolio', item.id);
          await updateDoc(docRef, {
            currentPrice: quote.price,
            currency: quote.currency || (item.symbol.endsWith('.HK') ? 'HKD' : 'USD'),
            lastUpdated: new Date().toISOString()
          });
        }
      }
      setLastMarketSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Market sync failed:", err);
    } finally {
      setIsSyncingMarket(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'portfolio' && portfolio.length > 0 && !lastMarketSyncTime) {
      handleSyncMarketPrices();
    }
  }, [activeTab, portfolio.length]);

  const handleLookupTicker = async (symbolToSearch) => {
    const querySymbol = symbolToSearch || newStock.symbol;
    if (!querySymbol) return;

    setIsSearchingTicker(true);
    try {
      const quote = await fetchLiveStockQuote(querySymbol);
      setIsSearchingTicker(false);

      if (quote && quote.price) {
        const isHK = quote.currency === 'HKD' || querySymbol.toUpperCase().endsWith('.HK');
        const formattedSymbol = querySymbol.toUpperCase();
        
        const defaultNames = {
          'TSLA': 'Tesla, Inc.',
          'AAPL': 'Apple Inc.',
          'NVDA': 'NVIDIA Corporation',
          '2800.HK': 'Tracker Fund of Hong Kong',
          '0700.HK': 'Tencent Holdings Ltd.',
          '9988.HK': 'Alibaba Group Holding'
        };

        setNewStock(prev => ({
          ...prev,
          symbol: formattedSymbol,
          name: prev.name || defaultNames[formattedSymbol] || `${formattedSymbol} Asset`,
          currentPrice: quote.price.toFixed(2),
          currency: quote.currency,
          category: isHK ? 'HK Equity' : 'US Tech & Growth',
          buyPrice: prev.buyPrice || quote.price.toFixed(2)
        }));
      } else {
         setNewStock(prev => ({ ...prev, name: 'Ticker not found', currentPrice: '' }));
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
        weeklyMinSavings: userProfile.weeklyMinSavings
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

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount || !user) return;
    try {
      const txRef = getCollectionPath(user.uid, 'transactions');
      await addDoc(txRef, { 
        ...newTx, 
        amount: parseFloat(newTx.amount) 
      });
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Failed to add transaction. Check permissions.");
    } finally {
      setNewTx({ description: '', amount: '', category: 'Dining', type: 'expense', date: new Date().toISOString().split('T')[0], account: 'Bank Account' });
      setShowAddTxModal(false);
    }
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
      const isHK = newStock.symbol.toUpperCase().endsWith('.HK');
      await addDoc(portRef, {
        symbol: newStock.symbol.toUpperCase(),
        name: newStock.name || newStock.symbol.toUpperCase(),
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

  const handleSaveDebtPlan = async () => {
    if (!user) return;
    setIsSavingDebt(true);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, { debtAmount, debtRate, debtMinPay }, { merge: true });
    } catch (error) {
      console.error("Error saving debt plan", error);
      alert("Failed to save debt plan.");
    } finally {
      setIsSavingDebt(false);
    }
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
        homeAddress: userProfile.homeAddress || ''
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

  const portfolioGrowth = useMemo(() => {
    const data = [];
    let baseValue = portfolioTotalValue * 0.9; 
    const dailyIncrement = (portfolioTotalValue - baseValue) / 30;
    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const randomFluctuation = baseValue * (Math.random() * 0.02 - 0.01); 
      baseValue += dailyIncrement + randomFluctuation;
      data.push({
        date: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        value: i === 0 ? portfolioTotalValue : Math.max(0, baseValue)
      });
    }
    return data;
  }, [portfolioTotalValue]);

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

  const debtPayoffTrajectory = useMemo(() => {
    let balance = debtAmount;
    const monthlyRate = (debtRate / 100) / 12;
    let month = 0;
    let totalInterest = 0;
    const trajectory = [{ month: 'M0', balance: balance, interestPaid: 0 }];

    while (balance > 0 && month < 120) {
      month++;
      const interest = balance * monthlyRate;
      totalInterest += interest;
      const principal = debtMinPay - interest;
      if (principal <= 0) break;
      balance = Math.max(0, balance - principal);
      
      if (month % 3 === 0 || balance === 0) {
        trajectory.push({
          month: `M${month}`,
          balance: Math.round(balance),
          interestPaid: Math.round(totalInterest)
        });
      }
    }
    return { trajectory, totalMonths: month, totalInterest: Math.round(totalInterest) };
  }, [debtAmount, debtRate, debtMinPay]);

  const mpfCalc = useMemo(() => {
    const income = Number(mpfIncome) || 0;
    let mandatory = 0;
    if (income >= 30000) mandatory = 1500;
    else if (income >= 7100) mandatory = income * 0.05;

    const annualTvc = Math.min(60000, Number(tvcMonthly) * 12);
    const estimatedTaxSaved = Math.round(annualTvc * 0.15); 

    return { mandatory, annualTvc, estimatedTaxSaved };
  }, [mpfIncome, tvcMonthly]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoadingAi) return;
    const userMsg = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoadingAi(true);

    try {
      const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const systemPrompt = `You are A.F.A, personalized financial advisor for ${userProfile.name}.
      Weekly Max Spend Limit: HK$ ${userProfile.weeklyMaxSpend}, Min Savings Target: HK$ ${userProfile.weeklyMinSavings}.
      Detected ${anomalyAnalysis.anomalies.length} high-value expense outliers.
      Weekend Spend Ratio: ${anomalyAnalysis.weekendRatio}%.`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMsg}` }] }]
        })
      });
      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I am currently analyzing your profile. Please try again in a moment.";
      setChatMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Service temporarily unavailable. Please check your network connection." }]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const cashFlowData = useMemo(() => {
    if (cashFlowView === 'Daily') {
      return [
        { name: 'Mon', income: 1200, expense: 400 },
        { name: 'Tue', income: 800, expense: 900 },
        { name: 'Wed', income: 1500, expense: 300 },
        { name: 'Thu', income: 2000, expense: 600 },
        { name: 'Fri', income: 3200, expense: 1200 },
        { name: 'Sat', income: 500, expense: 1800 },
        { name: 'Sun', income: 400, expense: 1100 },
      ];
    }
    if (cashFlowView === 'Weekly') {
      return [
        { name: 'W1', income: 8500, expense: 4200 },
        { name: 'W2', income: 9200, expense: 5100 },
        { name: 'W3', income: 7800, expense: 3900 },
        { name: 'W4', income: 11000, expense: 6200 },
      ];
    }
    // Monthly
    if (transactions.length < 3) {
       return [
         { name: 'Jan', income: 4000, expense: 2400 },
         { name: 'Feb', income: 4500, expense: 2100 },
         { name: 'Mar', income: 4200, expense: 2900 },
         { name: 'Apr', income: 5000, expense: 2000 },
         { name: 'May', income: 5500, expense: 2800 },
         { name: 'Jun', income: Math.max(5600, totalIncome), expense: Math.max(3000, totalExpense) },
       ];
    }
    const grouped = {};
    transactions.forEach(t => {
       const month = new Date(t.date).toLocaleString('default', { month: 'short' });
       if (!grouped[month]) grouped[month] = { name: month, income: 0, expense: 0 };
       if (t.type === 'income') grouped[month].income += Number(t.amount);
       else grouped[month].expense += Number(t.amount);
    });
    return Object.values(grouped).reverse();
  }, [transactions, totalIncome, totalExpense, cashFlowView]);

  return (
    <div className="flex h-screen bg-[#0d1117] text-slate-100 font-sans selection:bg-[#00f2fe]/30 selection:text-cyan-300 overflow-hidden">
      
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

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
              <AppIcon className="w-24 h-24 drop-shadow-[0_0_30px_rgba(0,242,254,0.4)]" animateStroke={true} />
            </div>
            
            <div className="glass-panel rounded-3xl p-6 sm:p-8 w-full relative overflow-hidden">
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
        <aside className="w-60 bg-[#161b22] border-r border-slate-800/80 flex-col z-40 hidden md:flex shrink-0 shadow-xl">
          <div className="p-5 flex flex-col gap-1 border-b border-slate-800/50">
             <div className="flex items-center gap-3">
                <AppIcon className="w-7 h-7" />
                <h1 translate="no" className="notranslate text-lg font-bold tracking-wider text-white leading-none">A.F.A.</h1>
             </div>
             <p className="text-[8px] text-slate-500 font-mono tracking-widest uppercase pl-[38px]">Automated Financial Assistant</p>
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
        <div className="flex-1 flex flex-col relative h-full overflow-y-auto overflow-x-hidden dashboard-enter bg-[#0d1117]">
          
          {/* HEADER (Main Content Area) */}
          <header className="sticky top-0 z-30 bg-[#161b22]/90 backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between px-6 py-3.5 shadow-sm">
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
                     placeholder="Search features, transactions, assets..." 
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
                                 <span className="text-xs font-mono font-bold text-emerald-400">${(p.shares * p.currentPrice).toLocaleString()}</span>
                               </div>
                             ))}
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

                        {searchNavMatches.length === 0 && searchPortfolioMatches.length === 0 && searchTransactionMatches.length === 0 && (
                          <div className="p-4 text-center text-xs text-slate-500 font-mono">
                            No matching records or modules found for "{globalSearch}".
                          </div>
                        )}
                     </div>
                   )}
                </div>
                
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
                          <XAxis dataKey="name" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                          <Bar dataKey="amount" fill="#93c5fd" radius={[4, 4, 0, 0]} />
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
                          <XAxis dataKey="name" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                          <Bar dataKey="amount" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
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
                          <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{fontSize: '9px', fill: '#fff'}}>
                            {categoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill || '#00f2fe'} stroke="rgba(0,0,0,0.2)" />
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
                          <Pie data={incomeCategoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{fontSize: '9px', fill: '#fff'}}>
                            {incomeCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} stroke="rgba(0,0,0,0.2)" />
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

                <div className="bg-[#161b22] rounded-2xl border border-slate-800/80 shadow-md overflow-hidden">
                  <div className="px-5 py-3 bg-[#0d1117] border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-mono uppercase text-[#00f2fe]">Transaction History Log</span>
                    <span className="text-[10px] text-slate-500 font-mono">{filteredTransactions.length} Records</span>
                  </div>

                  <table className="w-full text-left text-sm text-slate-300">
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
                          <td className="py-3 px-5 font-semibold text-white">{tx.description}</td>
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
            )}

            {/* REPORT / ANALYTICS TAB */}
            {activeTab === 'report' && (
              <div className="space-y-6 anim-slide-in">
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
                    <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#00f2fe]"/> Equity & Fund Holdings</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {lastMarketSyncTime ? `Live market synced at ${lastMarketSyncTime} (FX USD/HKD = 7.82)` : 'Live stock price feed active'}
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
                      <Plus className="w-4 h-4" /> Add Asset
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
                                {isPositive ? '+' : ''}{gainPercent}%
                              </span>
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

                {/* NEW: Portfolio Dashboard Enhancements */}
                <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md mb-6">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Portfolio Growth</h3>
                  <div className="h-64 w-full">
                    {portfolio.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">Add assets to see growth.</div> :
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={portfolioGrowth}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                        <XAxis dataKey="date" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                        <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                        <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-[#161b22] p-5 rounded-2xl border border-slate-800/80 shadow-md">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Portfolio Diversity</h3>
                    <div className="h-56 w-full">
                      {portfolio.length === 0 ? <div className="text-xs text-slate-500 h-full flex items-center justify-center">No portfolio data</div> :
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={portfolioDiversity} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{fontSize:'10px', fill:'#fff'}}>
                            {portfolioDiversity.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill || ['#00f2fe', '#3b82f6', '#8b5cf6', '#ec4899'][index % 4]} stroke="rgba(0,0,0,0.2)"/>
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

                {/* LIVE MARKET NEWS */}
                <div className="bg-[#161b22] p-6 rounded-3xl border border-slate-800/80 shadow-md space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-[#00f2fe]" /> Live Market Intelligence (RSS)
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Real-time feeds affecting global equity valuations.
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
                        {isSyncingNews ? "Fetching live market news..." : "No financial headlines found."}
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
                                item.impact === 'High Impact' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {item.impact}
                              </span>
                              <span className="text-[11px] font-mono text-[#00f2fe]">{item.source}</span>
                              <span className="text-[10px] text-slate-500">• {item.time}</span>
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
                  <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-400" /> Debt Repayment Optimizer
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Analyze credit card debt or personal loans and save your payoff plan directly to Firebase.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-4 bg-[#0d1117] p-5 rounded-2xl border border-slate-800/80">
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Total Unsecured Debt (HKD)</label>
                        <input type="number" value={debtAmount || ''} onChange={e => setDebtAmount(Number(e.target.value))} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">APR Interest Rate (%)</label>
                        <input type="number" step="0.5" value={debtRate || ''} onChange={e => setDebtRate(Number(e.target.value))} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Monthly Repayment Allocation (HKD)</label>
                        <input type="number" value={debtMinPay || ''} onChange={e => setDebtMinPay(Number(e.target.value))} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Payoff Strategy</label>
                        <select value={debtStrategy} onChange={e => setDebtStrategy(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white [&>option]:bg-[#161b22]">
                          <option value="avalanche">Avalanche (Highest Interest Savings)</option>
                          <option value="snowball">Snowball (Psychological Momentum)</option>
                        </select>
                      </div>

                      <button 
                        onClick={handleSaveDebtPlan} 
                        className="w-full mt-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        {isSavingDebt ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                        <span>Save Debt Plan</span>
                      </button>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Estimated Debt Free Time</span>
                          <div className="text-2xl font-bold text-emerald-400 mt-1">{debtPayoffTrajectory.totalMonths} Months</div>
                        </div>
                        <div className="p-4 bg-[#0d1117] rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">Total Interest Cost</span>
                          <div className="text-2xl font-bold text-rose-400 mt-1">${debtPayoffTrajectory.totalInterest.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="h-56 w-full bg-[#0d1117] rounded-xl border border-slate-800 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={debtPayoffTrajectory.trajectory}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" opacity={0.6} />
                            <XAxis dataKey="month" stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                            <YAxis stroke="#8b949e" tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={v => `$${v/1000}k`} />
                            <Tooltip contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#fff' }} />
                            <Area type="monotone" dataKey="balance" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.2} name="Remaining Balance" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
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
                  <div>
                    <h3 className="font-bold text-sm text-white">A.F.A. AI Advisor</h3>
                    <p className="text-[10px] text-slate-500 font-mono">Tailored for {userProfile.name} • Goal: {userProfile.goal}</p>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#161b22]">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-[#00f2fe] text-[#0d1117] font-bold' : 'bg-[#0d1117] border border-slate-800 text-slate-200'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isLoadingAi && <div className="text-xs text-slate-500 font-mono italic">A.F.A AI is analyzing...</div>}
                </div>

                <form onSubmit={handleSendMessage} className="p-3 bg-[#0d1117] border-t border-slate-800 flex gap-2">
                  <input type="text" value={userInput || ''} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask about HK tax deductions, market news, or spending..." className="flex-1 px-4 py-2 rounded-xl bg-[#161b22] border border-slate-800 text-xs text-white focus:outline-none focus:border-[#00f2fe]" />
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

      {showAddTxModal && (
        <div className="fixed inset-0 z-50 bg-[#0d1117]/80 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full relative border border-slate-700/50">
            <h3 className="text-base font-bold tracking-wider uppercase text-white mb-5">Log Transaction</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <input type="text" required placeholder="Description" value={newTx.description || ''} onChange={e => setNewTx({ ...newTx, description: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
              <input type="number" required placeholder="Amount" value={newTx.amount || ''} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white" />
              <input type="date" required value={newTx.date || ''} onChange={e => setNewTx({ ...newTx, date: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white font-mono" />
              <select value={newTx.account || ''} onChange={e => setNewTx({ ...newTx, account: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white [&>option]:bg-[#161b22]">
                <option value="Bank Account">Bank Account</option>
                <option value="Cash">Cash</option>
                <option value="Octopus">Octopus</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Crypto">Crypto Wallet</option>
              </select>
              <select value={newTx.type} onChange={e => {
                  const newType = e.target.value;
                  setNewTx({ ...newTx, type: newType, category: newType === 'income' ? 'Salary' : 'Dining' });
                }} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white [&>option]:bg-[#161b22]">
                <option value="expense">Expense / Outflow</option>
                <option value="income">Income / Inflow</option>
              </select>
              <select value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })} className="w-full px-4 py-2.5 glass-input rounded-xl text-xs text-white [&>option]:bg-[#161b22]">
                {newTx.type === 'expense' ? (
                  <>
                    <option value="Dining">Dining</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Rent">Rent</option>
                    <option value="Transport">Transport</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Investment">Investment Deposit</option>
                    <option value="Other">Other</option>
                  </>
                ) : (
                  <>
                    <option value="Salary">Salary</option>
                    <option value="Capital Gain">Capital Gain</option>
                    <option value="Dividend">Dividend</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Interest">Interest</option>
                    <option value="Gift">Gift</option>
                    <option value="Other">Other</option>
                  </>
                )}
              </select>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddTxModal(false)} className="px-4 py-2 text-xs text-slate-400 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold uppercase bg-[#00f2fe] text-[#0d1117] rounded-xl cursor-pointer hover:bg-cyan-400">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

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