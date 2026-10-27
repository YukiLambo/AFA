import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  Bot, 
  FileText, 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Send, 
  PieChart as PieIcon, 
  BarChart3, 
  DollarSign, 
  AlertCircle,
  TrendingDown,
  RefreshCw,
  Building2,
  Bus,
  Utensils,
  ShoppingBag,
  Briefcase,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  Legend 
} from 'recharts';

// Initial Mock Transactions for HK Context
const initialTransactions = [
  { id: '1', date: '2026-10-25', description: 'Salary (Tech Firm)', category: 'Salary', amount: 32000, type: 'income' },
  { id: '2', date: '2026-10-24', description: 'Rent (Kennedy Town Studio)', category: 'Rent', amount: 11500, type: 'expense' },
  { id: '3', date: '2026-10-23', description: 'Octopus Auto-add (MTR & Light Rail)', category: 'Transport', amount: 500, type: 'expense' },
  { id: '4', date: '2026-10-22', description: 'TamJai SamGor Lunch', category: 'Dining', amount: 68, type: 'expense' },
  { id: '5', date: '2026-10-20', description: 'HKTVmall Grocery', category: 'Shopping', amount: 480, type: 'expense' },
  { id: '6', date: '2026-10-18', description: 'Monthly MPF Auto Contribution', category: 'MPF', amount: 1500, type: 'expense' },
  { id: '7', date: '2026-10-15', description: 'Deposit to Interactive Brokers', category: 'Investment', amount: 6000, type: 'expense' },
];

// Initial Equities & Portfolio Items
const initialPortfolio = [
  { id: '1', symbol: '2800.HK', name: 'Tracker Fund of Hong Kong', shares: 1000, buyPrice: 18.50, currentPrice: 20.20, category: 'ETF' },
  { id: '2', symbol: '0700.HK', name: 'Tencent Holdings Ltd.', shares: 100, buyPrice: 310.00, currentPrice: 385.40, category: 'Tech' },
  { id: '3', symbol: 'VOO', name: 'Vanguard S&P 500 ETF (US)', shares: 15, buyPrice: 420.00, currentPrice: 512.00, category: 'US Equity' },
  { id: '4', symbol: '0005.HK', name: 'HSBC Holdings plc', shares: 800, buyPrice: 62.00, currentPrice: 68.80, category: 'Finance' },
];

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState(initialTransactions);
  const [portfolio, setPortfolio] = useState(initialPortfolio);

  // New Transaction Form State
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [newTx, setNewTx] = useState({
    description: '',
    amount: '',
    category: 'Dining',
    type: 'expense',
    date: new Date().toISOString().split('T')[0]
  });

  // New Stock Form State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStock, setNewStock] = useState({
    symbol: '',
    name: '',
    shares: '',
    buyPrice: '',
    currentPrice: '',
    category: 'HK Equity'
  });

  // AI Chat Assistant State
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'model',
      text: "Hello! I am your A.F.A. AI Financial Assistant. I can analyze your HKD cash flow, tax incentives (TVC/MPF), housing rent burden, and stock investment strategy. How can I help you today?"
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Computed Financial Totals
  const totalIncome = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  const totalExpense = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && t.category !== 'Investment')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  const totalInvestmentDeposits = useMemo(() => {
    return transactions
      .filter(t => t.category === 'Investment')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  const netSavings = totalIncome - totalExpense - totalInvestmentDeposits;

  // Portfolio Computations
  const portfolioTotalValue = useMemo(() => {
    return portfolio.reduce((sum, item) => sum + (item.shares * item.currentPrice), 0);
  }, [portfolio]);

  const portfolioTotalCost = useMemo(() => {
    return portfolio.reduce((sum, item) => sum + (item.shares * item.buyPrice), 0);
  }, [portfolio]);

  const portfolioUnrealizedGain = portfolioTotalValue - portfolioTotalCost;
  const portfolioGainPercent = portfolioTotalCost > 0 
    ? ((portfolioUnrealizedGain / portfolioTotalCost) * 100).toFixed(2)
    : '0.00';

  // Category Breakdown for Recharts Pie
  const categoryData = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return Object.keys(map).map(cat => ({
      name: cat,
      value: map[cat]
    }));
  }, [transactions]);

  // Handle Adding New Transaction
  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!newTx.description || !newTx.amount) return;

    const created = {
      id: Date.now().toString(),
      description: newTx.description,
      amount: parseFloat(newTx.amount),
      category: newTx.category,
      type: newTx.type,
      date: newTx.date
    };

    setTransactions([created, ...transactions]);
    setShowAddTxModal(false);
    setNewTx({
      description: '',
      amount: '',
      category: 'Dining',
      type: 'expense',
      date: new Date().toISOString().split('T')[0]
    });
  };

  // Handle Deleting Transaction
  const handleDeleteTransaction = (id) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // Handle Adding New Stock
  const handleAddStock = (e) => {
    e.preventDefault();
    if (!newStock.symbol || !newStock.shares || !newStock.buyPrice) return;

    const created = {
      id: Date.now().toString(),
      symbol: newStock.symbol.toUpperCase(),
      name: newStock.name || newStock.symbol.toUpperCase(),
      shares: parseFloat(newStock.shares),
      buyPrice: parseFloat(newStock.buyPrice),
      currentPrice: parseFloat(newStock.currentPrice || newStock.buyPrice),
      category: newStock.category
    };

    setPortfolio([...portfolio, created]);
    setShowAddStockModal(false);
    setNewStock({
      symbol: '',
      name: '',
      shares: '',
      buyPrice: '',
      currentPrice: '',
      category: 'HK Equity'
    });
  };

  // Handle Deleting Stock
  const handleDeleteStock = (id) => {
    setPortfolio(portfolio.filter(item => item.id !== id));
  };

  // AI Chat Request using Gemini API
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoadingAi) return;

    const userMsg = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoadingAi(true);

    try {
      const systemPrompt = `You are A.F.A (Automated Financial Advisor), a financial planner specializing in Hong Kong young adults.
      Current User Context:
      - Monthly Income: HK$ ${totalIncome}
      - Total Monthly Expense: HK$ ${totalExpense}
      - Monthly Investment Transfer: HK$ ${totalInvestmentDeposits}
      - Stock Portfolio Value: HK$ ${portfolioTotalValue} (Unrealized Gain: HK$ ${portfolioUnrealizedGain})
      Provide concise, highly practical advice tailored to Hong Kong living expenses (MPF, Salaries tax deductions like TVC, rent burden, and saving goals).`;

      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${userMsg}` }]
          }
        ]
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, I could not analyze your prompt right now. Please try again.";

      setChatMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      console.error("Gemini API Error:", err);
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        text: "I am having trouble connecting to the advisory server. Please check your network or try again shortly." 
      }]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 via-teal-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
              A
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-wider">
                A.F.A
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">Automated Financial Advisor for HK Young Adults</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              HKD Engine Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-14 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 sm:space-x-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'ledger', label: 'Dual Ledger', icon: Wallet },
            { id: 'portfolio', label: 'Stock & Equity', icon: TrendingUp },
            { id: 'advisor', label: 'A.F.A. AI Chat', icon: Bot },
            { id: 'report', label: 'AI Audit & Financial Health', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive 
                    ? 'border-emerald-600 text-emerald-700 font-semibold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Viewport Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ================= 1. DASHBOARD TAB ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Monthly Income</span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">HK$ {totalIncome.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">Gross salary + side hustle</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900">HK$ {totalExpense.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">Rent, Octopus, Dining, Shopping</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Monthly Investment</span>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-indigo-600">HK$ {totalInvestmentDeposits.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">Stock brokerages & voluntary deposits</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Net Monthly Cash Flow</span>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className={`text-2xl font-extrabold ${netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  HK$ {netSavings.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">Net remaining liquid savings</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly Overview Bar Chart */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Cash Flow Overview</h3>
                    <p className="text-xs text-slate-500">Income vs. Expense vs. Investment allocation</p>
                  </div>
                  <BarChart3 className="w-5 h-5 text-slate-400" />
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Income', amount: totalIncome, fill: '#10B981' },
                      { name: 'Expenses', amount: totalExpense, fill: '#F43F5E' },
                      { name: 'Investments', amount: totalInvestmentDeposits, fill: '#6366F1' },
                      { name: 'Net Cash', amount: Math.max(0, netSavings), fill: '#3B82F6' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tickLine={false} />
                      <YAxis tickLine={false} />
                      <Tooltip formatter={(value) => [`HK$ ${value.toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Spending Breakdown Pie Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-900">Expense Allocation</h3>
                    <PieIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="h-52 w-full">
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => [`HK$ ${val.toLocaleString()}`, 'Spent']} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-slate-400">
                        No expense items recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Legends */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {categoryData.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center space-x-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-slate-600 truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. DUAL LEDGER TAB ================= */}
        {activeTab === 'ledger' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" /> Dual Ledger & Quick Entry
                </h2>
                <p className="text-xs text-slate-500">Log income, HK rent, Octopus transit, MPF and investment transfers instantly.</p>
              </div>
              <button 
                onClick={() => setShowAddTxModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Transaction
              </button>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Amount (HKD)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-500">{tx.date}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">{tx.description}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            tx.type === 'income' 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : tx.category === 'Investment'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {tx.type === 'income' ? 'Income' : tx.category === 'Investment' ? 'Investment' : 'Expense'}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 text-right font-bold ${
                          tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'} HK$ {Number(tx.amount).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button 
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. STOCK & EQUITY PORTFOLIO TAB ================= */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header and Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-400 uppercase">Portfolio Market Value</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  HK$ {portfolioTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-400 uppercase">Total Cost Basis</span>
                <div className="text-2xl font-black text-slate-700 mt-1">
                  HK$ {portfolioTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-400 uppercase">Unrealized P&L</span>
                <div className={`text-2xl font-black mt-1 ${portfolioUnrealizedGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {portfolioUnrealizedGain >= 0 ? '+' : ''}HK$ {portfolioUnrealizedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({portfolioGainPercent}%)
                </div>
              </div>
            </div>

            {/* Holdings Bar & Add Stock Button */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="font-bold text-slate-900">Equity & Fund Holdings</h3>
                <p className="text-xs text-slate-500">Track HKEX stocks, US ETFs, and MPF equity allocations.</p>
              </div>
              <button
                onClick={() => setShowAddStockModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Asset
              </button>
            </div>

            {/* Stock List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="py-3 px-4">Symbol / Name</th>
                      <th className="py-3 px-4">Asset Class</th>
                      <th className="py-3 px-4 text-right">Shares</th>
                      <th className="py-3 px-4 text-right">Avg Cost</th>
                      <th className="py-3 px-4 text-right">Current Price</th>
                      <th className="py-3 px-4 text-right">Total Value (HKD)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {portfolio.map((item) => {
                      const itemVal = item.shares * item.currentPrice;
                      const itemCost = item.shares * item.buyPrice;
                      const gain = itemVal - itemCost;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {item.symbol}
                            <span className="block text-xs font-normal text-slate-500">{item.name}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium">{item.shares}</td>
                          <td className="py-3.5 px-4 text-right text-slate-600">${item.buyPrice.toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-900">${item.currentPrice.toFixed(2)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            HK$ {itemVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className={`block text-xs font-medium ${gain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteStock(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. A.F.A. AI CHAT TAB ================= */}
        {activeTab === 'advisor' && (
          <div className="h-[75vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
            {/* Chat Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">A.F.A. AI Advisor</h3>
                  <p className="text-xs text-slate-400">Grounded in HK economics, tax rules & investments</p>
                </div>
              </div>
            </div>

            {/* Chat Message Box */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isLoadingAi && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-500 flex items-center space-x-2 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Analyzing HK cash flow & investment model...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Ask about saving on HK rent, TVC tax deductions, MPF or HK/US stock strategy..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={isLoadingAi || !userInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}

        {/* ================= 5. AI AUDIT & FINANCIAL HEALTH TAB ================= */}
        {activeTab === 'report' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-emerald-600" /> AI Audit & Financial Health Assessment
              </h2>
              <p className="text-xs text-slate-500 mb-6">Automated AI health check and future projections based on income, rent burden, MPF allocation, and savings rate.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-xs font-semibold text-emerald-700 uppercase">Savings Ratio</div>
                  <div className="text-2xl font-bold text-emerald-900 mt-1">
                    {totalIncome > 0 ? (((totalIncome - totalExpense - totalInvestmentDeposits) / totalIncome) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-xs text-emerald-700 mt-2">Target benchmark is 20%+. Healthy financial buffer!</p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="text-xs font-semibold text-amber-700 uppercase">Rent Burden Ratio</div>
                  <div className="text-2xl font-bold text-amber-900 mt-1">
                    {totalIncome > 0 ? (((transactions.find(t => t.category === 'Rent')?.amount || 0) / totalIncome) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-xs text-amber-700 mt-2">Recommended maximum is 35% of gross monthly income.</p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="text-xs font-semibold text-blue-700 uppercase">Tax Optimization (TVC)</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">HK$ 60,000 Cap</div>
                  <p className="text-xs text-blue-700 mt-2">Consider Tax-Deductible Voluntary Contributions to save up to HK$10,200/year on Salaries Tax.</p>
                </div>
              </div>

              {/* Wealth Simulation Projection */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> 10-Year Wealth Growth Simulation
                </h3>
                <p className="text-xs text-slate-500 mb-4">Assuming current monthly investment deposits (HK$ {totalInvestmentDeposits}) at an average 6.5% annual compound return.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-400 font-semibold uppercase">3-Year Projected Value</span>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      HK$ {Math.round((portfolioTotalValue + totalInvestmentDeposits * 12 * 3) * 1.15).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-400 font-semibold uppercase">5-Year Projected Value</span>
                    <p className="text-lg font-bold text-slate-900 mt-1">
                      HK$ {Math.round((portfolioTotalValue + totalInvestmentDeposits * 12 * 5) * 1.30).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-400 font-semibold uppercase">10-Year Projected Value</span>
                    <p className="text-lg font-bold text-emerald-700 mt-1">
                      HK$ {Math.round((portfolioTotalValue + totalInvestmentDeposits * 12 * 10) * 1.80).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD TRANSACTION */}
      {showAddTxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Transaction</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., MTR Monthly Pass"
                  value={newTx.description}
                  onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (HKD)</label>
                  <input
                    type="number"
                    required
                    placeholder="500"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                  <select
                    value={newTx.type}
                    onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={newTx.category}
                    onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Dining">Dining</option>
                    <option value="Rent">Rent</option>
                    <option value="Transport">Transport</option>
                    <option value="Shopping">Shopping</option>
                    <option value="MPF">MPF</option>
                    <option value="Investment">Investment</option>
                    <option value="Salary">Salary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={newTx.date}
                    onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STOCK */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Equity / Asset</h3>
            <form onSubmit={handleAddStock} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ticker / Symbol</label>
                  <input
                    type="text"
                    required
                    placeholder="2800.HK / VOO"
                    value={newStock.symbol}
                    onChange={(e) => setNewStock({ ...newStock, symbol: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Asset Name</label>
                  <input
                    type="text"
                    placeholder="Tracker Fund"
                    value={newStock.name}
                    onChange={(e) => setNewStock({ ...newStock, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Shares</label>
                  <input
                    type="number"
                    required
                    placeholder="500"
                    value={newStock.shares}
                    onChange={(e) => setNewStock({ ...newStock, shares: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Buy Price</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="18.50"
                    value={newStock.buyPrice}
                    onChange={(e) => setNewStock({ ...newStock, buyPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Current</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="20.00"
                    value={newStock.currentPrice}
                    onChange={(e) => setNewStock({ ...newStock, currentPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Class / Category</label>
                <select
                  value={newStock.category}
                  onChange={(e) => setNewStock({ ...newStock, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                >
                  <option value="HK Equity">HK Equity</option>
                  <option value="US Equity">US Equity</option>
                  <option value="ETF">ETF</option>
                  <option value="Tech">Tech</option>
                  <option value="Finance">Finance</option>
                  <option value="MPF Fund">MPF Fund</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}