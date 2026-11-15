import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Receipt,
  DollarSign,
  Calendar,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { Customer, Invoice, UserAccount, CurrencyCode } from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency } from '../utils/formatters';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomer?: Customer | null;
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  isBn: boolean;
  onInvoiceCreated: (invoice: Invoice, updatedCustomer?: Customer) => void;
}

interface ItemRow {
  id: string;
  description: string;
  quantity: number | '';
  unitPrice: number | '';
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  currency,
  useBanglaNumerals,
  isBn,
  onInvoiceCreated,
}) => {
  if (!isOpen) return null;

  const [customerId, setCustomerId] = useState<string>(
    selectedCustomer ? selectedCustomer.id : (customers[0]?.id || '')
  );

  const activeCustomer = customers.find((c) => c.id === customerId) || selectedCustomer;

  // Invoice Details
  const defaultInvNum = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvNum);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10)
  );

  // Line Items
  const [items, setItems] = useState<ItemRow[]>([
    { id: '1', description: 'Product / Service Description', quantity: 1, unitPrice: 1000 },
  ]);

  // Tax & Discount
  const [taxRate, setTaxRate] = useState<number | ''>(0);
  const [discount, setDiscount] = useState<number | ''>(0);

  // Initial Payment (optional)
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number | ''>('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [initialPaymentRef, setInitialPaymentRef] = useState('');

  // Terms and Notes
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment is due within 14 days of invoice issue.');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculations
  const subtotal = items.reduce((sum, it) => {
    const qty = typeof it.quantity === 'number' ? it.quantity : 0;
    const price = typeof it.unitPrice === 'number' ? it.unitPrice : 0;
    return sum + (qty * price);
  }, 0);

  const parsedTaxRate = typeof taxRate === 'number' ? taxRate : 0;
  const taxAmount = (subtotal * parsedTaxRate) / 100;
  const parsedDiscount = typeof discount === 'number' ? discount : 0;
  const totalAmount = Math.max(0, subtotal + taxAmount - parsedDiscount);

  const parsedInitPayment = hasInitialPayment && typeof initialPaymentAmount === 'number'
    ? initialPaymentAmount
    : 0;
  const remainingBalanceDue = totalAmount - parsedInitPayment;
  const isExcessCredit = remainingBalanceDue < 0;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ItemRow, val: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg(isBn ? 'অনুগ্রহ করে একজন গ্রাহক নির্বাচন করুন' : 'Please select a customer');
      return;
    }

    if (items.length === 0 || subtotal <= 0) {
      setErrorMsg(isBn ? 'ইনভয়েসে অন্তত একটি আইটেম এবং মূল্য থাকতে হবে' : 'Invoice must have at least one valid item');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        customerId,
        invoiceNumber: invoiceNumber.trim() || undefined,
        date: new Date(invoiceDate).getTime() || Date.now(),
        dueDate: new Date(dueDate).getTime() || (Date.now() + 86400000 * 14),
        items: items.map((it) => ({
          description: it.description.trim() || 'Product / Service',
          quantity: typeof it.quantity === 'number' ? it.quantity : 1,
          unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : 0,
        })),
        taxRate: parsedTaxRate,
        discount: parsedDiscount,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        initialPaymentAmount: hasInitialPayment ? parsedInitPayment : 0,
        initialPaymentMethod: hasInitialPayment ? initialPaymentMethod : undefined,
        initialPaymentRef: hasInitialPayment ? initialPaymentRef.trim() : undefined,
      };

      const result = await ApiService.createInvoice(payload);
      onInvoiceCreated(result.invoice, result.customer);
      onClose();
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      setErrorMsg(err.message || (isBn ? 'ইনভয়েস তৈরি করতে ব্যর্থ হয়েছে' : 'Failed to create invoice'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-xs my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white font-heading">
                {isBn ? 'নতুন গ্রাহক ইনভয়েস তৈরি করুন' : 'Create Individual Customer Invoice'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn
                  ? 'গ্রাহকের নির্দিষ্ট চালান, আইটেম লিস্ট ও আংশিক পেমেন্ট ট্র্যাকিং'
                  : 'Itemized billing, partial payments & customer balance calculation'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Customer Selection & Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Customer Picker */}
            <div className="sm:col-span-1">
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                {isBn ? 'গ্রাহক নির্বাচন করুন *' : 'Select Customer *'}
              </label>
              {selectedCustomer ? (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-white flex items-center justify-between">
                  <span className="truncate">{selectedCustomer.name}</span>
                  <span className="text-[10px] text-amber-500 font-bold">Locked</span>
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-amber-500"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Customer Current Balance Pill */}
              {activeCustomer && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span>Current Balance:</span>
                  <span
                    className={`font-mono font-bold ${
                      activeCustomer.balance > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : activeCustomer.balance < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {formatCurrency(activeCustomer.balance, currency, useBanglaNumerals)}{' '}
                    {activeCustomer.balance > 0
                      ? '(Due)'
                      : activeCustomer.balance < 0
                      ? '(Credit)'
                      : '(Settled)'}
                  </span>
                </div>
              )}
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                {isBn ? 'ইনভয়েস নম্বর #' : 'Invoice Number #'}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                placeholder="INV-2026-0001"
              />
            </div>

            {/* Dates: Issue & Due */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  {isBn ? 'তারিখ' : 'Date'}
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  {isBn ? 'মেয়াদ' : 'Due Date'}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                {isBn ? 'পণ্য বা সার্ভিসের বিবরণ (Line Items)' : 'Billable Items & Services'}
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBn ? 'আইটেম যোগ করুন' : 'Add Item'}</span>
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
              {items.map((it, idx) => {
                const qty = typeof it.quantity === 'number' ? it.quantity : 0;
                const price = typeof it.unitPrice === 'number' ? it.unitPrice : 0;
                const rowTotal = qty * price;

                return (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800"
                  >
                    <div className="col-span-1 text-center font-bold text-slate-400 font-mono">
                      {idx + 1}
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="Item description / Service"
                        value={it.description}
                        onChange={(e) => handleUpdateItem(it.id, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) =>
                          handleUpdateItem(
                            it.id,
                            'quantity',
                            e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Unit Price"
                        value={it.unitPrice}
                        onChange={(e) =>
                          handleUpdateItem(
                            it.id,
                            'unitPrice',
                            e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-1 text-right font-mono font-bold text-slate-800 dark:text-white">
                      {formatCurrency(rowTotal, currency, useBanglaNumerals)}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        disabled={items.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals & Tax / Discount Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Notes & Terms */}
            <div className="space-y-2">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  {isBn ? 'শর্তাবলী (Terms & Conditions)' : 'Terms & Conditions'}
                </label>
                <input
                  type="text"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  {isBn ? 'অভ্যন্তরীণ নোট (Internal Memo)' : 'Internal Notes'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal reference..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>{isBn ? 'সাবটোটাল' : 'Subtotal'}:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCurrency(subtotal, currency, useBanglaNumerals)}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <span>{isBn ? 'ভ্যাট / ট্যাক্স' : 'Tax / VAT'}:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={taxRate}
                    onChange={(e) =>
                      setTaxRate(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    className="w-14 px-1.5 py-0.5 text-center font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                  <span>%</span>
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  +{formatCurrency(taxAmount, currency, useBanglaNumerals)}
                </span>
              </div>

              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <span>{isBn ? 'ছাড় / ডিসকাউন্ট' : 'Discount'}:</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    className="w-20 px-1.5 py-0.5 text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  -{formatCurrency(parsedDiscount, currency, useBanglaNumerals)}
                </span>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center text-sm font-bold text-slate-900 dark:text-white">
                <span>{isBn ? 'সর্বমোট চালান' : 'Grand Total'}:</span>
                <span className="font-mono text-base text-[#D4AF37]">
                  {formatCurrency(totalAmount, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>
          </div>

          {/* Optional Opening Payment Toggle */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-900 dark:text-white">
              <input
                type="checkbox"
                checked={hasInitialPayment}
                onChange={(e) => setHasInitialPayment(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
              />
              <span>{isBn ? 'চালান তৈরির সময় অগ্রিম বা আংশিক পেমেন্ট জমা নিন' : 'Record Initial or Partial Payment Now'}</span>
            </label>

            {hasInitialPayment && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-500/20">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    {isBn ? 'পেমেন্ট পরিমাণ *' : 'Payment Amount *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={initialPaymentAmount}
                    onChange={(e) =>
                      setInitialPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    {isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                  </label>
                  <select
                    value={initialPaymentMethod}
                    onChange={(e) => setInitialPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                  >
                    <option value="cash">Cash (নগদ)</option>
                    <option value="bkash">bKash (বিকাশ)</option>
                    <option value="nagad">Nagad (নগদ অ্যাপ)</option>
                    <option value="bank">Bank Transfer (ব্যাংক)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    {isBn ? 'রেফারেন্স / TrxID' : 'Reference / TrxID'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TRX-99248"
                    value={initialPaymentRef}
                    onChange={(e) => setInitialPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Calculated Remaining Balance or Excess Credit Callout */}
            {hasInitialPayment && parsedInitPayment > 0 && (
              <div
                className={`mt-3 p-2.5 rounded-xl text-xs flex items-center justify-between font-bold ${
                  isExcessCredit
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : remainingBalanceDue === 0
                    ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span>
                  {isExcessCredit
                    ? (isBn ? '🌟 অতিরিক্ত পেমেন্ট! কাস্টমার ক্রেডিট / অগ্রিম হিসেবে জমা হবে:' : '🌟 Excess Payment! Recorded as Customer Credit:')
                    : remainingBalanceDue === 0
                    ? (isBn ? 'হিসাব সম্পন্ন (পরিশোধিত)' : 'Fully Paid & Settled')
                    : (isBn ? 'অবশিষ্ট বকেয়া পাওনা:' : 'Remaining Balance Due:')}
                </span>
                <span className="font-mono text-sm">
                  {isExcessCredit
                    ? `Credit: -${formatCurrency(Math.abs(remainingBalanceDue), currency, useBanglaNumerals)}`
                    : formatCurrency(remainingBalanceDue, currency, useBanglaNumerals)}
                </span>
              </div>
            )}
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
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 rounded-xl font-black shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isBn ? 'ইনভয়েস সেভ হচ্ছে...' : 'Saving Invoice...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isBn ? 'ইনভয়েস কনফার্ম ও সেভ করুন' : 'Confirm & Save Invoice'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
