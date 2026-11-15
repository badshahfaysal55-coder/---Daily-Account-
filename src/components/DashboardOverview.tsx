import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  CreditCard,
  UserCheck,
  PlusCircle,
  Users,
  FileText,
  Printer,
  Search,
  Filter,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Clock,
  Edit2,
  Trash2,
  CloudCheck,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Transaction, UserProfile, UserAccount, Customer } from '../types/accounting';
import { formatCurrency, formatDateBangla, formatDateEn, DEFAULT_CATEGORIES } from '../utils/formatters';
import { t, Language } from '../utils/translations';
import { NavTabId } from './Sidebar';

interface DashboardOverviewProps {
  transactions: Transaction[];
  customers?: Customer[];
  user: UserProfile;
  currentUserAccount: UserAccount;
  currentLang: Language;
  onNavigateTab: (tab: NavTabId) => void;
  onQuickAddIncome: () => void;
  onQuickAddExpense: () => void;
  onPrintTransaction: (tx: Transaction) => void;
  onOpenReport: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  transactions,
  customers = [],
  user,
  currentUserAccount,
  currentLang,
  onNavigateTab,
  onQuickAddIncome,
  onQuickAddExpense,
  onPrintTransaction,
  onOpenReport,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const isBn = currentLang === 'bn';
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const [showRecentTransactions, setShowRecentTransactions] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zara_show_recent_transactions');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleRecentTransactions = () => {
    setShowRecentTransactions((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zara_show_recent_transactions', String(next));
      } catch {}
      return next;
    });
  };

  const [showAnalytics, setShowAnalytics] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('zara_show_income_expense_analytics');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleAnalytics = () => {
    setShowAnalytics((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zara_show_income_expense_analytics', String(next));
      } catch {}
      return next;
    });
  };

  // 1. Core Financial Aggregations & Transaction Averages (Computed exclusively from real records)
  const incomeTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'income'),
    [transactions]
  );
  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'expense'),
    [transactions]
  );

  const totalIncome = useMemo(
    () => incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions]
  );

  const totalExpense = useMemo(
    () => expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions]
  );

  const totalBalance = totalIncome - totalExpense;
  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0';

  const incomeCount = incomeTransactions.length;
  const expenseCount = expenseTransactions.length;
  const totalTxCount = transactions.length;

  const avgIncome = incomeCount > 0 ? Math.round(totalIncome / incomeCount) : 0;
  const avgExpense = expenseCount > 0 ? Math.round(totalExpense / expenseCount) : 0;
  const avgNetPerTx = totalTxCount > 0 ? Math.round(totalBalance / totalTxCount) : 0;
  const avgVolumePerTx = totalTxCount > 0 ? Math.round((totalIncome + totalExpense) / totalTxCount) : 0;

  // 3. Category Breakdown for Expenses
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_CATEGORIES.forEach((c) => map.set(c.id, isBn ? c.nameBn : c.nameEn));
    return map;
  }, [isBn]);

  const categoryExpenses = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = t.category || 'other';
        map[cat] = (map[cat] || 0) + t.amount;
      });

    return Object.entries(map)
      .map(([cat, amount]) => ({
        cat,
        label: categoryMap.get(cat) || cat,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions, totalExpense, categoryMap]);

  // 4. Time Series Chart Data (Daily, Weekly, Monthly, Yearly)
  const chartData = useMemo(() => {
    const now = Date.now();
    const intervals: Array<{ label: string; income: number; expense: number }> = [];

    if (period === 'daily') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        const dayLabel = isBn
          ? ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'][d.getDay()]
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];

        const inc = transactions
          .filter((t) => t.timestamp >= dayStart && t.timestamp < dayEnd && t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const exp = transactions
          .filter((t) => t.timestamp >= dayStart && t.timestamp < dayEnd && t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        intervals.push({ label: dayLabel, income: inc, expense: exp });
      }
    } else if (period === 'weekly') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = now - (i + 1) * 7 * 86400000;
        const weekEnd = now - i * 7 * 86400000;
        const weekLabel = isBn ? `সপ্তাহ ${4 - i}` : `Wk ${4 - i}`;

        const inc = transactions
          .filter((t) => t.timestamp >= weekStart && t.timestamp < weekEnd && t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const exp = transactions
          .filter((t) => t.timestamp >= weekStart && t.timestamp < weekEnd && t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        intervals.push({ label: weekLabel, income: inc, expense: exp });
      }
    } else if (period === 'monthly') {
      // Last 6 months
      const monthNamesBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
      const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
        const mLabel = isBn ? monthNamesBn[d.getMonth()] : monthNamesEn[d.getMonth()];

        const inc = transactions
          .filter((t) => t.timestamp >= monthStart && t.timestamp < monthEnd && t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const exp = transactions
          .filter((t) => t.timestamp >= monthStart && t.timestamp < monthEnd && t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        intervals.push({ label: mLabel, income: inc, expense: exp });
      }
    } else {
      // Yearly (Last 3 years)
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 2; y <= currentYear; y++) {
        const yStart = new Date(y, 0, 1).getTime();
        const yEnd = new Date(y + 1, 0, 1).getTime();
        const yLabel = String(y);

        const inc = transactions
          .filter((t) => t.timestamp >= yStart && t.timestamp < yEnd && t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const exp = transactions
          .filter((t) => t.timestamp >= yStart && t.timestamp < yEnd && t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);

        intervals.push({ label: yLabel, income: inc, expense: exp });
      }
    }

    return intervals;
  }, [transactions, period, isBn]);

  const maxChartValue = useMemo(() => {
    let max = 1000;
    chartData.forEach((d) => {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    return max * 1.15;
  }, [chartData]);

  // 5. Recent Transactions Filtering
  const filteredRecentTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.paymentMethod.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [transactions, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: Top 3 Financial Summary KPI Cards (Totals + Averages) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Balance + Avg per Transaction */}
        <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-heading">
                {isBn ? 'মোট বর্তমান ব্যালেন্স' : 'Total Balance'}
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#D4AF37]">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${totalBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                {formatCurrency(totalBalance, user.currency, user.useBanglaNumerals)}
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center font-bold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                    {profitMargin}%
                  </span>
                  <span className="text-slate-400">
                    {isBn ? 'নেট মার্জিন' : 'Net Margin'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {totalTxCount} {isBn ? 'টি লেনদেন' : 'Total tx'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">{isBn ? 'গড় ব্যালেন্স/লেনদেন: ' : 'Avg Net / Tx: '}</span>
              <span className={`font-bold font-mono ${avgNetPerTx >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-rose-600'}`}>
                {formatCurrency(avgNetPerTx, user.currency, user.useBanglaNumerals)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400">{isBn ? 'গড় আকার: ' : 'Avg Tx: '}</span>
              <span className="font-bold font-mono text-amber-600 dark:text-[#D4AF37]">
                {formatCurrency(avgVolumePerTx, user.currency, user.useBanglaNumerals)}
              </span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Total Income + Avg Income */}
        <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-heading">
                {isBn ? 'সর্বমোট আয় (ক্রেডিট)' : 'Total Income'}
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                {formatCurrency(totalIncome, user.currency, user.useBanglaNumerals)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {incomeCount}
                </span>
                <span>{isBn ? 'টি ক্রেডিট লেনদেন' : 'Credit entries'}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400">
              {isBn ? 'গড় আয় (প্রতি লেনদেন)' : 'Avg per Income'}
            </span>
            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(avgIncome, user.currency, user.useBanglaNumerals)}
            </span>
          </div>
        </div>

        {/* Card 3: Total Expense + Avg Expense */}
        <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-heading">
                {isBn ? 'সর্বমোট ব্যয় (ডেবিট)' : 'Total Expense'}
              </span>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
                {formatCurrency(totalExpense, user.currency, user.useBanglaNumerals)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {expenseCount}
                </span>
                <span>{isBn ? 'টি ডেবিট লেনদেন' : 'Debit entries'}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400">
              {isBn ? 'গড় ব্যয় (প্রতি লেনদেন)' : 'Avg per Expense'}
            </span>
            <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
              {formatCurrency(avgExpense, user.currency, user.useBanglaNumerals)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: Quick Actions Bar */}
      <div className="bg-gradient-to-r from-[#172F4D] to-[#101A2C] rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="font-bold text-sm tracking-tight font-heading flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>{isBn ? 'দ্রুত অ্যাকশন ও লেনদেন' : 'Quick Actions & Accounting Operations'}</span>
            </span>
            <p className="text-xs text-slate-300 mt-0.5">
              {isBn ? 'এক ক্লিকেই নতুন হিসাব যোগ অথবা ইনভয়েস তৈরি করুন' : 'Instant transaction entry, customer CRM and invoice generation.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReport}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-white/10"
            >
              <Printer className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{isBn ? 'পূর্ণাঙ্গ রিপোর্ট প্রিন্ট' : 'Full Statement PDF'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onQuickAddIncome}
            className="p-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <PlusCircle className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <ArrowDownRight className="w-4 h-4 text-emerald-400/60" />
            </div>
            <div className="mt-3">
              <span className="font-bold text-xs text-white block">
                {isBn ? '+ আয় যোগ করুন' : '+ Add Income'}
              </span>
              <span className="text-[10px] text-emerald-200/70 block mt-0.5">
                {isBn ? 'বিক্রয়, কালেকশন' : 'Sales, collection'}
              </span>
            </div>
          </button>

          <button
            onClick={onQuickAddExpense}
            className="p-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <PlusCircle className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
              <ArrowUpRight className="w-4 h-4 text-rose-400/60" />
            </div>
            <div className="mt-3">
              <span className="font-bold text-xs text-white block">
                {isBn ? '+ ব্যয় যোগ করুন' : '+ Add Expense'}
              </span>
              <span className="text-[10px] text-rose-200/70 block mt-0.5">
                {isBn ? 'বাজার, বেতন, ইউটিলিটি' : 'Bills, payroll, supplies'}
              </span>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('customers')}
            className="p-3.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <Users className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-4 h-4 text-purple-400/60" />
            </div>
            <div className="mt-3">
              <span className="font-bold text-xs text-white block">
                {isBn ? '+ গ্রাহক বা ভেন্ডর' : '+ Add Customer'}
              </span>
              <span className="text-[10px] text-purple-200/70 block mt-0.5">
                {isBn ? 'বাকি খাতা ও লেজার' : 'CRM dues & balances'}
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              if (transactions.length > 0) {
                onPrintTransaction(transactions[0]);
              } else {
                onOpenReport();
              }
            }}
            className="p-3.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 text-[#D4AF37] text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <Receipt className="w-5 h-5 text-[#D4AF37] group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-4 h-4 text-[#D4AF37]/60" />
            </div>
            <div className="mt-3">
              <span className="font-bold text-xs text-white block">
                {isBn ? 'ইনভয়েস ও ভাউচার' : 'Generate Invoice'}
              </span>
              <span className="text-[10px] text-amber-200/70 block mt-0.5">
                {isBn ? 'গ্রাহক রসিদ ও চালান' : 'Instant corporate bill'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 4: Compact Interactive Income vs Expense Chart (Midnight Green Box) */}
      <div className="w-full">
        <div className="w-full bg-gradient-to-br from-[#022C22] via-[#043927] to-[#064E3B] text-white rounded-2xl p-3.5 sm:p-4 border border-emerald-700/60 shadow-md flex flex-col justify-between transition-all">
          <div>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${showAnalytics ? 'pb-2.5 border-b border-emerald-800/70' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-xs sm:text-sm font-heading flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                  <span>{isBn ? 'আয় ও ব্যয়ের গতিধারা অ্যানালিটিক্স' : 'Income vs Expense Analytics'}</span>
                </h3>
                {!showAnalytics && (
                  <span className="text-[10px] font-bold text-emerald-200 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-700/60">
                    {isBn ? 'লুকানো' : 'Hidden'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {showAnalytics && (
                  <div className="flex items-center gap-0.5 bg-[#01221A]/80 border border-emerald-800/70 p-0.5 rounded-lg">
                    {(['daily', 'weekly', 'monthly', 'yearly'] as AnalyticsPeriod[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer capitalize ${
                          period === p
                            ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-xs'
                            : 'text-emerald-100/80 hover:text-white'
                        }`}
                      >
                        {p === 'daily'
                          ? (isBn ? 'দৈনিক' : 'Daily')
                          : p === 'weekly'
                          ? (isBn ? 'সাপ্তাহিক' : 'Weekly')
                          : p === 'monthly'
                          ? (isBn ? 'মাসিক' : 'Monthly')
                          : (isBn ? 'বাৎসরিক' : 'Yearly')}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={toggleAnalytics}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#01221A]/80 text-emerald-100 hover:text-[#D4AF37] flex items-center gap-1 transition cursor-pointer border border-emerald-700/70 shadow-2xs"
                  title={showAnalytics ? (isBn ? 'অ্যানালিটিক্স হাইড করুন' : 'Hide Analytics') : (isBn ? 'অ্যানালিটিক্স দেখান' : 'Show Analytics')}
                >
                  {showAnalytics ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{isBn ? 'হাইড' : 'Hide'}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isBn ? 'দেখান' : 'Show'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {showAnalytics && (
              <>
                {/* Compact Legend & Period Stats */}
                <div className="flex items-center justify-between gap-3 py-2 text-[11px]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
                      <span className="text-emerald-100 font-medium">{isBn ? 'আয় (Income)' : 'Income'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 shrink-0" />
                      <span className="text-emerald-100 font-medium">{isBn ? 'ব্যয় (Expense)' : 'Expense'}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-200/80">
                    {isBn ? 'মোট রেকর্ড:' : 'Records:'} {transactions.length}
                  </span>
                </div>

                {/* Compact Bar Chart */}
                <div className="h-32 w-full pt-3 pb-1.5 flex items-end justify-between gap-2 sm:gap-4 border-t border-emerald-800/60">
                  {chartData.map((d, index) => {
                    const incHeight = maxChartValue > 0 ? Math.round((d.income / maxChartValue) * 86) : 0;
                    const expHeight = maxChartValue > 0 ? Math.round((d.expense / maxChartValue) * 86) : 0;

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-9 bg-slate-950 border border-emerald-700 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 font-mono shadow-md">
                          <div className="text-emerald-300">+{formatCurrency(d.income, user.currency, user.useBanglaNumerals)}</div>
                          <div className="text-rose-300">-{formatCurrency(d.expense, user.currency, user.useBanglaNumerals)}</div>
                        </div>

                        <div className="w-full flex items-end justify-center gap-1 h-24">
                          {/* Income Bar */}
                          <div
                            style={{ height: `${Math.max(incHeight, 3)}px` }}
                            className="w-full max-w-[16px] bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t transition-all duration-300 group-hover:brightness-110 shadow-xs"
                          />
                          {/* Expense Bar */}
                          <div
                            style={{ height: `${Math.max(expHeight, 3)}px` }}
                            className="w-full max-w-[16px] bg-gradient-to-t from-rose-500 to-rose-300 rounded-t transition-all duration-300 group-hover:brightness-110 shadow-xs"
                          />
                        </div>

                        <span className="text-[10px] font-mono text-emerald-200/85 mt-1.5 truncate max-w-full">
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: Recent Transactions with Search, Filter & Quick Actions */}
      <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs transition-all">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 ${showRecentTransactions ? 'pb-4 border-b border-slate-100 dark:border-slate-800' : ''}`}>
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base font-heading">
                  {isBn ? 'সাম্প্রতিক আর্থিক লেনদেন ও স্ট্যাটাস' : 'Recent Transactions & Payment Status'}
                </h3>
                {!showRecentTransactions && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {transactions.length} {isBn ? 'টি লেনদেন লুকানো' : 'entries hidden'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isBn ? 'রিয়েল-টাইম ক্লাউড ডাটাবেজ থেকে সরাসরি লোডকৃত' : 'Live entries synchronized with your secure cloud ledger.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Hide / Show Button */}
            <button
              onClick={toggleRecentTransactions}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700/80 shadow-2xs"
              title={showRecentTransactions ? (isBn ? 'হাইড করুন' : 'Hide Recent Transactions') : (isBn ? 'দেখান' : 'Show Recent Transactions')}
            >
              {showRecentTransactions ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{isBn ? 'হাইড করুন' : 'Hide'}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isBn ? 'দেখান' : 'Show'}</span>
                </>
              )}
            </button>

            {showRecentTransactions && (
              <>
                {/* Search & Filter Controls */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={isBn ? 'লেনদেন খুঁজুন...' : 'Search transactions...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-amber-400 focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      filterType === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isBn ? 'সব' : 'All'}
                  </button>
                  <button
                    onClick={() => setFilterType('income')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      filterType === 'income'
                        ? 'bg-emerald-500 text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500'
                    }`}
                  >
                    {isBn ? 'আয়' : 'Income'}
                  </button>
                  <button
                    onClick={() => setFilterType('expense')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      filterType === 'expense'
                        ? 'bg-rose-500 text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-rose-500'
                    }`}
                  >
                    {isBn ? 'ব্যয়' : 'Expense'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Transactions Table (Shown only when showRecentTransactions is true) */}
        {showRecentTransactions && (
          <>
            <div className="overflow-x-auto mt-2">
            {filteredRecentTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isBn ? 'কোন লেনদেন খুঁজে পাওয়া যায়নি' : 'No matching transactions recorded.'}
              </p>
              <button
                onClick={onQuickAddIncome}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isBn ? 'প্রথম এন্ট্রি যোগ করুন' : 'Log First Entry'}</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-2">{isBn ? 'তারিখ ও সময়' : 'Date & Time'}</th>
                  <th className="py-3 px-2">{isBn ? 'বিবরণ ও নোট' : 'Description & Notes'}</th>
                  <th className="py-3 px-2">{isBn ? 'ক্যাটাগরি' : 'Category'}</th>
                  <th className="py-3 px-2">{isBn ? 'মাধ্যম' : 'Payment Method'}</th>
                  <th className="py-3 px-2">{isBn ? 'স্ট্যাটাস' : 'Cloud Status'}</th>
                  <th className="py-3 px-2 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                  <th className="py-3 px-2 text-center">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors group"
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-2 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {isBn ? formatDateBangla(tx.timestamp) : formatDateEn(tx.timestamp)}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-2 max-w-xs">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">
                        {tx.description}
                      </span>
                      {tx.notes && (
                        <span className="text-[11px] text-slate-400 block truncate">
                          {tx.notes}
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {categoryMap.get(tx.category) || tx.category}
                    </td>

                    {/* Payment Method */}
                    <td className="py-3 px-2 whitespace-nowrap">
                      <span className="uppercase font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {tx.paymentMethod}
                      </span>
                    </td>

                    {/* Cloud Status */}
                    <td className="py-3 px-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Cloud Saved</span>
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <span
                        className={`font-black font-mono text-sm ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount, user.currency, user.useBanglaNumerals)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onPrintTransaction(tx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                          title={isBn ? 'ইনভয়েস বা ভাউচার প্রিন্ট' : 'Print Invoice'}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                          title={isBn ? 'সম্পাদনা' : 'Edit'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

          {/* View All Ledger link */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {isBn ? 'সর্বমোট রেকর্ড সংখ্যা:' : 'Total Ledger Records:'}{' '}
              <strong className="text-slate-800 dark:text-slate-200">{transactions.length}</strong>
            </span>
            <button
              onClick={() => onNavigateTab('ledger')}
              className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>{isBn ? 'সকল খতিয়ান দেখুন' : 'View Full Ledger Book'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
    </div>
  );
};
