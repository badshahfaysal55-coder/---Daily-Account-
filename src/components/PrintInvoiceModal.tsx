import React from 'react';
import {
  X,
  Printer,
  Receipt,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { Invoice, GlobalAppSettings, CurrencyCode } from '../types/accounting';
import { formatCurrency } from '../utils/formatters';
import { ZaraLogo } from './ZaraLogo';

interface PrintInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  globalSettings: GlobalAppSettings;
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  isBn: boolean;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  globalSettings,
  currency,
  useBanglaNumerals,
  isBn,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isExcessCredit = invoice.balanceDue < 0;
  const isFullyPaid = invoice.balanceDue === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl relative border border-slate-200 text-xs my-auto max-h-[96vh] overflow-y-auto print:max-w-none print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 print:hidden mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F223D] flex items-center justify-center text-[#8BC34A]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 font-heading">
                {isBn ? 'গ্রাহক চালান ও ইনভয়েস ভাউচার' : 'Official Customer Invoice'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Invoice #{invoice.invoiceNumber} • {invoice.customerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-[#8BC34A] to-lime-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md hover:brightness-105 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রিন্ট / PDF সেভ করুন' : 'Print / Save PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PRINTABLE INVOICE SHEET (Matches Screenshot Specification)     */}
        {/* ============================================================== */}
        <div
          id="printable-customer-invoice"
          className="bg-white text-slate-900 rounded-2xl border border-slate-200 print:border-none overflow-hidden relative shadow-sm"
          style={{ minHeight: '850px' }}
        >
          {/* Top Lime Ribbon Graphic Header */}
          <div className="relative bg-[#0F223D] text-white pt-8 pb-10 px-6 sm:px-10 overflow-hidden">
            {/* Lime Green Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-[#8BC34A]" />

            {/* Geometric Diagonal Ribbon */}
            <div
              className="absolute -top-6 right-20 w-32 h-64 bg-[#8BC34A] transform rotate-45 pointer-events-none opacity-90 shadow-2xl"
              style={{ clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-heading uppercase text-white">
                  INVOICE
                </h1>
                <p className="text-xs text-slate-300 font-mono tracking-widest mt-1">
                  #{invoice.invoiceNumber}
                </p>
              </div>

              {/* Company Logo & Brand */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white p-1 shadow-md flex items-center justify-center">
                  <ZaraLogo size="md" showText={false} />
                </div>
                <div className="text-right">
                  <div className="text-base font-black tracking-tight font-heading text-white">
                    {globalSettings.appName || 'ZARA Accounting'}
                  </div>
                  <div className="text-[10px] text-slate-300 font-medium tracking-wide">
                    {globalSettings.companyName || 'ZARA Group & Holdings Ltd.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-10 space-y-6">
            {/* Invoice Meta & Billing Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-4 border-b border-slate-100">
              {/* Invoice To */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  INVOICE TO :
                </span>
                <h2 className="text-lg font-black text-slate-900 font-heading">
                  {invoice.customerName}
                </h2>
                {invoice.customerBusiness && (
                  <p className="text-xs font-semibold text-[#8BC34A] mt-0.5">
                    {invoice.customerBusiness}
                  </p>
                )}
                {invoice.customerPhone && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    Phone: {invoice.customerPhone}
                  </p>
                )}
                {invoice.customerAddress && (
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
                    {invoice.customerAddress}
                  </p>
                )}
              </div>

              {/* Payment Info & Dates */}
              <div className="sm:text-right space-y-1 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Invoice Date:</span>{' '}
                  <strong className="font-mono text-slate-800">
                    {new Date(invoice.date).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Due Date:</span>{' '}
                  <strong className="font-mono text-slate-800">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>{' '}
                  <span
                    className={`font-mono uppercase font-black px-2 py-0.5 rounded text-[10px] ${
                      isExcessCredit
                        ? 'bg-purple-100 text-purple-800'
                        : isFullyPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : invoice.paidAmount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isExcessCredit ? 'Overpaid (Credit)' : invoice.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2.5 px-3 bg-[#8BC34A] text-slate-950 font-bold text-center w-12 text-xs">
                      SL.
                    </th>
                    <th className="py-2.5 px-4 bg-[#0F223D] text-white font-bold text-xs">
                      Product / Service Description
                    </th>
                    <th className="py-2.5 px-3 bg-[#8BC34A] text-slate-950 font-bold text-right w-24 text-xs">
                      Price
                    </th>
                    <th className="py-2.5 px-3 bg-[#0F223D] text-white font-bold text-center w-20 text-xs">
                      Qty.
                    </th>
                    <th className="py-2.5 px-4 bg-[#8BC34A] text-slate-950 font-bold text-right w-28 text-xs">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatCurrency(item.unitPrice, currency, useBanglaNumerals)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.total, currency, useBanglaNumerals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Partial Payments Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              {/* Terms & Conditions */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                  Terms & Conditions
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm">
                  {invoice.terms ||
                    'Payment is due within payment terms. All accounts and entries are maintained in real-time encrypted cloud databases.'}
                </p>

                {/* Payments Log */}
                {invoice.payments && invoice.payments.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Payments Recorded ({invoice.payments.length}):
                    </span>
                    <div className="space-y-1 text-[10px] text-slate-600 font-mono">
                      {invoice.payments.map((p, pIdx) => (
                        <div key={p.id} className="flex justify-between items-center bg-slate-50 p-1.5 rounded">
                          <span>
                            #{pIdx + 1} {new Date(p.paymentDate).toLocaleDateString()} ({p.paymentMethod.toUpperCase()})
                            {p.reference ? ` - ${p.reference}` : ''}
                          </span>
                          <span className="font-bold text-emerald-700">
                            {formatCurrency(p.amount, currency, useBanglaNumerals)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Calculation Summary Box */}
              <div className="space-y-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-100 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Sub Total:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatCurrency(invoice.subtotal, currency, useBanglaNumerals)}
                  </span>
                </div>

                {invoice.taxRate > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Tax ({invoice.taxRate}%):</span>
                    <span className="font-mono font-bold text-slate-800">
                      +{formatCurrency(invoice.taxAmount, currency, useBanglaNumerals)}
                    </span>
                  </div>
                )}

                {invoice.discount > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Discount:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      -{formatCurrency(invoice.discount, currency, useBanglaNumerals)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 pt-1.5">
                  <span>Total Amount:</span>
                  <span className="font-mono text-base text-slate-900">
                    {formatCurrency(invoice.totalAmount, currency, useBanglaNumerals)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold">
                  <span>Paid Amount:</span>
                  <span className="font-mono font-bold">
                    {formatCurrency(invoice.paidAmount, currency, useBanglaNumerals)}
                  </span>
                </div>

                {/* Remaining Due or Advance Credit Box */}
                <div
                  className={`flex justify-between items-center p-2.5 rounded-xl text-sm font-black mt-2 ${
                    isExcessCredit
                      ? 'bg-purple-100 text-purple-950 border border-purple-300'
                      : isFullyPaid
                      ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                      : 'bg-[#8BC34A] text-slate-950'
                  }`}
                >
                  <span>
                    {isExcessCredit
                      ? 'Advance Credit / Excess:'
                      : isFullyPaid
                      ? 'Balance Due (Paid):'
                      : 'Remaining Due:'}
                  </span>
                  <span className="font-mono text-base">
                    {isExcessCredit
                      ? `-${formatCurrency(Math.abs(invoice.balanceDue), currency, useBanglaNumerals)}`
                      : formatCurrency(invoice.balanceDue, currency, useBanglaNumerals)}
                  </span>
                </div>
              </div>
            </div>

            {/* Invoice Footer */}
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 border-t border-slate-200 gap-3">
              <div className="flex items-center gap-4 flex-wrap text-[11px]">
                <span>Corporate Hotline: +880 1711-000000</span>
                <span>•</span>
                <span>accounts@zaragroup.com</span>
              </div>
              <div className="text-right">
                <span className="font-heading font-black text-slate-800 block text-xs">
                  Thanks For Your Business
                </span>
                <span className="text-[10px] text-slate-400">
                  ZARA Accounting Cloud Platform
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
