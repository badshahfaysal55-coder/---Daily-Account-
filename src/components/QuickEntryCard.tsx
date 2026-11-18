import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Plus, 
  Smartphone, 
  Laptop, 
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Crown
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { UserProfile, Transaction } from '../types/accounting';
import { DEFAULT_CATEGORIES, formatCurrency, getCurrencySymbol } from '../utils/formatters';
import { t } from '../utils/translations';
import confetti from 'canvas-confetti';

interface QuickEntryCardProps {
  user: UserProfile;
  onTransactionAdded: (tx: Transaction) => void;
}

export const QuickEntryCard: React.FC<QuickEntryCardProps> = ({
  user,
  onTransactionAdded,
}) => {
  const currentLang = user.language;
  const isBn = currentLang === 'bn';

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saveStatus, setSaveStatus] = useState<string>(t('saveStatusAllSaved', currentLang));
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);
  
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState<string>('other');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [notes, setNotes] = useState('');
  const [viewAsMobilePhone, setViewAsMobilePhone] = useState(false);

  // Load draft on mount
  useEffect(() => {
    const draft = StorageService.getLocalDraft();
    if (draft.description || draft.amount) {
      setDescription(draft.description || '');
      setAmount(draft.amount || '');
      if (draft.category) setCategory(draft.category);
      if (draft.type) setType(draft.type);
    }
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!amount && !description) {
      setSaveStatus(t('saveStatusAllSaved', currentLang));
      return;
    }

    setSaveStatus(t('saveStatusSaving', currentLang));

    StorageService.setLocalDraft({
      description,
      amount,
      category,
      type,
    });

    const timer = setTimeout(async () => {
      try {
        await StorageService.syncToFirestore(
          user.userId,
          {
            description,
            amount: Number(amount) || 0,
            type,
            category,
          },
          user.isSimulatedOffline
        );

        setSaveStatus(t('saveStatusCloudSaved', currentLang));
        setLastSavedTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (error) {
        console.error('Cloud Sync Error: ', error);
        setSaveStatus(t('saveStatusFailed', currentLang));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [description, amount, type, category, user.userId, user.isSimulatedOffline, currentLang]);

  const handleAddToLedger = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return;
    }

    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      userId: user.userId,
      workspaceUserId: user.userId,
      description: description.trim() || (type === 'expense' ? (isBn ? 'দৈনিক খরচ' : 'Corporate Expense') : (isBn ? 'দৈনিক জমা' : 'Corporate Revenue')),
      amount: numAmount,
      type,
      category,
      paymentMethod,
      timestamp: Date.now(),
      syncedToCloud: !user.isSimulatedOffline,
      notes: notes.trim() || undefined,
    };

    onTransactionAdded(newTx);

    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#D4AF37', '#101A2C', '#F5D77F'],
      });
    } catch {
      // ignore
    }

    setDescription('');
    setAmount('');
    setNotes('');
    StorageService.setLocalDraft({ description: '', amount: '' });
    setSaveStatus(isBn ? 'খতিয়ানে সংরক্ষিত হয়েছে ✓' : 'Recorded to Ledger ✓');
  };

  const quickPresets = [
    { label: isBn ? 'অফিস নাস্তা ও আপ্যায়ন' : 'Office Refreshments', num: 350, cat: 'dining', type: 'expense' as const },
    { label: isBn ? 'যাতায়াত ও সিএনজি ভাড়া' : 'Transport & Logistics', num: 180, cat: 'transport', type: 'expense' as const },
    { label: isBn ? 'বিদ্যুৎ ও ক্লাউড বিল' : 'Utilities & Server Cloud', num: 2800, cat: 'bills', type: 'expense' as const },
    { label: isBn ? 'কাস্টমার পেমেন্ট কালেকশন' : 'Customer Sales Inflow', num: 15000, cat: 'business', type: 'income' as const },
    { label: isBn ? 'মাসিক কর্পোরেট ফান্ড' : 'Corporate Reserve Deposit', num: 50000, cat: 'investment', type: 'income' as const },
  ];

  const applyPreset = (preset: typeof quickPresets[0]) => {
    setDescription(preset.label);
    setAmount(preset.num.toString());
    setCategory(preset.cat);
    setType(preset.type);
  };

  const currentCategories = DEFAULT_CATEGORIES.filter((c) => c.type === type);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Device frame switcher */}
      <div className="w-full max-w-xl flex items-center justify-between mb-3 px-1 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 font-bold font-heading text-slate-800 dark:text-slate-200">
          <Crown className="w-4 h-4 text-amber-500" />
          <span>{isBn ? 'ইনপুট স্ক্রিন প্রিভিউ:' : 'Input Layout View:'}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl">
          <button
            onClick={() => setViewAsMobilePhone(false)}
            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition ${
              !viewAsMobilePhone ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>{isBn ? 'ডেস্কটপ কার্ড' : 'Executive Card'}</span>
          </button>
          <button
            onClick={() => setViewAsMobilePhone(true)}
            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition ${
              viewAsMobilePhone ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isBn ? 'মোবাইল ফ্রেম' : 'Mobile Frame'}</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div 
        className={`w-full transition-all duration-300 ${
          viewAsMobilePhone 
            ? 'max-w-[400px] border-8 border-slate-900 dark:border-slate-800 rounded-[40px] p-4 shadow-2xl bg-white dark:bg-[#101A2C] relative overflow-hidden ring-1 ring-amber-500/20 my-2' 
            : 'max-w-xl bg-white dark:bg-[#101A2C] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 transition-colors'
        }`}
      >
        {viewAsMobilePhone && (
          <div className="flex flex-col items-center mb-3">
            <div className="w-24 h-4 bg-slate-900 rounded-b-xl flex items-center justify-center">
              <div className="w-10 h-1 bg-slate-700 rounded-full"></div>
            </div>
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 px-2 pt-1">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <span className="text-amber-500">100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Screen Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
              {t('entryScreenTitle', currentLang)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('entrySubtitle', currentLang)}
            </p>
          </div>

          <span className="text-[11px] font-mono bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/60 font-bold">
            {user.userId}
          </span>
        </div>

        {/* Expense vs Income Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setType('expense');
              setCategory('bazaar');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>{t('debit', currentLang)}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('income');
              setCategory('business');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              type === 'income'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{t('credit', currentLang)}</span>
          </button>
        </div>

        {/* Inputs */}
        <form onSubmit={handleAddToLedger} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('descriptionLabel', currentLang)}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('descriptionPlaceholder', currentLang)}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
              />
              {description && (
                <button
                  type="button"
                  onClick={() => setDescription('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('amountLabel', currentLang)}
              </label>
              {amount && !isNaN(Number(amount)) && (
                <span className="text-xs font-black font-mono text-amber-600 dark:text-amber-400">
                  {formatCurrency(Number(amount), user.currency, user.useBanglaNumerals)}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-2.5 text-amber-600 dark:text-amber-400 font-black text-base pointer-events-none">
                {getCurrencySymbol(user.currency)}
              </div>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder={t('amountPlaceholder', currentLang)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('categoryLabel', currentLang)}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {currentCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border transition cursor-pointer ${
                    category === cat.id
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-900 dark:border-amber-500 font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{isBn ? cat.nameBn : cat.nameEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { id: 'cash', labelBn: 'নগদ ক্যাশ', labelEn: 'Cash', icon: '💵' },
              { id: 'bkash', labelBn: 'বিকাশ', labelEn: 'bKash', icon: '🌸' },
              { id: 'nagad', labelBn: 'নগদ', labelEn: 'Nagad', icon: '🟠' },
              { id: 'bank', labelBn: 'ব্যাংক / কার্ড', labelEn: 'Bank Card', icon: '💳' },
            ].map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPaymentMethod(pm.id as any)}
                className={`py-1.5 px-1 rounded-lg text-[11px] text-center border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  paymentMethod === pm.id
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-400 font-bold'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>{pm.icon}</span>
                <span className="truncate">{isBn ? pm.labelBn : pm.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Auto-Save Status Banner */}
          <div className="rounded-xl p-3 border transition-all duration-200 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {saveStatus.includes('Saving') || saveStatus.includes('সেভ হচ্ছে') ? (
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              ) : saveStatus.includes('failed') || saveStatus.includes('ব্যর্থ') ? (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {saveStatus}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Cloud Workspace: {user.userId}
                </p>
              </div>
            </div>

            {lastSavedTimestamp && (
              <span className="text-[10px] font-mono text-slate-400">
                {lastSavedTimestamp}
              </span>
            )}
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) <= 0}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer ${
                !amount || parseFloat(amount) <= 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : type === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white shadow-amber-600/20'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{t('addEntryButton', currentLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDescription('');
                setAmount('');
                setNotes('');
                StorageService.setLocalDraft({ description: '', amount: '' });
                setSaveStatus(t('clearDraftButton', currentLang));
              }}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={t('clearDraftButton', currentLang)}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Quick Presets */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 font-heading">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('quickPresetsTitle', currentLang)}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-xs bg-slate-50 dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-300 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 transition cursor-pointer font-medium"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
