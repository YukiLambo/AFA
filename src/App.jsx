import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, Wallet, TrendingUp, Bot, FileText, Plus, Trash2, 
  ArrowUpRight, ArrowDownRight, Sparkles, Send, PieChart as PieIcon, 
  BarChart3, DollarSign, RefreshCw 
} from 'lucide-react';

const initialTransactions = [
  { id: '1', date: '2026-10-25', description: 'Salary (Tech Firm)', category: 'Salary', amount: 32000, type: 'income' },
  { id: '2', date: '2026-10-24', description: 'Rent (Kennedy Town Studio)', category: 'Rent', amount: 11500, type: 'expense' },
  { id: '3', date: '2026-10-23', description: 'Octopus Auto-add', category: 'Transport', amount: 500, type: 'expense' },
  { id: '4', date: '2026-10-22', description: 'TamJai SamGor Lunch', category: 'Dining', amount: 68, type: 'expense' },
  { id: '5', date: '2026-10-20', description: 'HKTVmall Grocery', category: 'Shopping', amount: 480, type: 'expense' },
  { id: '6', date: '2026-10-18', description: 'Monthly MPF Auto Contribution', category: 'MPF', amount: 1500, type: 'expense' },
  { id: '7', date: '2026-10-15', description: 'Deposit to Interactive Brokers', category: 'Investment', amount: 6000, type: 'expense' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions] = useState(initialTransactions);

  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense' && t.category !== 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const totalInvestmentDeposits = useMemo(() => transactions.filter(t => t.category === 'Investment').reduce((sum, t) => sum + Number(t.amount), 0), [transactions]);
  const netSavings = totalIncome - totalExpense - totalInvestmentDeposits;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 text-white p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">A.F.A - Automated Financial Advisor</h1>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">HKD Engine Active</span>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex space-x-6 px-4">
          {['dashboard', 'ledger', 'portfolio', 'advisor'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 capitalize text-sm font-semibold border-b-2 ${activeTab === tab ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl w-full mx-auto p-6 flex-1">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Income</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">HK$ {totalIncome.toLocaleString()}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Expenses</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">HK$ {totalExpense.toLocaleString()}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-semibold uppercase">Monthly Investment</span>
                <div className="text-2xl font-extrabold text-indigo-600 mt-1">HK$ {totalInvestmentDeposits.toLocaleString()}</div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-semibold uppercase">Net Cash Flow</span>
                <div className={`text-2xl font-extrabold mt-1 ${netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>HK$ {netSavings.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
