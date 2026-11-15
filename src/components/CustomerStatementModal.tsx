import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  MessageCircle,
  Phone,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Plus,
  RefreshCw,
  Building,
  User,
  ExternalLink
} from 'lucide-react';
import { Customer, CustomerStatement, Invoice, InvoicePayment, GlobalAppSettings, CurrencyCode } from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency, formatDateBangla, formatDateEn } from '../utils/formatters';
import { getWhatsAppUrl, formatDisplayPhone } from '../utils/phoneUtils';
import { ZaraLogo } from './ZaraLogo';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  globalSettings: GlobalAppSettings;
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  isBn: boolean;
  onOpenCreateInvoice: (customer: Customer) => void;
  onOpenRecordPayment: (invoice: Invoice) => void;
  onOpenPrintInvoice: (invoice: Invoice) => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  isOpen,
  onClose,
  customer,
  globalSettings,
  currency,
  useBanglaNumerals,
  isBn,
  onOpenCreateInvoice,
  onOpenRecordPayment,
  onOpenPrintInvoice,
}) => {
  if (!isOpen) return null;

  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'invoices' | 'payments'>('ledger');

  const loadStatement = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getCustomerStatement(customer.id);
      setStatement(data);
    } catch (err) {
      console.error('Failed to load statement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatement();
  }, [customer.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    if (!statement) return;
    const phoneNum = customer.whatsapp || customer.phone;
    if (!phoneNum) return;

    const balanceText = statement.isCredit
      ? `Credit (Advance): -${formatCurrency(statement.creditAmount, currency, useBanglaNumerals)}`
      : formatCurrency(statement.balanceDue, currency, useBanglaNumerals);

    const message = [
      `*${globalSettings.companyName || 'ZARA Accounting'} - Customer Statement*`,
      `Client: ${customer.name}`,
      customer.businessName ? `Company: ${customer.businessName}` : '',
      `Date: ${new Date().toLocaleDateString()}`,
      `---------------------------------`,
      `• Total Invoiced: ${formatCurrency(statement.totalInvoiced, currency, useBanglaNumerals)}`,
      `• Total Payments Made: ${formatCurrency(statement.totalPaid, currency, useBanglaNumerals)}`,
      `• Current Outstanding / Balance: *${balanceText}*`,
      `---------------------------------`,
      `Invoices Count: ${statement.invoices.length}`,
      `Thank you for your business!`,
    ]
      .filter(Boolean)
      .join('\n');

    const clean = phoneNum.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-4 sm:p-7 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-xs my-auto max-h-[96vh] overflow-y-auto print:max-w-none print:m-0 print:p-0 print:border-none print:shadow-none">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#101A2C] border border-amber-500/30 flex items-center justify-center text-[#D4AF37] shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white font-heading">
                {isBn ? 'গ্রাহক খতিয়ান ও হিসাব স্টেটমেন্ট' : 'Customer Account Statement'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {customer.name} {customer.businessName ? `• ${customer.businessName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onOpenCreateInvoice(customer)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? '+ নতুন ইনভয়েস' : '+ New Invoice'}</span>
            </button>

            {(customer.whatsapp || customer.phone) && (
              <button
                onClick={handleSendWhatsApp}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="Send Statement via WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রিন্ট / PDF' : 'Print / PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-slate-400 font-medium">Loading comprehensive statement...</span>
          </div>
        ) : statement ? (
          <div className="mt-4 space-y-6" id="printable-statement">
            {/* Statement Header for Print & Screen */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <ZaraLogo size="md" showText={false} />
                <div>
                  <h1 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                    {globalSettings.companyName || 'ZARA Group & Holdings Ltd.'}
                  </h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enterprise Cloud Accounting & Financial Treasury
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Statement Issued: {new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Statement For (গ্রাহক বিবরণ)
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white block font-heading">
                  {customer.name}
                </span>
                {customer.businessName && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block">
                    {customer.businessName}
                  </span>
                )}
                {customer.phone && (
                  <span className="text-[11px] text-slate-500 font-mono block">
                    {formatDisplayPhone(customer.phone)}
                  </span>
                )}
                {customer.address && (
                  <span className="text-[10px] text-slate-400 block max-w-xs sm:ml-auto">
                    {customer.address}
                  </span>
                )}
              </div>
            </div>

            {/* REQUIREMENT 4: Top 3 Financial Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Total Invoiced */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isBn ? 'সর্বমোট চালান (Total Invoiced)' : 'Total Invoiced'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-xl font-black font-mono text-slate-900 dark:text-white">
                  {formatCurrency(statement.totalInvoiced, currency, useBanglaNumerals)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {statement.invoices.length} {isBn ? 'টি চালান প্রদান করা হয়েছে' : 'Invoices billed'}
                </span>
              </div>

              {/* Card 2: Total Payments Made */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isBn ? 'সর্বমোট প্রাপ্তি (Total Payments)' : 'Total Payments Made'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(statement.totalPaid, currency, useBanglaNumerals)}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {statement.payments.length} {isBn ? 'টি পেমেন্ট ট্রানজেকশন সম্পন্ন' : 'Payments received'}
                </span>
              </div>

              {/* Card 3: Current Remaining Balance or Excess Credit */}
              <div
                className={`p-4 rounded-2xl border shadow-xs ${
                  statement.isCredit
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/70 text-emerald-900 dark:text-emerald-200'
                    : statement.balanceDue === 0
                    ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                    : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {statement.isCredit
                      ? (isBn ? '🌟 কাস্টমার ক্রেডিট (অগ্রিম জমা)' : '🌟 Excess / Advance Credit')
                      : statement.balanceDue === 0
                      ? (isBn ? 'হিসাব পরিশোধিত (Settled)' : 'Account Settled')
                      : (isBn ? 'অবশিষ্ট বকেয়া পাওনা (Due)' : 'Outstanding Balance Due')}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      statement.isCredit
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {statement.isCredit ? <Sparkles className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                  </div>
                </div>
                <div className="mt-2 text-xl font-black font-mono">
                  {statement.isCredit
                    ? `- ${formatCurrency(statement.creditAmount, currency, useBanglaNumerals)}`
                    : formatCurrency(statement.balanceDue, currency, useBanglaNumerals)}
                </div>
                <span className="text-[10px] font-semibold opacity-80 mt-0.5 block">
                  {statement.isCredit
                    ? (isBn ? 'পরবর্তী বিল বা কেনাকাটার জন্য ক্রেডিট সংরক্ষিত' : 'Available credit for future invoices')
                    : statement.balanceDue === 0
                    ? (isBn ? 'সকল চালান ও বকেয়া শূন্য' : 'Zero balance remaining')
                    : (isBn ? 'গ্রাহকের নিকট বর্তমান প্রাপ্য বকেয়া' : 'Pending payment from customer')}
                </span>
              </div>
            </div>

            {/* Sub-tabs Selector (Hidden on print) */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 print:hidden">
              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs ${
                  activeTab === 'ledger'
                    ? 'bg-[#101A2C] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isBn ? 'হিসাব খতিয়ান (Ledger Statement)' : 'Chronological Ledger'}
              </button>

              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs ${
                  activeTab === 'invoices'
                    ? 'bg-[#101A2C] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isBn ? `সকল চালান (${statement.invoices.length})` : `Invoices (${statement.invoices.length})`}
              </button>

              <button
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer text-xs ${
                  activeTab === 'payments'
                    ? 'bg-[#101A2C] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isBn ? `পেমেন্ট হিস্ট্রি (${statement.payments.length})` : `Payment History (${statement.payments.length})`}
              </button>
            </div>

            {/* TAB 1: Chronological Running Ledger Table */}
            {activeTab === 'ledger' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Ref / Invoice #</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Invoiced (+)</th>
                        <th className="py-2.5 px-3 text-right">Paid (-)</th>
                        <th className="py-2.5 px-3 text-right">Balance (জের)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {statement.ledgerEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No ledger entries found for this customer.
                          </td>
                        </tr>
                      ) : (
                        statement.ledgerEntries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition"
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {new Date(entry.date).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {entry.reference}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                              {entry.description}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {entry.debit > 0
                                ? formatCurrency(entry.debit, currency, useBanglaNumerals)
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {entry.credit > 0
                                ? formatCurrency(entry.credit, currency, useBanglaNumerals)
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black">
                              <span
                                className={
                                  entry.runningBalance > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : entry.runningBalance < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500'
                                }
                              >
                                {entry.runningBalance < 0
                                  ? `Credit -${formatCurrency(Math.abs(entry.runningBalance), currency, useBanglaNumerals)}`
                                  : formatCurrency(entry.runningBalance, currency, useBanglaNumerals)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Invoices Breakdown */}
            {activeTab === 'invoices' && (
              <div className="space-y-3">
                {statement.invoices.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Receipt className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="font-semibold">No invoices issued for this customer yet.</p>
                    <button
                      onClick={() => onOpenCreateInvoice(customer)}
                      className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Invoice</span>
                    </button>
                  </div>
                ) : (
                  statement.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white font-mono text-sm">
                            #{inv.invoiceNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              inv.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : inv.status === 'overpaid'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : inv.status === 'partial'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {inv.status === 'overpaid' ? 'Credit / Excess' : inv.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>Date: {new Date(inv.date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Due: {new Date(inv.dueDate).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{inv.items.length} items</span>
                        </div>
                      </div>

                      {/* Financial Figures & Progress */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-slate-500 text-[10px] uppercase font-bold">Total / Paid</div>
                          <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {formatCurrency(inv.totalAmount, currency, useBanglaNumerals)}
                          </div>
                          <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                            Paid: {formatCurrency(inv.paidAmount, currency, useBanglaNumerals)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-slate-500 text-[10px] uppercase font-bold">Remaining</div>
                          <div
                            className={`font-mono font-black text-sm ${
                              inv.balanceDue > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : inv.balanceDue < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {inv.balanceDue < 0
                              ? `Credit: -${formatCurrency(Math.abs(inv.balanceDue), currency, useBanglaNumerals)}`
                              : formatCurrency(inv.balanceDue, currency, useBanglaNumerals)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 print:hidden">
                          {inv.balanceDue > 0 && (
                            <button
                              onClick={() => onOpenRecordPayment(inv)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>{isBn ? 'পেমেন্ট' : 'Pay'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenPrintInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white transition cursor-pointer"
                            title="Print Graphic Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: Payment History */}
            {activeTab === 'payments' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference / Notes</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {statement.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      statement.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {new Date(p.paymentDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 uppercase font-bold text-slate-700 dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {p.reference && <strong className="text-slate-900 dark:text-white mr-1.5">{p.reference}</strong>}
                            {p.notes}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {p.recordedByName || 'System'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.amount, currency, useBanglaNumerals)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
