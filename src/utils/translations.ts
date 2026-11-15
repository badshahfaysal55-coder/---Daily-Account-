export type Language = 'bn' | 'en';

export const TRANSLATIONS = {
  // Brand & General
  appName: {
    bn: 'ZARA অ্যাকাউন্টিং অ্যাপ',
    en: 'ZARA Accounting App',
  },
  corporateSubtitle: {
    bn: 'প্রিমিয়াম কর্পোরেট ফাইন্যান্সিয়াল প্ল্যাটফর্ম',
    en: 'Premium Corporate Financial Platform',
  },
  executiveHQ: {
    bn: 'এক্সিকিউটিভ হেডকোয়ার্টার্স ওয়ার্কস্পেস',
    en: 'Executive HQ Workspace',
  },
  ownerBadge: {
    bn: 'মেইন ওনার (সর্বোচ্চ নিয়ন্ত্রণ)',
    en: 'Primary Owner (Full Control)',
  },
  allWorkspaces: {
    bn: 'সকল ওয়ার্কস্পেস (মাস্টার কনসোলিডেটেড)',
    en: 'All Workspaces (Consolidated Master)',
  },

  // Navigation & Sidebar
  navDashboard: {
    bn: 'ড্যাশবোর্ড',
    en: 'Dashboard',
  },
  navAutoSaveEntry: {
    bn: 'দৈনিক হিসাব এন্ট্রি',
    en: 'Daily Accounting Entry',
  },
  navLedger: {
    bn: 'খতিয়ান ও লেনদেন',
    en: 'Ledger & Transactions',
  },
  navReports: {
    bn: 'রিপোর্ট ও বিশ্লেষণ',
    en: 'Reports & Analytics',
  },
  navInvoices: {
    bn: 'ইনভয়েস ও রসিদ',
    en: 'Invoices & Vouchers',
  },
  navCustomers: {
    bn: 'গ্রাহক ও ভেন্ডর',
    en: 'Customers & Vendors',
  },
  navOwnerCenter: {
    bn: 'ওনার কন্ট্রোল সেন্টার',
    en: 'Owner Control Center',
  },
  navCloudDatabase: {
    bn: 'ক্লাউড ডাটাবেজ লাইভ',
    en: 'Cloud DB Live',
  },
  navSettings: {
    bn: 'অ্যাপের রূপ ও সেটিংস',
    en: 'Appearance & Settings',
  },
  navSyncLogs: {
    bn: 'সিঙ্ক অডিট লগ',
    en: 'Sync Audit Logs',
  },
  navReactNative: {
    bn: 'মোবাইল কোড এক্সপোর্ট',
    en: 'Mobile Code Export',
  },

  // Financial Stats & Metrics
  netBalance: {
    bn: 'মোট ব্যালেন্স (ক্যাশ ও ব্যাংক)',
    en: 'Net Balance (Cash & Bank)',
  },
  totalIncome: {
    bn: 'মোট জমা / ক্রেডিট (আয়)',
    en: 'Total Credit / Income',
  },
  totalExpense: {
    bn: 'মোট খরচ / ডেবিট (ব্যয়)',
    en: 'Total Debit / Expense',
  },
  todayExpense: {
    bn: 'আজকের মোট লেনদেন',
    en: "Today's Total Transactions",
  },
  debit: {
    bn: 'ডেবিট (খরচ)',
    en: 'Debit (Expense)',
  },
  credit: {
    bn: 'ক্রেডিট (জমা)',
    en: 'Credit (Income)',
  },
  income: {
    bn: 'আয় / জমা',
    en: 'Income',
  },
  expense: {
    bn: 'ব্যয় / খরচ',
    en: 'Expense',
  },

  // Entry Form & Auto-Save
  entryScreenTitle: {
    bn: 'দৈনিক হিসাব (স্বয়ংক্রিয় ক্লাউড সেভ)',
    en: 'Daily Accounting (Auto Cloud Save)',
  },
  entrySubtitle: {
    bn: '১ সেকেন্ডের ডিবউন্স টাইমার সহ ক্লাউড ও মেমোরিতে রিয়েল-টাইম সংরক্ষণ',
    en: '1-second debounce auto-save to cloud database & high-speed memory',
  },
  descriptionLabel: {
    bn: 'লেনদেনের বিবরণ',
    en: 'Transaction Description',
  },
  descriptionPlaceholder: {
    bn: 'বিবরণ লিখুন (যেমন: ফেব্রুয়ারি অফিস স্পেস রেন্ট, মার্চেন্ট কালেকশন)',
    en: 'Enter description (e.g. Office Space Rent, Merchant Sales)',
  },
  amountLabel: {
    bn: 'টাকার পরিমাণ',
    en: 'Amount',
  },
  amountPlaceholder: {
    bn: 'পরিমাণ লিখুন (যেমন: ৫,৫০০)',
    en: 'Enter amount (e.g. 5,500)',
  },
  categoryLabel: {
    bn: 'ক্যাটেগরি নির্বাচন করুন',
    en: 'Select Category',
  },
  paymentMethodLabel: {
    bn: 'পরিশোধের মাধ্যম (Payment Method)',
    en: 'Payment Method',
  },
  cash: {
    bn: 'নগদ ক্যাশ',
    en: 'Cash',
  },
  bkash: {
    bn: 'বিকাশ (bKash)',
    en: 'bKash',
  },
  nagad: {
    bn: 'নগদ (Nagad)',
    en: 'Nagad',
  },
  bank: {
    bn: 'ব্যাংক / কর্পোরেট কার্ড',
    en: 'Bank / Card',
  },
  notesLabel: {
    bn: 'অতিরিক্ত নোট বা মেমো',
    en: 'Notes / Memo',
  },
  notesPlaceholder: {
    bn: 'ভাউচার নং বা রেফারেন্স...',
    en: 'Voucher # or memo reference...',
  },
  saveStatusAllSaved: {
    bn: 'সব পরিবর্তন সংরক্ষিত ✓',
    en: 'All changes saved ✓',
  },
  saveStatusSaving: {
    bn: 'ক্লাউডে সেভ হচ্ছে...',
    en: 'Saving to Cloud Database...',
  },
  saveStatusCloudSaved: {
    bn: 'ক্লাউড ডাটাবেজে সংরক্ষিত ✓',
    en: 'Cloud Database Saved ✓',
  },
  saveStatusFailed: {
    bn: 'সংরক্ষণ ব্যর্থ (অফলাইন মোড)',
    en: 'Save failed (Offline Mode)',
  },
  addEntryButton: {
    bn: 'খতিয়ানে রেকর্ড যোগ করুন',
    en: 'Add Record to Ledger',
  },
  clearDraftButton: {
    bn: 'ড্রাফট পরিষ্কার করুন',
    en: 'Clear Draft',
  },
  quickPresetsTitle: {
    bn: 'জনপ্রিয় দ্রুত এন্ট্রি শর্টকাট:',
    en: 'Corporate Quick Entry Presets:',
  },

  // Ledger & Transactions List
  ledgerTitle: {
    bn: 'দৈনিক খতিয়ান ও লেনদেন তালিকা',
    en: 'Daily Ledger & Transactions List',
  },
  searchPlaceholder: {
    bn: 'বিবরণ, ক্যাটেগরি বা পরিমাণ দিয়ে খুঁজুন...',
    en: 'Search by description, category, or amount...',
  },
  filterAllTypes: {
    bn: 'সকল লেনদেন',
    en: 'All Types',
  },
  filterExpenses: {
    bn: 'শুধুমাত্র ব্যয় (Debit)',
    en: 'Expenses Only (Debit)',
  },
  filterIncome: {
    bn: 'শুধুমাত্র আয় (Credit)',
    en: 'Income Only (Credit)',
  },
  filterAllCategories: {
    bn: 'সকল ক্যাটেগরি',
    en: 'All Categories',
  },
  exportCSV: {
    bn: 'এক্সেল / CSV এক্সপোর্ট',
    en: 'Export CSV',
  },
  printLedger: {
    bn: 'রসিদ / চালান প্রিন্ট',
    en: 'Print Vouchers',
  },
  tableColDescription: {
    bn: 'বিবরণ ও ক্যাটেগরি',
    en: 'Description & Category',
  },
  tableColWorkspace: {
    bn: 'ওয়ার্কস্পেস / ইউজার',
    en: 'Workspace / User',
  },
  tableColMethod: {
    bn: 'মাধ্যম',
    en: 'Method',
  },
  tableColDate: {
    bn: 'তারিখ ও সময়',
    en: 'Date & Time',
  },
  tableColAmount: {
    bn: 'টাকার পরিমাণ',
    en: 'Amount',
  },
  tableColActions: {
    bn: 'অ্যাকশন',
    en: 'Actions',
  },
  noTransactionsFound: {
    bn: 'কোনো লেনদেন বা হিসাব পাওয়া যায়নি।',
    en: 'No transactions found.',
  },

  // Owner Control & User Management
  ownerControlTitle: {
    bn: 'ওনার কন্ট্রোল ও ইউজার একাউন্ট ম্যানেজমেন্ট',
    en: 'Owner Control & User Account Management',
  },
  ownerSubtitle: {
    bn: 'শুধুমাত্র প্রধান ওনার নতুন ইউজার আইডি, পাসওয়ার্ড ও ওয়ার্কস্পেস পারমিশন নিয়ন্ত্রণ করতে পারেন।',
    en: 'Only the authenticated Owner can create User IDs, passwords, and configure workspace permissions.',
  },
  addNewUserBtn: {
    bn: 'নতুন ইউজার তৈরি করুন',
    en: 'Create New User Account',
  },
  userAccountsTab: {
    bn: 'ইউজার অ্যাকাউন্টস ও পারমিশন',
    en: 'User Accounts & Roles',
  },
  consolidatedTab: {
    bn: 'সমন্বিত মাস্টার অডিট',
    en: 'Consolidated Master Audit',
  },
  broadcastTab: {
    bn: 'গ্লোবাল নোটিশ ও অ্যাপ সেটিংস',
    en: 'Global Broadcast & Notice',
  },
  backupTab: {
    bn: 'ক্লাউড ব্যাকআপ ও রিস্টোর',
    en: 'Cloud Backup & Snapshot',
  },
  roleOwner: {
    bn: 'মেইন ওনার (Owner)',
    en: 'Primary Owner',
  },
  roleAdmin: {
    bn: 'অ্যাডমিন (Admin)',
    en: 'Administrator',
  },
  roleManager: {
    bn: 'ম্যানেজার (Manager)',
    en: 'Branch Manager',
  },
  roleStaff: {
    bn: 'স্টাফ / ক্যাশিয়ার (Staff)',
    en: 'Cashier / Staff',
  },
  roleViewer: {
    bn: 'নিরীক্ষক / ভিউয়ার (Viewer)',
    en: 'Auditor / Viewer',
  },
  statusActive: {
    bn: 'সক্রিয় (Active)',
    en: 'Active',
  },
  statusDisabled: {
    bn: 'নিষ্ক্রিয় (Disabled)',
    en: 'Suspended / Disabled',
  },
  actionEdit: {
    bn: 'সম্পাদনা ও পাসওয়ার্ড রিসেট',
    en: 'Edit & Reset Password',
  },
  actionDisable: {
    bn: 'অ্যাকাউন্ট স্থগিত করুন',
    en: 'Suspend Account',
  },
  actionEnable: {
    bn: 'অ্যাকাউন্ট চালু করুন',
    en: 'Activate Account',
  },
  actionDelete: {
    bn: 'অ্যাকাউন্ট মুছে ফেলুন',
    en: 'Delete Account',
  },

  // Themes & Appearance
  appearanceTitle: {
    bn: 'অ্যাপের রূপ ও ৪টি প্রিমিয়াম থিম সেটিংস',
    en: 'Appearance & 4 Premium Corporate Themes',
  },
  appearanceSubtitle: {
    bn: 'আপনার পছন্দমতো থিম ও ডার্ক/লাইট মোড নির্বাচন করুন। আপনার নির্বাচন ক্লাউডে সংরক্ষিত থাকবে।',
    en: 'Choose from 4 luxury corporate themes. Your selection is saved to your cloud profile.',
  },
  themeMidnightGoldTitle: {
    bn: 'মিডনাইট গোল্ড (Midnight Gold) — ডিফল্ট',
    en: 'Midnight Gold (Luxury Executive) — Default',
  },
  themeMidnightGoldDesc: {
    bn: 'রাজকীয় নেভি ব্লু (#101A2C), রয়েল গোল্ড (#D4AF37) এবং পিওর হোয়াইট এর আভিজাত্য।',
    en: 'Rich Primary Navy (#101A2C), Royal Gold (#D4AF37), and Pure White accents.',
  },
  themeRoyalBlueTitle: {
    bn: 'রয়েল ব্লু (Royal Blue)',
    en: 'Royal Blue (Corporate Banking)',
  },
  themeRoyalBlueDesc: {
    bn: 'গভীর ব্লু (#1E3A8A), সাফায়ার এবং ক্রিস্প হোয়াইট এর আধুনিক ব্যাংকিং থিম।',
    en: 'Deep royal blue (#1E3A8A), vibrant sapphire, and crisp white styling.',
  },
  themeEmeraldGreenTitle: {
    bn: 'এমারেল্ড গ্রিন (Emerald Green)',
    en: 'Emerald Green (Wealth & Growth)',
  },
  themeEmeraldGreenDesc: {
    bn: 'মার্জিত সবুজ (#064E3B), গোল্ডেন মিন্ট এবং শুভ্র হোয়াইট ফিন্যান্সিয়াল থিম।',
    en: 'Sophisticated pine (#064E3B), golden mint accents, and serene whites.',
  },
  themeGraphiteBlackTitle: {
    bn: 'গ্রাফাইট ব্ল্যাক (Graphite Black)',
    en: 'Graphite Black (Modern Stealth)',
  },
  themeGraphiteBlackDesc: {
    bn: 'আধুনিক অবসিডিয়ান ব্ল্যাক (#09090B), কাঠকয়লা চারকোল এবং প্লাটিনাম সিলভার।',
    en: 'Sleek obsidian black (#09090B), charcoal, and polished platinum silver.',
  },
  applyThemeBtn: {
    bn: 'এই থিমটি প্রয়োগ করুন',
    en: 'Apply Theme',
  },
  themeAppliedBadge: {
    bn: 'বর্তমান সক্রিয় থিম ✓',
    en: 'Active Theme ✓',
  },
  displayMode: {
    bn: 'ডিসপ্লে মোড (Display Mode)',
    en: 'Display Mode',
  },
  lightMode: {
    bn: 'লাইট মোড (Light Mode)',
    en: 'Light Mode',
  },
  darkMode: {
    bn: 'ডার্ক মোড (Dark Mode)',
    en: 'Dark Mode',
  },
  languageOptionTitle: {
    bn: 'ভাষা নির্বাচন (Language)',
    en: 'Language Preference',
  },
  numeralFormatTitle: {
    bn: 'সংখ্যার ফরম্যাট (Number Digits)',
    en: 'Numeral Display Format',
  },
  banglaDigitsOption: {
    bn: 'বাংলা সংখ্যা (যেমন: ১২,৩৫০ ৳)',
    en: 'Bangla Digits (e.g. ১২,৩৫০ ৳)',
  },
  englishDigitsOption: {
    bn: 'ইংরেজি সংখ্যা (যেমন: 12,350 ৳)',
    en: 'English Digits (e.g. 12,350 ৳)',
  },

  // Auth & Login
  loginTitle: {
    bn: 'ZARA একাউন্ট সাইন-ইন',
    en: 'ZARA Account Sign In',
  },
  loginSubtitle: {
    bn: 'মালিক কর্তৃক নির্ধারিত ইউজার আইডি ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।',
    en: 'Enter your assigned User ID and password to access your workspace.',
  },
  ownerLoginBadge: {
    bn: 'ওনার লগইন পোর্টাল',
    en: 'Owner Login Portal',
  },
  staffLoginBadge: {
    bn: 'ইউজার ও স্টাফ পোর্টাল',
    en: 'User & Staff Portal',
  },
  usernameField: {
    bn: 'ইউজার আইডি / ইউজারনেম',
    en: 'User ID / Username',
  },
  passwordField: {
    bn: 'পাসওয়ার্ড',
    en: 'Password',
  },
  signInButton: {
    bn: 'লগইন করুন',
    en: 'Sign In',
  },
  switchUserButton: {
    bn: 'ইউজার পরিবর্তন (৮ জন ইউজার টেস্ট)',
    en: 'Switch User (8 Demo Workspaces)',
  },
  logoutButton: {
    bn: 'লগআউট',
    en: 'Log Out',
  },

  // Invoices & Printing
  printVoucherTitle: {
    bn: 'কর্পোরেট ক্যাশ চালান ও রসিদ',
    en: 'Corporate Cash Voucher & Invoice',
  },
  receiptNumber: {
    bn: 'রসিদ নং',
    en: 'Receipt #',
  },
  receiptDate: {
    bn: 'ইস্যু তারিখ ও সময়',
    en: 'Issue Date & Time',
  },
  customerSign: {
    bn: 'গ্রাহক / প্রাপকের স্বাক্ষর',
    en: 'Recipient Signature',
  },
  authorizedSign: {
    bn: 'হিসাব রক্ষক / অনুমোদিত স্বাক্ষর',
    en: 'Authorized Financial Signatory',
  },
  watermarkCompany: {
    bn: 'ZARA কর্পোরেট ফাইনান্সিয়াল সিস্টেম',
    en: 'ZARA Corporate Financial System',
  },
  verifiedCloudRecord: {
    bn: 'ক্লাউড সার্ভার ভেরিফাইড ও সংরক্ষিত ✓',
    en: 'Verified Cloud Server Record ✓',
  },

  // Customers & Vendors
  customersTitle: {
    bn: 'গ্রাহক ও ভেন্ডর খাতা (CRM Ledger)',
    en: 'Customers & Vendors Ledger',
  },
  customersSubtitle: {
    bn: 'নিয়মিত কাস্টমার ও ভেন্ডরদের দেনা-পাওনা এবং ব্যালেন্স ট্র্যাকিং',
    en: 'Track receivables and payables for regular clients and suppliers',
  },
};

export function t(key: keyof typeof TRANSLATIONS, lang: Language): string {
  const item = TRANSLATIONS[key];
  if (!item) return key;
  return item[lang] || item['en'] || key;
}
