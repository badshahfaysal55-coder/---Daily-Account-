import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  History,
  TrendingDown,
  ArrowDownCircle,
  Building,
  Sparkles
} from 'lucide-react';
import { Invoice, InvoicePayment, CurrencyCode } from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency, getCurrencySymbol } from '../utils/formatters';

interface DepositPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  currency: CurrencyCode;
  isBn: boolean;
  onPaymentRecorded: (result: {
    invoice: Invoice;
    payment: InvoicePayment;
  }) => void;
}

export const DepositPaymentModal: React.FC<DepositPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  currency,
  isBn,
  onPaymentRecorded,
}) => {
  if (!isOpen) return null;

  const defaultDue = invoice.balanceDue > 0 ? invoice.balanceDue : '';
  const [depositAmount, setDepositAmount] = useState<number | ''>(defaultDue);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'bkash' | 'nagad'>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numEntered = typeof depositAmount === 'number' ? depositAmount : 0;
  const projectedPaid = invoice.paidAmount + numEntered;
  const projectedRemaining = invoice.totalAmount - projectedPaid;
  const isOverpaying = projectedRemaining < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numEntered <= 0) {
      setErrorMsg(isBn ? 'সঠিক জমার পরিমাণ লিখুন (০ এর বেশি)' : 'Please enter a valid deposit amount greater than 0');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await ApiService.recordInvoicePayment(invoice.id, {
        amount: numEntered,
        paymentDate: new Date(paymentDate).getTime(),
        paymentMethod,
        reference: reference.trim(),
        notes: notes.trim(),
      });

      onPaymentRecorded({
        invoice: res.invoice,
        payment: res.payment,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to deposit payment:', err);
      setErrorMsg(err.message || 'Error recording deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isBn ? 'ইনভয়েসে টাকা জমা / ডিপোজিট' : 'Deposit / Add Payment on Invoice'}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Invoice #{invoice.invoiceNumber} • {invoice.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current Balance Overview */}
        <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono text-center">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Total Bill</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(invoice.totalAmount, currency)}</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-600 block uppercase">Already Paid</span>
            <span className="text-sm font-bold text-emerald-600">+{formatCurrency(invoice.paidAmount, currency)}</span>
          </div>
          <div>
            <span className="text-[10px] text-amber-600 block uppercase">Remaining Due</span>
            <span className="text-sm font-black text-amber-600">
              {formatCurrency(invoice.balanceDue > 0 ? invoice.balanceDue : 0, currency)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Deposit Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-800 dark:text-slate-200">
                {isBn ? `জমার পরিমাণ (${getCurrencySymbol(currency)}) *` : `Deposit Amount (${getCurrencySymbol(currency)}) *`}
              </label>
              {invoice.balanceDue > 0 && (
                <button
                  type="button"
                  onClick={() => setDepositAmount(invoice.balanceDue)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  {isBn ? 'বাকি পুরো টাকা জমা' : 'Full Due Balance'}
                </button>
              )}
            </div>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
              <input
                type="number"
                required
                min="1"
                step="any"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2000"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-base font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'পেমেন্ট মাধ্যম *' : 'Payment Method *'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium outline-none"
              >
                <option value="cash">Cash (নগদ টাকা)</option>
                <option value="bank">Bank Transfer (ব্যাংক ট্রান্সফার)</option>
                <option value="bkash">bKash (বিকাশ)</option>
                <option value="nagad">Nagad (নগদ)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'জমার তারিখ' : 'Deposit Date'}
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'রশিদ / রেফারেন্স নম্বর' : 'Receipt / Ref #'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. TRX-9921"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'মন্তব্য / বিবরণ' : 'Memo / Note'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Deposit at Jubail counter"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Live Outcome Box */}
          <div className={`p-3 rounded-2xl border font-mono text-xs flex items-center justify-between ${
            projectedRemaining <= 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}>
            <div>
              <span className="block text-[10px] font-sans font-bold">New Balance After Deposit</span>
              <span className="font-bold">
                {projectedRemaining <= 0 ? '✓ Fully Settled' : `Remaining: ${formatCurrency(projectedRemaining, currency)}`}
              </span>
            </div>
            {isOverpaying && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                Credit: {formatCurrency(Math.abs(projectedRemaining), currency)}
              </span>
            )}
          </div>

          {/* Previous Deposit History on this invoice */}
          {Array.isArray(invoice.payments) && invoice.payments.length > 0 && (
            <div className="pt-2">
              <span className="block font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 text-[11px]">
                <History className="w-3.5 h-3.5" />
                <span>Previous Deposits on this Invoice ({invoice.payments.length})</span>
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-mono">
                {invoice.payments.map((p, idx) => (
                  <div key={p.id || idx} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span>{new Date(p.paymentDate).toLocaleDateString()} ({p.paymentMethod})</span>
                    <span className="font-bold text-emerald-600">+{formatCurrency(p.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{isBn ? 'টাকা জমা নিশ্চিত করুন' : 'Confirm Deposit'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
