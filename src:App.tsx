import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Wallet, TrendingUp, Bot, FileText, Plus, Trash2, 
  Sparkles, Send, ShieldCheck, AlertCircle, User, LogOut, Sliders, Target, Compass, Edit3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  // Check if a user is logged in via localStorage
  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    return localStorage.getItem('afa_active_user') || '';
  });

  // Controls whether the registration/onboarding wizard is open
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  // Blank user profile template
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    goal: 'HK Property Down Payment',
    riskTolerance: 'Moderate Growth (Balanced ETFs & Tech)',
    targetAmount: 500000,
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [portfolio, setPortfolio] = useState([]);

  // Splash screen timeout
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Load user-specific data from localStorage whenever active user changes
  useEffect(() => {
    if (currentUserEmail) {
      const savedProfile = localStorage.getItem(`afa_profile_${currentUserEmail}`);
      const savedTx = localStorage.getItem(`afa_tx_${currentUserEmail}`);
      const savedPort = localStorage.getItem(`afa_port_${currentUserEmail}`);

      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      }
      if (savedTx) {
        setTransactions(JSON.parse(savedTx));
      } else {
        setTransactions([
          { id: '1', date: '2026-10-25', description: 'Initial Salary', category: 'Salary', amount: 30000, type: 'income' }
        ]);
      }
      if (savedPort) {
        setPortfolio(JSON.parse(savedPort));
      } else {
        setPortfolio([
          { id: '1', symbol: '2800.HK', name: 'Tracker Fund of Hong Kong', shares: 200, buyPrice: 19.00, currentPrice: 20.20, category: 'ETF', yield: 3.4 }
        ]);
      }
    }
  }, [currentUserEmail]);

  // Sync data changes to localStorage keyed by user email
  useEffect(() => {
    if (currentUserEmail) {
      localStorage.setItem(`afa_tx_${currentUserEmail}`, JSON.stringify(transactions));
    }
  }, [transactions, currentUserEmail]);

  useEffect(() => {
    if (currentUserEmail) {
      localStorage.setItem(`afa_port_${currentUserEmail}`, JSON.stringify(portfolio));
    }
  }, [portfolio, currentUserEmail]);

  const handleFinishOnboarding = () => {
    if (!userProfile.name || !userProfile.email) return;
    const cleanEmail = userProfile.email.toLowerCase().trim();

    localStorage.setItem(`afa_profile_${cleanEmail}`, JSON.stringify(userProfile));
    localStorage.setItem('afa_active_user', cleanEmail);

    setCurrentUserEmail(cleanEmail);
    setIsRegistering(false);
    setIsEditingProfile(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('afa_active_user');
    setCurrentUserEmail('');
    setUserProfile({ name: '', email: '', goal: 'HK Property Down Payment', riskTolerance: 'Moderate Growth', targetAmount: 500000 });
    setOnboardingStep(1);
  };

  // Calculations
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense' && t.category !== 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalInvestmentDeposits = useMemo(() => transactions.filter(t => t.category === 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const netSavings = totalIncome - totalExpense - totalInvestmentDeposits;

  const savingsRatio = useMemo(() => totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0, [totalIncome, netSavings]);
  const rentExpense = useMemo(() => transactions.find(t => t.category === 'Rent')?.amount || 0, [transactions]);
  const rentBurdenRatio = useMemo(() => totalIncome > 0 ? ((rentExpense / totalIncome) * 100) : 0, [totalIncome, rentExpense]);
  const investmentRatio = useMemo(() => totalIncome > 0 ? ((totalInvestmentDeposits / totalIncome) * 100) : 0, [totalIncome, totalInvestmentDeposits]);

  const healthScore = useMemo(() => {
    let score = 50;
    if (savingsRatio >= 20) score += 20;
    else if (savingsRatio >= 10) score += 10;
    if (rentBurdenRatio <= 35) score += 20;
    if (investmentRatio >= 15) score += 10;
    return Math.min(100, Math.max(0, score));
  }, [savingsRatio, rentBurdenRatio, investmentRatio]);

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      
      {showSplash && (
        <div className="fixed inset-0 z-50 bg-[#070b12] flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-indigo-600 flex items-center justify-center text-slate-950 font-black animate-pulse shadow-xl shadow-emerald-500/30 mb-4">
            <Compass className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-3xl font-black tracking-widest text-white">A.F.A.</h1>
          <p className="text-xs text-slate-400 font-mono tracking-widest mt-2 uppercase">Multi-User Onboarding Engine</p>
        </div>
      )}

      {/* REGISTRATION & LOGIN GATE */}
      {(!currentUserEmail || isRegistering || isEditingProfile) && !showSplash && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-400 to-indigo-600 flex items-center justify-center text-slate-950 font-bold">
                  <Compass className="w-4 h-4 text-slate-950" />
                </div>
                <h2 className="text-lg font-black text-white">
                  {isRegistering || isEditingProfile ? 'Tailor-Make User Profile' : 'A.F.A. Account Access'}
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                {isRegistering || isEditingProfile ? `Step ${onboardingStep} of 3` : 'Login'}
              </span>
            </div>

            {!isRegistering && !isEditingProfile ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your email address to log into your account or register a brand-new profile instantly.
                </p>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Your Email Address</label>
                  <input 
                    type="email" 
                    id="userEmailBox"
                    placeholder="e.g. natalie@hkbu.edu.hk"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button 
                  onClick={() => {
                    const inputEl = document.getElementById('userEmailBox');
                    const val = inputEl ? inputEl.value.toLowerCase().trim() : '';
                    if (val) {
                      const existing = localStorage.getItem(`afa_profile_${val}`);
                      if (existing) {
                        localStorage.setItem('afa_active_user', val);
                        setCurrentUserEmail(val);
                      } else {
                        setUserProfile(prev => ({ ...prev, email: val }));
                        setOnboardingStep(1);
                        setIsRegistering(true);
                      }
                    }
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Continue to Profile 🚀
                </button>
              </div>
            ) : (
              <div>
                {onboardingStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Step 1: Personal Details</p>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Full Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Natalie Cheung"
                        value={userProfile.name}
                        onChange={e => setUserProfile({...userProfile, name: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Email Address</label>
                      <input 
                        type="email" 
                        disabled={!isRegistering && isEditingProfile}
                        value={userProfile.email}
                        onChange={e => setUserProfile({...userProfile, email: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                      />
                    </div>
                    <button 
                      disabled={!userProfile.name}
                      onClick={() => userProfile.name && setOnboardingStep(2)}
                      className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider ${userProfile.name ? 'bg-emerald-500 text-slate-950 cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    >
                      Next: Financial Goal
                    </button>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Step 2: Wealth Milestone</p>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Target Objective</label>
                      <select 
                        value={userProfile.goal}
                        onChange={e => setUserProfile({...userProfile, goal: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="HK Property Down Payment">HK Property Down Payment</option>
                        <option value="Early Retirement (FIRE)">Early Retirement (FIRE)</option>
                        <option value="High-Yield Dividend Cash Flow">High-Yield Dividend Cash Flow</option>
                        <option value="General Wealth Accumulation">General Wealth Accumulation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Target Amount (HKD)</label>
                      <input 
                        type="number" 
                        value={userProfile.targetAmount}
                        onChange={e => setUserProfile({...userProfile, targetAmount: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setOnboardingStep(1)} className="w-1/3 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold uppercase cursor-pointer">Back</button>
                      <button onClick={() => setOnboardingStep(3)} className="w-2/3 bg-emerald-500 text-slate-950 py-3 rounded-xl text-xs font-bold uppercase cursor-pointer">Next: Risk Appetite</button>
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">Step 3: Risk Profile</p>
                    <div className="space-y-2">
                      {[
                        'Conservative (Tracker Funds & Bonds)', 
                        'Moderate Growth (Balanced ETFs & Tech)', 
                        'Aggressive Growth (High-Beta Equities)'
                      ].map(risk => (
                        <button 
                          key={risk} 
                          onClick={() => setUserProfile({...userProfile, riskTolerance: risk})} 
                          className={`w-full p-3.5 rounded-xl border text-left text-xs font-medium cursor-pointer transition-all ${userProfile.riskTolerance === risk ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300'}`}
                        >
                          {risk}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button onClick={() => setOnboardingStep(2)} className="w-1/3 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold uppercase cursor-pointer">Back</button>
                      <button 
                        onClick={handleFinishOnboarding}
                        className="w-2/3 bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 py-3 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-500/20"
                      >
                        {isEditingProfile ? 'Save Profile Changes 💾' : 'Launch My Dashboard 🚀'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 bg-[#070b12]/80 backdrop-blur-xl border-b border-slate-800/85">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-400 to-indigo-600 flex items-center justify-center text-slate-950 font-black">
              <Compass className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-wider text-white">A.F.A.</h1>
              <p className="text-[10px] text-slate-400 font-mono">Multi-User Financial Platform</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => { setOnboardingStep(1); setIsEditingProfile(true); }}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs text-emerald-400 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </button>
            <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {userProfile.name || currentUserEmail}
            </span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs text-rose-400 cursor-pointer">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD VIEW */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-gradient-to-br from-slate-900/90 via-[#0b0f19] to-slate-950 p-6 rounded-3xl border border-slate-800/80 shadow-2xl">
          <h2 className="text-2xl font-black text-white">Welcome back, {userProfile.name || 'User'}!</h2>
          <p className="text-xs text-slate-400 mt-1">Goal: <span className="text-emerald-400 font-bold">{userProfile.goal}</span> (Target: HK$ {Number(userProfile.targetAmount || 0).toLocaleString()})</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">Health Score: {healthScore}/100</span>
            <span className="px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono">Risk Profile: {userProfile.riskTolerance}</span>
          </div>
        </div>
      </main>

    </div>
  );
}