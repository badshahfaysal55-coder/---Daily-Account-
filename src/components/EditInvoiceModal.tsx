import React, { useState } from 'react';
import {
  X,
  Edit2,
  Calendar,
  Building,
  User,
  CreditCard,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  DollarSign
} from 'lucide-react';
import { Invoice, Customer, CurrencyCode } from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency, getCurrencySymbol } from '../utils/formatters';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  currency: CurrencyCode;
  isBn: boolean;
  onInvoiceUpdated: (updatedInvoice: Invoice) => void;
}

export const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  currency,
  isBn,
  onInvoiceUpdated,
}) => {
  if (!isOpen) return null;

  const [customerName, setCustomerName] = useState(invoice.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(invoice.customerPhone || '');
  const [iqamaNo, setIqamaNo] = useState(invoice.iqamaNo || '');
  const [serviceName, setServiceName] = useState(invoice.serviceName || invoice.items[0]?.description || 'Iqama Renewal 9 months');
  const [branchOffice, setBranchOffice] = useState(invoice.branchOffice || 'JUB5 - Jubail - Al Madrasa / الجبيل - المدرسة');
  const [invoiceDate, setInvoiceDate] = useState(new Date(invoice.date).toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(invoice.dueDate || invoice.date + 86400000 * 14).toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState<number | ''>(invoice.totalAmount);
  const [notes, setNotes] = useState(invoice.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numTotal = typeof totalAmount === 'number' ? totalAmount : parseFloat(String(totalAmount));
    if (isNaN(numTotal) || numTotal <= 0) {
      setErrorMsg(isBn ? 'সঠিক মোট বিল পরিমাণ লিখুন (০ এর বেশি)' : 'Please enter a valid invoice total amount');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await ApiService.updateInvoice(invoice.id, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        iqamaNo: iqamaNo.trim(),
        serviceName: serviceName.trim(),
        branchOffice: branchOffice.trim(),
        date: new Date(invoiceDate).getTime(),
        dueDate: new Date(dueDate).getTime(),
        totalAmount: numTotal,
        notes: notes.trim(),
        items: [
          {
            id: invoice.items[0]?.id || `item-${Date.now()}`,
            description: serviceName.trim() || 'Service Package',
            quantity: 1,
            unitPrice: numTotal,
          },
        ],
      });

      onInvoiceUpdated(res.invoice);
      onClose();
    } catch (err: any) {
      console.error('Failed to update invoice:', err);
      setErrorMsg(err.message || 'Failed to update invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isBn ? 'ইনভয়েস সম্পাদনা করুন' : 'Edit Invoice Record'}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Invoice #{invoice.invoiceNumber}
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'গ্রাহকের নাম *' : 'Customer Name *'}
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. إم دي سوجون هاولادر or MD Sojon"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'মোবাইল / হোয়াটসঅ্যাপ নম্বর' : 'Phone / WhatsApp'}
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 0599432476"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Iqama/ID & Branch Office */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'ইকামা / বর্ডার / আইডি নম্বর' : 'Iqama / Border / ID No.'}
              </label>
              <input
                type="text"
                value={iqamaNo}
                onChange={(e) => setIqamaNo(e.target.value)}
                placeholder="e.g. 2525041410"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-semibold outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'শাখা / ব্রাঞ্চ অফিস' : 'Office Branch'}
              </label>
              <input
                type="text"
                value={branchOffice}
                onChange={(e) => setBranchOffice(e.target.value)}
                placeholder="e.g. JUB5 - Jubail - Al Madrasa"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Service Name & Invoice Total Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'সার্ভিস টাইপ *' : 'Service Type *'}
              </label>
              <input
                type="text"
                required
                list="service-list-options"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Iqama Renewal 9 months"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium outline-none focus:border-amber-500"
              />
              <datalist id="service-list-options">
                <option value="Iqama Renewal 9 months" />
                <option value="Iqama Renewal 6 months" />
                <option value="Exit / Re-entry Visa" />
                <option value="Transfer" />
                <option value="6-Month Visa & Iqama" />
                <option value="12-Month Visa & Iqama" />
                <option value="Ajeer Contract" />
                <option value="Chamber Certification" />
              </datalist>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? `মোট ইনভয়েস বিল (${getCurrencySymbol(currency)}) *` : `Invoice Total Amount (${getCurrencySymbol(currency)}) *`}
              </label>
              <input
                type="number"
                required
                min="1"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 7851"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-sm outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Invoice Date & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'ইনভয়েস তারিখ' : 'Invoice Date'}
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isBn ? 'পরিশোধের মেয়াদ (Due Date)' : 'Due Date'}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isBn ? 'নোট / বিবরণ' : 'Notes / Remarks'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Client requested 2-part installment"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs outline-none"
            />
          </div>

          {/* Live Balance Summary Calculation */}
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800 flex items-center justify-between font-mono text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Already Paid</span>
              <span className="font-bold text-emerald-600">+{formatCurrency(invoice.paidAmount, currency)}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">Projected Remaining</span>
              <span className="font-black text-slate-900 dark:text-white">
                {formatCurrency(Math.max(0, (typeof totalAmount === 'number' ? totalAmount : 0) - invoice.paidAmount), currency)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{isBn ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}</span>
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
