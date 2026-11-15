import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Invoice, InvoicePayment, Customer, CurrencyCode } from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency, getCurrencySymbol } from '../utils/formatters';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  isBn: boolean;
  onPaymentRecorded: (result: {
    invoice: Invoice;
    payment: InvoicePayment;
    customer: Customer;
    isExcessCredit: boolean;
    creditAmount: number;
  }) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  currency,
  useBanglaNumerals,
  isBn,
  onPaymentRecorded,
}) => {
  if (!isOpen) return null;

  // Pre-fill with remaining due if positive, or empty
  const defaultAmount = invoice.balanceDue > 0 ? invoice.balanceDue : '';
  const [amount, setAmount] = useState<number | ''>(defaultAmount);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Calculations for Requirements 2 & 3
  const enteredAmount = typeof amount === 'number' ? amount : 0;
  const currentBalanceDue = invoice.balanceDue;
  const projectedNewPaid = invoice.paidAmount + enteredAmount;
  const projectedRemainingBalance = invoice.totalAmount - projectedNewPaid;
  const isOverpaying = projectedRemainingBalance < 0;
  const excessCreditAmount = isOverpaying ? Math.abs(projectedRemainingBalance) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredAmount <= 0) {
      setErrorMsg(isBn ? 'সঠিক পেমেন্ট পরিমাণ লিখুন (০ এর বেশি)' : 'Please enter a valid payment amount greater than 0');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await ApiService.recordInvoicePayment(invoice.id, {
        amount: enteredAmount,
        paymentDate: new Date(paymentDate).getTime() || Date.now(),
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onPaymentRecorded(res);
      onClose();
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      setErrorMsg(err.message || (isBn ? 'পেমেন্ট রেকর্ড করতে ব্যর্থ হয়েছে' : 'Failed to record payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-xs my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white font-heading">
                {isBn ? 'আংশিক বা সম্পূর্ণ পেমেন্ট গ্রহণ' : 'Record Customer Payment'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Invoice #{invoice.invoiceNumber} • {invoice.customerName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Invoice Financial Snapshot */}
        <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount</span>
            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
              {formatCurrency(invoice.totalAmount, currency, useBanglaNumerals)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Already Paid</span>
            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
              {formatCurrency(invoice.paidAmount, currency, useBanglaNumerals)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Due</span>
            <span
              className={`font-mono font-bold text-xs ${
                invoice.balanceDue > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : invoice.balanceDue < 0
                  ? 'text-emerald-500'
                  : 'text-slate-500'
              }`}
            >
              {invoice.balanceDue < 0
                ? `Credit: -${formatCurrency(Math.abs(invoice.balanceDue), currency, useBanglaNumerals)}`
                : formatCurrency(invoice.balanceDue, currency, useBanglaNumerals)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Payment Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-700 dark:text-slate-300 font-bold">
                {isBn ? 'পেমেন্ট পরিমাণ লিখুন *' : 'Payment Amount *'}
              </label>
              {invoice.balanceDue > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(invoice.balanceDue)}
                  className="text-[11px] text-[#D4AF37] hover:underline font-bold cursor-pointer"
                >
                  {isBn ? 'সম্পূর্ণ বকেয়া পে করুন' : 'Pay Full Due'}
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold font-mono text-sm">
                {getCurrencySymbol(currency)}
              </span>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                }
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* REQUIREMENT 2 & 3: Interactive Balance Reduction & Excess Credit Callout */}
          {enteredAmount > 0 && (
            <div
              className={`p-3 rounded-2xl border text-xs transition-all ${
                isOverpaying
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700/80 text-emerald-900 dark:text-emerald-200'
                  : projectedRemainingBalance === 0
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700/80 text-blue-900 dark:text-blue-200'
                  : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  {isOverpaying ? (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {isBn
                          ? '🌟 অতিরিক্ত পেমেন্ট! কাস্টমার ক্রেডিট হিসেবে জমা হবে:'
                          : '🌟 Excess Payment! Recorded as Customer Credit:'}
                      </span>
                    </>
                  ) : projectedRemainingBalance === 0 ? (
                    <span>{isBn ? 'ইনভয়েস সম্পূর্ণ পরিশোধিত হবে:' : 'Invoice will be Fully Paid:'}</span>
                  ) : (
                    <span>{isBn ? 'নতুন অবশিষ্ট বকেয়া ব্যালেন্স:' : 'Remaining Balance After Payment:'}</span>
                  )}
                </span>
                <span className="font-mono text-sm">
                  {isOverpaying
                    ? `Credit: -${formatCurrency(excessCreditAmount, currency, useBanglaNumerals)}`
                    : formatCurrency(projectedRemainingBalance, currency, useBanglaNumerals)}
                </span>
              </div>

              {isOverpaying && (
                <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-tight">
                  {isBn
                    ? `এই পেমেন্ট মোট বকেয়ার চেয়ে ${formatCurrency(excessCreditAmount, currency, useBanglaNumerals)} বেশি। অতিরিক্ত অর্থ গ্রাহকের একাউন্টে ঋণাত্মক ব্যালেন্স/অগ্রিম ক্রেডিট (-${formatCurrency(excessCreditAmount, currency, useBanglaNumerals)}) হিসেবে সংরক্ষিত থাকবে যা পরবর্তী ক্রয়ে ব্যবহার করা যাবে।`
                    : `This payment exceeds the invoice balance by ${formatCurrency(excessCreditAmount, currency, useBanglaNumerals)}. The excess is recorded as negative balance / advance credit (-${formatCurrency(excessCreditAmount, currency, useBanglaNumerals)}) on customer profile for future transactions.`}
                </p>
              )}
            </div>
          )}

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                {isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="cash">Cash (নগদ)</option>
                <option value="bkash">bKash (বিকাশ)</option>
                <option value="nagad">Nagad (নগদ)</option>
                <option value="bank">Bank Transfer (ব্যাংক)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                {isBn ? 'পেমেন্ট তারিখ' : 'Payment Date'}
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                {isBn ? 'রেফারেন্স / TrxID / চেক #' : 'Reference / TrxID / Cheque #'}
              </label>
              <input
                type="text"
                placeholder="e.g. TRX-992144"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                {isBn ? 'নোট / মন্তব্য' : 'Notes / Remarks'}
              </label>
              <input
                type="text"
                placeholder="Optional payment notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition cursor-pointer"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || enteredAmount <= 0}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-black shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isBn ? 'পেমেন্ট জমা হচ্ছে...' : 'Recording Payment...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isBn ? 'পেমেন্ট নিশ্চিত করুন' : 'Confirm Payment Entry'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
