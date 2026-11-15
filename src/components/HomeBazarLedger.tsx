import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Printer,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CreditCard,
  RefreshCw,
  User,
  Users,
  Tag,
  ShieldCheck,
  ChevronDown,
  Check,
  Percent,
  SlidersHorizontal
} from 'lucide-react';
import {
  HomeBazarEntry,
  HomeBazarCategory,
  HomeBazarSummary,
  BazarBuyer,
  BuyerSpendingSummary,
  UserAccount,
  GlobalAppSettings,
  CurrencyCode
} from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency, getCurrencySymbol } from '../utils/formatters';

interface HomeBazarLedgerProps {
  currentUser: UserAccount;
  globalSettings: GlobalAppSettings;
  currentLang: 'bn' | 'en';
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  onBackToInvoices?: () => void;
}

const CATEGORY_CONFIG: Record<
  HomeBazarCategory,
  { labelBn: string; labelEn: string; icon: string; color: string }
> = {
  fish_meat: {
    labelBn: 'মাছ ও মাংস',
    labelEn: 'Fish & Meat',
    icon: '🐟',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  },
  vegetables_fruits: {
    labelBn: 'শাক-সবজি ও ফলমূল',
    labelEn: 'Vegetables & Fruits',
    icon: '🥬',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
  groceries_staples: {
    labelBn: 'চাল, তেল ও মশলা',
    labelEn: 'Rice, Oil & Staples',
    icon: '🍚',
    color: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  dairy_bakery: {
    labelBn: 'দুধ, ডিম ও বেকারি',
    labelEn: 'Dairy, Eggs & Bakery',
    icon: '🥛',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  },
  cleaning_toiletries: {
    labelBn: 'সাবান ও গৃহস্থালি',
    labelEn: 'Toiletries & Cleaning',
    icon: '🧼',
    color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900',
  },
  snacks_beverages: {
    labelBn: 'চা, বিস্কুট ও নাস্তা',
    labelEn: 'Snacks & Tea',
    icon: '☕',
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
  },
  other: {
    labelBn: 'অন্যান্য মুদি বাজার',
    labelEn: 'Other Groceries',
    icon: '📦',
    color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export const HomeBazarLedger: React.FC<HomeBazarLedgerProps> = ({
  currentUser,
  globalSettings,
  currentLang,
  currency,
  useBanglaNumerals,
  onBackToInvoices,
}) => {
  const isBn = currentLang === 'bn';

  const [entries, setEntries] = useState<HomeBazarEntry[]>([]);
  const [buyers, setBuyers] = useState<BazarBuyer[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Real-time Auto-Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'idle'>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HomeBazarEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<HomeBazarEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudgetValue, setNewBudgetValue] = useState<number | ''>(0);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showBuyersModal, setShowBuyersModal] = useState(false);
  const [showBuyerBreakdown, setShowBuyerBreakdown] = useState(true);

  // New Buyer Form (Inside Manage Buyers Modal)
  const [newBuyerIdInput, setNewBuyerIdInput] = useState('');
  const [newBuyerNameInput, setNewBuyerNameInput] = useState('');
  const [newBuyerPhoneInput, setNewBuyerPhoneInput] = useState('');
  const [isAddingBuyer, setIsAddingBuyer] = useState(false);

  // Form states for Add/Edit
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formItemName, setFormItemName] = useState('');
  const [formCategory, setFormCategory] = useState<HomeBazarCategory>('fish_meat');
  const [formQuantity, setFormQuantity] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [formNotes, setFormNotes] = useState('');
  const [formBuyerId, setFormBuyerId] = useState<string>('');
  const [formPurchasedBy, setFormPurchasedBy] = useState<string>('');
  const [isCustomBuyerMode, setIsCustomBuyerMode] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Data function
  const loadBazarData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsSyncing(true);
      const res = await ApiService.getHomeBazar();
      setEntries(res.entries || []);
      const budget = typeof res.monthlyBudget === 'number' ? res.monthlyBudget : 0;
      setMonthlyBudget(budget);
      setNewBudgetValue(budget);

      if (res.buyers && res.buyers.length > 0) {
        setBuyers(res.buyers);
      } else {
        // Fallback fetch buyers
        try {
          const bList = await ApiService.getBazarBuyers();
          if (bList && bList.length > 0) setBuyers(bList);
        } catch {
          // ignore
        }
      }

      setLastSyncedTime(new Date());
      setSyncStatus('connected');
    } catch (err: any) {
      console.error('Failed to load home bazar data:', err);
      if (!isSilent) {
        setToastMessage({ text: err.message || 'Error loading bazar records', type: 'error' });
      }
    } finally {
      if (!isSilent) setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadBazarData(false);
  }, [loadBazarData]);

  // Real-time SSE listener for automatic sync
  useEffect(() => {
    const token = ApiService.getToken() || '';
    const sseUrl = `/api/sync/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    let es: EventSource | null = null;
    try {
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setSyncStatus('connected');
      };

      es.addEventListener('connected', () => {
        setSyncStatus('connected');
      });

      // Handle real-time bazar events
      const handleSyncEvent = () => {
        loadBazarData(true);
      };

      es.addEventListener('home_bazar_added', handleSyncEvent);
      es.addEventListener('home_bazar_updated', handleSyncEvent);
      es.addEventListener('home_bazar_deleted', handleSyncEvent);
      es.addEventListener('home_bazar_budget_updated', handleSyncEvent);
      es.addEventListener('bazar_buyers_updated', handleSyncEvent);
      es.addEventListener('user_updated', handleSyncEvent);
      es.addEventListener('user_created', handleSyncEvent);
      es.addEventListener('user_deleted', handleSyncEvent);
      es.addEventListener('database_restored', handleSyncEvent);

      es.onerror = () => {
        setSyncStatus('idle');
      };
    } catch (e) {
      console.warn('SSE connection failed, relying on periodic sync:', e);
      setSyncStatus('idle');
    }

    // Auto-sync polling heartbeat (every 8 seconds) & focus sync
    const interval = setInterval(() => {
      loadBazarData(true);
    }, 8000);

    const handleWindowFocus = () => {
      loadBazarData(true);
    };
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadBazarData(true);
      }
    });

    return () => {
      if (es) es.close();
      clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loadBazarData]);

  // Toast Auto-clear
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthPrefix = todayStr.slice(0, 7);

  const stats = useMemo(() => {
    let todaySpent = 0;
    let thisMonthSpent = 0;

    entries.forEach((e) => {
      const amt = Number(e.amount) || 0;
      if (e.date === todayStr) todaySpent += amt;
      if (e.date?.startsWith(thisMonthPrefix)) thisMonthSpent += amt;
    });

    const remaining = monthlyBudget > 0 ? monthlyBudget - thisMonthSpent : 0;
    const budgetPercentage =
      monthlyBudget > 0 ? Math.min(100, Math.round((thisMonthSpent / monthlyBudget) * 100)) : 0;

    return {
      todaySpent,
      thisMonthSpent,
      remaining,
      budgetPercentage,
    };
  }, [entries, monthlyBudget, todayStr, thisMonthPrefix]);

  // Dynamic Buyer Summaries calculated from current entries
  const buyerSummaries: BuyerSpendingSummary[] = useMemo(() => {
    const map: Record<string, { buyerId: string; buyerName: string; totalSpent: number; itemCount: number }> = {};

    entries.forEach((item) => {
      const bId = item.buyerId || item.purchasedBy || 'Unknown';
      const bName = item.purchasedBy || item.buyerId || 'Unknown Buyer';
      if (!map[bId]) {
        map[bId] = { buyerId: bId, buyerName: bName, totalSpent: 0, itemCount: 0 };
      }
      map[bId].totalSpent += Number(item.amount) || 0;
      map[bId].itemCount += 1;
    });

    const totalAll = Object.values(map).reduce((s, b) => s + b.totalSpent, 0);

    return Object.values(map)
      .map((b) => ({
        ...b,
        percentage: totalAll > 0 ? Math.round((b.totalSpent / totalAll) * 100) : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [entries]);

  // Filtered entries by category, search query, and buyer ID
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (selectedBuyerId !== 'all') {
        const itemBuyer = (e.buyerId || e.purchasedBy || '').toLowerCase();
        if (itemBuyer !== selectedBuyerId.toLowerCase()) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        e.itemName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q) ||
        e.purchasedBy?.toLowerCase().includes(q) ||
        e.buyerId?.toLowerCase().includes(q) ||
        e.date?.includes(q)
      );
    });
  }, [entries, selectedCategory, selectedBuyerId, searchQuery]);

  // Group by Date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, HomeBazarEntry[]> = {};
    filteredEntries.forEach((e) => {
      const d = e.date || todayStr;
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return sortedDates.map((d) => {
      const items = groups[d];
      const isToday = d === todayStr;
      const dateObj = new Date(d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const totalAmount = items.reduce((s, it) => s + (it.amount || 0), 0);

      return {
        dateStr: d,
        displayLabel: isToday ? `Today  ${d}` : `${dayName}  ${d}`,
        totalAmount,
        items,
      };
    });
  }, [filteredEntries, todayStr]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingEntry(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormItemName('');
    setFormCategory('fish_meat');
    setFormQuantity('');
    setFormAmount('');
    setFormPaymentMethod('cash');
    setFormNotes('');

    // Default buyer: current user ID & name
    const defaultId = currentUser.username || currentUser.id || 'rh.faysal007';
    setFormBuyerId(defaultId);
    setFormPurchasedBy(currentUser.name || 'Faysal Ahmed');
    setIsCustomBuyerMode(false);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (entry: HomeBazarEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.date || new Date().toISOString().slice(0, 10));
    setFormItemName(entry.itemName);
    setFormCategory(entry.category || 'other');
    setFormQuantity(entry.quantity || '');
    setFormAmount(entry.amount);
    setFormPaymentMethod(entry.paymentMethod || 'cash');
    setFormNotes(entry.notes || '');

    const bId = entry.buyerId || entry.purchasedBy || currentUser.username || 'rh.faysal007';
    setFormBuyerId(bId);
    setFormPurchasedBy(entry.purchasedBy || currentUser.name);

    // If buyer ID is not in pre-defined buyers list, show as custom
    const match = buyers.some((b) => b.buyerId.toLowerCase() === bId.toLowerCase());
    setIsCustomBuyerMode(!match);

    setShowAddModal(true);
  };

  // When buyer ID selection changes in Add/Edit modal
  const handleSelectBuyerId = (bId: string) => {
    if (bId === '__CUSTOM__') {
      setIsCustomBuyerMode(true);
      setFormBuyerId('');
      setFormPurchasedBy('');
    } else {
      setIsCustomBuyerMode(false);
      setFormBuyerId(bId);
      const matched = buyers.find((b) => b.buyerId.toLowerCase() === bId.toLowerCase());
      if (matched) {
        setFormPurchasedBy(matched.name);
      }
    }
  };

  // Save Bazar Item (Add or Update)
  const handleSaveBazarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = typeof formAmount === 'number' ? formAmount : parseFloat(String(formAmount));
    if (isNaN(numAmt) || numAmt <= 0) {
      setToastMessage({ text: 'Please enter a valid amount greater than 0', type: 'error' });
      return;
    }

    const finalBuyerId = formBuyerId.trim() || currentUser.username || 'rh.faysal007';
    const finalPurchasedBy = formPurchasedBy.trim() || finalBuyerId;

    setIsSubmitting(true);
    try {
      if (editingEntry) {
        const updated = await ApiService.updateHomeBazarEntry(editingEntry.id, {
          date: formDate,
          itemName: formItemName.trim(),
          category: formCategory,
          quantity: formQuantity.trim(),
          amount: numAmt,
          paymentMethod: formPaymentMethod,
          notes: formNotes.trim(),
          buyerId: finalBuyerId,
          purchasedBy: finalPurchasedBy,
        });
        setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setToastMessage({
          text: isBn ? `বাজার হিসাব আপডেট হয়েছে (আইডি: ${finalBuyerId})` : `Bazar item updated for ID: ${finalBuyerId}`,
          type: 'success',
        });
      } else {
        const created = await ApiService.createHomeBazarEntry({
          date: formDate,
          itemName: formItemName.trim(),
          category: formCategory,
          quantity: formQuantity.trim(),
          amount: numAmt,
          paymentMethod: formPaymentMethod,
          notes: formNotes.trim(),
          buyerId: finalBuyerId,
          purchasedBy: finalPurchasedBy,
        });
        setEntries((prev) => [created, ...prev]);
        setToastMessage({
          text: isBn ? `নতুন বাজার খরচ যুক্ত হয়েছে (আইডি: ${finalBuyerId})` : `Bazar item saved with Buyer ID: ${finalBuyerId}`,
          type: 'success',
        });
      }
      setShowAddModal(false);
      // Reload in background to refresh buyer summaries
      loadBazarData(true);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error saving item', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Confirm
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteHomeBazarEntry(entryToDelete.id);
      setEntries((prev) => prev.filter((it) => it.id !== entryToDelete.id));
      setToastMessage({ text: isBn ? 'বাজার রেকর্ড মুছে ফেলা হয়েছে' : 'Bazar item deleted', type: 'success' });
      setEntryToDelete(null);
      loadBazarData(true);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error deleting item', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = typeof newBudgetValue === 'number' ? newBudgetValue : parseFloat(String(newBudgetValue));
    if (isNaN(num) || num < 0) return;

    try {
      const updatedBudget = await ApiService.updateHomeBazarBudget(num);
      setMonthlyBudget(updatedBudget);
      setShowBudgetModal(false);
      setToastMessage({ text: isBn ? 'মাসিক বাজার বাজেট সংরক্ষিত হয়েছে' : 'Monthly bazar budget updated', type: 'success' });
      loadBazarData(true);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error updating budget', type: 'error' });
    }
  };

  // Add new buyer ID in modal
  const handleAddNewBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyerIdInput.trim() || !newBuyerNameInput.trim()) {
      setToastMessage({ text: 'Buyer ID and Name are required', type: 'error' });
      return;
    }

    setIsAddingBuyer(true);
    try {
      const created = await ApiService.addBazarBuyer({
        buyerId: newBuyerIdInput.trim(),
        name: newBuyerNameInput.trim(),
        phone: newBuyerPhoneInput.trim(),
        role: 'Buyer',
      });
      setBuyers((prev) => {
        const filtered = prev.filter((b) => b.buyerId.toLowerCase() !== created.buyerId.toLowerCase());
        return [created, ...filtered];
      });
      setNewBuyerIdInput('');
      setNewBuyerNameInput('');
      setNewBuyerPhoneInput('');
      setToastMessage({ text: isBn ? `ক্রেতার আইডি '${created.buyerId}' যুক্ত হয়েছে` : `Buyer ID '${created.buyerId}' registered`, type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error adding buyer ID', type: 'error' });
    } finally {
      setIsAddingBuyer(false);
    }
  };

  // Delete buyer
  const handleDeleteBuyer = async (bId: string) => {
    try {
      await ApiService.deleteBazarBuyer(bId);
      setBuyers((prev) => prev.filter((b) => b.buyerId.toLowerCase() !== bId.toLowerCase()));
      setToastMessage({ text: `Buyer ID '${bId}' removed`, type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error deleting buyer', type: 'error' });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 px-2 sm:px-4 pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-xl shrink-0 border border-amber-300/40 shadow-xs">
              🛒
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {isBn ? 'দৈনিক বাজার ও মুদি মালামাল হিসাব' : 'Daily Home Bazar & Grocery Goods'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-mono">
                  {entries.length} {isBn ? 'আইটেম' : 'items'}
                </span>

                {/* Auto-Sync Live Indicator Badge */}
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  title="Real-time live synchronization active"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{isBn ? 'অটো-সিঙ্ক সক্রিয়' : 'Auto-Sync Live'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {isBn
                    ? 'ক্রেতার আইডি (Buyer ID) ভিত্তিক বাজার খরচ ও রিয়েল-টাইম হিসাব'
                    : 'Track grocery purchases by Buyer ID with real-time live synchronization'}
                </span>
                <span>•</span>
                <span className="text-[10px] font-mono text-slate-400">
                  Synced: {lastSyncedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
            {/* Manual Sync Trigger Button */}
            <button
              type="button"
              onClick={() => loadBazarData(false)}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Manual Sync Now"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin text-amber-500' : ''}`} />
              <span>{isBn ? 'সিঙ্ক করুন' : 'Sync Now'}</span>
            </button>

            {/* Manage Buyer IDs Button */}
            <button
              type="button"
              onClick={() => setShowBuyersModal(true)}
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Manage Buyer IDs & Mess Members"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isBn ? 'ক্রেতার আইডি' : 'Buyer IDs'}</span>
            </button>

            {onBackToInvoices && (
              <button
                type="button"
                onClick={onBackToInvoices}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                ← Back
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Print Bazar Memo"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>{isBn ? 'রশিদ প্রিন্ট' : 'Print Slip'}</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? '+ নতুন বাজার এন্ট্রি' : '+ Add Bazar Item'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* BUDGET & SPENDING METRIC CARDS                                 */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {/* Card 1: Today's Bazar */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
              {isBn ? 'আজকের মোট বাজার' : "Today's Bazar"}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatCurrency(stats.todaySpent, currency, useBanglaNumerals)}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block mt-1">
              {entries.filter((e) => e.date === todayStr).length} {isBn ? 'টি আইটেম কেনা হয়েছে' : 'items purchased'}
            </span>
          </div>

          {/* Card 2: This Month Total */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 block uppercase">
              {isBn ? 'চলতি মাসের মোট খরচ' : 'This Month Spent'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-900 dark:text-amber-300 font-mono">
                {formatCurrency(stats.thisMonthSpent, currency, useBanglaNumerals)}
              </span>
            </div>
            <span className="text-[10px] text-amber-700 font-semibold block mt-1">
              {stats.budgetPercentage}% {isBn ? 'বাজেট ব্যবহৃত' : 'of budget used'}
            </span>
          </div>

          {/* Card 3: Monthly Allocated Budget */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                {isBn ? 'মাসিক বাজার বাজেট' : 'Monthly Budget'}
              </span>
              <button
                type="button"
                onClick={() => setShowBudgetModal(true)}
                className="text-[10px] text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
                title="Edit Budget"
              >
                Edit
              </button>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatCurrency(monthlyBudget, currency, useBanglaNumerals)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  stats.budgetPercentage > 90 ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${stats.budgetPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Card 4: Remaining Budget */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 block uppercase">
              {isBn ? 'অবশিষ্ট বাজেট' : 'Remaining Budget'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {formatCurrency(stats.remaining, currency, useBanglaNumerals)}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
              {isBn ? 'হাতে থাকা ব্যালেন্স' : 'Available for remaining days'}
            </span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION: BUYER ID BREAKDOWN & SPENDING SUMMARY (NEW)           */}
        {/* ============================================================== */}
        {buyerSummaries.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-indigo-900/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {isBn ? 'ক্রেতার আইডি অনুযায়ী খরচের হিসাব (Buyer ID Breakdown)' : 'Buyer ID Spending Summary'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBuyerBreakdown(!showBuyerBreakdown)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {showBuyerBreakdown ? (isBn ? 'সংক্ষেপ করুন' : 'Hide') : (isBn ? 'বিস্তারিত দেখুন' : 'Show Details')}
                </button>
              </div>
            </div>

            {showBuyerBreakdown && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {buyerSummaries.map((bs) => {
                  const isSelected = selectedBuyerId.toLowerCase() === bs.buyerId.toLowerCase();
                  return (
                    <div
                      key={bs.buyerId}
                      onClick={() => setSelectedBuyerId(isSelected ? 'all' : bs.buyerId)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-indigo-100 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}
                        >
                          🆔 {bs.buyerId}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}
                        >
                          {bs.itemCount} {isBn ? 'টি এন্ট্রি' : 'items'}
                        </span>
                      </div>
                      <div className="mt-1.5 font-bold truncate text-xs" title={bs.buyerName}>
                        {bs.buyerName}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="font-mono font-black text-sm">
                          {formatCurrency(bs.totalSpent, currency, useBanglaNumerals)}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`}
                        >
                          {bs.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* BUYER ID FILTER PILLS                                          */}
        {/* ============================================================== */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            {isBn ? 'ক্রেতা ফিল্টার:' : 'Buyer:'}
          </span>

          <button
            onClick={() => setSelectedBuyerId('all')}
            className={`px-3 py-1 rounded-xl transition cursor-pointer whitespace-nowrap font-bold ${
              selectedBuyerId === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সকল ক্রেতা (All)' : 'All Buyers'}
          </button>

          {buyerSummaries.map((b) => (
            <button
              key={b.buyerId}
              onClick={() => setSelectedBuyerId(b.buyerId)}
              className={`px-2.5 py-1 rounded-xl transition cursor-pointer whitespace-nowrap font-bold flex items-center gap-1 ${
                selectedBuyerId.toLowerCase() === b.buyerId.toLowerCase()
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="font-mono text-[10px]">🆔 {b.buyerId}</span>
              <span className="opacity-80 truncate max-w-[100px]">({b.buyerName.split(' ')[0]})</span>
            </button>
          ))}
        </div>

        {/* ============================================================== */}
        {/* CATEGORY FILTER PILLS                                          */}
        {/* ============================================================== */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap font-bold ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isBn ? 'সকল ক্যাটাগরি' : 'All Categories'} ({entries.length})
          </button>

          {(Object.keys(CATEGORY_CONFIG) as HomeBazarCategory[]).map((catKey) => {
            const cat = CATEGORY_CONFIG[catKey];
            const isSel = selectedCategory === catKey;
            const count = entries.filter((e) => e.category === catKey).length;

            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 font-bold ${
                  isSel
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{isBn ? cat.labelBn : cat.labelEn}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* ============================================================== */}
        {/* SEARCH BAR                                                     */}
        {/* ============================================================== */}
        <div className="mt-3 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              isBn
                ? 'পণ্য, ক্রেতার আইডি (e.g. rh.faysal007, BYR-01), নাম বা তারিখ দিয়ে খুঁজুন...'
                : 'Search grocery item, Buyer ID, buyer name, or date...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* BAZAR LIST GROUPED BY DATE                                     */}
        {/* ============================================================== */}
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading daily bazar ledger & sync...</p>
          </div>
        ) : groupedEntries.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl mt-6 px-4">
            <ShoppingBag className="w-12 h-12 text-amber-500 mx-auto mb-2 opacity-60" />
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              {isBn ? 'বর্তমানে কোনো বাজার খরচ রেকর্ড নেই' : 'No grocery items recorded yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {isBn
                ? 'আপনার মাছ, মাংস, শাকসবজি ও মুদি মালামাল হিসাব এন্ট্রি করুন। যে ব্যক্তি বাজার করবে তার আইডি (Buyer ID) লিখে দিলে কার কত খরচ হয়েছে তা স্বয়ংক্রিয়ভাবে হিসাব থাকবে।'
                : 'Track daily grocery expenses and associate each purchase with a Buyer ID. As you enter items, remaining balances and buyer spending calculate automatically in real time.'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? '+ নতুন বাজার এন্ট্রি করুন' : '+ Add First Bazar Item'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBudgetModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                <span>{isBn ? 'মাসিক বাজেট সেট করুন' : 'Set Monthly Budget'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {groupedEntries.map((group) => (
              <div key={group.dateStr} className="space-y-2">
                {/* Date Header */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1 border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>{group.displayLabel}</span>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400">
                    Day Total:{' '}
                    <strong>
                      {formatCurrency(group.totalAmount, currency, useBanglaNumerals)}
                    </strong>
                  </div>
                </div>

                {/* Items in Table Grid */}
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Buyer ID & Name</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Cost ({getCurrencySymbol(currency)})</th>
                        <th className="py-2.5 px-3 text-center">Payment</th>
                        <th className="py-2.5 px-3">Notes / Memo</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {group.items.map((item, idx) => {
                        const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
                        const buyerIdDisplay = item.buyerId || item.purchasedBy || 'Unknown';
                        const buyerNameDisplay = item.purchasedBy || item.buyerId || 'Buyer';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              {item.itemName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.color}`}
                              >
                                <span>{cat.icon}</span>
                                <span>{isBn ? cat.labelBn : cat.labelEn}</span>
                              </span>
                            </td>
                            {/* Buyer ID Column */}
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 w-fit">
                                  <span>🆔</span>
                                  <span>{buyerIdDisplay}</span>
                                </span>
                                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px] mt-0.5">
                                  {buyerNameDisplay}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              {item.quantity || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(item.amount, currency, useBanglaNumerals)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.paymentMethod}
                              </span>
                            </td>
                            <td
                              className="py-2.5 px-3 text-slate-500 text-[11px] max-w-[180px] truncate"
                              title={item.notes}
                            >
                              {item.notes || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEntryToDelete(item)}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: ADD / EDIT BAZAR ITEM MODAL                           */}
      {/* ============================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-base">
                  🛒
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingEntry
                      ? isBn
                        ? 'বাজার আইটেম সম্পাদনা'
                        : 'Edit Bazar Item'
                      : isBn
                      ? 'নতুন বাজার খরচ যোগ করুন'
                      : 'Add New Daily Grocery Item'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isBn
                      ? 'কার আইডি দিয়ে বাজার কেনা হচ্ছে তা সিলেক্ট করুন'
                      : 'Assign expense to Buyer ID for personal/mess accounting'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBazarItem} className="mt-4 space-y-3.5">
              {/* Buyer ID and Name Selection (PROMINENT) */}
              <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isBn ? 'কে বাজার করেছে? ক্রেতার আইডি (Buyer ID) *' : 'Who Bought? Buyer ID *'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomBuyerMode(!isCustomBuyerMode);
                      if (!isCustomBuyerMode) {
                        setFormBuyerId('');
                        setFormPurchasedBy('');
                      } else {
                        const def = currentUser.username || 'rh.faysal007';
                        setFormBuyerId(def);
                        setFormPurchasedBy(currentUser.name);
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {isCustomBuyerMode
                      ? isBn
                        ? 'তালিকা থেকে পছন্দ করুন'
                        : 'Pick from list'
                      : isBn
                      ? '+ নতুন আইডি লিখুন'
                      : '+ Type custom ID'}
                  </button>
                </div>

                {!isCustomBuyerMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <select
                        value={formBuyerId}
                        onChange={(e) => handleSelectBuyerId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl font-mono font-bold text-xs outline-none"
                      >
                        {buyers.map((b) => (
                          <option key={b.buyerId} value={b.buyerId}>
                            🆔 {b.buyerId} ({b.name})
                          </option>
                        ))}
                        <option value="__CUSTOM__">+ Write custom Buyer ID...</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Buyer Full Name"
                        value={formPurchasedBy}
                        onChange={(e) => setFormPurchasedBy(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Buyer ID (e.g. BYR-02, MBR-101)"
                        value={formBuyerId}
                        onChange={(e) => setFormBuyerId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl font-mono font-bold text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Buyer Name (e.g. Sujon Hawlader)"
                        value={formPurchasedBy}
                        onChange={(e) => setFormPurchasedBy(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Item Name */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'বাজারের পণ্য / বিবরণের নাম *' : 'Item Description *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  placeholder="e.g. রুই মাছ, দেশি আলু-পেঁয়াজ, সয়াবিন তেল, ডিম ২ ডজন"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium outline-none focus:border-amber-500 text-xs"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'ক্যাটাগরি *' : 'Category *'}
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as HomeBazarCategory)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium outline-none text-xs"
                >
                  <option value="fish_meat">🐟 Fish & Meat (মাছ ও মাংস)</option>
                  <option value="vegetables_fruits">🥬 Vegetables & Fruits (শাক-সবজি ও ফলমূল)</option>
                  <option value="groceries_staples">🍚 Rice, Oil & Staples (চাল, তেল ও মশলা)</option>
                  <option value="dairy_bakery">🥛 Dairy, Eggs & Bakery (দুধ, ডিম ও বেকারি)</option>
                  <option value="cleaning_toiletries">🧼 Toiletries & Soap (সাবান ও গৃহস্থালি)</option>
                  <option value="snacks_beverages">☕ Snacks & Tea (চা ও নাস্তা)</option>
                  <option value="other">📦 Other Groceries (অন্যান্য বাজার)</option>
                </select>
              </div>

              {/* Quantity & Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'পরিমাণ / ওজন' : 'Quantity / Weight'}
                  </label>
                  <input
                    type="text"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="e.g. 2 kg, 1 dozen, 5 liter"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? `দাম / খরচ (${getCurrencySymbol(currency)}) *` : `Amount (${getCurrencySymbol(currency)}) *`}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Payment Method & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Source'}
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                  >
                    <option value="cash">Cash (নগদ ক্যাশ)</option>
                    <option value="bank">Bank / Card</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'বাজারের তারিখ' : 'Purchase Date'}
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'মন্তব্য / দোকানের নাম' : 'Shop Name / Note'}
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Jubail Fish Market / কারওয়ান বাজার"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingEntry ? 'Update Item' : 'Save to Bazar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: MANAGE BUYER IDS & MESS MEMBERS                         */}
      {/* ============================================================== */}
      {showBuyersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center text-base">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isBn ? 'ক্রেতার আইডি ও সদস্য ব্যবস্থাপনা' : 'Manage Buyer IDs & Accounts'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {isBn
                      ? 'নতুন ক্রেতার আইডি যুক্ত করুন যাতে বাজার করার সময় তার আইডি সিলেক্ট করা যায়'
                      : 'Add buyer IDs (e.g. BYR-01, roommates, employees) to log and split grocery expenses'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuyersModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add New Buyer ID Form */}
            <form onSubmit={handleAddNewBuyer} className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                {isBn ? '+ নতুন ক্রেতার আইডি যোগ করুন' : '+ Register New Buyer ID'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Buyer ID (e.g. BYR-02)"
                    value={newBuyerIdInput}
                    onChange={(e) => setNewBuyerIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-xs outline-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Buyer Name"
                    value={newBuyerNameInput}
                    onChange={(e) => setNewBuyerNameInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Mobile (Optional)"
                    value={newBuyerPhoneInput}
                    onChange={(e) => setNewBuyerPhoneInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>
              <div className="text-right">
                <button
                  type="submit"
                  disabled={isAddingBuyer}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm transition"
                >
                  {isAddingBuyer ? 'Adding...' : isBn ? '+ আইডি সংরক্ষণ করুন' : '+ Add Buyer ID'}
                </button>
              </div>
            </form>

            {/* Registered Buyers List */}
            <div className="mt-4 space-y-2">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider block">
                {isBn ? 'নিবন্ধিত ক্রেতা আইডি তালিকা' : 'Registered Buyer Accounts'} ({buyers.length})
              </span>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {buyers.map((b) => (
                  <div
                    key={b.buyerId}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        🆔 {b.buyerId}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{b.name}</div>
                        {b.phone && <div className="text-[10px] text-slate-400 font-mono">{b.phone}</div>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {b.role && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500">
                          {b.role}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteBuyer(b.buyerId)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Remove Buyer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setShowBuyersModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT MONTHLY BUDGET MODAL                             */}
      {/* ============================================================== */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs text-center">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto mb-2 text-lg">
              💰
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isBn ? 'মাসিক বাজার বাজেট নির্ধারণ' : 'Set Monthly Bazar Budget'}
            </h3>
            <p className="text-slate-500 text-[11px] mt-1 mb-4">
              Enter target grocery and food budget for this month ({getCurrencySymbol(currency)}):
            </p>

            <form onSubmit={handleSaveBudget} className="space-y-3">
              <input
                type="number"
                min="0"
                step="any"
                required
                value={newBudgetValue}
                onChange={(e) => setNewBudgetValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-mono font-bold text-lg outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Save Budget
                </button>
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: DELETE ITEM CONFIRMATION                              */}
      {/* ============================================================== */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-900/60 text-center text-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isBn ? 'বাজার রেকর্ড মুছে ফেলবেন?' : 'Delete Bazar Entry?'}
            </h3>
            <p className="text-slate-500 mt-2 text-xs">
              <strong className="text-slate-900 dark:text-white">{entryToDelete.itemName}</strong> (
              {formatCurrency(entryToDelete.amount, currency, useBanglaNumerals)}) will be removed from your grocery ledger.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Yes, Delete</span>
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEntryToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: PRINT BAZAR MEMO / STATEMENT                          */}
      {/* ============================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl my-auto text-xs font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 print:hidden">
              <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Print Preview: Daily Home Bazar Statement (with Buyer ID)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-4">
              <div className="text-center pb-2 border-b border-slate-300">
                <h2 className="text-lg font-bold text-slate-900">
                  {globalSettings.appName || 'ZARA Accounting'} — Daily Bazar & Grocery Account
                </h2>
                <p className="text-[11px] text-slate-500">
                  Expense Statement • Printed on {new Date().toLocaleDateString()}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-100 rounded-xl font-mono text-center text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px]">Today Spent</span>
                  <strong className="text-slate-900">
                    {formatCurrency(stats.todaySpent, currency, useBanglaNumerals)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">Month Total</span>
                  <strong className="text-amber-700">
                    {formatCurrency(stats.thisMonthSpent, currency, useBanglaNumerals)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">Remaining Budget</span>
                  <strong className="text-emerald-700">
                    {formatCurrency(stats.remaining, currency, useBanglaNumerals)}
                  </strong>
                </div>
              </div>

              {/* Buyer breakdown in print */}
              {buyerSummaries.length > 0 && (
                <div className="p-2 border border-slate-200 rounded-lg">
                  <div className="font-bold text-[10px] text-slate-700 mb-1 uppercase">
                    Buyer Cost Distribution:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px]">
                    {buyerSummaries.map((bs) => (
                      <div key={bs.buyerId} className="border-b border-slate-100 pb-0.5">
                        <span className="font-mono font-bold">[{bs.buyerId}]</span> {bs.buyerName}:{' '}
                        <strong>{formatCurrency(bs.totalSpent, currency, useBanglaNumerals)}</strong> ({bs.percentage}%)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <table className="w-full border-collapse border border-slate-300 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold">
                    <th className="border border-slate-300 p-1 text-center w-6">#</th>
                    <th className="border border-slate-300 p-1.5 text-left">Date</th>
                    <th className="border border-slate-300 p-1.5 text-left">Buyer ID & Name</th>
                    <th className="border border-slate-300 p-1.5 text-left">Item Description</th>
                    <th className="border border-slate-300 p-1.5 text-left">Category</th>
                    <th className="border border-slate-300 p-1.5 text-right">Qty</th>
                    <th className="border border-slate-300 p-1.5 text-right">Amount ({getCurrencySymbol(currency)})</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.slice(0, 50).map((it, idx) => (
                    <tr key={it.id}>
                      <td className="border border-slate-300 p-1 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 p-1">{it.date}</td>
                      <td className="border border-slate-300 p-1 font-mono">
                        [{it.buyerId || 'N/A'}] {it.purchasedBy || ''}
                      </td>
                      <td className="border border-slate-300 p-1 font-semibold">{it.itemName}</td>
                      <td className="border border-slate-300 p-1">{it.category}</td>
                      <td className="border border-slate-300 p-1 text-right font-mono">{it.quantity || '—'}</td>
                      <td className="border border-slate-300 p-1 text-right font-mono font-bold">{formatCurrency(it.amount, currency, useBanglaNumerals)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={6} className="border border-slate-300 p-1.5 uppercase">
                      Total Recorded
                    </td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono font-black">
                      {formatCurrency(filteredEntries.reduce((s, it) => s + (it.amount || 0), 0), currency, useBanglaNumerals)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
