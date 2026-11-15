import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  MessageCircle,
  Receipt,
  SlidersHorizontal,
  Wallet,
  Building2,
  RotateCcw,
  Briefcase,
  Copy,
  Check,
  Printer,
  Edit2,
  Trash2,
  ArrowDownCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Invoice, InvoicePayment, Customer, UserAccount, GlobalAppSettings, CurrencyCode } from '../types/accounting';
import { ApiService } from '../services/api';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { EditInvoiceModal } from './EditInvoiceModal';
import { DepositPaymentModal } from './DepositPaymentModal';
import { PrintInvoiceModal } from './PrintInvoiceModal';
import { getWhatsAppUrl } from '../utils/phoneUtils';
import { formatCurrency } from '../utils/formatters';

interface DailyInvoicesViewProps {
  currentUser: UserAccount;
  globalSettings: GlobalAppSettings;
  currentLang: 'bn' | 'en';
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  customers: Customer[];
  onOpenQuickCash?: () => void;
  onOpenBazarAccount?: () => void;
}

export const DailyInvoicesView: React.FC<DailyInvoicesViewProps> = ({
  currentUser,
  globalSettings,
  currentLang,
  currency,
  useBanglaNumerals,
  customers,
  onOpenQuickCash,
  onOpenBazarAccount,
}) => {
  const isBn = currentLang === 'bn';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceToDeposit, setInvoiceToDeposit] = useState<Invoice | null>(null);
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load Invoices
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getInvoices();
      setInvoices(res || []);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      setToastMessage({ text: err.message || 'Error loading invoices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    const unsubscribe = ApiService.subscribeToEvents((event) => {
      if (
        event.startsWith('invoice_') ||
        event === 'user_updated' ||
        event === 'global_settings_updated' ||
        event === 'database_restored'
      ) {
        loadInvoices();
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Toast Auto-clear
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Copy Invoice Number
  const handleCopyInvoiceNumber = (invNum: string, id: string) => {
    navigator.clipboard.writeText(invNum);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe Delete Invoice
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      await ApiService.deleteInvoice(invoiceToDelete.id);
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceToDelete.id));
      setToastMessage({
        text: isBn ? `ইনভয়েস #${invoiceToDelete.invoiceNumber} ডিলিট করা হয়েছে` : `Invoice #${invoiceToDelete.invoiceNumber} deleted`,
        type: 'success',
      });
      setInvoiceToDelete(null);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to delete invoice', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Status filter
      if (statusFilter === 'paid' && inv.status !== 'paid' && inv.status !== 'overpaid') return false;
      if (statusFilter === 'partial' && inv.status !== 'partial') return false;
      if (statusFilter === 'unpaid' && inv.status !== 'unpaid') return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const numOnly = q.replace(/[^0-9]/g, '');

      const matchInvNo = inv.invoiceNumber?.toLowerCase().includes(q) || (numOnly && inv.invoiceNumber?.includes(numOnly));
      const matchCust = inv.customerName?.toLowerCase().includes(q);
      const matchPhone = inv.customerPhone?.toLowerCase().includes(q) || (numOnly && inv.customerPhone?.includes(numOnly));
      const matchIqama = inv.iqamaNo?.toLowerCase().includes(q) || (numOnly && inv.iqamaNo?.includes(numOnly));
      const matchService = inv.serviceName?.toLowerCase().includes(q) || inv.items?.some((it) => it.description.toLowerCase().includes(q));
      const matchBranch = inv.branchOffice?.toLowerCase().includes(q);

      return matchInvNo || matchCust || matchPhone || matchIqama || matchService || matchBranch;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Aggregate Stats matching user's photo
  const stats = useMemo(() => {
    let totalCash = 0;
    let receiptsCount = 0;
    let bankTransfers = 0;
    let refundedCount = 0;

    const servicesCountMap: Record<string, number> = {
      '12-Month Visa & Iqama': 0,
      '9-Month Visa & Iqama': 0,
      '6-Month Visa & Iqama': 0,
      '3-Month Visa & Iqama': 0,
      'Transfer': 0,
      'Iqama Renewal': 0,
      'Ajeer Contract': 0,
      'Chamber': 0,
      'Other': 0,
    };

    invoices.forEach((inv) => {
      totalCash += inv.paidAmount || 0;
      if (inv.payments && inv.payments.length > 0) {
        receiptsCount += inv.payments.length;
        inv.payments.forEach((p) => {
          if (p.paymentMethod === 'bank') bankTransfers += p.amount;
        });
      } else if (inv.paidAmount > 0) {
        receiptsCount += 1;
      }

      // Classify service
      const sName = (inv.serviceName || inv.items?.[0]?.description || '').toLowerCase();
      if (sName.includes('12-month') || sName.includes('12 month')) {
        servicesCountMap['12-Month Visa & Iqama'] += 1;
      } else if (sName.includes('9-month') || sName.includes('9 month')) {
        servicesCountMap['9-Month Visa & Iqama'] += 1;
      } else if (sName.includes('6-month') || sName.includes('6 month')) {
        servicesCountMap['6-Month Visa & Iqama'] += 1;
      } else if (sName.includes('3-month') || sName.includes('3 month')) {
        servicesCountMap['3-Month Visa & Iqama'] += 1;
      } else if (sName.includes('transfer') || sName.includes('sponsorship')) {
        servicesCountMap['Transfer'] += 1;
      } else if (sName.includes('iqama renewal') || sName.includes('renewal')) {
        servicesCountMap['Iqama Renewal'] += 1;
      } else if (sName.includes('ajeer')) {
        servicesCountMap['Ajeer Contract'] += 1;
      } else if (sName.includes('chamber')) {
        servicesCountMap['Chamber'] += 1;
      } else {
        servicesCountMap['Other'] += 1;
      }
    });

    const activeServicesCount = Object.values(servicesCountMap).filter((c) => c > 0).length;

    return {
      totalCash,
      receiptsCount,
      bankTransfers,
      refundedCount,
      servicesCountMap,
      activeServicesCount,
    };
  }, [invoices]);

  // Group invoices by Date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Invoice[]> = {};
    const todayStr = new Date().toISOString().slice(0, 10);

    filteredInvoices.forEach((inv) => {
      const dStr = new Date(inv.date).toISOString().slice(0, 10);
      if (!groups[dStr]) groups[dStr] = [];
      groups[dStr].push(inv);
    });

    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return sortedDates.map((dStr) => {
      const items = groups[dStr];
      const isToday = dStr === todayStr;
      const dateObj = new Date(dStr);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

      const totalPaidOnDate = items.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const totalInvoicedOnDate = items.reduce((s, i) => s + (i.totalAmount || 0), 0);
      const pmtsCount = items.reduce((s, i) => s + (i.payments?.length || (i.paidAmount > 0 ? 1 : 0)), 0);

      return {
        dateStr: dStr,
        displayLabel: isToday ? `Today  ${dStr}` : `${dayName}  ${dStr}`,
        invoicesCount: items.length,
        pmtsCount,
        totalPaid: totalPaidOnDate,
        totalInvoiced: totalInvoicedOnDate,
        items,
      };
    });
  }, [filteredInvoices]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 px-2 sm:px-4 pb-12">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold border ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container Card in Authentic Sandy-Beige / Warm Theme */}
      <div className="bg-[#FAF7F2] dark:bg-slate-900 rounded-3xl border border-[#E9E1D4] dark:border-slate-800 shadow-sm p-4 sm:p-6 transition-colors">
        {/* Top Header: Invoices + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EBE4D8] dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2A26] dark:text-white tracking-tight">
              Invoices
            </h1>
            <p className="text-xs text-[#7A7265] dark:text-slate-400 mt-0.5">
              Manage invoices, requests, transactions, payment status and payments
            </p>
            <p className="text-[11px] text-[#9A9183] dark:text-slate-500 mt-0.5">
              The stats, invoices and requests cards show today&apos;s activity, starting at 5:00 AM Riyadh time
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {/* Daily Bazar Account Quick Shortcut */}
            {onOpenBazarAccount && (
              <button
                type="button"
                onClick={onOpenBazarAccount}
                className="px-3 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="দৈনিক বাজার খাতা খুলুন"
              >
                <span>🛒</span>
                <span className="hidden sm:inline">{isBn ? 'বাজার খাতা' : 'Bazar Account'}</span>
              </button>
            )}

            {/* WhatsApp Support Button */}
            <a
              href="https://wa.me/966599432476"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-[#E0D7C9] dark:border-slate-700 flex items-center justify-center text-emerald-600 hover:text-emerald-500 shadow-xs transition hover:scale-105"
              title="WhatsApp Client Support"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
            </a>

            {/* + New Invoice Button (Black pill with gold accent) */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-[#1C1A18] hover:bg-[#2C2926] dark:bg-amber-500 dark:hover:bg-amber-400 text-[#E5D7B7] dark:text-slate-950 text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D4AF37] dark:text-slate-950" />
              <span>New Invoice</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TOP CASH SUMMARY CARD                                          */}
        {/* ============================================================== */}
        <div className="mt-5">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-[#EBE4D8] dark:border-slate-700/80 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-[#5C564B] dark:text-slate-300 block">
                Cash
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#1F1C18] dark:text-white font-mono tracking-tight">
                {formatCurrency(stats.totalCash, currency, useBanglaNumerals)}
              </div>
              <div className="text-xs text-[#8A8172] dark:text-slate-400 pt-0.5">
                Receipts <strong className="text-[#3A352D] dark:text-slate-200">{stats.receiptsCount}</strong>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Net Cash {formatCurrency(stats.totalCash, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-[#F7F2E8] dark:bg-slate-700/60 border border-[#EAE1D1] dark:border-slate-600 flex items-center justify-center text-[#B39352] dark:text-amber-400 shrink-0">
              <Wallet className="w-7 h-7 stroke-[1.6]" />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SEARCH AND ACTION BAR                                          */}
        {/* ============================================================== */}
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8C8477] absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice no, request no, name, iqama, border no, visa no, ID, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-800/80 border border-[#E0D7C9] dark:border-slate-700 rounded-2xl text-xs text-[#332F2A] dark:text-white placeholder-[#9C9487] dark:placeholder-slate-400 outline-none focus:border-[#C4A968] focus:ring-1 focus:ring-[#C4A968]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Receipt Button */}
          <button
            type="button"
            onClick={() => {
              if (invoices.length > 0) setInvoiceToPrint(invoices[0]);
            }}
            className="px-4 py-2.5 bg-white dark:bg-slate-800/80 border border-[#E0D7C9] dark:border-slate-700 rounded-2xl text-xs font-semibold text-[#4A443A] dark:text-slate-300 flex items-center justify-center gap-2 hover:bg-[#F4EFE6] dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <span>Receipt</span>
            <Receipt className="w-4 h-4 text-[#7A7163] dark:text-slate-400" />
          </button>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800/80 border border-[#E0D7C9] dark:border-slate-700 rounded-2xl px-2 py-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#7A7163] ml-1 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-[#4A443A] dark:text-slate-300 outline-none cursor-pointer py-1.5 pr-2"
            >
              <option value="all">All Invoices ({invoices.length})</option>
              <option value="paid">Paid In Full</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid Due</option>
            </select>
          </div>
        </div>

        {/* Quick Shortcut Pill for Quick Cash */}
        {onOpenQuickCash && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">
              {isBn ? 'সহজ লিঙ্ক:' : 'Quick Tool:'}
            </span>
            <button
              onClick={onOpenQuickCash}
              className="px-2.5 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-300/60 cursor-pointer transition flex items-center gap-1"
            >
              <span>⚡</span>
              <span>{isBn ? 'কুইক ক্যাশ লেনদেন এন্ট্রি' : 'Quick Cash Ledger Entry'}</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* INVOICE VOUCHERS LIST (Grouped by Date)                       */}
        {/* ============================================================== */}
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading invoice records...</p>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-[#E0D7C9] dark:border-slate-800 rounded-3xl mt-6 px-4">
            <Receipt className="w-12 h-12 text-[#B39352] dark:text-amber-400 mx-auto mb-3 opacity-60" />
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">
              {isBn ? 'বর্তমানে কোনো ইনভয়েস নেই' : 'No invoices recorded yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {isBn
                ? 'নতুন ইনভয়েস যুক্ত করতে উপরের "+ New Invoice" বাটনে ক্লিক করুন। ইনভয়েস ও ডিপোজিট যুক্ত করলে সকল হিসাব ও সার্ভিস রিপোর্ট স্বয়ংক্রিয়ভাবে ক্যালকুলেট হবে।'
                : 'Click "+ New Invoice" to create your first client invoice. Live calculations for cash, deposits, and services will run automatically.'}
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? '+ প্রথম ইনভয়েস তৈরি করুন' : '+ Create First Invoice'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groupedByDate.map((group) => (
              <div key={group.dateStr} className="space-y-3">
                {/* Date Group Header */}
                <div className="flex items-center justify-between text-xs text-[#5C564B] dark:text-slate-400 font-medium px-1">
                  <span className="font-bold text-[#3B362D] dark:text-slate-200">
                    {group.displayLabel}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span>{group.invoicesCount} invoices</span>
                    <span className="text-[#3B82F6]">{group.pmtsCount} pmts</span>
                    <span className="text-emerald-600 font-bold">+{formatCurrency(group.totalPaid, currency, useBanglaNumerals)}</span>
                    <span>= {formatCurrency(group.totalPaid, currency, useBanglaNumerals)}</span>
                  </div>
                </div>

                {/* Cards in this Date Group */}
                <div className="space-y-3">
                  {group.items.map((inv) => {
                    const isPaidInFull = inv.status === 'paid' || inv.status === 'overpaid' || inv.balanceDue <= 0;
                    const paidPercentage = inv.totalAmount > 0 ? Math.min(100, Math.round((inv.paidAmount / inv.totalAmount) * 100)) : 100;
                    const waLink = inv.customerPhone ? getWhatsAppUrl(inv.customerPhone) : null;
                    const invNoSpaced = inv.invoiceNumber ? inv.invoiceNumber.split('').join(' ') : '—';

                    return (
                      <div
                        key={inv.id}
                        className="bg-white dark:bg-slate-800/95 rounded-2xl border border-[#E9E1D4] dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row overflow-hidden relative"
                      >
                        {/* ==================================================== */}
                        {/* LEFT TICKET SECTION: Client Info, Service, Invoicing */}
                        {/* ==================================================== */}
                        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between space-y-3">
                          {/* Top Row: Client Name + Flag + Payment Indicator */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-[#1F1C18] dark:text-white tracking-tight">
                                  {inv.customerName}
                                </h3>
                                {/* Flag (BD 🇧🇩 by default as in screenshot) */}
                                <span className="text-sm select-none" title="Bangladesh">🇧🇩</span>
                              </div>
                              <p className="text-[11px] text-[#7A7265] dark:text-slate-400 font-mono mt-0.5">
                                {inv.iqamaNo || '2525041410'} • {inv.branchOffice || 'الجبيل - المدرسة JUB5'}
                              </p>
                            </div>

                            {/* Upward green arrow payment badge (matching screenshot) */}
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-mono text-xs font-bold">
                              <span>↑</span>
                              <span>{formatCurrency(inv.lastPaymentAmount || inv.paidAmount || 0, currency, useBanglaNumerals)}</span>
                            </div>
                          </div>

                          {/* Middle Row: Service Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF4E6] dark:bg-amber-950/40 text-[#9C752B] dark:text-amber-300 border border-[#E8D9B8] dark:border-amber-800 text-xs font-bold">
                              {inv.serviceName || inv.items[0]?.description || 'Iqama Renewal 9 months'}
                            </span>
                          </div>

                          {/* Bottom Row: Date, Invoice Number, and Action Tools */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-[#7A7265] dark:text-slate-400">
                            <span>{new Date(inv.date).toISOString().slice(0, 10)}</span>

                            <div className="flex items-center gap-3">
                              {/* Invoice Number with copy */}
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="text-[10px] text-slate-400">Invoice no</span>
                                <span className="font-bold text-[#2E2A24] dark:text-white tracking-wider text-xs">
                                  {invNoSpaced}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyInvoiceNumber(inv.invoiceNumber, inv.id)}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                  title="Copy Invoice Number"
                                >
                                  {copiedId === inv.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>

                              {/* Interactive Actions: WhatsApp, Print, Edit, Deposit, Delete */}
                              <div className="flex items-center gap-1">
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 hover:text-emerald-500 transition"
                                    title="WhatsApp Chat with Client"
                                  >
                                    <MessageCircle className="w-4 h-4 fill-current" />
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setInvoiceToPrint(inv)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                                  title="Print Voucher Receipt"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>

                                {/* User Requirement: "make every invoice i can edit" */}
                                <button
                                  type="button"
                                  onClick={() => setInvoiceToEdit(inv)}
                                  className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                  title="Edit Invoice Details"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>

                                {/* User Requirement: "and difosit every invoice if i want any change" */}
                                <button
                                  type="button"
                                  onClick={() => setInvoiceToDeposit(inv)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 transition cursor-pointer shadow-xs"
                                  title="Deposit / Add Payment"
                                >
                                  <ArrowDownCircle className="w-3 h-3" />
                                  <span>Deposit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setInvoiceToDelete(inv)}
                                  className="p-1 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                                  title="Delete Invoice"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ==================================================== */}
                        {/* PERFORATED TICKET DIVIDER WITH CIRCULAR NOTCHES     */}
                        {/* ==================================================== */}
                        <div className="hidden md:flex flex-col items-center justify-between relative w-0">
                          {/* Top Notch Hole */}
                          <div className="w-4 h-4 rounded-full bg-[#FAF7F2] dark:bg-slate-900 border border-[#E9E1D4] dark:border-slate-800 -mt-2 -ml-2 z-10"></div>
                          {/* Vertical Dashed / Dotted Line */}
                          <div className="w-px h-full border-r border-dashed border-[#DDD4C5] dark:border-slate-700 my-1"></div>
                          {/* Bottom Notch Hole */}
                          <div className="w-4 h-4 rounded-full bg-[#FAF7F2] dark:bg-slate-900 border border-[#E9E1D4] dark:border-slate-800 -mb-2 -ml-2 z-10"></div>
                        </div>

                        {/* ==================================================== */}
                        {/* RIGHT BALANCE SLIP SECTION                          */}
                        {/* ==================================================== */}
                        <div className="w-full md:w-56 bg-[#FCFAF6] dark:bg-slate-800/40 p-4 sm:p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#F0E8DC] dark:border-slate-700/50">
                          <div>
                            {/* Big Number / Badge Header */}
                            {isPaidInFull ? (
                              <div className="flex items-center justify-between gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  PAID IN FULL
                                </span>
                                <span className="text-lg font-bold font-mono text-[#2B2721] dark:text-white">
                                  {formatCurrency(inv.totalAmount, currency, useBanglaNumerals)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-2xl font-bold font-mono text-[#2B2721] dark:text-white">
                                {formatCurrency(inv.totalAmount, currency, useBanglaNumerals)}
                              </div>
                            )}

                            {/* Paid & Remaining */}
                            <div className="mt-3 space-y-1 font-mono text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[#8A8172] dark:text-slate-400 text-[11px]">Paid</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  +{formatCurrency(inv.paidAmount, currency, useBanglaNumerals)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#8A8172] dark:text-slate-400 text-[11px]">Remaining</span>
                                <span
                                  className={`font-bold ${
                                    inv.balanceDue <= 0
                                      ? 'text-slate-400'
                                      : 'text-[#964B00] dark:text-amber-400'
                                  }`}
                                >
                                  {inv.balanceDue > 0 ? `-${formatCurrency(inv.balanceDue, currency, useBanglaNumerals)}` : formatCurrency(0, currency, useBanglaNumerals)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar reflecting amount paid */}
                          <div className="mt-4">
                            <div className="w-full h-1.5 rounded-full bg-[#EAE2D5] dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isPaidInFull ? 'bg-emerald-500' : 'bg-[#B08938] dark:bg-amber-500'
                                }`}
                                style={{ width: `${paidPercentage}%` }}
                              ></div>
                            </div>

                            {/* Quick deposit shortcut button */}
                            {!isPaidInFull && (
                              <button
                                type="button"
                                onClick={() => setInvoiceToDeposit(inv)}
                                className="w-full mt-2.5 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition border border-emerald-300/40"
                              >
                                <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Deposit Due ({inv.balanceDue})</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: CREATE INVOICE MODAL                                  */}
      {/* ============================================================== */}
      {showCreateModal && (
        <CreateInvoiceModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          customers={customers}
          currency={currency}
          useBanglaNumerals={useBanglaNumerals}
          isBn={isBn}
          onInvoiceCreated={(newInv) => {
            setInvoices((prev) => [newInv, ...prev]);
            setShowCreateModal(false);
            setToastMessage({
              text: isBn ? `নতুন ইনভয়েস #${newInv.invoiceNumber} সফলভাবে তৈরি হয়েছে!` : `Invoice #${newInv.invoiceNumber} created successfully!`,
              type: 'success',
            });
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT INVOICE MODAL                                    */}
      {/* ============================================================== */}
      {invoiceToEdit && (
        <EditInvoiceModal
          isOpen={!!invoiceToEdit}
          onClose={() => setInvoiceToEdit(null)}
          invoice={invoiceToEdit}
          currency={currency}
          isBn={isBn}
          onInvoiceUpdated={(updated) => {
            setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setInvoiceToEdit(null);
            setToastMessage({
              text: isBn ? `ইনভয়েস #${updated.invoiceNumber} আপডেট সম্পন্ন হয়েছে` : `Invoice #${updated.invoiceNumber} updated successfully!`,
              type: 'success',
            });
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 3: DEPOSIT PAYMENT MODAL                                 */}
      {/* ============================================================== */}
      {invoiceToDeposit && (
        <DepositPaymentModal
          isOpen={!!invoiceToDeposit}
          onClose={() => setInvoiceToDeposit(null)}
          invoice={invoiceToDeposit}
          currency={currency}
          isBn={isBn}
          onPaymentRecorded={({ invoice: updatedInv }) => {
            setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
            setInvoiceToDeposit(null);
            setToastMessage({
              text: isBn ? `ইনভয়েস #${updatedInv.invoiceNumber} এ টাকা জমা হয়েছে!` : `Deposit recorded on Invoice #${updatedInv.invoiceNumber}!`,
              type: 'success',
            });
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 4: PRINT INVOICE VOUCHER RECEIPT                         */}
      {/* ============================================================== */}
      {invoiceToPrint && (
        <PrintInvoiceModal
          isOpen={!!invoiceToPrint}
          onClose={() => setInvoiceToPrint(null)}
          invoice={invoiceToPrint}
          globalSettings={globalSettings}
          currency={currency}
          useBanglaNumerals={useBanglaNumerals}
          isBn={isBn}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 5: DELETE INVOICE CONFIRMATION                           */}
      {/* ============================================================== */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-900/60 text-center text-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isBn ? 'ইনভয়েস ডিলিট করবেন?' : 'Delete Invoice?'}
            </h3>
            <p className="text-slate-500 mt-2 text-xs">
              {isBn ? 'ইনভয়েস #' : 'Invoice #'}{' '}
              <strong className="text-slate-900 dark:text-white font-mono">{invoiceToDelete.invoiceNumber}</strong> (
              {invoiceToDelete.customerName}) {isBn ? 'মুছে ফেলা হবে।' : 'will be permanently removed.'}
            </p>
            <div className="my-3 p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl font-mono text-xs text-rose-600 font-bold">
              Total Amount: {formatCurrency(invoiceToDelete.totalAmount, currency, useBanglaNumerals)}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isBn ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'}</span>
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setInvoiceToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
