export type TransactionType = 'expense' | 'income';

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';

export type AppTheme = 'midnight-gold' | 'royal-blue' | 'emerald-green' | 'graphite-black' | 'emerald-graphite';

export type DisplayMode = 'light' | 'dark';

export type CurrencyCode = 'BDT' | 'USD' | 'EUR' | 'SAR';

export interface Category {
  id: string;
  nameBn: string;
  nameEn: string;
  icon: string;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  userId: string;
  workspaceUserId: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  timestamp: number;
  updatedAt?: number;
  syncedToCloud: boolean;
  notes?: string;
  createdByName?: string;
  customerName?: string;
}

export interface Customer {
  id: string;
  workspaceUserId: string;
  name: string;
  phone: string;
  whatsapp?: string;
  photoUrl?: string;
  photoData?: string;
  email?: string;
  address?: string;
  businessName?: string;
  notes?: string;
  type: 'customer' | 'vendor';
  balance: number; // positive = customer owes us (due), negative = advance credit (overpaid/deposit)
  updatedAt: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentDate: number;
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  reference?: string;
  notes?: string;
  recordedByName?: string;
  createdAt: number;
}

export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'overpaid';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerBusiness?: string;
  customerAddress?: string;
  workspaceUserId: string;
  date: number;
  dueDate: number;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number; // positive = remaining due, negative = credit / excess payment
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  payments: InvoicePayment[];
  serviceName?: string;         // e.g. "Iqama Renewal 9 months", "Exit / Re-entry Visa"
  iqamaNo?: string;             // e.g. "2525041410", "2231120094"
  branchOffice?: string;        // e.g. "JUB5 - Jubail - Al Madrasa / الجبيل - المدرسة"
  lastPaymentAmount?: number;   // e.g. 5000
  countryFlag?: string;         // e.g. "BD" | "SA"
  createdAt: number;
  updatedAt: number;
}

// Daily Home Bazar & Grocery Goods Account Types
export type HomeBazarCategory =
  | 'fish_meat'             // মাছ ও মাংস
  | 'vegetables_fruits'     // শাক-সবজি ও ফলমূল
  | 'groceries_staples'     // চাল, ডাল, তেল ও মশলা
  | 'dairy_bakery'          // দুধ, ডিম ও বেকারি
  | 'cleaning_toiletries'   // সাবান, ডিটারজেন্ট ও গৃহস্থালি
  | 'snacks_beverages'      // চা, নাস্তা ও পানীয়
  | 'other';                // অন্যান্য মুদি বাজার

export interface HomeBazarEntry {
  id: string;
  userId: string;
  workspaceUserId: string;
  date: string;              // YYYY-MM-DD
  itemName: string;          // e.g. "রুই মাছ", "বাসমতী চাল ৫ কেজি"
  category: HomeBazarCategory;
  quantity?: string;         // e.g. "2 kg", "1 dozen", "5 liter"
  amount: number;            // Amount spent
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  purchasedBy?: string;      // e.g. "Faysal Ahmed"
  buyerId?: string;          // e.g. "rh.faysal007", "BYR-01", "MBR-101"
  notes?: string;            // Notes / shop name
  createdAt: number;
  updatedAt: number;
}

export interface BazarBuyer {
  buyerId: string;
  name: string;
  phone?: string;
  role?: string;
  amount?: number;
  notes?: string;
  photoUrl?: string;
  photoData?: string;
  updatedAt?: number;
}

export interface BuyerSpendingSummary {
  buyerId: string;
  buyerName: string;
  totalSpent: number;
  itemCount: number;
  percentage: number;
}

export interface HomeBazarSummary {
  totalToday: number;
  totalThisMonth: number;
  monthlyBudget: number;
  remainingBudget: number;
  categoryTotals: Record<HomeBazarCategory, number>;
  buyerSummaries?: BuyerSpendingSummary[];
}

export interface CustomerStatement {
  customer: Customer;
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number; // positive = due, negative = credit
  isCredit: boolean;
  creditAmount: number;
  invoices: Invoice[];
  payments: InvoicePayment[];
  ledgerEntries: Array<{
    id: string;
    date: number;
    type: 'invoice' | 'payment' | 'opening_balance';
    reference: string;
    description: string;
    debit: number; // charges/invoiced
    credit: number; // payments received
    runningBalance: number;
  }>;
}

export type SyncStatus = 
  | 'idle'
  | 'saving'
  | 'saved_cloud'
  | 'saved_local'
  | 'error_offline'
  | 'queued';

export interface CloudAccountDoc {
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  updatedAt: string;
  lastSavedBy: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email?: string;
  appleId?: string;
  idProvider?: 'email' | 'apple';
  name: string;
  role: UserRole;
  workspaceName: string;
  status: 'active' | 'disabled';
  canExport: boolean;
  canDelete: boolean;
  canAddTransactions?: boolean;   // Permission: Add daily transactions / income / expense
  canViewLedger?: boolean;         // Permission: View ledger & transaction list
  canEditCustomers?: boolean;      // Permission: Add / edit customers & CRM
  canApproveInvoices?: boolean;    // Permission: Create invoices & record payments
  canManageCommissions?: boolean;  // Permission: View & edit commission sheet
  canManageBazar?: boolean;        // Permission: Access & manage Daily Bazar ledger
  canManageBuyers?: boolean;       // Permission: Add/edit Buyer IDs & Buyer photos
  isCommissionOnly?: boolean;      // Permission: Restricted exclusively to Commission Sheet
  isCommissionBazarOnly?: boolean; // Permission: Restricted exclusively to Commission Sheet & Daily Bazar
  theme?: AppTheme;
  displayMode?: DisplayMode;
  language?: 'bn' | 'en';
  useBanglaNumerals?: boolean;
  headerBgColor?: string;
  sidebarBgColor?: string;
  photoUrl?: string;
  photoData?: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface CommissionEntry {
  id: string;
  date: string;               // e.g. "2026-11-14"
  office: string;             // e.g. "JUB5 - Jubail - Al Madrasa"
  invoiceNo: string;          // e.g. "8295503408"
  invoiceStatus: 'Active' | 'Pending' | 'Cancelled';
  agent: string;              // Person / Agent name
  agentId?: string;
  client: string;             // Client name
  workerName?: string;        // Worker name (optional)
  clientMobile?: string;      // e.g. "0531598048"
  service: string;            // e.g. "6-month visa"
  qty: number;                // e.g. 1
  ratePerUnit: number;        // e.g. 0 (user entered, no auto amount)
  invoiceTotal: number;       // e.g. 0
  remainingAmount: number;    // e.g. 0
  eligible: boolean;          // true = Yes (eligible), false = No (waiting)
  reasonNotEligible?: string; // e.g. "Pending: the wakalah installment"
  commissionAmount: number;   // e.g. 0 (user entered, no auto amount)
  isClawback?: boolean;       // true if clawback on cancelled invoice
  clawbackAmount?: number;    // e.g. 0
  payoutStatus: 'To pay' | 'Paid' | 'Not eligible' | 'Carried over';
  paidAt?: number;
  period?: string;            // e.g. "2026-11" or "2026-06 — 2026-09"
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommissionPersonAccount {
  id: string;
  name: string;
  iqamaNo?: string;
  phone?: string;
  office?: string;
  linkedUserId?: string;
  photoUrl?: string;
  photoData?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommissionStatementSummary {
  agent: string;
  period: string;
  printedDate: string;
  totalInvoices: number;
  commissionDue: number;
  clawbackAmount: number;
  owedByAgent: number;
  alreadyPaid: number;
  notYetEligibleAmount: number;
  eligibleCount: number;
  waitingCount: number;
  cancelledCount: number;
  currency: string;
}

export interface GlobalAppSettings {
  appName: string;
  companyName: string;
  version: string;
  currency: 'BDT' | 'USD' | 'EUR' | 'SAR';
  broadcastMessage: string;
  broadcastType: 'info' | 'warning' | 'alert' | 'success';
  broadcastActive: boolean;
  defaultTheme?: AppTheme;
  headerBgColor?: string;
  sidebarBgColor?: string;
  forceRefreshAt?: number;
  updatedAt: number;
  lastUpdatedBy: string;
}

export interface AppVersionInfo {
  buildId: string;
  version: string;
  settingsUpdatedAt: number;
  forceRefreshAt: number;
  serverTime: number;
}

export interface UserProfile {
  userId: string;
  name: string;
  phoneOrEmail: string;
  photoUrl?: string;
  photoData?: string;
  currency: 'BDT' | 'USD' | 'EUR' | 'SAR';
  useBanglaNumerals: boolean;
  language: 'bn' | 'en';
  theme: AppTheme;
  displayMode: DisplayMode;
  storageMode: 'cloud_hybrid' | 'cloud_only' | 'local_mmkv';
  isSimulatedOffline: boolean;
  headerBgColor?: string;
  sidebarBgColor?: string;
}
