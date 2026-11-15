import React, { useState } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Crown,
  Phone,
  Mail,
  MapPin,
  FileText,
  Sliders,
  DollarSign
} from 'lucide-react';
import { Transaction, UserProfile, UserAccount } from '../types/accounting';
import { formatCurrency, formatDateBangla, formatDateEn, DEFAULT_CATEGORIES } from '../utils/formatters';
import { t, Language } from '../utils/translations';
import { ZaraLogo } from './ZaraLogo';

interface PrintVoucherModalProps {
  transaction: Transaction | null;
  allTransactions?: Transaction[];
  isPrintAll?: boolean;
  user: UserProfile;
  currentUserAccount?: UserAccount;
  currentLang?: Language;
  onClose: () => void;
}

export const PrintVoucherModal: React.FC<PrintVoucherModalProps> = ({
  transaction,
  allTransactions = [],
  isPrintAll = false,
  user,
  currentUserAccount,
  currentLang = 'bn',
  onClose,
}) => {
  const isBn = currentLang === 'bn';
  const [template, setTemplate] = useState<'screenshot_invoice' | 'classic_voucher'>('screenshot_invoice');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [customerName, setCustomerName] = useState(
    transaction?.customerName || 'Valued Corporate Client'
  );
  const [accountNumber, setAccountNumber] = useState('0170 0000 000');
  const [accountName, setAccountName] = useState('ZARA Group & Holdings Ltd.');
  const [branchName, setBranchName] = useState('Dhaka Executive Branch');

  const triggerPrint = () => {
    window.print();
  };

  const categoryMap = new Map();
  DEFAULT_CATEGORIES.forEach((c) => categoryMap.set(c.id, isBn ? c.nameBn : c.nameEn));

  // Determine line items
  const items = isPrintAll
    ? allTransactions.slice(0, 8).map((t, idx) => ({
        sl: idx + 1,
        description: t.description,
        price: t.amount,
        qty: 1,
        total: t.amount,
        type: t.type,
      }))
    : transaction
    ? [
        {
          sl: 1,
          description: transaction.description,
          price: transaction.amount,
          qty: 1,
          total: transaction.amount,
          type: transaction.type,
        },
      ]
    : [
        {
          sl: 1,
          description: 'Product / Service Description',
          price: 50,
          qty: 1,
          total: 50,
          type: 'income' as const,
        },
      ];

  const subTotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subTotal * taxRate) / 100;
  const grandTotal = subTotal + taxAmount;
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const invoiceDate = new Date().toLocaleDateString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-3 sm:p-6 shadow-2xl relative my-auto print:p-0 print:shadow-none print:m-0 print:w-full print:max-w-none border border-slate-200 max-h-[96vh] overflow-y-auto">
        {/* Modal Controls Bar (Hidden during Print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 print:hidden gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm font-heading">
                {isPrintAll ? (isBn ? 'কনসলিডেটেড ইনভয়েস ও রসিদ' : 'Consolidated Invoice & Statement') : (isBn ? 'অফিসিয়াল ইনভয়েস ও ভাউচার' : 'Official Corporate Invoice')}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                {isBn ? 'স্ক্রিনশট ডিজাইন অনুযায়ী গ্রাফিক্যাল চালান' : 'Exact match with modern corporate invoice specification'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {/* Template Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setTemplate('screenshot_invoice')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                  template === 'screenshot_invoice'
                    ? 'bg-[#101A2C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'গ্রাফিক্যাল ইনভয়েস' : 'Graphic Invoice'}
              </button>
              <button
                onClick={() => setTemplate('classic_voucher')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs ${
                  template === 'classic_voucher'
                    ? 'bg-[#101A2C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBn ? 'ক্লাসিক ভাউচার' : 'Classic Voucher'}
              </button>
            </div>

            <button
              onClick={triggerPrint}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md hover:brightness-105 shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isBn ? 'প্রিন্ট / PDF' : 'Print / Save PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer ml-auto sm:ml-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TEMPLATE 1: Exact Match to Screenshot (Lime Green & Navy)     */}
        {/* ============================================================== */}
        {template === 'screenshot_invoice' && (
          <div
            id="printable-invoice"
            className="bg-white text-slate-900 font-sans shadow-md border border-slate-200 print:border-none print:shadow-none overflow-hidden rounded-xl"
            style={{ minHeight: '840px' }}
          >
            {/* Top Navy Banner with Folded Green Ribbon & Diagonal Pinstripes */}
            <div className="relative bg-[#0B1B2B] text-white px-4 sm:px-8 pt-6 sm:pt-8 pb-10 sm:pb-12 overflow-hidden">
              {/* Top angled lime-green accent block */}
              <div
                className="absolute top-0 left-0 right-0 h-9 bg-[#76B82A]"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 75%)' }}
              />

              {/* White diagonal pinstripes in top ribbon */}
              <div
                className="absolute top-1 left-1/3 w-36 h-8 opacity-70 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.7) 5px, rgba(255,255,255,0.7) 8px)',
                }}
              />

              {/* Folded Diagonal Lime-Green Ribbon Band */}
              <div
                className="absolute -top-4 right-16 sm:right-28 w-20 sm:w-24 h-44 sm:h-48 bg-[#76B82A] transform -rotate-[32deg] shadow-2xl z-10"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)',
                }}
              />
              <div
                className="absolute bottom-0 right-32 sm:right-48 w-14 sm:w-16 h-8 bg-[#5A8E1E] transform -rotate-[32deg] z-0 opacity-80"
              />

              {/* Banner Content: INVOICE and Logo */}
              <div className="relative z-20 flex items-center justify-between pt-4 gap-2">
                <div>
                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-heading">
                    INVOICE
                  </h1>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-right">
                    <span className="text-lg sm:text-2xl font-extrabold text-white tracking-wide block font-heading">
                      ZARA
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-300 tracking-widest uppercase block">
                      Holdings Ltd.
                    </span>
                  </div>
                  <ZaraLogo size="md" showText={false} />
                </div>
              </div>
            </div>

            {/* Sub-header double hairline rules on right */}
            <div className="px-4 sm:px-8 pt-4 pb-2 flex justify-end">
              <div className="w-36 sm:w-48 space-y-1">
                <div className="h-0.5 bg-slate-300 w-full" />
                <div className="h-0.5 bg-slate-200 w-3/4 ml-auto" />
              </div>
            </div>

            {/* Invoice To & Payment Method Section */}
            <div className="px-4 sm:px-8 py-4 sm:py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs">
              {/* Left Column: INVOICE TO */}
              <div>
                <span className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-wide block mb-1">
                  INVOICE TO :
                </span>
                <div className="text-lg sm:text-2xl font-bold font-heading">
                  <span className="text-[#76B82A]">{customerName.split(' ')[0]} </span>
                  <span className="text-[#0B1B2B]">
                    {customerName.split(' ').slice(1).join(' ') || 'Client'}
                  </span>
                </div>
                <div className="text-slate-600 mt-1 space-y-0.5">
                  <p className="font-medium text-xs">
                    {currentUserAccount?.workspaceName || 'Executive Corporate Client'}
                  </p>
                  <p className="text-slate-500 text-[11px]">Dhaka, Bangladesh • System ID: {user.userId}</p>
                  <p className="text-slate-500 text-[11px]">Invoice: {invoiceNumber} • Date: {invoiceDate}</p>
                </div>
              </div>

              {/* Right Column: Payment Method */}
              <div className="sm:text-right flex flex-col sm:items-end">
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block mb-1 sm:mb-2">
                  Payment Method
                </span>
                <div className="space-y-1 font-mono text-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 font-sans mr-2">Account No</span>
                    <strong>: {accountNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans mr-2">Account Name</span>
                    <strong>: {accountName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans mr-2">Branch Name</span>
                    <strong>: {branchName}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Table with custom styled headers: SL. (Green), Description (Navy), Price (Green), Qty (Navy), Total (Green) */}
            <div className="px-3 sm:px-8 py-3 sm:py-4 overflow-x-auto">
              <table className="w-full text-xs min-w-[480px] sm:min-w-0 print:min-w-0">
                <thead>
                  <tr className="text-white font-bold text-xs uppercase tracking-wider">
                    {/* SL. Header (Green) */}
                    <th className="py-2.5 px-3 bg-[#76B82A] text-center w-14 rounded-l-md">
                      SL.
                    </th>
                    {/* Product Description Header (Navy) */}
                    <th className="py-2.5 px-4 bg-[#0B1B2B] text-left">
                      Product Description
                    </th>
                    {/* Price Header (Green) */}
                    <th className="py-2.5 px-3 bg-[#76B82A] text-right w-28">
                      Price
                    </th>
                    {/* Qty. Header (Navy) */}
                    <th className="py-2.5 px-3 bg-[#0B1B2B] text-center w-20">
                      Qty.
                    </th>
                    {/* Total Header (Green) */}
                    <th className="py-2.5 px-4 bg-[#76B82A] text-right w-32 rounded-r-md">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={index}
                      className="border-b border-dashed border-slate-300 text-slate-800"
                    >
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-700">
                        {item.sl}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-800">
                        {formatCurrency(item.price, user.currency, user.useBanglaNumerals)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {item.qty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.total, user.currency, user.useBanglaNumerals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Terms & Calculation Section */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
              {/* Left: Terms & Conditions */}
              <div>
                <span className="font-extrabold text-slate-900 text-xs block mb-1 sm:mb-2 font-heading">
                  Terms & Conditions
                </span>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed max-w-sm">
                  Payment is due within 15 days of invoice date. All accounts and entries are
                  electronically authenticated with real-time cloud synchronization. For inquiries
                  regarding this invoice, please reach out to ZARA corporate treasury.
                </p>
              </div>

              {/* Right: Sub Total, Tax, and Highlighted Lime Green Total Bar */}
              <div className="sm:text-right flex flex-col sm:items-end space-y-1.5 sm:space-y-2 text-xs">
                <div className="flex justify-between sm:justify-end gap-6 text-slate-700 font-mono">
                  <span className="text-slate-500 font-sans">Sub Total</span>
                  <span className="font-bold">: {formatCurrency(subTotal, user.currency, user.useBanglaNumerals)}</span>
                </div>

                <div className="flex justify-between sm:justify-end gap-6 text-slate-700 font-mono">
                  <span className="text-slate-500 font-sans">Tax / VAT</span>
                  <span className="font-bold">: {taxRate.toFixed(2)}%</span>
                </div>

                {/* Lime Green Highlighted Total Bar matching screenshot */}
                <div className="w-full sm:w-64 bg-[#76B82A] text-white py-2 px-3 sm:px-4 rounded-md flex items-center justify-between font-mono font-black text-xs sm:text-sm shadow-sm mt-1">
                  <span className="font-sans uppercase tracking-wider text-[11px] sm:text-xs font-bold">
                    Total
                  </span>
                  <span>
                    : {formatCurrency(grandTotal, user.currency, user.useBanglaNumerals)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Gray Footer Bar matching screenshot */}
            <div className="mt-4 sm:mt-8 bg-[#ECEFF1] text-slate-600 px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] sm:text-[11px]">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-700" />
                  <span>+880 1700 000 000</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-700" />
                  <span>treasury@zara.com</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dhaka, Bangladesh</span>
                </span>
              </div>

              <div className="font-bold text-slate-800 tracking-wide font-heading text-center sm:text-right">
                Thanks For Your Business
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TEMPLATE 2: Classic Corporate Voucher                          */}
        {/* ============================================================== */}
        {template === 'classic_voucher' && (
          <div className="border border-slate-300 rounded-2xl p-6 sm:p-8 bg-white relative zara-watermark print:border-none print:p-0">
            {/* Header */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900 gap-4">
              <div className="flex items-center gap-3">
                <ZaraLogo size="md" showText={false} />
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">
                    ZARA HOLDINGS LTD.
                  </h1>
                  <p className="text-xs font-bold text-amber-700 tracking-wider uppercase">
                    Corporate Treasury & Ledger
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dhaka, Bangladesh • System ID: {user.userId}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold bg-slate-900 text-amber-400 px-3 py-1 rounded-lg inline-block uppercase">
                  {isPrintAll ? 'STATEMENT' : (transaction?.type === 'income' ? 'CREDIT VOUCHER' : 'DEBIT VOUCHER')}
                </span>
                <div className="text-xs text-slate-600 mt-2 font-mono">
                  <div><span className="text-slate-400">NO:</span> {invoiceNumber}</div>
                  <div><span className="text-slate-400">DATE:</span> {invoiceDate}</div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="py-4 grid grid-cols-2 gap-4 text-xs border-b border-dashed border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  {isBn ? 'ইস্যুকৃত ওয়ার্কস্পেস:' : 'Issued Workspace:'}
                </span>
                <span className="font-bold text-slate-900">
                  {currentUserAccount?.workspaceName || 'Executive HQ'}
                </span>
                <span className="text-slate-500 block text-[11px]">
                  User: {currentUserAccount?.name || user.name} (@{currentUserAccount?.username || user.userId})
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                  {isBn ? 'সার্ভার ভেরিফিকেশন:' : 'Verification Status:'}
                </span>
                <span className="font-semibold text-emerald-700 flex items-center justify-end gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('verifiedCloudRecord', currentLang)}</span>
                </span>
                <span className="text-slate-400 block font-mono text-[10px]">AUTH SHA-256 Cloud Verified</span>
              </div>
            </div>

            {/* Table */}
            <div className="py-4">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-slate-700 font-bold uppercase text-[10px]">
                    <th className="py-2">SL.</th>
                    <th className="py-2">{isBn ? 'বিবরণ' : 'Description'}</th>
                    <th className="py-2">{isBn ? 'ধরন' : 'Type'}</th>
                    <th className="py-2 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 font-mono text-slate-600">{item.sl}</td>
                      <td className="py-2.5 text-slate-900 font-semibold">{item.description}</td>
                      <td className="py-2.5 uppercase font-mono text-[10px] text-slate-600">
                        {item.type}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.total, user.currency, user.useBanglaNumerals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 pt-3 border-t-2 border-slate-900 flex justify-between text-xs font-bold text-slate-900">
                <span>{isBn ? 'সর্বমোট রেকর্ড:' : 'Total Records:'} {items.length}</span>
                <span className="text-sm font-mono">
                  {isBn ? 'মোট টাকা: ' : 'Grand Total: '}
                  {formatCurrency(grandTotal, user.currency, user.useBanglaNumerals)}
                </span>
              </div>
            </div>

            {/* Footer Signatures */}
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-[11px] text-slate-600">
              <div className="text-center">
                <div className="w-36 border-b border-slate-400 mx-auto mb-1"></div>
                <span className="font-medium">{t('customerSign', currentLang)}</span>
              </div>
              <div className="text-center">
                <div className="w-36 border-b border-slate-400 mx-auto mb-1"></div>
                <span className="font-medium">{t('authorizedSign', currentLang)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
