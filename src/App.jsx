import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Wallet, TrendingUp, Bot, FileText, Plus, Trash2, 
  Send, ShieldCheck, AlertCircle, User, LogOut, Sliders, Target, Compass, CreditCard, PiggyBank,
  RefreshCw, Globe, ArrowUpRight, ArrowDownRight, CheckCircle2, Loader2, AlertTriangle, Bell,
  Download, ShieldAlert, Newspaper, Filter, Search, Zap, ExternalLink, Activity
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell
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
      @keyframes pulseNode {
        0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(0,242,254,0.8)); }
        50% { transform: scale(1.25); filter: drop-shadow(0 0 16px rgba(0,242,254,1)); }
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
        animation: pulseNode 2.5s infinite ease-in-out;
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
    
    <circle className="cyber-node" cx="50" cy="25" r="5.5" fill="#ffffff" />
    <circle className="cyber-node" cx="28" cy="72" r="4.5" fill="#00f2fe" style={{ animationDelay: '0.4s' }} />
    <circle className="cyber-node" cx="72" cy="72" r="4.5" fill="#00f2fe" style={{ animationDelay: '0.8s' }} />
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
    weeklyMinSavings: '1200'
  });

  // Data States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [portfolio, setPortfolio] = useState([]);

  // Live Market API Sync Controls
  const [isSyncingMarket, setIsSyncingMarket] = useState(false);
  const [lastMarketSyncTime, setLastMarketSyncTime] = useState(null);
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);

  // Live Financial News State
  const [newsCategory, setNewsCategory] = useState('All');
  const [newsSearch, setNewsSearch] = useState('');
  const [filterByHoldingsOnly, setFilterByHoldingsOnly] = useState(false);
  const [isSyncingNews, setIsSyncingNews] = useState(false);
  const [lastNewsSyncTime, setLastNewsSyncTime] = useState('Just Now');

  // Sample Financial News Feed
  const initialNewsFeed = [
    {
      id: 1,
      title: "Federal Reserve Signals Data-Dependent Interest Rate Trajectory Amid Cooling Inflation",
      summary: "Central bank policymakers reiterated their commitment to calibrated rate decisions, balancing labor market stability with inflation benchmarks.",
      category: "Central Bank & Rates",
      source: "Bloomberg Financial",
      time: "25m ago",
      symbols: ["USD", "HKD"],
      impact: "Market Alert",
      url: "https://www.bloomberg.com"
    },
    {
      id: 2,
      title: "NVIDIA Capex Demand Accelerates As Hyperscalers Double Down on Next-Gen Infrastructure",
      summary: "Surging Enterprise AI deployments continue to support valuation fundamentals across global semiconductor supply chains.",
      category: "Tech & AI",
      source: "Reuters Technology",
      time: "1h ago",
      symbols: ["NVDA", "TSLA"],
      impact: "Bullish",
      url: "https://www.reuters.com"
    },
    {
      id: 3,
      title: "Hong Kong Tracker Fund (2800.HK) Experiences Inflow Growth Following Fiscal Measures",
      summary: "Institutional capital flows into Southbound Stock Connect remain robust, aiding liquidity in blue-chip equities.",
      category: "Macro Economy",
      source: "SCMP Business",
      time: "3h ago",
      symbols: ["2800.HK", "0700.HK", "9988.HK"],
      impact: "High Impact",
      url: "https://www.scmp.com"
    },
    {
      id: 4,
      title: "OPEC+ Crude Production Strategy Adjustments Impact Global Energy Sector Margins",
      summary: "Oil benchmark fluctuations provide macro headwinds for transport and manufacturing overhead costs worldwide.",
      category: "Energy & Commodities",
      source: "Financial Times",
      time: "5h ago",
      symbols: ["XOM", "CVX"],
      impact: "Neutral",
      url: "https://www.ft.com"
    }
  ];

  const [newsFeed, setNewsFeed] = useState(initialNewsFeed);

  // Wealth Simulator Control States
  const [simInitial, setSimInitial] = useState(50000);
  const [simMonthly, setSimMonthly] = useState(6000);
  const [simRate, setSimRate] = useState(6.5);
  const [simYears, setSimYears] = useState(10);

  // Debt Strategy State
  const [debtAmount, setDebtAmount] = useState(45000);
  const [debtRate, setDebtRate] = useState(24.5);
  const [debtMinPay, setDebtMinPay] = useState(2500);
  const [debtStrategy, setDebtStrategy] = useState('avalanche');

  // MPF & Tax State
  const [mpfIncome, setMpfIncome] = useState(30000);
  const [tvcMonthly, setTvcMonthly] = useState(2000);

  // Modal Controls
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [newTx, setNewTx] = useState({ description: '', amount: '', category: 'Dining', type: 'expense', date: new Date().toISOString().split('T')[0] });

  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStock, setNewStock] = useState({ symbol: '', name: '', shares: '', buyPrice: '', currentPrice: '', currency: 'HKD', category: 'HK Equity' });

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
      return;
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'afa-default';
    
    // Sync Profile
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(prev => ({ ...prev, ...docSnap.data() }));
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
  }, [user]);

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
    }
  };

  const handleRefreshNews = () => {
    setIsSyncingNews(true);
    setTimeout(() => {
      setIsSyncingNews(false);
      setLastNewsSyncTime(new Date().toLocaleTimeString());
    }, 800);
  };

  // Filtered News Memo
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
      });
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.');
      setOnboardingStep(2); 
      setAuthActionLoading(false);
    }
  };

  const handleSignOut = () => signOut(auth);

  // --- HANDLERS: FIRESTORE MUTATIONS ---
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount || !user) return;
    try {
      const txRef = getCollectionPath(user.uid, 'transactions');
      await addDoc(txRef, { 
        ...newTx, 
        amount: parseFloat(newTx.amount) 
      });
      setShowAddTxModal(false);
      setNewTx({ description: '', amount: '', category: 'Dining', type: 'expense', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      console.error("Error adding transaction:", error);
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
      setShowAddStockModal(false);
      setNewStock({ symbol: '', name: '', shares: '', buyPrice: '', currentPrice: '', currency: 'HKD', category: 'HK Equity' });
    } catch (error) {
      console.error("Error adding stock:", error);
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
      await updateDoc(profileRef, { weeklyMaxSpend: newMaxSpend, weeklyMinSavings: newMinSavings });
    }
  };

  // --- FINANCIAL THEORY CALCULATIONS ---
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense' && t.category !== 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalInvestmentDeposits = useMemo(() => transactions.filter(t => t.category === 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const netSavings = totalIncome - totalExpense - totalInvestmentDeposits;

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

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-100 font-sans flex flex-col selection:bg-[#00f2fe]/30 selection:text-cyan-300 relative overflow-x-hidden">
      
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
          background: rgba(10, 15, 25, 0.25);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 48px 0 rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 242, 254, 0.05);
        }
        
        .glass-input {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }
        .glass-input:focus {
          border-color: #00f2fe;
          background: rgba(0, 0, 0, 0.45);
          box-shadow: 0 0 15px rgba(0, 242, 254, 0.2);
          outline: none;
        }
      `}</style>

      {/* Ambient Lights */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#00f2fe]/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>
      <div className="fixed bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-[#4facfe]/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>

      {/* SPLASH SCREEN */}
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-[#05080f] flex flex-col items-center justify-center p-6 transition-opacity duration-1000">
          <div className="relative flex items-center justify-center mb-10">
            <AppIcon className="w-28 h-28 drop-shadow-[0_0_35px_rgba(0,242,254,0.4)]" animateStroke={true} />
          </div>
          <div className="flex text-4xl sm:text-5xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400">
             <span style={{ animation: 'fadeUpStagger 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards', opacity: 0 }}>A.</span>
             <span style={{ animation: 'fadeUpStagger 1s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards', opacity: 0 }}>F.</span>
             <span style={{ animation: 'fadeUpStagger 1s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards', opacity: 0 }}>A.</span>
          </div>
          <p style={{ animation: 'fadeUpStagger 1s ease-out 1.3s forwards', opacity: 0 }} className="text-xs text-cyan-400/70 font-mono tracking-widest mt-5 uppercase">
            Automated Financial Advisor
          </p>
        </div>
      )}

      {/* AUTHENTICATION & REGISTRATION */}
      {!authLoading && !user && !showSplash && (
        <div className="fixed inset-0 z-40 bg-transparent flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md relative anim-slide-in flex flex-col items-center">
            <div className="mb-8 z-10">
              <AppIcon className="w-24 h-24 drop-shadow-[0_0_30px_rgba(0,242,254,0.6)]" animateStroke={true} />
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
                    <p className="text-[10px] text-cyan-300/80 mt-1.5 uppercase font-mono tracking-widest leading-relaxed px-2">Your personal automated financial assistant</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Email</label>
                      <input type="email" required value={userProfile.email} onChange={e => setUserProfile({...userProfile, email: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" placeholder="Enter your email" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Password</label>
                      <input type="password" required value={userProfile.password} onChange={e => setUserProfile({...userProfile, password: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" placeholder="••••••••" />
                    </div>
                    <button type="submit" disabled={authActionLoading} className="w-full py-4 mt-2 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] hover:from-cyan-400 hover:to-blue-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(0,242,254,0.4)] disabled:opacity-50">
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
                        <input type="text" placeholder="e.g. Chloe Chan" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <button disabled={!userProfile.name} onClick={() => setOnboardingStep(2)} className="w-full py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest">Next Phase</button>
                    </div>
                  )}

                  {onboardingStep === 2 && (
                    <div className="space-y-4 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Email Address</label>
                        <input type="email" placeholder="chloe@hktech.io" value={userProfile.email} onChange={e => setUserProfile({...userProfile, email: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white mb-4" />
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Password Key</label>
                        <input type="password" placeholder="Min 6 characters" value={userProfile.password} onChange={e => setUserProfile({...userProfile, password: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setOnboardingStep(1)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.email || userProfile.password.length < 6} onClick={() => setOnboardingStep(3)} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 rounded-xl text-xs font-black uppercase">Next Phase</button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 3 && (
                    <div className="space-y-4 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Wealth Target</label>
                        <select value={userProfile.goal} onChange={e => setUserProfile({...userProfile, goal: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white [&>option]:bg-slate-900">
                          <option value="">-- Select Objective --</option>
                          <option value="HK Property Down Payment">HK Property Down Payment</option>
                          <option value="Early Retirement (FIRE)">Early Retirement (FIRE)</option>
                          <option value="High-Yield Dividend Cash Flow">High-Yield Dividend Cash Flow</option>
                          <option value="General Wealth Accumulation">General Wealth Accumulation</option>
                        </select>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setOnboardingStep(2)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.goal} onClick={() => setOnboardingStep(4)} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 rounded-xl text-xs font-black uppercase">Next Phase</button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 4 && (
                    <div className="space-y-4 anim-slide-in">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1.5">Capital Target (HKD)</label>
                        <input type="number" placeholder="e.g. 500000" value={userProfile.targetAmount} onChange={e => setUserProfile({...userProfile, targetAmount: e.target.value})} className="w-full px-4 py-3.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setOnboardingStep(3)} className="w-1/3 bg-white/5 py-4 rounded-xl text-xs text-slate-300">Back</button>
                        <button disabled={!userProfile.targetAmount} onClick={() => setOnboardingStep(5)} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 rounded-xl text-xs font-black uppercase">Next Phase</button>
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
                        <button disabled={!userProfile.riskTolerance || authActionLoading} onClick={handleRegister} className="w-2/3 py-4 bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 rounded-xl text-xs font-black uppercase">
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

      {/* MAIN APPLICATION */}
      {user && !showSplash && (
        <div className="dashboard-enter flex flex-col w-full min-h-screen">
          {/* HEADER */}
          <header className="sticky top-0 z-30 bg-[#05080f]/80 backdrop-blur-xl border-b border-slate-800/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AppIcon className="w-10 h-10" />
                <div>
                  <h1 className="text-xl font-extrabold tracking-wider text-white">A.F.A.</h1>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Educational Financial Guidance</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="hidden sm:flex px-3 py-1 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  SFC Compliant Mode
                </span>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">{userProfile.name || user.email}</span>
                  <LogOut className="w-3.5 h-3.5 ml-1 text-slate-500" />
                </button>
              </div>
            </div>
          </header>

          {/* NAVIGATION */}
          <nav className="bg-[#090d16]/70 border-b border-slate-800/60 sticky top-[68px] z-20 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 flex space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'ledger', label: 'Dual Ledger', icon: Wallet },
                { id: 'report', label: 'Spending & Warnings', icon: Bell },
                { id: 'portfolio', label: 'Stock & Equity', icon: TrendingUp },
                { id: 'simulator', label: 'Wealth Simulator', icon: Sliders },
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
                    className={`flex items-center space-x-2 py-3.5 px-4 border-b-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                      isActive 
                        ? 'border-[#00f2fe] text-[#00f2fe] bg-[#00f2fe]/10' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00f2fe]' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* MAIN CONTENT */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 anim-slide-in">
                
                {/* ACTIVE WARNINGS BANNER */}
                {systemAlerts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-cyan-400 animate-bounce" />
                      <h3 className="text-xs font-mono uppercase text-cyan-400 tracking-wider">Automated Warning System & Targets</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {systemAlerts.map((alert, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border flex items-start gap-3 backdrop-blur-md ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                          <div>
                            <h4 className="font-bold text-sm">{alert.title}</h4>
                            <p className="text-xs mt-0.5 opacity-90">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TRI-RING FINANCIAL HEALTH & MATRIX INDEX GAUGE */}
                <div className="bg-gradient-to-br from-slate-900/90 via-[#0b0f19] to-slate-950 p-6 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    
                    <div className="space-y-3 max-w-md">
                      <div className="flex items-center gap-2 text-xs font-mono text-blue-400 tracking-wider uppercase">
                        <Target className="w-4 h-4" /> Goal: {userProfile.goal || 'General Growth'}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white">
                        Wealth Index: <span className="text-[#00f2fe]">{healthScore}</span><span className="text-slate-500 text-lg">/100</span>
                      </h2>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Evaluated against the <span className="text-slate-200 font-semibold">50/30/20 Rule</span> and Hong Kong housing burden thresholds. Target: <span className="text-cyan-400 font-bold">HK$ {Number(userProfile.targetAmount || 0).toLocaleString()}</span>.
                      </p>
                      
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
                          Savings: {savingsRatio.toFixed(1)}% (Target: 20%)
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono">
                          Investment Velocity: {investmentRatio.toFixed(1)}%
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono">
                          Rent Shield: {rentBurdenRatio.toFixed(1)}% (Max: 35%)
                        </span>
                      </div>
                    </div>

                    <div className="relative flex items-center justify-center w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                        <circle cx="60" cy="60" r="50" stroke="#10b981" strokeWidth="6" strokeDasharray={314} strokeDashoffset={314 - (314 * Math.min(savingsRatio, 100)) / 100} strokeLinecap="round" fill="transparent" />
                        
                        <circle cx="60" cy="60" r="40" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                        <circle cx="60" cy="60" r="40" stroke="#00f2fe" strokeWidth="6" strokeDasharray={251} strokeDashoffset={251 - (251 * Math.min(investmentRatio * 2, 100)) / 100} strokeLinecap="round" fill="transparent" />
                        
                        <circle cx="60" cy="60" r="30" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                        <circle cx="60" cy="60" r="30" stroke="#f59e0b" strokeWidth="6" strokeDasharray={188} strokeDashoffset={188 - (188 * Math.min(rentBurdenRatio * 2, 100)) / 100} strokeLinecap="round" fill="transparent" />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-white">{healthScore}</span>
                        <span className="text-[9px] font-mono uppercase text-slate-400">Score</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* TOP METRICS SUMMARY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Weekly Spent</span>
                    <div className="text-2xl font-black text-white mt-1">HK$ {weeklySpentTotal.toLocaleString()}</div>
                    <span className="text-[10px] text-cyan-400 mt-1 block">Max Target: HK$ {Number(userProfile.weeklyMaxSpend).toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Flagged Outliers</span>
                    <div className="text-2xl font-black text-rose-400 mt-1">{anomalyAnalysis.anomalies.length} Transactions</div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Exceeding baseline std. dev.</span>
                  </div>
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Live Equity Assets</span>
                    <div className="text-2xl font-black text-blue-400 mt-1">HK$ {portfolioTotalValue.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Net Surplus</span>
                    <div className={`text-2xl font-black mt-1 ${netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      HK$ {netSavings.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* CASH FLOW BAR CHART */}
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Cash Allocation Matrix</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Income', amount: totalIncome, fill: '#10b981' },
                        { name: 'Expenses', amount: totalExpense, fill: '#f43f5e' },
                        { name: 'Investments', amount: totalInvestmentDeposits, fill: '#00f2fe' },
                        { name: 'Surplus', amount: Math.max(0, netSavings), fill: '#3b82f6' },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                        <YAxis stroke="#64748b" tickLine={false} />
                        <Tooltip cursor={{fill: '#1e293b', opacity: 0.4}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} formatter={(val) => [`HK$ ${val.toLocaleString()}`, 'Amount']} />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}

            {/* DUAL LEDGER TAB (INTEGRATED WITH AUDIT & VISUAL CHARTS) */}
            {activeTab === 'ledger' && (
              <div className="space-y-6 anim-slide-in">
                {/* Header & Main Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-cyan-400" /> Integrated Dual Ledger & Audit Center
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Real-time transaction tracking combined with category diagnostics and anomaly alerts.</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintPdfReport}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Download className="w-4 h-4" /> Export Report (PDF)
                    </button>
                    <button 
                      onClick={() => setShowAddTxModal(true)}
                      className="bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      <Plus className="w-4 h-4" /> Add Record
                    </button>
                  </div>
                </div>

                {/* System Warning & Target Banner inside Ledger */}
                {systemAlerts.length > 0 && (
                  <div className="space-y-2">
                    {systemAlerts.map((alert, idx) => (
                      <div key={idx} className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs backdrop-blur-md ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span><strong>{alert.title}:</strong> {alert.message}</span>
                        </div>
                        <button onClick={() => setActiveTab('report')} className="underline font-bold text-[10px] uppercase cursor-pointer shrink-0 ml-2">Adjust Limits</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visual Category & Spending Breakdown Graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Category Breakdown Pie Chart */}
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center">
                    <h3 className="text-xs font-mono uppercase text-slate-400 self-start mb-2">Category Distribution</h3>
                    <div className="h-56 w-full relative">
                      {categoryBreakdown.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">No expense data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {categoryBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0.4)" />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} formatter={(val) => [`HK$ ${val.toLocaleString()}`, 'Amount']} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Category Spending Progress Bars */}
                  <div className="lg:col-span-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-3 flex flex-col justify-center">
                    <h3 className="text-xs font-mono uppercase text-slate-400">Expense Ranking & Category Shares</h3>
                    {categoryBreakdown.length === 0 ? (
                      <div className="text-xs text-slate-500 font-mono py-8 text-center">Add transactions to visualize category metrics.</div>
                    ) : (
                      <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 no-scrollbar">
                        {categoryBreakdown.map(cat => (
                          <div key={cat.name} className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-white font-semibold flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.fill }}></span>
                                {cat.name}
                              </span>
                              <span className="text-slate-400">HK$ {cat.value.toLocaleString()} ({cat.percentage}%)</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%`, backgroundColor: cat.fill }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-mono uppercase text-cyan-300">Transaction History Log</span>
                    <span className="text-[10px] text-slate-500 font-mono">{transactions.length} Records</span>
                  </div>

                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono">
                      <tr>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Description</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4 text-right">Amount (HKD)</th>
                        <th className="py-3.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-xs text-slate-500">No transactions recorded yet. Click "Add Record" to start logging cash flows.</td>
                        </tr>
                      )}
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{tx.date}</td>
                          <td className="py-3.5 px-4 font-semibold text-white">{tx.description}</td>
                          <td className="py-3.5 px-4">
                            <span 
                              className="px-2.5 py-1 rounded-md text-xs font-mono text-slate-200 border border-slate-700/60"
                              style={{ backgroundColor: `${CATEGORY_COLORS[tx.category] || '#334155'}20` }}
                            >
                              {tx.category}
                            </span>
                          </td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {tx.type === 'income' ? '+' : '-'} HK$ {Number(tx.amount).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SPENDING & WARNINGS REPORT TAB */}
            {activeTab === 'report' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-cyan-400" /> Comprehensive Anomaly & Target Audit
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">Detects high-value expense outliers, frequent micro-spending, and budget thresholds.</p>
                    </div>

                    <button
                      onClick={handlePrintPdfReport}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
                    >
                      <Download className="w-4 h-4" /> Download Report (PDF)
                    </button>
                  </div>

                  {systemAlerts.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-xs font-mono uppercase text-cyan-400">System Detected Warnings & Alerts</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {systemAlerts.map((alert, idx) => (
                          <div key={idx} className={`p-4 rounded-2xl border flex items-start gap-3 ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                              <h4 className="font-bold text-sm">{alert.title}</h4>
                              <p className="text-xs mt-0.5 opacity-90">{alert.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> All spending is within normal target parameters! No active anomalies detected.
                    </div>
                  )}

                  {anomalyAnalysis.anomalies.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-mono uppercase text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> High-Value Expense Outliers
                      </h3>
                      <div className="space-y-2">
                        {anomalyAnalysis.anomalies.map(a => (
                          <div key={a.id || a.description} className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-white block">{a.description}</span>
                              <span className="text-slate-400 text-[10px]">{a.date} • Category: {a.category}</span>
                            </div>
                            <span className="font-mono font-bold text-rose-400 text-sm">HK$ {Number(a.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <h3 className="text-xs font-mono uppercase text-cyan-300 flex items-center gap-2">
                        <Sliders className="w-4 h-4" /> Interactive Target Adjuster
                      </h3>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1.5 font-mono">Max Allowed Weekly Spending (HKD)</label>
                        <input 
                          type="number" 
                          value={userProfile.weeklyMaxSpend} 
                          onChange={e => handleUpdateTargets(e.target.value, userProfile.weeklyMinSavings)} 
                          className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white font-mono" 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1.5 font-mono">Min Weekly Savings Target (HKD)</label>
                        <input 
                          type="number" 
                          value={userProfile.weeklyMinSavings} 
                          onChange={e => handleUpdateTargets(userProfile.weeklyMaxSpend, e.target.value)} 
                          className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white font-mono" 
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">Targets auto-save and update system alerts real-time.</p>
                    </div>

                    <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <h3 className="text-xs font-mono uppercase text-cyan-300 flex items-center gap-2">
                        <Compass className="w-4 h-4" /> Pattern & Frequency Breakdown
                      </h3>
                      <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800">
                        <span className="text-slate-400">Total Outflow Analyzed:</span>
                        <span className="font-bold text-white font-mono">HK$ {anomalyAnalysis.totalSpent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800">
                        <span className="text-slate-400">Historical Average Expense / Tx:</span>
                        <span className="font-bold text-cyan-400 font-mono">HK$ {anomalyAnalysis.meanAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs py-2">
                        <span className="text-slate-400">Weekend Expenditure Ratio:</span>
                        <span className="font-bold text-amber-400 font-mono">{anomalyAnalysis.weekendRatio}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STOCK PORTFOLIO TAB */}
            {activeTab === 'portfolio' && (
              <div className="space-y-6 anim-slide-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Total Market Valuation (HKD)</span>
                    <div className="text-2xl font-black text-white mt-1">HK$ {portfolioTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Cost Basis (HKD)</span>
                    <div className="text-2xl font-black text-slate-300 mt-1">HK$ {portfolioTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <span className="text-xs font-mono uppercase text-slate-400">Unrealized P&L</span>
                    <div className={`text-2xl font-black mt-1 ${portfolioUnrealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {portfolioUnrealizedGain >= 0 ? '+' : ''}HK$ {portfolioUnrealizedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({portfolioGainPercent}%)
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400"/> Equity & Fund Holdings</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {lastMarketSyncTime ? `Live market synced at ${lastMarketSyncTime} (FX USD/HKD = 7.82)` : 'Live stock price feed active'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSyncMarketPrices}
                      disabled={isSyncingMarket}
                      className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMarket ? 'animate-spin text-cyan-400' : ''}`} />
                      <span>{isSyncingMarket ? 'Syncing...' : 'Sync Market Prices'}</span>
                    </button>

                    <button onClick={() => setShowAddStockModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer">
                      <Plus className="w-4 h-4" /> Add Asset
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono">
                      <tr>
                        <th className="py-3.5 px-4">Symbol</th>
                        <th className="py-3.5 px-4 text-right">Shares</th>
                        <th className="py-3.5 px-4 text-right">Avg Cost</th>
                        <th className="py-3.5 px-4 text-right">Live Price</th>
                        <th className="py-3.5 px-4 text-right">Market Value (HKD)</th>
                        <th className="py-3.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {portfolio.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-xs text-slate-500">No assets in portfolio. Click "Add Asset" to track TSLA, AAPL, NVDA, 2800.HK, or 0700.HK.</td>
                        </tr>
                      )}
                      {portfolio.map(item => {
                        const currency = item.currency || (item.symbol.endsWith('.HK') ? 'HKD' : 'USD');
                        const rate = currency === 'USD' ? DEFAULT_USD_HKD_RATE : 1;
                        const valueInHkd = item.shares * item.currentPrice * rate;
                        const gainPercent = item.buyPrice > 0 ? (((item.currentPrice - item.buyPrice) / item.buyPrice) * 100).toFixed(2) : '0.00';
                        const isPositive = Number(gainPercent) >= 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40">
                            <td className="py-3.5 px-4 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <span>{item.symbol}</span>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">{currency}</span>
                              </div>
                              <span className="block text-xs font-normal text-slate-400 mt-0.5">{item.name}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono">{item.shares}</td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                              {currency === 'USD' ? '$' : 'HK$'}{item.buyPrice.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-white">
                              <div className="flex items-center justify-end gap-1">
                                <span>{currency === 'USD' ? '$' : 'HK$'}{item.currentPrice.toFixed(2)}</span>
                                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                              </div>
                              <span className={`text-[10px] block font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{gainPercent}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                              HK$ {valueInHkd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button onClick={() => handleDeleteStock(item.id)} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* LIVE MARKET & MACRO FINANCIAL NEWS INTELLIGENCE BLOCK */}
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80 space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Newspaper className="w-5 h-5 text-cyan-400" /> Live Market & Macro Financial News Intelligence
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Real-time market catalysts, central bank signals, and economic developments affecting equity valuations.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                        Updated {lastNewsSyncTime}
                      </span>
                      <button 
                        onClick={handleRefreshNews}
                        disabled={isSyncingNews}
                        className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNews ? 'animate-spin text-cyan-400' : ''}`} />
                        <span>{isSyncingNews ? 'Syncing...' : 'Sync Feed'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-start gap-3">
                      <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest block font-semibold">Rate Outlook</span>
                        <h4 className="text-xs font-bold text-white mt-0.5">Global Central Banks Maintain Data-Driven Rate Path</h4>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-start gap-3">
                      <Activity className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-semibold">Tech & Semiconductors</span>
                        <h4 className="text-xs font-bold text-white mt-0.5">AI Capex Expansion Accelerates Hyperscaler Earnings</h4>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-start gap-3">
                      <Globe className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block font-semibold">Greater China Market</span>
                        <h4 className="text-xs font-bold text-white mt-0.5">HK Market Liquidity Boosted by Fiscal Measures</h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                      {['All', 'Central Bank & Rates', 'Tech & AI', 'Macro Economy', 'Energy & Commodities'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setNewsCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all cursor-pointer ${
                            newsCategory === cat 
                              ? 'bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/50 font-bold' 
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          value={newsSearch}
                          onChange={e => setNewsSearch(e.target.value)}
                          placeholder="Search headlines or tickers..."
                          className="w-full pl-9 pr-4 py-2 glass-input rounded-xl text-xs text-white"
                        />
                      </div>

                      <button
                        onClick={() => setFilterByHoldingsOnly(!filterByHoldingsOnly)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-2 border transition-all cursor-pointer whitespace-nowrap ${
                          filterByHoldingsOnly
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filter Portfolio Assets</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredNews.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                        No financial headlines matching current search parameters or portfolio tags.
                      </div>
                    ) : (
                      filteredNews.map(item => (
                        <div 
                          key={item.id} 
                          className="p-4 bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl transition-all space-y-2.5 group"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                item.impact === 'High' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                item.impact === 'Positive' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                item.impact === 'Warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}>
                                {item.impact}
                              </span>
                              <span className="text-[11px] font-mono text-cyan-400">{item.source}</span>
                              <span className="text-[10px] text-slate-500">• {item.time}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.symbols.map(sym => (
                                <span key={sym} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                                  ${sym}
                                </span>
                              ))}
                            </div>
                          </div>

                          <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center justify-between gap-2">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
                              <span>{item.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500 inline shrink-0" />
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

            {/* WEALTH SIMULATOR TAB */}
            {activeTab === 'simulator' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
                  <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-blue-400" /> Compound Wealth Trajectory Simulator
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Uses standard Time Value of Money (TVM) monthly compounding: <span className="text-blue-400 font-bold">HK$ {Number(userProfile.targetAmount || 0).toLocaleString()}</span> goal.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-5 bg-slate-950 p-5 rounded-2xl border border-slate-800/80">
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Initial Capital</span>
                          <span className="text-blue-400 font-bold">HK$ {simInitial.toLocaleString()}</span>
                        </label>
                        <input type="range" min="0" max="500000" step="10000" value={simInitial} onChange={e => setSimInitial(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Monthly Deposit</span>
                          <span className="text-blue-400 font-bold">HK$ {simMonthly.toLocaleString()}</span>
                        </label>
                        <input type="range" min="1000" max="50000" step="1000" value={simMonthly} onChange={e => setSimMonthly(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Expected Return</span>
                          <span className="text-blue-400 font-bold">{simRate}% / year</span>
                        </label>
                        <input type="range" min="1" max="15" step="0.5" value={simRate} onChange={e => setSimRate(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 flex justify-between mb-2">
                          <span>Time Horizon</span>
                          <span className="text-blue-400 font-bold">{simYears} Years</span>
                        </label>
                        <input type="range" min="1" max="30" step="1" value={simYears} onChange={e => setSimYears(Number(e.target.value))} className="w-full accent-[#00f2fe]" />
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={simulationTrajectory}>
                            <defs>
                              <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                            <XAxis dataKey="year" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} formatter={(val) => [`HK$ ${val.toLocaleString()}`, 'Value']} />
                            <Area type="monotone" dataKey="balance" stroke="#00f2fe" strokeWidth={3} fillOpacity={1} fill="url(#colorBal)" name="Portfolio Value" />
                            <Area type="monotone" dataKey="invested" stroke="#64748b" strokeDasharray="4 4" strokeWidth={2} fillOpacity={0} name="Total Principal" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-400">Projected Value at Year {simYears}:</span>
                        <span className="text-xl font-bold text-cyan-400">
                          HK$ {simulationTrajectory[simulationTrajectory.length - 1]?.balance.toLocaleString()}
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
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
                  <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-rose-400" /> Debt Repayment Optimizer (Snowball vs. Avalanche)
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Analyze credit card debt or personal loans to optimize interest expenditure.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800/80">
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Total Unsecured Debt (HKD)</label>
                        <input type="number" value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">APR Interest Rate (%)</label>
                        <input type="number" step="0.5" value={debtRate} onChange={e => setDebtRate(Number(e.target.value))} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Monthly Repayment Allocation (HKD)</label>
                        <input type="number" value={debtMinPay} onChange={e => setDebtMinPay(Number(e.target.value))} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Payoff Strategy</label>
                        <select value={debtStrategy} onChange={e => setDebtStrategy(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white [&>option]:bg-slate-900">
                          <option value="avalanche">Avalanche (Mathematically Highest Interest Savings)</option>
                          <option value="snowball">Snowball (Psychological Momentum)</option>
                        </select>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Estimated Debt Free Time</span>
                          <div className="text-2xl font-bold text-emerald-400 mt-1">{debtPayoffTrajectory.totalMonths} Months</div>
                        </div>
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">Total Interest Cost</span>
                          <div className="text-2xl font-bold text-rose-400 mt-1">HK$ {debtPayoffTrajectory.totalInterest.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={debtPayoffTrajectory.trajectory}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
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
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
                  <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <PiggyBank className="w-5 h-5 text-indigo-400" /> Mandatory Provident Fund (MPF) & Tax Savings (TVC)
                  </h2>
                  <p className="text-xs text-slate-400 mb-6">Calculate HK MPF statutory contributions and Tax-Deductible Voluntary Contributions (TVC) benefits.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800/80">
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Monthly Employment Income (HKD)</label>
                        <input type="number" value={mpfIncome} onChange={e => setMpfIncome(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-300 block mb-1.5">Monthly TVC Voluntary Contribution (HKD)</label>
                        <input type="number" value={tvcMonthly} onChange={e => setTvcMonthly(e.target.value)} className="w-full px-4 py-2.5 glass-input rounded-xl text-sm text-white" />
                      </div>
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                        <strong>DIS Guidance:</strong> The Default Investment Strategy (Core Accumulation Fund vs Age 50+ De-risking) provides a low-cost, automated global option for young employees.
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-xs text-slate-400 font-mono block">Mandatory Monthly Employee Contribution</span>
                          <span className="text-xs text-slate-500">(5% up to HK$1,500 max cap)</span>
                        </div>
                        <span className="text-xl font-bold text-white">HK$ {mpfCalc.mandatory.toLocaleString()}</span>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-xs text-slate-400 font-mono block">Annual TVC Tax Deductible Total</span>
                          <span className="text-xs text-slate-500">(Cap: HK$ 60,000 / year)</span>
                        </div>
                        <span className="text-xl font-bold text-indigo-400">HK$ {mpfCalc.annualTvc.toLocaleString()}</span>
                      </div>

                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-xs text-emerald-400 font-mono block">Estimated Annual Salaries Tax Savings</span>
                          <span className="text-xs text-emerald-500/80">(Based on standard marginal tax tier)</span>
                        </div>
                        <span className="text-2xl font-black text-emerald-400">HK$ {mpfCalc.estimatedTaxSaved.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI CHAT TAB */}
            {activeTab === 'advisor' && (
              <div className="h-[75vh] flex flex-col bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden anim-slide-in">
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
                  <Bot className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-sm text-white">A.F.A. AI Advisor</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Tailored for {userProfile.name} • Goal: {userProfile.goal}</p>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#070b12]">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-[#00f2fe] text-slate-950 font-semibold' : 'bg-slate-900 border border-slate-800 text-slate-200'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isLoadingAi && <div className="text-xs text-slate-500 font-mono italic">A.F.A AI is analyzing...</div>}
                </div>

                <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                  <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask about HK tax deductions, market news, or spending..." className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-[#00f2fe]" />
                  <button type="submit" className="bg-[#00f2fe] hover:bg-cyan-400 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                    <Send className="w-4 h-4" /> Send
                  </button>
                </form>
              </div>
            )}

            {/* AI DIAGNOSTIC TAB */}
            {activeTab === 'diagnostic' && (
              <div className="space-y-6 anim-slide-in">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
                  <h2 className="text-lg font-bold text-white mb-4">AI Financial Health Diagnostic</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-xs font-mono text-slate-400">Savings Ratio (50/30/20)</span>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">{savingsRatio.toFixed(1)}%</div>
                      <p className="text-xs text-slate-400 mt-2">Target benchmark is 20%+.</p>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-xs font-mono text-slate-400">Rent Burden Threshold</span>
                      <div className="text-2xl font-bold text-amber-400 mt-1">{rentBurdenRatio.toFixed(1)}%</div>
                      <p className="text-xs text-slate-400 mt-2">Maximum benchmark is 35%.</p>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-xs font-mono text-slate-400">Tax Optimization Cap</span>
                      <div className="text-2xl font-bold text-indigo-400 mt-1">HK$ 60,000 Cap</div>
                      <p className="text-xs text-slate-400 mt-2">Consider TVC tax deductions.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MANDATORY REGULATORY FOOTER DISCLAIMER */}
            <footer className="mt-8 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-500 font-mono leading-relaxed text-center">
              <p><strong>Regulatory Compliance Disclaimer:</strong> A.F.A. (Automated Financial Advisor) is an educational tool designed for financial literacy, debt modeling, and budgeting habit formation in Hong Kong. It does not provide regulated investment advice, securities recommendations, or discretionary portfolio management under the Securities and Futures Ordinance (SFO). All market quotes are provided for educational tracking.</p>
            </footer>

          </main>
        </div>
      )}

      {/* MODALS WITH GLASSMORPHISM */}
      {showAddTxModal && (
        <div className="fixed inset-0 z-50 bg-[#05080f]/60 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full relative">
            <h3 className="text-lg font-black tracking-widest uppercase text-white mb-6">Log Transaction</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <input type="text" required placeholder="Description" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white" />
              <input type="number" required placeholder="Amount (HKD)" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white" />
              <input type="date" required value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" />
              <select value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white [&>option]:bg-slate-900">
                <option value="Salary">Salary</option>
                <option value="Dining">Dining</option>
                <option value="Shopping">Shopping</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Rent">Rent</option>
                <option value="Transport">Transport</option>
                <option value="Investment">Investment Deposit</option>
              </select>
              <select value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white [&>option]:bg-slate-900">
                <option value="expense">Expense / Outflow</option>
                <option value="income">Income / Inflow</option>
              </select>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddTxModal(false)} className="px-5 py-2.5 text-xs text-slate-300 bg-white/5 rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-black uppercase bg-gradient-to-r from-[#00f2fe] to-[#4facfe] text-slate-950 rounded-xl cursor-pointer">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddStockModal && (
        <div className="fixed inset-0 z-50 bg-[#05080f]/60 backdrop-blur-md flex items-center justify-center p-4 anim-slide-in">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full relative">
            <h3 className="text-lg font-black tracking-widest uppercase text-white mb-2">Add Equity Asset</h3>
            <p className="text-xs text-slate-400 mb-6">Enter ticker (e.g., TSLA, AAPL, NVDA, 2800.HK, 0700.HK) for live price auto-fetch.</p>

            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-cyan-300 uppercase tracking-widest mb-1">Ticker Symbol</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g., TSLA or 2800.HK" 
                    value={newStock.symbol} 
                    onChange={e => setNewStock({ ...newStock, symbol: e.target.value })} 
                    className="flex-1 px-4 py-3 glass-input rounded-xl text-sm text-white uppercase font-mono" 
                  />
                  <button 
                    type="button" 
                    onClick={() => handleLookupTicker(newStock.symbol)} 
                    disabled={isSearchingTicker || !newStock.symbol}
                    className="px-4 py-3 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSearchingTicker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                    <span>Lookup</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Asset / Company Name</label>
                <input type="text" placeholder="e.g. Tesla Inc." value={newStock.name} onChange={e => setNewStock({ ...newStock, name: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white" />
              </div>

              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Shares Count</label>
                  <input type="number" step="any" required placeholder="Shares" value={newStock.shares} onChange={e => setNewStock({ ...newStock, shares: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" />
                </div>
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Currency Tier</label>
                  <select value={newStock.currency} onChange={e => setNewStock({ ...newStock, currency: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono [&>option]:bg-slate-900">
                    <option value="HKD">HKD ($)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Buy Price ({newStock.currency})</label>
                  <input type="number" step="0.01" required placeholder="Buy Price" value={newStock.buyPrice} onChange={e => setNewStock({ ...newStock, buyPrice: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" />
                </div>
                <div className="w-1/2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Live Price ({newStock.currency})</label>
                  <input type="number" step="0.01" placeholder="Current Price" value={newStock.currentPrice} onChange={e => setNewStock({ ...newStock, currentPrice: e.target.value })} className="w-full px-4 py-3 glass-input rounded-xl text-sm text-white font-mono" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddStockModal(false)} className="px-5 py-2.5 text-xs text-slate-300 bg-white/5 rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-xs font-black uppercase bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer">Save Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}