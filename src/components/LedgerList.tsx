import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Edit3, 
  Printer, 
  Check, 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  FileSpreadsheet, 
  Calendar 
} from 'lucide-react';
import { Transaction, UserProfile, Category } from '../types/accounting';
import { 
  formatCurrency, 
  formatDateBangla, 
  formatDateEn, 
  DEFAULT_CATEGORIES, 
  toBanglaDigits 
} from '../utils/formatters';
import { t } from '../utils/translations';

interface LedgerListProps {
  transactions: Transaction[];
  user: UserProfile;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  onPrintTransaction: (tx: Transaction) => void;
  onPrintAllLedger: () => void;
}

export const LedgerList: React.FC<LedgerListProps> = ({
  transactions,
  user,
  onUpdateTransaction,
  onDeleteTransaction,
  onPrintTransaction,
  onPrintAllLedger,
}) => {
  const currentLang = user.language;
  const isBn = currentLang === 'bn';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    DEFAULT_CATEGORIES.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedType !== 'all' && t.type !== selectedType) return false;
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const descMatch = t.description.toLowerCase().includes(query);
        const amountMatch = t.amount.toString().includes(query);
        const catObj = categoryMap.get(t.category);
        const catMatch = catObj ? (catObj.nameBn.includes(query) || catObj.nameEn.toLowerCase().includes(query)) : false;
        if (!descMatch && !amountMatch && !catMatch) return false;
      }
      return true;
    });
  }, [transactions, selectedType, selectedCategory, searchQuery, categoryMap]);

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditDesc(t.description);
    setEditAmount(t.amount.toString());
    setEditCategory(t.category);
  };

  const saveEdit = (id: string) => {
    const num = parseFloat(editAmount);
    if (!editDesc.trim() || isNaN(num) || num <= 0) return;
    onUpdateTransaction(id, {
      description: editDesc.trim(),
      amount: num,
      category: editCategory,
    });
    setEditingId(null);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'];
    const rows = transactions.map((t) => [
      t.id,
      new Date(t.timestamp).toISOString(),
      t.type,
      categoryMap.get(t.category)?.nameEn || t.category,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount,
      t.paymentMethod,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `zf_accounting_${user.userId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-[#101A2C] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden w-full max-w-6xl mx-auto transition-colors">
      {/* Header & Controls */}
      <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
              {t('ledgerTitle', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn 
                ? `মোট ${user.useBanglaNumerals ? toBanglaDigits(filtered.length) : filtered.length} টি লেনদেনের রেকর্ড দেখানো হচ্ছে` 
                : `Showing ${filtered.length} transaction records`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Download CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('exportCSV', currentLang)}</span>
            </button>

            <button
              onClick={onPrintAllLedger}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Print voucher or ledger report"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>{t('printLedger', currentLang)}</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={t('searchPlaceholder', currentLang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
            >
              <option value="all">{t('filterAllTypes', currentLang)}</option>
              <option value="expense">{t('filterExpenses', currentLang)}</option>
              <option value="income">{t('filterIncome', currentLang)}</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
            >
              <option value="all">{t('filterAllCategories', currentLang)}</option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {isBn ? cat.nameBn : cat.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table / List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {t('noTransactionsFound', currentLang)}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
          {filtered.map((t) => {
            const cat = categoryMap.get(t.category);
            const isEditing = editingId === t.id;

            return (
              <div
                key={t.id}
                className="p-3.5 md:px-6 hover:bg-slate-50/80 dark:hover:bg-slate-850 transition flex items-center justify-between gap-3 text-sm group"
              >
                {/* Left */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base shadow-xs ${
                      t.type === 'income' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    }`}
                  >
                    <span>{cat ? cat.icon : '📝'}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-1.5 py-1">
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none dark:bg-slate-900 dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-28 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg font-bold dark:bg-slate-900 dark:text-white"
                          />
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 dark:bg-slate-900 dark:text-white"
                          >
                            {DEFAULT_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.icon} {isBn ? c.nameBn : c.nameEn}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white truncate font-heading">
                            {t.description}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {cat ? (isBn ? cat.nameBn : cat.nameEn) : t.category}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded uppercase">
                            {t.paymentMethod}
                          </span>
                          {t.createdByName && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              by {t.createdByName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>{isBn ? formatDateBangla(t.timestamp) : formatDateEn(t.timestamp)}</span>
                          {t.notes && (
                            <>
                              <span>•</span>
                              <span className="italic text-slate-500 truncate">{t.notes}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div
                      className={`font-black text-base flex items-center justify-end gap-1 font-mono ${
                        t.type === 'income' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {t.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4 text-amber-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-rose-500" />
                      )}
                      <span>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount, user.currency, user.useBanglaNumerals)}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Cloud Synced ✓
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(t.id)}
                          className="p-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onPrintTransaction(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Voucher / Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEdit(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
