import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Calendar, ShieldCheck } from 'lucide-react';
import { Transaction, UserProfile } from '../types/accounting';
import { formatCurrency, toBanglaDigits } from '../utils/formatters';
import { t, Language } from '../utils/translations';

interface StatsCardsProps {
  transactions: Transaction[];
  user: UserProfile;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ transactions, user }) => {
  const currentLang = user.language;
  const isBn = currentLang === 'bn';

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Today's stats
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter(
    (t) => new Date(t.timestamp).toDateString() === today
  );
  const todayExpense = todayTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-6xl mx-auto my-4">
      {/* Total Balance Card */}
      <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden transition-colors">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-bold font-heading">{t('netBalance', currentLang)}</span>
          <div className={`p-1.5 rounded-lg ${netBalance >= 0 ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-rose-50 text-rose-600'}`}>
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className={`text-xl font-black font-mono tracking-tight ${netBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
          {formatCurrency(netBalance, user.currency, user.useBanglaNumerals)}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {isBn ? 'হাতে নগদ ও ব্যাংক ব্যালেন্স' : 'Liquid Cash & Reserves'}
          </span>
        </div>
      </div>

      {/* Total Income Card */}
      <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-bold font-heading">{t('totalIncome', currentLang)}</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
          {formatCurrency(totalIncome, user.currency, user.useBanglaNumerals)}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          {isBn 
            ? `${user.useBanglaNumerals ? toBanglaDigits(transactions.filter(t => t.type === 'income').length) : transactions.filter(t => t.type === 'income').length} টি জমার রেকর্ড` 
            : `${transactions.filter(t => t.type === 'income').length} credit records`}
        </div>
      </div>

      {/* Total Expense Card */}
      <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-bold font-heading">{t('totalExpense', currentLang)}</span>
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
          {formatCurrency(totalExpense, user.currency, user.useBanglaNumerals)}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          {isBn 
            ? `${user.useBanglaNumerals ? toBanglaDigits(transactions.filter(t => t.type === 'expense').length) : transactions.filter(t => t.type === 'expense').length} টি খরচের রেকর্ড` 
            : `${transactions.filter(t => t.type === 'expense').length} debit records`}
        </div>
      </div>

      {/* Today's Expense Card */}
      <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
          <span className="text-xs font-bold font-heading">{t('todayExpense', currentLang)}</span>
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-black font-mono text-slate-800 dark:text-slate-200 tracking-tight">
          {formatCurrency(todayExpense, user.currency, user.useBanglaNumerals)}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          {isBn 
            ? `আজ মোট ${user.useBanglaNumerals ? toBanglaDigits(todayTransactions.length) : todayTransactions.length} টি লেনদেন` 
            : `${todayTransactions.length} transactions today`}
        </div>
      </div>
    </div>
  );
};
