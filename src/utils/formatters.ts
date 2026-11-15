import { Category } from '../types/accounting';

const BANGLA_NUMBERS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(num: number | string): string {
  if (num === null || num === undefined) return '';
  const str = num.toString();
  return str.replace(/[0-9]/g, (match) => BANGLA_NUMBERS[parseInt(match, 10)]);
}

export function getCurrencySymbol(currency: 'BDT' | 'USD' | 'EUR' | 'SAR' = 'SAR'): string {
  switch (currency) {
    case 'SAR':
      return '⃁';
    case 'BDT':
      return '৳';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    default:
      return '⃁';
  }
}

export function formatCurrency(
  amount: number,
  currency: 'BDT' | 'USD' | 'EUR' | 'SAR' = 'SAR',
  useBanglaNumerals = false
): string {
  const rounded = Math.round(amount * 100) / 100;
  const parts = rounded.toLocaleString('en-US').split('.');
  const wholePart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  const symbol = getCurrencySymbol(currency);

  if (useBanglaNumerals) {
    const formattedWhole = toBanglaDigits(wholePart);
    const formattedDec = decimalPart ? toBanglaDigits(decimalPart) : '';
    return `${symbol} ${formattedWhole}${formattedDec}`;
  }

  return `${symbol} ${wholePart}${decimalPart}`;
}

export function formatDateBangla(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'বিকাল/রাত' : 'সকাল/দুপুর';
  const displayHours = hours % 12 || 12;
  const timeStr = `${toBanglaDigits(displayHours)}:${toBanglaDigits(minutes)} ${ampm}`;

  if (isToday) {
    return `আজ (${timeStr})`;
  }
  if (isYesterday) {
    return `গতকাল (${timeStr})`;
  }

  const monthsBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const day = toBanglaDigits(date.getDate());
  const month = monthsBn[date.getMonth()];
  const year = toBanglaDigits(date.getFullYear());

  return `${day} ${month} ${year}, ${timeStr}`;
}

export function formatDateEn(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense Categories
  { id: 'bazaar', nameBn: 'বাজার খরচ ও মুদি', nameEn: 'Groceries & Bazaar', icon: '🛒', color: '#10b981', type: 'expense' },
  { id: 'dining', nameBn: 'খাবার ও নাস্তা', nameEn: 'Food & Dining', icon: '🍔', color: '#f59e0b', type: 'expense' },
  { id: 'transport', nameBn: 'যাতায়াত / ভাড়া', nameEn: 'Transport & Rent', icon: '🚗', color: '#3b82f6', type: 'expense' },
  { id: 'bills', nameBn: 'বিদ্যুৎ ও গ্যাস বিল', nameEn: 'Utility Bills', icon: '⚡', color: '#ec4899', type: 'expense' },
  { id: 'health', nameBn: 'চিকিৎসা ও ওষুধ', nameEn: 'Medicine & Health', icon: '💊', color: '#ef4444', type: 'expense' },
  { id: 'shopping', nameBn: 'কেনাকাটা ও পোশাক', nameEn: 'Shopping & Clothes', icon: '🛍️', color: '#8b5cf6', type: 'expense' },
  { id: 'recharge', nameBn: 'মোবাইল রিচার্জ ও নেট', nameEn: 'Mobile & Internet', icon: '📱', color: '#06b6d4', type: 'expense' },
  { id: 'other_exp', nameBn: 'অন্যান্য খরচ', nameEn: 'Other Expense', icon: '💸', color: '#64748b', type: 'expense' },
  
  // Income Categories
  { id: 'salary', nameBn: 'বেতন ও ভাতা', nameEn: 'Salary & Allowance', icon: '💼', color: '#059669', type: 'income' },
  { id: 'business', nameBn: 'ব্যবসা ও বিক্রয়', nameEn: 'Business & Sales', icon: '🏪', color: '#16a34a', type: 'income' },
  { id: 'freelance', nameBn: 'ফ্রিল্যান্সিং / পার্টটাইম', nameEn: 'Freelance & Projects', icon: '💻', color: '#2563eb', type: 'income' },
  { id: 'gift', nameBn: 'উপহার ও অনুদান', nameEn: 'Gift & Remittance', icon: '🎁', color: '#d97706', type: 'income' },
  { id: 'investment', nameBn: 'বিনিয়োগ / মুনাফা', nameEn: 'Investment & Profit', icon: '📈', color: '#7c3aed', type: 'income' },
  { id: 'other_inc', nameBn: 'অন্যান্য আয়', nameEn: 'Other Income', icon: '💰', color: '#0d9488', type: 'income' },
];
