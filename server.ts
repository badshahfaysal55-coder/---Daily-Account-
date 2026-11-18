import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

async function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return { ai, Type };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'zara_database.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'zara_database.backup.json');
const DB_BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_BACKUPS_DIR)) {
  fs.mkdirSync(DB_BACKUPS_DIR, { recursive: true });
}
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';
export type AppTheme = 'midnight-gold' | 'royal-blue' | 'emerald-green' | 'graphite-black' | 'emerald-graphite';
export type DisplayMode = 'light' | 'dark';

export interface DbUser {
  id: string;
  username: string;
  email?: string;
  appleId?: string;
  idProvider?: 'email' | 'apple';
  name: string;
  passwordHash: string;
  role: UserRole;
  workspaceName: string;
  status: 'active' | 'disabled';
  canExport: boolean;
  canDelete: boolean;
  canAddTransactions?: boolean;   // Permission: Add transactions
  canViewLedger?: boolean;         // Permission: View ledger
  canEditCustomers?: boolean;      // Permission: Add / edit customers
  canApproveInvoices?: boolean;    // Permission: Invoices & payments
  canManageCommissions?: boolean;  // Permission: Commission sheets
  canManageBazar?: boolean;        // Permission: Daily Bazar ledger
  canManageBuyers?: boolean;       // Permission: Buyer IDs & Buyer photos
  isCommissionOnly?: boolean;      // Permission: Commission sheet only
  isCommissionBazarOnly?: boolean; // Permission: Commission sheet & Daily Bazar only
  theme?: AppTheme;
  displayMode?: DisplayMode;
  language?: 'bn' | 'en';
  useBanglaNumerals?: boolean;
  headerBgColor?: string;
  sidebarBgColor?: string;
  photoUrl?: string;
  photoData?: string;
  createdAt: number;
  updatedAt?: number;
  lastLoginAt?: number;
}

export interface DbCommissionEntry {
  id: string;
  date: string;               // e.g. "2026-11-14"
  office: string;             // e.g. "JUB5 - Jubail - Al Madrasa"
  invoiceNo: string;          // e.g. "8295503408"
  invoiceStatus: 'Active' | 'Pending' | 'Cancelled';
  agent: string;              // Person / Agent name
  agentId?: string;
  client: string;             // Client name
  workerName?: string;        // Worker name
  clientMobile?: string;      // e.g. "0531598048"
  service: string;            // e.g. "6-month visa"
  qty: number;                // e.g. 1
  ratePerUnit: number;        // User entered (0 if not entered)
  invoiceTotal: number;       // User entered (0 if not entered)
  remainingAmount: number;    // User entered (0 if not entered)
  eligible: boolean;          // true = Yes (eligible), false = No (waiting)
  reasonNotEligible?: string; // e.g. "Pending: the wakalah installment"
  commissionAmount: number;   // User entered (0 if not entered)
  isClawback?: boolean;       // true if clawback on cancelled invoice
  clawbackAmount?: number;    // e.g. 0
  payoutStatus: 'To pay' | 'Paid' | 'Not eligible' | 'Carried over';
  paidAt?: number;
  period?: string;            // e.g. "2026-11" or "2026-06 — 2026-09"
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DbCommissionPersonAccount {
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

export interface DbTransaction {
  id: string;
  userId: string;
  workspaceUserId: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  timestamp: number;
  updatedAt?: number;
  notes?: string;
  createdByName?: string;
  customerName?: string;
  syncedToCloud?: boolean;
}

export interface DbCustomer {
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
  balance: number;
  updatedAt: number;
}

export interface DbBazarBuyer {
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

export interface DbGlobalSettings {
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
  bazarMonthlyBudget?: number;
  bazarBuyers?: DbBazarBuyer[];
  forceRefreshAt?: number;
  updatedAt: number;
  lastUpdatedBy: string;
}

export interface DbInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DbInvoicePayment {
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

export interface DbInvoice {
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
  items: DbInvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number; // positive = remaining due, negative = customer credit/overpayment
  status: 'paid' | 'partial' | 'unpaid' | 'overpaid';
  serviceName?: string;
  iqamaNo?: string;
  branchOffice?: string;
  lastPaymentAmount?: number;
  countryFlag?: string;
  notes?: string;
  terms?: string;
  payments: DbInvoicePayment[];
  createdAt: number;
  updatedAt: number;
}

export interface DbHomeBazarEntry {
  id: string;
  userId: string;
  workspaceUserId: string;
  date: string;
  itemName: string;
  category: 'fish_meat' | 'vegetables_fruits' | 'groceries_staples' | 'dairy_bakery' | 'cleaning_toiletries' | 'snacks_beverages' | 'other';
  quantity?: string;
  amount: number;
  paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
  purchasedBy?: string;
  buyerId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DatabaseSchema {
  users: DbUser[];
  transactions: DbTransaction[];
  customers: DbCustomer[];
  invoices: DbInvoice[];
  commissionEntries: DbCommissionEntry[];
  commissionPersons?: DbCommissionPersonAccount[];
  commissionMonths?: string[];
  homeBazarEntries: DbHomeBazarEntry[];
  drafts: Record<string, { description: string; amount: string; category?: string; type?: 'income' | 'expense'; updatedAt: number }>;
  sessions?: Record<string, string>;
  deletedRecordIds?: Record<string, number>;
  globalSettings: DbGlobalSettings;
  auditLogs: Array<{ id: string; timestamp: number; action: string; performedBy: string; details: any }>;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_zara_salt_2026').digest('hex');
}

// Initial seed data: ONLY the Main Owner exists by default (no automatic staff/demo users)
const INITIAL_DATABASE: DatabaseSchema = {
  users: [
    {
      id: 'usr_owner_faisal',
      username: 'rh.faysal007',
      name: 'Faysal Ahmed (Main Owner)',
      passwordHash: hashPassword('zara@owner2026'),
      role: 'owner',
      workspaceName: 'Executive HQ Workspace',
      status: 'active',
      canExport: true,
      canDelete: true,
      canAddTransactions: true,
      canViewLedger: true,
      canEditCustomers: true,
      canApproveInvoices: true,
      canManageCommissions: true,
      canManageBazar: true,
      canManageBuyers: true,
      theme: 'midnight-gold',
      displayMode: 'light',
      language: 'en',
      createdAt: Date.now() - 86400000 * 30,
    },
  ],
  transactions: [
    {
      id: 'tx-owner-1',
      userId: 'usr_owner_faisal',
      workspaceUserId: 'usr_owner_faisal',
      description: 'ZARA কর্পোরেট বিনিয়োগ তহবিল জমা',
      amount: 150000,
      type: 'income',
      category: 'investment',
      paymentMethod: 'bank',
      timestamp: Date.now() - 86400000 * 3,
      notes: 'হেড অফিস মাস্টার ফান্ড',
      createdByName: 'Faysal Ahmed (Main Owner)',
      customerName: 'ZARA Holdings',
    },
    {
      id: 'tx-owner-2',
      userId: 'usr_owner_faisal',
      workspaceUserId: 'usr_owner_faisal',
      description: 'সফটওয়্যার ও ক্লাউড সার্ভার লাইসেন্স রিনিউ',
      amount: 12500,
      type: 'expense',
      category: 'bills',
      paymentMethod: 'bank',
      timestamp: Date.now() - 86400000 * 1,
      notes: 'AWS & Cloud Infrastructure',
      createdByName: 'Faysal Ahmed (Main Owner)',
      customerName: 'Cloud Provider Inc.',
    },
  ],
  customers: [
    {
      id: 'cust-1',
      workspaceUserId: 'usr_owner_faisal',
      name: 'মেসার্স রহিম টেক্সটাইল',
      phone: '+880 1711-234567',
      type: 'customer',
      balance: 45000,
      updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'cust-2',
      workspaceUserId: 'usr_owner_faisal',
      name: 'প্রিমিয়াম ফ্যাব্রিক্স সরবরাহকারী',
      phone: '+880 1819-876543',
      type: 'vendor',
      balance: -28000,
      updatedAt: Date.now() - 86400000 * 4,
    },
  ],
  invoices: [],
  commissionEntries: [],
  commissionPersons: [
    {
      id: 'person_rh_faysal',
      name: 'RH FAYSAL',
      iqamaNo: '',
      phone: '',
      office: 'JUB5 - Jubail - Al Madrasa',
      linkedUserId: 'usr_owner_faisal',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  commissionMonths: [new Date().toISOString().slice(0, 7)],
  homeBazarEntries: [],
  drafts: {},
  sessions: {},
  globalSettings: {
    appName: 'ZARA Accounting App',
    companyName: 'ZARA Group & Holdings Ltd.',
    version: '2.5.0-gold',
    currency: 'SAR',
    broadcastMessage: 'স্বাগতম ZARA Accounting ক্লাউড সিস্টেমে। সকল হিসাব স্বয়ংক্রিয়ভাবে ক্লাউড ডাটাবেজে সংরক্ষিত হচ্ছে।',
    broadcastType: 'info',
    broadcastActive: true,
    defaultTheme: 'midnight-gold',
    bazarMonthlyBudget: 0,
    bazarBuyers: [
      { buyerId: 'rh.faysal007', name: 'Faysal Ahmed (Main Owner)', role: 'Owner' },
    ],
    updatedAt: Date.now(),
    lastUpdatedBy: 'rh.faysal007 (Owner)',
  },
  auditLogs: [
    {
      id: 'audit-init',
      timestamp: Date.now(),
      action: 'SYSTEM_INITIALIZED',
      performedBy: 'System / Owner (rh.faysal007)',
      details: 'Initialized ZARA Accounting Cloud Database with Owner-only account provisioning.',
    },
  ],
};

function isAutoSyncedCustomerInvoiceCommission(entry: any): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const id = String(entry.id || '');
  const notes = String(entry.notes || '');
  const isAutoSyncedSource =
    id.startsWith('comm-inv-') || notes === 'Auto-synced from Daily Invoices';
  if (!isAutoSyncedSource) return false;
  const commAmt = Number(entry.commissionAmount) || 0;
  const rate = Number(entry.ratePerUnit) || 0;
  return commAmt === 0 && rate === 0 && !entry.isClawback && entry.invoiceStatus !== 'Cancelled';
}

// Non-destructive database loader that preserves all old settings and data across updates
function normalizeLoadedDatabase(parsed: any): DatabaseSchema | null {
  if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.transactions) || !parsed.globalSettings) {
    return null;
  }
  if (!Array.isArray(parsed.customers)) parsed.customers = INITIAL_DATABASE.customers;
  if (!Array.isArray(parsed.invoices)) parsed.invoices = [];
  if (!Array.isArray(parsed.commissionEntries)) parsed.commissionEntries = [];
  if (!Array.isArray(parsed.commissionPersons)) parsed.commissionPersons = [];
  if (!Array.isArray(parsed.commissionMonths)) parsed.commissionMonths = [];
  if (!Array.isArray(parsed.homeBazarEntries)) parsed.homeBazarEntries = [];
  if (!Array.isArray(parsed.auditLogs)) parsed.auditLogs = [];
  if (!parsed.drafts || typeof parsed.drafts !== 'object') parsed.drafts = {};
  if (!parsed.sessions || typeof parsed.sessions !== 'object') parsed.sessions = {};
  if (!parsed.deletedRecordIds || typeof parsed.deletedRecordIds !== 'object') parsed.deletedRecordIds = {};

  // Exclude and tombstone any legacy auto-synced 0-commission customer invoices from Commission Sheet
  const purgeTs = Date.now();
  const keptCommissionEntries: any[] = [];
  parsed.commissionEntries.forEach((entry: any) => {
    if (isAutoSyncedCustomerInvoiceCommission(entry)) {
      if (entry?.id && !parsed.deletedRecordIds[entry.id]) {
        parsed.deletedRecordIds[entry.id] = purgeTs;
      }
      parsed.__purgedAutoSyncedCommissions = true;
    } else {
      keptCommissionEntries.push(entry);
    }
  });
  parsed.commissionEntries = keptCommissionEntries;

  if (!parsed.globalSettings.currency) {
    parsed.globalSettings.currency = 'SAR';
  }
  if (parsed.globalSettings.bazarMonthlyBudget === undefined) {
    parsed.globalSettings.bazarMonthlyBudget = 0;
  }
  if (parsed.globalSettings.forceRefreshAt === undefined) {
    parsed.globalSettings.forceRefreshAt = 0;
  }
  if (!Array.isArray(parsed.globalSettings.bazarBuyers)) {
    parsed.globalSettings.bazarBuyers = [
      { buyerId: 'rh.faysal007', name: 'Faysal Ahmed (Main Owner)', role: 'Owner' },
    ];
  }

  // Consolidate legacy "FAYSAL" records & profile into "RH FAYSAL" (one-time / idempotent)
  // and NEVER auto-create new Person accounts from commissionEntries or user profiles
  const nowTs = Date.now();
  const hasExplicitFaysalOnly = parsed.commissionPersons.some(
    (p: any) => typeof p?.name === 'string' && p.name.trim().toLowerCase() === 'faysal'
  );
  const hasRhFaysal = parsed.commissionPersons.some(
    (p: any) => typeof p?.name === 'string' && p.name.trim().toLowerCase() === 'rh faysal'
  );

  if (hasExplicitFaysalOnly || !hasRhFaysal) {
    const faysalPersons = parsed.commissionPersons.filter(
      (p: any) => typeof p?.name === 'string' && p.name.trim().toLowerCase() === 'faysal'
    );
    const existingRh = parsed.commissionPersons.find(
      (p: any) => typeof p?.name === 'string' && p.name.trim().toLowerCase() === 'rh faysal'
    );

    if (faysalPersons.length > 0) {
      const primarySource = faysalPersons[0];
      const mergedRh: any = existingRh
        ? {
            ...existingRh,
            name: 'RH FAYSAL',
            iqamaNo: existingRh.iqamaNo || primarySource.iqamaNo || '',
            phone: existingRh.phone || primarySource.phone || '',
            office: existingRh.office || primarySource.office || 'JUB5 - Jubail - Al Madrasa',
            linkedUserId: existingRh.linkedUserId || primarySource.linkedUserId || 'usr_owner_faisal',
            photoUrl: existingRh.photoUrl || primarySource.photoUrl,
            photoData: existingRh.photoData || primarySource.photoData,
            updatedAt: nowTs,
          }
        : {
            ...primarySource,
            id: 'person_rh_faysal',
            name: 'RH FAYSAL',
            updatedAt: nowTs,
          };

      faysalPersons.forEach((fp: any) => {
        if (fp?.id && fp.id !== mergedRh.id) {
          parsed.deletedRecordIds[fp.id] = nowTs;
        }
      });

      parsed.commissionPersons = parsed.commissionPersons.filter(
        (p: any) =>
          typeof p?.name === 'string' &&
          p.name.trim().toLowerCase() !== 'faysal' &&
          p.name.trim().toLowerCase() !== 'rh faysal'
      );
      parsed.commissionPersons.unshift(mergedRh);
      parsed.__migratedPersons = true;
    } else if (!existingRh && parsed.commissionPersons.length === 0) {
      parsed.commissionPersons.push({
        id: 'person_rh_faysal',
        name: 'RH FAYSAL',
        iqamaNo: '',
        phone: '',
        office: 'JUB5 - Jubail - Al Madrasa',
        linkedUserId: 'usr_owner_faisal',
        createdAt: nowTs,
        updatedAt: nowTs,
      });
      parsed.__migratedPersons = true;
    }
  }

  // Ensure any "FAYSAL" commission records are merged into "RH FAYSAL"
  parsed.commissionEntries.forEach((entry: any) => {
    const ym = typeof entry?.date === 'string' && /^\d{4}-\d{2}/.test(entry.date) ? entry.date.slice(0, 7) : null;
    if (ym && !parsed.commissionMonths.includes(ym)) {
      parsed.commissionMonths.push(ym);
    }
    const agName = typeof entry?.agent === 'string' ? entry.agent.trim() : '';
    if (agName && (agName.toLowerCase() === 'faysal' || agName.toLowerCase() === 'rh faysal') && entry.agent !== 'RH FAYSAL') {
      entry.agent = 'RH FAYSAL';
      entry.updatedAt = nowTs;
      parsed.__migratedPersons = true;
    }
  });

  // Only backfill missing user fields — never overwrite existing saved user preferences/settings
  parsed.users.forEach((u: any) => {
    if (u.role === 'cashier' || u.role === 'user') u.role = 'staff';
    if (!u.theme) u.theme = 'midnight-gold';
    if (!u.displayMode) u.displayMode = 'light';
    if (!u.language) u.language = 'en';
    if (u.useBanglaNumerals === undefined) u.useBanglaNumerals = u.language === 'bn';
    if (u.canAddTransactions === undefined) u.canAddTransactions = true;
    if (u.canViewLedger === undefined) u.canViewLedger = true;
    if (u.canEditCustomers === undefined) u.canEditCustomers = u.role !== 'viewer';
    if (u.canApproveInvoices === undefined) u.canApproveInvoices = u.role === 'owner' || u.role === 'admin' || u.role === 'manager';
    if (u.canManageCommissions === undefined) u.canManageCommissions = u.role === 'owner' || u.role === 'admin' || u.role === 'manager';
    if (u.canManageBazar === undefined) u.canManageBazar = u.role === 'owner' || !u.isCommissionOnly;
    if (u.canManageBuyers === undefined) u.canManageBuyers = u.role === 'owner' || u.role === 'admin';
    if (u.isCommissionBazarOnly) {
      u.isCommissionOnly = false;
      if (u.canManageCommissions === undefined) u.canManageCommissions = true;
      if (u.canManageBazar === undefined) u.canManageBazar = true;
    }
  });

  // Self-heal profile & customer photos between PHOTOS_DIR and embedded photoData
  const rehydrateRecordPhoto = (rec: any) => {
    if (!rec) return;
    const urlPath = typeof rec.photoUrl === 'string' && rec.photoUrl.startsWith('/api/photos/')
      ? path.join(PHOTOS_DIR, rec.photoUrl.replace('/api/photos/', ''))
      : null;

    if (rec.photoData && typeof rec.photoData === 'string') {
      const m = rec.photoData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (m) {
        let ext = m[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const targetPath = urlPath || path.join(PHOTOS_DIR, `${rec.id}_restored.${ext}`);
        if (!fs.existsSync(targetPath)) {
          try {
            fs.writeFileSync(targetPath, Buffer.from(m[2], 'base64'));
            if (!rec.photoUrl) {
              rec.photoUrl = `/api/photos/${path.basename(targetPath)}`;
            }
          } catch {}
        }
      }
    } else if (urlPath && fs.existsSync(urlPath)) {
      try {
        const buf = fs.readFileSync(urlPath);
        if (buf.length > 0) {
          const ext = path.extname(urlPath).replace('.', '').toLowerCase() || 'jpg';
          const mime = ext === 'jpg' ? 'jpeg' : ext;
          rec.photoData = `data:image/${mime};base64,${buf.toString('base64')}`;
        }
      } catch {}
    } else if (rec.id && fs.existsSync(PHOTOS_DIR)) {
      try {
        const prefix = `${rec.id}_`;
        const candidates = fs
          .readdirSync(PHOTOS_DIR)
          .filter((f) => f.startsWith(prefix))
          .sort()
          .reverse();
        const best = candidates.find((f) => {
          try {
            return fs.statSync(path.join(PHOTOS_DIR, f)).size > 100;
          } catch {
            return false;
          }
        });
        if (best) {
          const full = path.join(PHOTOS_DIR, best);
          const buf = fs.readFileSync(full);
          const ext = path.extname(best).replace('.', '').toLowerCase() || 'jpg';
          const mime = ext === 'jpg' ? 'jpeg' : ext;
          rec.photoUrl = `/api/photos/${best}`;
          rec.photoData = `data:image/${mime};base64,${buf.toString('base64')}`;
        } else if (urlPath && !fs.existsSync(urlPath)) {
          rec.photoUrl = undefined;
        }
      } catch {}
    }
  };

  parsed.users.forEach(rehydrateRecordPhoto);
  parsed.customers.forEach(rehydrateRecordPhoto);
  parsed.commissionPersons.forEach(rehydrateRecordPhoto);
  if (Array.isArray(parsed.globalSettings?.bazarBuyers)) {
    parsed.globalSettings.bazarBuyers.forEach((b: any) => {
      if (!b || !b.buyerId) return;
      const safeKey = 'buyer_' + String(b.buyerId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const temp: any = { id: safeKey, photoUrl: b.photoUrl, photoData: b.photoData };
      rehydrateRecordPhoto(temp);
      if (temp.photoUrl) b.photoUrl = temp.photoUrl;
      if (temp.photoData) b.photoData = temp.photoData;
    });
  }

  return parsed as DatabaseSchema;
}

function loadDatabase(): DatabaseSchema {
  for (const candidatePath of [DB_FILE, DB_BACKUP_FILE]) {
    try {
      if (fs.existsSync(candidatePath)) {
        const data = fs.readFileSync(candidatePath, 'utf-8');
        const parsed = JSON.parse(data);
        const normalized = normalizeLoadedDatabase(parsed);
        if (normalized) {
          const hadPurgeOrMigration = Boolean(
            (normalized as any).__purgedAutoSyncedCommissions || (normalized as any).__migratedPersons
          );
          if ((normalized as any).__purgedAutoSyncedCommissions !== undefined) {
            delete (normalized as any).__purgedAutoSyncedCommissions;
          }
          if ((normalized as any).__migratedPersons !== undefined) {
            delete (normalized as any).__migratedPersons;
          }
          if (candidatePath === DB_BACKUP_FILE || hadPurgeOrMigration) {
            if (candidatePath === DB_BACKUP_FILE) {
              console.warn('Recovered database from rolling backup without losing settings or data.');
            }
            fs.writeFileSync(DB_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
          }
          return normalized;
        }
      }
    } catch (err) {
      console.error(`Error reading database candidate (${candidatePath}):`, err);
    }
  }
  saveDatabase(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

let lastRollingBackupAt = 0;
let lastServerSaveAt = Date.now();

function writeRollingCheckpoint(jsonPayload: string, force = false) {
  const now = Date.now();
  if (!force && now - lastRollingBackupAt < 3 * 60 * 1000) return;
  try {
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
    const target = path.join(DB_BACKUPS_DIR, `zara_db_${stamp}.json`);
    fs.writeFileSync(target, jsonPayload, 'utf-8');
    lastRollingBackupAt = now;

    // Keep last 24 rolling auto-backup files
    const files = fs
      .readdirSync(DB_BACKUPS_DIR)
      .filter((f) => f.startsWith('zara_db_') && f.endsWith('.json'))
      .sort()
      .reverse();
    files.slice(24).forEach((old) => {
      try {
        fs.unlinkSync(path.join(DB_BACKUPS_DIR, old));
      } catch {}
    });
  } catch (err) {
    console.error('Rolling backup error:', err);
  }
}

function saveDatabase(database: DatabaseSchema) {
  try {
    if (fs.existsSync(DB_FILE)) {
      try {
        const existingRaw = fs.readFileSync(DB_FILE, 'utf-8');
        JSON.parse(existingRaw); // Only keep backup if existing DB file is valid JSON
        fs.writeFileSync(DB_BACKUP_FILE, existingRaw, 'utf-8');
      } catch {
        // existing file invalid; skip overwriting good backup
      }
    }
    const serialized = JSON.stringify(database, null, 2);
    const tempPath = DB_FILE + '.tmp';
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
    lastServerSaveAt = Date.now();
    writeRollingCheckpoint(serialized, false);
  } catch (err) {
    console.error('Error persisting database:', err);
  }
}

// In-memory active database
let db = loadDatabase();

// Continuous background checkpoint backup every 5 minutes
setInterval(() => {
  try {
    const serialized = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_BACKUP_FILE, serialized, 'utf-8');
    writeRollingCheckpoint(serialized, true);
  } catch {}
}, 5 * 60 * 1000);

// In-memory sessions store (token -> DbUser), hydrated from persisted db.sessions
const SESSIONS = new Map<string, DbUser>();
if (db.sessions) {
  for (const [tok, uid] of Object.entries(db.sessions)) {
    const matchedUser = db.users.find((u) => u.id === uid);
    if (matchedUser) {
      SESSIONS.set(tok, matchedUser);
    }
  }
}

// Event subscribers for real-time cloud push
const clients: Array<{ id: string; res: express.Response; userId: string }> = [];

function notifySubscribers(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      // client disconnected
    }
  }
}

const isProductionEnv = process.env.NODE_ENV === 'production';
let cachedBuildFingerprint = { value: '', computedAt: 0 };

function computeLatestMtimeInDir(dirPath: string): number {
  let latest = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = computeLatestMtimeInDir(fullPath);
        if (sub > latest) latest = sub;
      } else {
        try {
          const st = fs.statSync(fullPath);
          if (st.mtimeMs > latest) latest = st.mtimeMs;
        } catch {}
      }
    }
  } catch {}
  return latest;
}

function getBuildId(): string {
  const now = Date.now();
  if (cachedBuildFingerprint.value && now - cachedBuildFingerprint.computedAt < 3000) {
    return cachedBuildFingerprint.value;
  }
  const hash = crypto.createHash('sha1');
  try {
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
      hash.update(fs.readFileSync(distIndex));
    }
    const distSw = path.join(__dirname, 'dist', 'sw.js');
    if (fs.existsSync(distSw)) {
      hash.update(fs.readFileSync(distSw));
    }
    const serverStat = fs.statSync(__filename);
    hash.update(String(Math.round(serverStat.mtimeMs)));
    if (!isProductionEnv) {
      const rootHtml = path.join(__dirname, 'index.html');
      if (fs.existsSync(rootHtml)) {
        hash.update(String(Math.round(fs.statSync(rootHtml).mtimeMs)));
      }
      hash.update(String(Math.round(computeLatestMtimeInDir(path.join(__dirname, 'src')))));
    }
  } catch {
    hash.update('zara-default-build');
  }
  const digest = hash.digest('hex').slice(0, 14);
  cachedBuildFingerprint = { value: digest, computedAt: now };
  return digest;
}

function getAppVersionInfo() {
  return {
    buildId: getBuildId(),
    version: db.globalSettings?.version || '2.5.0-gold',
    settingsUpdatedAt: Number(db.globalSettings?.updatedAt) || 0,
    forceRefreshAt: Number(db.globalSettings?.forceRefreshAt) || 0,
    serverTime: Date.now(),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (
      origin &&
      (origin === 'https://localhost' ||
        origin === 'http://localhost' ||
        origin === 'capacitor://localhost' ||
        origin === 'ionic://localhost' ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:'))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'x-auth-token');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    if (!req.path.startsWith('/photos') && req.path !== '/sync/events') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
  // Self-healing photo serving: if file on disk is missing after an update, reconstruct it from embedded photoData
  app.get('/api/photos/:filename', (req, res, next) => {
    const filename = path.basename(req.params.filename || '');
    const filePath = path.join(PHOTOS_DIR, filename);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const targetUrl = `/api/photos/${filename}`;
    const matchedUser = (db.users || []).find(
      (u) => u.photoData && (u.photoUrl === targetUrl || filename.startsWith(`${u.id}_`))
    );
    const matchedCust = !matchedUser
      ? (db.customers || []).find(
          (c) => c.photoData && (c.photoUrl === targetUrl || filename.startsWith(`${c.id}_`))
        )
      : undefined;
    const matchedPerson = !matchedUser && !matchedCust
      ? (db.commissionPersons || []).find(
          (p) => p.photoData && (p.photoUrl === targetUrl || filename.startsWith(`${p.id}_`))
        )
      : undefined;
    const dataUrl = matchedUser?.photoData || matchedCust?.photoData || matchedPerson?.photoData;
    if (dataUrl) {
      const m = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (m) {
        const buf = Buffer.from(m[2], 'base64');
        try {
          fs.writeFileSync(filePath, buf);
        } catch {}
        res.setHeader('Content-Type', `image/${m[1].toLowerCase()}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buf);
      }
    }
    return next();
  });
  app.use('/api/photos', express.static(PHOTOS_DIR));

  // Helper middleware to authenticate token with persistent session recovery
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token) {
      let user = SESSIONS.get(token);
      if (!user && db.sessions && db.sessions[token]) {
        const uid = db.sessions[token];
        user = db.users.find((u) => u.id === uid);
        if (user) {
          SESSIONS.set(token, user);
        }
      }
      if (!user) {
        // Re-hydrate session ONLY if token explicitly encodes a known user ID or username
        const matched = db.users.find(
          (u) => token.includes(u.id) || token.includes(u.username)
        );
        if (matched) {
          SESSIONS.set(token, matched);
          if (!db.sessions) db.sessions = {};
          db.sessions[token] = matched.id;
          saveDatabase(db);
          user = matched;
        }
      }

      if (user) {
        const freshUser = db.users.find((u) => u.id === user!.id);
        if (freshUser) {
          if (freshUser.status === 'disabled') {
            return res.status(403).json({ error: 'Your account has been suspended by the Owner' });
          }
          SESSIONS.set(token, freshUser);
          (req as any).user = freshUser;
          (req as any).token = token;
          res.setHeader('x-auth-token', token);
          return next();
        } else {
          // User was deleted: purge stale session token
          SESSIONS.delete(token);
          if (db.sessions && db.sessions[token]) {
            delete db.sessions[token];
            saveDatabase(db);
          }
        }
      }

      // If client supplied an explicit non-auto user token that no longer resolves to any user, reject instead of silently elevating to Owner
      if (!token.startsWith('token_auto_')) {
        return res.status(401).json({
          error: 'User session invalid or account removed',
          accountRemoved: true,
        });
      }
    }

    // Seamless fallback to active primary owner when no valid token is supplied
    const defaultUser = db.users.find((u) => u.role === 'owner' && u.status !== 'disabled') || db.users[0];
    if (defaultUser && defaultUser.status !== 'disabled') {
      const autoToken = `token_auto_${defaultUser.id}`;
      SESSIONS.set(autoToken, defaultUser);
      if (!db.sessions) db.sessions = {};
      if (db.sessions[autoToken] !== defaultUser.id) {
        db.sessions[autoToken] = defaultUser.id;
        saveDatabase(db);
      }
      (req as any).user = defaultUser;
      (req as any).token = autoToken;
      res.setHeader('x-auth-token', autoToken);
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  };

  // Helper middleware for Owner-only routes
  const ownerOnlyMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as DbUser;
    if (user.role !== 'owner') {
      return res.status(403).json({ error: 'Access Denied: Only the Main Owner has administrative authority for this action' });
    }
    next();
  };

  /* ------------------- AUTH ROUTES ------------------- */
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'User ID / Mail Address and password are required' });
    }

    const identifier = String(username).trim().toLowerCase();
    const hashed = hashPassword(password);
    const user = db.users.find(
      (u) =>
        u.passwordHash === hashed &&
        (u.username.toLowerCase() === identifier ||
          (u.email && u.email.toLowerCase() === identifier) ||
          (u.appleId && u.appleId.toLowerCase() === identifier))
    );

    if (!user) {
      return res.status(401).json({ error: 'ভুল ইউজার আইডি / ইমেইল অথবা পাসওয়ার্ড (Invalid User ID, Email or Password)' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'আপনার অ্যাকাউন্টটি Owner দ্বারা স্থগিত (Suspended) করা রয়েছে।' });
    }

    const token = `token_${user.id}_${crypto.randomUUID()}`;
    user.lastLoginAt = Date.now();
    if (!db.sessions) db.sessions = {};
    db.sessions[token] = user.id;
    SESSIONS.set(token, user);

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'USER_LOGIN',
      performedBy: `${user.name} (${user.username})`,
      details: { role: user.role, workspace: user.workspaceName },
    });
    db.auditLogs = db.auditLogs.slice(0, 100);
    saveDatabase(db);

    const safeUser = { ...user };
    delete (safeUser as any).passwordHash;

    return res.json({
      token,
      user: safeUser,
      globalSettings: db.globalSettings,
    });
  });

  app.post('/api/auth/apple-login', async (req, res) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({ error: 'Apple Sign-In ID token is required' });
      }

      const firebaseCfgPath = path.join(__dirname, 'firebase-applet-config.json');
      if (!fs.existsSync(firebaseCfgPath)) {
        return res.status(500).json({ error: 'Firebase configuration missing on server' });
      }
      const firebaseCfg = JSON.parse(fs.readFileSync(firebaseCfgPath, 'utf-8'));
      const apiKey = firebaseCfg?.apiKey;
      if (!apiKey) {
        return res.status(500).json({ error: 'Firebase API key missing on server' });
      }

      const verifyRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!verifyRes.ok) {
        return res.status(401).json({ error: 'Apple ID token verification failed' });
      }

      const verifyData: any = await verifyRes.json();
      const fbUser = Array.isArray(verifyData?.users) ? verifyData.users[0] : null;
      const verifiedEmail = String(
        fbUser?.email ||
          fbUser?.providerUserInfo?.find((p: any) => p?.email)?.email ||
          ''
      )
        .trim()
        .toLowerCase();

      if (!verifiedEmail) {
        return res.status(400).json({ error: 'No email returned from Apple ID. Please share email during Apple Sign-In.' });
      }

      const user = db.users.find(
        (u) =>
          (u.appleId && u.appleId.toLowerCase() === verifiedEmail) ||
          (u.email && u.email.toLowerCase() === verifiedEmail) ||
          u.username.toLowerCase() === verifiedEmail
      );

      if (!user) {
        return res.status(404).json({
          error: `এই Apple ID (${verifiedEmail}) এর জন্য কোনো ইউজার আইডি তৈরি করা নেই। প্রথমে Owner Control থেকে এই Apple ID দিয়ে User ID তৈরি করুন। (No account found for Apple ID: ${verifiedEmail})`,
        });
      }

      if (user.status === 'disabled') {
        return res.status(403).json({ error: 'আপনার অ্যাকাউন্টটি Owner দ্বারা স্থগিত (Suspended) করা রয়েছে।' });
      }

      const token = `token_${user.id}_${crypto.randomUUID()}`;
      user.lastLoginAt = Date.now();
      if (!db.sessions) db.sessions = {};
      db.sessions[token] = user.id;
      SESSIONS.set(token, user);

      db.auditLogs.unshift({
        id: 'audit-' + Date.now(),
        timestamp: Date.now(),
        action: 'USER_LOGIN',
        performedBy: `${user.name} (${user.username})`,
        details: { role: user.role, workspace: user.workspaceName, provider: 'apple' },
      });
      db.auditLogs = db.auditLogs.slice(0, 100);
      saveDatabase(db);

      const safeUser = { ...user };
      delete (safeUser as any).passwordHash;

      return res.json({
        token,
        user: safeUser,
        globalSettings: db.globalSettings,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Apple ID authentication error' });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = (req as any).user as DbUser;
    const safeUser = { ...user };
    delete (safeUser as any).passwordHash;

    return res.json({
      user: safeUser,
      globalSettings: db.globalSettings,
    });
  });

  // Session verification and persistent recovery endpoint
  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    let user: DbUser | undefined = token ? SESSIONS.get(token) : undefined;
    if (!user && token && db.sessions && db.sessions[token]) {
      const uid = db.sessions[token];
      user = db.users.find((u) => u.id === uid && u.status !== 'disabled');
      if (user) SESSIONS.set(token, user);
    }
    if (!user && token) {
      user = db.users.find(
        (u) => (token.includes(u.id) || token.includes(u.username)) && u.status !== 'disabled'
      );
      if (user) {
        SESSIONS.set(token, user);
        if (!db.sessions) db.sessions = {};
        db.sessions[token] = user.id;
        saveDatabase(db);
      }
    }

    if (!user) {
      user = db.users.find((u) => u.role === 'owner' && u.status !== 'disabled') || db.users[0];
      const autoToken = `token_auto_${user.id}`;
      SESSIONS.set(autoToken, user);
      if (!db.sessions) db.sessions = {};
      if (db.sessions[autoToken] !== user.id) {
        db.sessions[autoToken] = user.id;
        saveDatabase(db);
      }
      res.setHeader('x-auth-token', autoToken);
      const safe = { ...user };
      delete (safe as any).passwordHash;
      return res.json({ user: safe, token: autoToken });
    }
    const freshUser = db.users.find((u) => u.id === user!.id) || user;
    const safe = { ...freshUser };
    delete (safe as any).passwordHash;
    return res.json({ user: safe, token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      SESSIONS.delete(token);
      if (db.sessions && db.sessions[token]) {
        delete db.sessions[token];
        saveDatabase(db);
      }
    }
    return res.json({ success: true });
  });

  /* ------------------- USER PREFERENCES (Theme, DisplayMode, Language, Numerals, Colors) ------------------- */
  app.put('/api/users/:id/preferences', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;

    // Users can only update their own preferences (or Owner can update any)
    if (currentUser.id !== targetId && currentUser.role !== 'owner') {
      return res.status(403).json({ error: 'Cannot modify another user\'s preferences' });
    }

    const userIndex = db.users.findIndex((u) => u.id === targetId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { theme, displayMode, language, useBanglaNumerals, headerBgColor, sidebarBgColor } = req.body;
    if (theme !== undefined) db.users[userIndex].theme = theme;
    if (displayMode !== undefined) db.users[userIndex].displayMode = displayMode;
    if (language !== undefined) db.users[userIndex].language = language;
    if (useBanglaNumerals !== undefined) db.users[userIndex].useBanglaNumerals = Boolean(useBanglaNumerals);
    if (headerBgColor !== undefined) db.users[userIndex].headerBgColor = headerBgColor || undefined;
    if (sidebarBgColor !== undefined) db.users[userIndex].sidebarBgColor = sidebarBgColor || undefined;

    for (const [tok, sessUser] of SESSIONS.entries()) {
      if (sessUser.id === targetId) {
        SESSIONS.set(tok, db.users[userIndex]);
      }
    }

    saveDatabase(db);

    const safe = { ...db.users[userIndex] };
    delete (safe as any).passwordHash;
    notifySubscribers('user_updated', { type: 'preferences_updated', userId: targetId, user: safe });
    return res.json({ user: safe });
  });

  /* ------------------- USERS MANAGEMENT (Owner Control Only) ------------------- */
  app.get('/api/users', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const safeUsers = db.users.map((u) => {
      const safe = { ...u };
      delete (safe as any).passwordHash;
      return safe;
    });

    if (currentUser.role === 'owner') {
      return res.json({ users: safeUsers });
    } else {
      // Non-owners can only see their own profile in list
      return res.json({ users: safeUsers.filter((u) => u.id === currentUser.id) });
    }
  });

  // Owner manually creates new user account
  app.post('/api/users', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const { 
      username, 
      email,
      appleId,
      idProvider,
      name, 
      password, 
      role, 
      workspaceName, 
      canExport, 
      canDelete, 
      canAddTransactions,
      canViewLedger,
      canEditCustomers,
      canApproveInvoices,
      canManageCommissions,
      canManageBazar,
      canManageBuyers,
      isCommissionOnly,
      isCommissionBazarOnly,
      theme, 
      language 
    } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'User ID, password and name are required' });
    }

    if (role === 'owner') {
      return res.status(400).json({ error: 'Only one Primary Owner account can exist in the system.' });
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawAppleId = typeof appleId === 'string' ? appleId.trim().toLowerCase() : '';
    const resolvedProvider: 'email' | 'apple' = idProvider === 'apple' ? 'apple' : 'email';
    const normalizedEmail =
      rawEmail ||
      rawAppleId ||
      (EMAIL_REGEX.test(trimmedUsername) ? trimmedUsername : '');
    const normalizedAppleId =
      resolvedProvider === 'apple' ? (rawAppleId || normalizedEmail) : rawAppleId;

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        error: 'একটি সঠিক মেইল অ্যাড্রেস বা Apple ID ইমেইল দেওয়া বাধ্যতামূলক (Valid Mail Address / Apple ID email is required to create a User ID).',
      });
    }

    if (normalizedAppleId && !EMAIL_REGEX.test(normalizedAppleId)) {
      return res.status(400).json({
        error: 'সঠিক Apple ID ইমেইল লিখুন (Please enter a valid Apple ID email address).',
      });
    }

    if (db.users.some((u) => u.username.toLowerCase() === trimmedUsername)) {
      return res.status(400).json({ error: 'User ID / Username already taken. Please choose another.' });
    }

    if (
      db.users.some(
        (u) =>
          (u.email && u.email.toLowerCase() === normalizedEmail) ||
          (normalizedAppleId && u.appleId && u.appleId.toLowerCase() === normalizedAppleId)
      )
    ) {
      return res.status(400).json({
        error: 'এই মেইল অ্যাড্রেস / Apple ID দিয়ে ইতিমধ্যেই একটি ইউজার অ্যাকাউন্ট রয়েছে। (This Mail Address or Apple ID is already registered.)',
      });
    }

    const assignedRole = role || 'staff';
    const commBazarOnlyFlag = Boolean(isCommissionBazarOnly);
    const commOnlyFlag = !commBazarOnlyFlag && Boolean(isCommissionOnly);
    const restrictedFlag = commOnlyFlag || commBazarOnlyFlag;
    const newUser: DbUser = {
      id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      username: trimmedUsername,
      email: normalizedEmail,
      ...(normalizedAppleId ? { appleId: normalizedAppleId } : {}),
      idProvider: resolvedProvider,
      name: name.trim(),
      passwordHash: hashPassword(password),
      role: assignedRole,
      workspaceName: workspaceName?.trim() || `${name.trim()}'s Workspace`,
      status: 'active',
      canExport: canExport !== undefined ? canExport : true,
      canDelete: canDelete !== undefined ? canDelete : false,
      canAddTransactions: canAddTransactions !== undefined ? canAddTransactions : !restrictedFlag,
      canViewLedger: canViewLedger !== undefined ? canViewLedger : !restrictedFlag,
      canEditCustomers: canEditCustomers !== undefined ? canEditCustomers : (!restrictedFlag && assignedRole !== 'viewer'),
      canApproveInvoices: canApproveInvoices !== undefined ? canApproveInvoices : (!restrictedFlag && (assignedRole === 'admin' || assignedRole === 'manager')),
      canManageCommissions: canManageCommissions !== undefined ? canManageCommissions : (restrictedFlag || assignedRole === 'admin'),
      canManageBazar: canManageBazar !== undefined ? canManageBazar : (commBazarOnlyFlag || !commOnlyFlag),
      canManageBuyers: canManageBuyers !== undefined ? canManageBuyers : (assignedRole === 'admin'),
      isCommissionOnly: commOnlyFlag,
      isCommissionBazarOnly: commBazarOnlyFlag,
      theme: theme || db.globalSettings.defaultTheme || 'midnight-gold',
      displayMode: 'light',
      language: language || 'en',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.users.push(newUser);

    // Auto-sync created user into Bazar Buyers directory so every module recognizes them immediately
    if (!Array.isArray(db.globalSettings.bazarBuyers)) {
      db.globalSettings.bazarBuyers = [];
    }
    if (!db.globalSettings.bazarBuyers.some((b) => b.buyerId.toLowerCase() === newUser.username.toLowerCase())) {
      db.globalSettings.bazarBuyers.push({
        buyerId: newUser.username,
        name: newUser.name,
        role: newUser.role,
      });
    }

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'USER_CREATED',
      performedBy: (req as any).user.name,
      details: { username: newUser.username, role: newUser.role, workspace: newUser.workspaceName },
    });
    saveDatabase(db);

    const safe = { ...newUser };
    delete (safe as any).passwordHash;
    notifySubscribers('user_updated', { type: 'created', userId: newUser.id, user: safe });
    notifySubscribers('bazar_buyers_updated', { buyers: db.globalSettings.bazarBuyers });
    notifySubscribers('global_settings_updated', { globalSettings: db.globalSettings });

    return res.status(201).json({ user: safe });
  });

  // Owner edits user (password reset, email/appleId, role, status activate/suspend, permissions)
  app.put('/api/users/:id', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const targetId = req.params.id;
    const { 
      name, 
      email,
      appleId,
      idProvider,
      password, 
      role, 
      workspaceName, 
      status, 
      canExport, 
      canDelete, 
      canAddTransactions,
      canViewLedger,
      canEditCustomers,
      canApproveInvoices,
      canManageCommissions,
      canManageBazar,
      canManageBuyers,
      theme, 
      displayMode, 
      language 
    } = req.body;

    const userIndex = db.users.findIndex((u) => u.id === targetId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = db.users[userIndex];

    // Cannot downgrade or suspend primary owner
    if (targetUser.role === 'owner' && (status === 'disabled' || (role && role !== 'owner'))) {
      return res.status(400).json({ error: 'The Primary Owner account cannot be disabled or downgraded' });
    }
    // Cannot promote non-owner to owner
    if (targetUser.role !== 'owner' && role === 'owner') {
      return res.status(403).json({ error: 'Cannot promote a user account to Primary Owner' });
    }

    if (email !== undefined) {
      const nextEmail = String(email || '').trim().toLowerCase();
      if (nextEmail && !EMAIL_REGEX.test(nextEmail)) {
        return res.status(400).json({ error: 'সঠিক মেইল অ্যাড্রেস লিখুন (Invalid Mail Address format).' });
      }
      if (
        nextEmail &&
        db.users.some((u) => u.id !== targetId && u.email && u.email.toLowerCase() === nextEmail)
      ) {
        return res.status(400).json({ error: 'এই মেইল অ্যাড্রেসটি অন্য ইউজারের জন্য ব্যবহৃত হচ্ছে।' });
      }
      if (nextEmail) {
        targetUser.email = nextEmail;
      } else {
        delete targetUser.email;
      }
    }

    if (appleId !== undefined) {
      const nextAppleId = String(appleId || '').trim().toLowerCase();
      if (nextAppleId && !EMAIL_REGEX.test(nextAppleId)) {
        return res.status(400).json({ error: 'সঠিক Apple ID ইমেইল লিখুন (Invalid Apple ID format).' });
      }
      if (
        nextAppleId &&
        db.users.some((u) => u.id !== targetId && u.appleId && u.appleId.toLowerCase() === nextAppleId)
      ) {
        return res.status(400).json({ error: 'এই Apple ID টি অন্য ইউজারের জন্য ব্যবহৃত হচ্ছে।' });
      }
      if (nextAppleId) {
        targetUser.appleId = nextAppleId;
        if (!targetUser.email) {
          targetUser.email = nextAppleId;
        }
      } else {
        delete targetUser.appleId;
      }
    }

    if (idProvider === 'email' || idProvider === 'apple') {
      targetUser.idProvider = idProvider;
    }

    if (name) targetUser.name = name.trim();
    if (password && password.trim().length >= 4) {
      targetUser.passwordHash = hashPassword(password.trim());
    }
    if (role) targetUser.role = role;
    if (workspaceName) targetUser.workspaceName = workspaceName.trim();
    if (status) targetUser.status = status;
    if (canExport !== undefined) targetUser.canExport = canExport;
    if (canDelete !== undefined) targetUser.canDelete = canDelete;
    if (canAddTransactions !== undefined) targetUser.canAddTransactions = canAddTransactions;
    if (canViewLedger !== undefined) targetUser.canViewLedger = canViewLedger;
    if (canEditCustomers !== undefined) targetUser.canEditCustomers = canEditCustomers;
    if (canApproveInvoices !== undefined) targetUser.canApproveInvoices = canApproveInvoices;
    if (canManageCommissions !== undefined) targetUser.canManageCommissions = canManageCommissions;
    if (canManageBazar !== undefined) targetUser.canManageBazar = canManageBazar;
    if (canManageBuyers !== undefined) targetUser.canManageBuyers = canManageBuyers;
    if (req.body.isCommissionOnly !== undefined) targetUser.isCommissionOnly = Boolean(req.body.isCommissionOnly);
    if (req.body.isCommissionBazarOnly !== undefined) targetUser.isCommissionBazarOnly = Boolean(req.body.isCommissionBazarOnly);
    if (theme) targetUser.theme = theme;
    if (displayMode) targetUser.displayMode = displayMode;
    if (language) targetUser.language = language;
    targetUser.updatedAt = Date.now();

    db.users[userIndex] = targetUser;

    // Keep live SESSIONS and bazarBuyers in sync
    for (const [tok, sessUser] of SESSIONS.entries()) {
      if (sessUser.id === targetUser.id) {
        SESSIONS.set(tok, targetUser);
      }
    }
    if (Array.isArray(db.globalSettings.bazarBuyers)) {
      const buyerIdx = db.globalSettings.bazarBuyers.findIndex(
        (b) => b.buyerId.toLowerCase() === targetUser.username.toLowerCase()
      );
      if (buyerIdx !== -1) {
        db.globalSettings.bazarBuyers[buyerIdx] = {
          ...db.globalSettings.bazarBuyers[buyerIdx],
          name: targetUser.name,
          role: targetUser.role,
        };
      }
    }

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'USER_UPDATED',
      performedBy: (req as any).user.name,
      details: { targetUser: targetUser.username, changes: req.body },
    });
    saveDatabase(db);

    const safe = { ...targetUser };
    delete (safe as any).passwordHash;
    notifySubscribers('user_updated', { type: 'updated', userId: targetUser.id, user: safe });
    notifySubscribers('bazar_buyers_updated', { buyers: db.globalSettings.bazarBuyers });

    return res.json({ user: safe });
  });

  // Owner deletes user account
  app.delete('/api/users/:id', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const targetId = req.params.id;
    const targetUser = db.users.find((u) => u.id === targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'owner') {
      return res.status(400).json({ error: 'Cannot delete the Primary Owner' });
    }

    db.users = db.users.filter((u) => u.id !== targetId);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[targetId] = Date.now();
    db.deletedRecordIds[`buyer:${targetUser.username.toLowerCase()}`] = Date.now();

    // Purge any persisted or active sessions for deleted user
    for (const [tok, sessUser] of SESSIONS.entries()) {
      if (sessUser.id === targetId) {
        SESSIONS.delete(tok);
      }
    }
    if (db.sessions) {
      for (const [tok, uid] of Object.entries(db.sessions)) {
        if (uid === targetId) {
          delete db.sessions[tok];
        }
      }
    }
    if (Array.isArray(db.globalSettings.bazarBuyers)) {
      db.globalSettings.bazarBuyers = db.globalSettings.bazarBuyers.filter(
        (b) => b.buyerId.toLowerCase() !== targetUser.username.toLowerCase()
      );
    }

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'USER_DELETED',
      performedBy: (req as any).user.name,
      details: { deletedUser: targetUser.username },
    });
    saveDatabase(db);

    notifySubscribers('user_updated', { type: 'deleted', userId: targetId });
    notifySubscribers('bazar_buyers_updated', { buyers: db.globalSettings.bazarBuyers });
    return res.json({ success: true, message: `User ${targetUser.name} deleted` });
  });

  /* ------------------- PROFILE PHOTO MANAGEMENT ------------------- */
  // Upload or update user profile photo (User can update self, Owner can update anyone)
  app.post('/api/users/:id/photo', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;

    if (currentUser.role !== 'owner' && currentUser.id !== targetId) {
      return res.status(403).json({ error: 'Permission denied: You can only update your own profile photo.' });
    }

    const targetUser = db.users.find((u) => u.id === targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { photoBase64 } = req.body;
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return res.status(400).json({ error: 'Valid photo base64 data is required' });
    }

    const matches = photoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image payload. Supported formats: JPG, PNG, WebP.' });
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (!['jpg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported format. Allowed: JPG, JPEG, PNG, WebP, GIF, SVG, HEIC.' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image exceeds maximum allowed size of 25MB.' });
    }

    // Clean up previous photo if present
    if (targetUser.photoUrl && targetUser.photoUrl.startsWith('/api/photos/')) {
      const oldFilename = targetUser.photoUrl.replace('/api/photos/', '');
      const oldPath = path.join(PHOTOS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    const filename = `${targetUser.id}_${Date.now()}.${ext}`;
    const filePath = path.join(PHOTOS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const photoUrl = `/api/photos/${filename}`;
    targetUser.photoUrl = photoUrl;
    targetUser.photoData = photoBase64;
    targetUser.updatedAt = Date.now();

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'USER_PHOTO_UPDATED',
      performedBy: currentUser.name,
      details: { targetUser: targetUser.username, photoUrl },
    });
    for (const [tok, sessUser] of SESSIONS.entries()) {
      if (sessUser.id === targetUser.id) SESSIONS.set(tok, targetUser);
    }
    saveDatabase(db);

    const safe = { ...targetUser };
    delete (safe as any).passwordHash;
    notifySubscribers('user_updated', { type: 'photo_updated', userId: targetUser.id, photoUrl, user: safe });

    return res.json({ success: true, photoUrl, user: safe });
  });

  // Delete/Remove user profile photo
  app.delete('/api/users/:id/photo', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;

    if (currentUser.role !== 'owner' && currentUser.id !== targetId) {
      return res.status(403).json({ error: 'Permission denied: You can only remove your own profile photo.' });
    }

    const targetUser = db.users.find((u) => u.id === targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.photoUrl && targetUser.photoUrl.startsWith('/api/photos/')) {
      const oldFilename = targetUser.photoUrl.replace('/api/photos/', '');
      const oldPath = path.join(PHOTOS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    targetUser.photoUrl = undefined;
    targetUser.photoData = undefined;
    targetUser.updatedAt = Date.now();
    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'USER_PHOTO_REMOVED',
      performedBy: currentUser.name,
      details: { targetUser: targetUser.username },
    });
    for (const [tok, sessUser] of SESSIONS.entries()) {
      if (sessUser.id === targetUser.id) SESSIONS.set(tok, targetUser);
    }
    saveDatabase(db);

    const safe = { ...targetUser };
    delete (safe as any).passwordHash;
    notifySubscribers('user_updated', { type: 'photo_removed', userId: targetUser.id, user: safe });

    return res.json({ success: true, user: safe });
  });

  /* ------------------- TRANSACTIONS (Private Workspaces & Isolated Ledger) ------------------- */
  app.get('/api/transactions', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { workspaceUserId, all } = req.query;

    let results: DbTransaction[] = [];

    if (currentUser.role === 'owner') {
      if (all === 'true') {
        results = db.transactions;
      } else if (workspaceUserId && typeof workspaceUserId === 'string') {
        results = db.transactions.filter((t) => t.workspaceUserId === workspaceUserId);
      } else {
        results = db.transactions.filter((t) => t.workspaceUserId === currentUser.id);
      }
    } else {
      // STRICT PRIVACY: Other users CANNOT see other users' financial records
      results = db.transactions.filter((t) => t.workspaceUserId === currentUser.id);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);
    return res.json({ transactions: results });
  });

  app.post('/api/transactions', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;

    // Viewers cannot create transactions
    if (currentUser.role === 'viewer') {
      return res.status(403).json({ error: 'Viewer accounts have read-only access' });
    }

    const { description, amount, type, category, paymentMethod, notes, targetWorkspaceUserId, customerName } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const workspaceUserId = (currentUser.role === 'owner' && targetWorkspaceUserId) 
      ? targetWorkspaceUserId 
      : currentUser.id;

    const newTx: DbTransaction = {
      id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: currentUser.id,
      workspaceUserId,
      description: description?.trim() || (type === 'income' ? 'জমা হিসাব' : 'দৈনিক খরচ'),
      amount: numAmount,
      type: type === 'income' ? 'income' : 'expense',
      category: category || 'bazaar',
      paymentMethod: paymentMethod || 'cash',
      timestamp: Date.now(),
      notes: notes?.trim() || undefined,
      createdByName: currentUser.name,
      customerName: customerName?.trim() || undefined,
    };

    db.transactions.unshift(newTx);
    saveDatabase(db);

    notifySubscribers('transaction_created', { workspaceUserId, transaction: newTx });
    return res.status(201).json({ transaction: newTx });
  });

  app.put('/api/transactions/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role === 'viewer') {
      return res.status(403).json({ error: 'Viewer accounts cannot edit records' });
    }

    const txId = req.params.id;
    const { description, amount, type, category, paymentMethod, notes, customerName } = req.body;

    const index = db.transactions.findIndex((t) => t.id === txId);
    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = db.transactions[index];
    if (currentUser.role !== 'owner' && tx.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'You do not have permission to edit this record' });
    }

    if (description) tx.description = description.trim();
    if (amount) {
      const num = parseFloat(amount);
      if (!isNaN(num) && num > 0) tx.amount = num;
    }
    if (type) tx.type = type;
    if (category) tx.category = category;
    if (paymentMethod) tx.paymentMethod = paymentMethod;
    if (notes !== undefined) tx.notes = notes.trim();
    if (customerName !== undefined) tx.customerName = customerName.trim();
    tx.updatedAt = Date.now();

    db.transactions[index] = tx;
    saveDatabase(db);

    notifySubscribers('transaction_updated', { workspaceUserId: tx.workspaceUserId, transaction: tx });
    return res.json({ transaction: tx });
  });

  app.delete('/api/transactions/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role === 'viewer') {
      return res.status(403).json({ error: 'Viewer accounts cannot delete records' });
    }

    const txId = req.params.id;
    const tx = db.transactions.find((t) => t.id === txId);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (currentUser.role !== 'owner' && tx.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Cannot delete another user\'s record' });
    }

    if (currentUser.role !== 'owner' && !currentUser.canDelete) {
      return res.status(403).json({ error: 'Your account does not have deletion permission. Contact Owner.' });
    }

    db.transactions = db.transactions.filter((t) => t.id !== txId);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[txId] = Date.now();
    saveDatabase(db);

    notifySubscribers('transaction_deleted', { workspaceUserId: tx.workspaceUserId, transactionId: txId });
    return res.json({ success: true, deletedId: txId });
  });

  /* ------------------- CUSTOMERS & VENDORS (CRM Ledger) ------------------- */
  app.get('/api/customers', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const results = currentUser.role === 'owner' 
      ? db.customers 
      : db.customers.filter((c) => c.workspaceUserId === currentUser.id);
    return res.json({ customers: results });
  });

  // Dedicated customer photo upload endpoint
  app.post('/api/customers/photo', authMiddleware, (req, res) => {
    const { photoBase64 } = req.body;
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return res.status(400).json({ error: 'Valid photo base64 data is required' });
    }

    const matches = photoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format. Supported formats: JPG, JPEG, PNG, WebP.' });
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (!['jpg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported format. Allowed: JPG, JPEG, PNG, WebP, GIF, SVG, HEIC.' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image exceeds maximum allowed size of 25MB.' });
    }

    const filename = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(PHOTOS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const photoUrl = `/api/photos/${filename}`;
    return res.json({ success: true, photoUrl });
  });

  app.post('/api/customers', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { 
      name, 
      phone, 
      whatsapp, 
      photoUrl, 
      photoBase64, 
      email, 
      address, 
      businessName, 
      notes, 
      type, 
      balance 
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const cleanPhone = (phone || '').trim();
    const normalizedDigits = cleanPhone.replace(/[^0-9]/g, '');

    // Duplicate Phone Number Check within workspace
    if (normalizedDigits && normalizedDigits.length >= 7) {
      const existing = db.customers.find(
        (c) => c.workspaceUserId === currentUser.id && 
               c.phone.replace(/[^0-9]/g, '') === normalizedDigits
      );
      if (existing) {
        return res.status(409).json({ 
          error: `Duplicate phone number! A customer with this phone already exists: "${existing.name}".` 
        });
      }
    }

    let finalPhotoUrl = photoUrl || undefined;
    let finalPhotoData: string | undefined = undefined;
    if (photoBase64 && typeof photoBase64 === 'string') {
      try {
        const matches = photoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          let ext = matches[1].toLowerCase();
          if (ext === 'jpeg') ext = 'jpg';
          if (['jpg', 'png', 'webp'].includes(ext)) {
            const buffer = Buffer.from(matches[2], 'base64');
            if (buffer.length <= 5 * 1024 * 1024) {
              const filename = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
              fs.writeFileSync(path.join(PHOTOS_DIR, filename), buffer);
              finalPhotoUrl = `/api/photos/${filename}`;
              finalPhotoData = photoBase64;
            }
          }
        }
      } catch (err) {
        console.error('Error saving customer photo:', err);
      }
    }

    const newCust: DbCustomer = {
      id: 'cust-' + Date.now(),
      workspaceUserId: currentUser.id,
      name: name.trim(),
      phone: cleanPhone,
      whatsapp: (whatsapp || '').trim() || undefined,
      photoUrl: finalPhotoUrl,
      photoData: finalPhotoData,
      email: (email || '').trim() || undefined,
      address: (address || '').trim() || undefined,
      businessName: (businessName || '').trim() || undefined,
      notes: (notes || '').trim() || undefined,
      type: type === 'vendor' ? 'vendor' : 'customer',
      balance: parseFloat(balance) || 0,
      updatedAt: Date.now(),
    };

    db.customers.unshift(newCust);
    saveDatabase(db);

    notifySubscribers('customer_created', { workspaceUserId: currentUser.id, customer: newCust });
    return res.status(201).json({ customer: newCust, success: true });
  });

  // Edit/Update Customer
  app.put('/api/customers/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const custId = req.params.id;
    const cust = db.customers.find((c) => c.id === custId);

    if (!cust) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (currentUser.role !== 'owner' && cust.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: You can only edit customers in your workspace.' });
    }

    const { 
      name, 
      phone, 
      whatsapp, 
      photoUrl, 
      photoBase64, 
      removePhoto, 
      email, 
      address, 
      businessName, 
      notes, 
      type, 
      balance 
    } = req.body;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Customer name cannot be empty' });
      }
      cust.name = name.trim();
    }

    if (phone !== undefined) {
      const cleanPhone = (phone || '').trim();
      const normalizedDigits = cleanPhone.replace(/[^0-9]/g, '');

      // Check duplicate against other customers
      if (normalizedDigits && normalizedDigits.length >= 7) {
        const existing = db.customers.find(
          (c) => c.id !== custId && 
                 c.workspaceUserId === cust.workspaceUserId && 
                 c.phone.replace(/[^0-9]/g, '') === normalizedDigits
        );
        if (existing) {
          return res.status(409).json({ 
            error: `Duplicate phone number! Another record "${existing.name}" already has this phone number.` 
          });
        }
      }
      cust.phone = cleanPhone;
    }

    if (whatsapp !== undefined) cust.whatsapp = (whatsapp || '').trim() || undefined;
    if (email !== undefined) cust.email = (email || '').trim() || undefined;
    if (address !== undefined) cust.address = (address || '').trim() || undefined;
    if (businessName !== undefined) cust.businessName = (businessName || '').trim() || undefined;
    if (notes !== undefined) cust.notes = (notes || '').trim() || undefined;
    if (type !== undefined) cust.type = type === 'vendor' ? 'vendor' : 'customer';
    if (balance !== undefined) cust.balance = parseFloat(balance) || 0;

    // Handle photo updates
    if (removePhoto) {
      if (cust.photoUrl && cust.photoUrl.startsWith('/api/photos/')) {
        const oldFile = path.join(PHOTOS_DIR, cust.photoUrl.replace('/api/photos/', ''));
        if (fs.existsSync(oldFile)) {
          try { fs.unlinkSync(oldFile); } catch {}
        }
      }
      cust.photoUrl = undefined;
      cust.photoData = undefined;
    } else if (photoBase64 && typeof photoBase64 === 'string') {
      try {
        const matches = photoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          let ext = matches[1].toLowerCase();
          if (ext === 'jpeg') ext = 'jpg';
          if (['jpg', 'png', 'webp'].includes(ext)) {
            const buffer = Buffer.from(matches[2], 'base64');
            if (buffer.length <= 5 * 1024 * 1024) {
              // Delete old photo if it was an uploaded file
              if (cust.photoUrl && cust.photoUrl.startsWith('/api/photos/')) {
                const oldFile = path.join(PHOTOS_DIR, cust.photoUrl.replace('/api/photos/', ''));
                if (fs.existsSync(oldFile)) {
                  try { fs.unlinkSync(oldFile); } catch {}
                }
              }
              const filename = `cust_${cust.id}_${Date.now()}.${ext}`;
              fs.writeFileSync(path.join(PHOTOS_DIR, filename), buffer);
              cust.photoUrl = `/api/photos/${filename}`;
              cust.photoData = photoBase64;
            }
          }
        }
      } catch (err) {
        console.error('Error updating customer photo:', err);
      }
    } else if (photoUrl !== undefined) {
      cust.photoUrl = photoUrl || undefined;
    }

    cust.updatedAt = Date.now();
    saveDatabase(db);

    notifySubscribers('customer_updated', { workspaceUserId: cust.workspaceUserId, customer: cust });
    return res.json({ customer: cust, success: true });
  });

  // Delete Customer
  app.delete('/api/customers/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const custId = req.params.id;
    const index = db.customers.findIndex((c) => c.id === custId);

    if (index === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const cust = db.customers[index];
    if (currentUser.role !== 'owner' && cust.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: You can only delete customers in your workspace.' });
    }

    // Clean up photo file if present
    if (cust.photoUrl && cust.photoUrl.startsWith('/api/photos/')) {
      const oldFile = path.join(PHOTOS_DIR, cust.photoUrl.replace('/api/photos/', ''));
      if (fs.existsSync(oldFile)) {
        try { fs.unlinkSync(oldFile); } catch {}
      }
    }

    db.customers.splice(index, 1);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[custId] = Date.now();
    saveDatabase(db);

    notifySubscribers('customer_deleted', { workspaceUserId: cust.workspaceUserId, customerId: custId });
    return res.json({ success: true, deletedId: custId });
  });

  /* ------------------- INVOICES, PARTIAL PAYMENTS & STATEMENTS ------------------- */
  // 1. Get All Invoices (filter by customerId or workspace)
  app.get('/api/invoices', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { customerId } = req.query;

    let list = currentUser.role === 'owner'
      ? db.invoices
      : db.invoices.filter((inv) => inv.workspaceUserId === currentUser.id);

    if (customerId && typeof customerId === 'string') {
      list = list.filter((inv) => inv.customerId === customerId);
    }

    // Sort by latest date first
    list.sort((a, b) => (b.date || b.createdAt) - (a.date || a.createdAt));

    return res.json({ invoices: list });
  });

  // 2. Get Single Invoice by ID
  app.get('/api/invoices/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const inv = db.invoices.find((i) => i.id === req.params.id);

    if (!inv) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (currentUser.role !== 'owner' && inv.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot view invoice from another workspace.' });
    }

    return res.json({ invoice: inv });
  });

  // 3. Create Individual Customer Invoice
  app.post('/api/invoices', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const {
      customerId,
      invoiceNumber,
      date,
      dueDate,
      items,
      taxRate = 0,
      discount = 0,
      notes,
      terms,
      initialPaymentAmount = 0,
      initialPaymentMethod = 'cash',
      initialPaymentRef = '',
      serviceName,
      iqamaNo,
      branchOffice,
      countryFlag,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer is required to create an invoice' });
    }

    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (currentUser.role !== 'owner' && customer.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot invoice customer in another workspace.' });
    }

    // Format & validate line items
    const parsedItems: DbInvoiceItem[] = Array.isArray(items) && items.length > 0
      ? items.map((it: any, idx: number) => {
          const qty = Math.max(1, parseFloat(it.quantity) || 1);
          const price = parseFloat(it.unitPrice) || 0;
          return {
            id: it.id || `item-${Date.now()}-${idx}`,
            description: (it.description || 'Product / Service').trim(),
            quantity: qty,
            unitPrice: price,
            total: qty * price,
          };
        })
      : [
          {
            id: `item-${Date.now()}-1`,
            description: serviceName || 'Products / Services',
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ];

    const subtotal = parsedItems.reduce((sum, it) => sum + it.total, 0);
    const parsedTaxRate = Math.max(0, parseFloat(taxRate) || 0);
    const taxAmount = (subtotal * parsedTaxRate) / 100;
    const parsedDiscount = Math.max(0, parseFloat(discount) || 0);
    const totalAmount = Math.max(0, subtotal + taxAmount - parsedDiscount);

    // Initial Payment (optional opening payment)
    const initialPayment = Math.max(0, parseFloat(initialPaymentAmount) || 0);
    const payments: DbInvoicePayment[] = [];
    const invId = 'inv-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    if (initialPayment > 0) {
      payments.push({
        id: 'pay-init-' + Date.now(),
        invoiceId: invId,
        customerId: customer.id,
        amount: initialPayment,
        paymentDate: date || Date.now(),
        paymentMethod: initialPaymentMethod || 'cash',
        reference: initialPaymentRef ? String(initialPaymentRef).trim() : 'Initial Payment',
        notes: 'Initial payment upon invoice creation',
        recordedByName: currentUser.name,
        createdAt: Date.now(),
      });

      // Log income transaction into main business ledger
      db.transactions.unshift({
        id: 'tx-invpay-' + Date.now(),
        userId: currentUser.id,
        workspaceUserId: customer.workspaceUserId,
        description: `Invoice Payment #${invoiceNumber || 'INV'} - ${customer.name}`,
        amount: initialPayment,
        type: 'income',
        category: 'sales',
        paymentMethod: initialPaymentMethod || 'cash',
        timestamp: date || Date.now(),
        syncedToCloud: true,
        customerName: customer.name,
        notes: `Initial payment received on Invoice #${invoiceNumber || 'INV'}`,
        createdByName: currentUser.name,
      });
    }

    const paidAmount = initialPayment;
    const balanceDue = totalAmount - paidAmount;

    let status: 'paid' | 'partial' | 'unpaid' | 'overpaid' = 'unpaid';
    if (balanceDue === 0 && totalAmount > 0) {
      status = 'paid';
    } else if (balanceDue < 0) {
      status = 'overpaid'; // Payment exceeds total -> credit
    } else if (paidAmount > 0 && balanceDue > 0) {
      status = 'partial';
    }

    // Auto-generate invoice number if not provided
    const finalInvoiceNumber = invoiceNumber && typeof invoiceNumber === 'string' && invoiceNumber.trim().length > 0
      ? invoiceNumber.trim()
      : `INV-${new Date().getFullYear()}-${String(db.invoices.length + 1).padStart(4, '0')}`;

    const newInvoice: DbInvoice = {
      id: invId,
      invoiceNumber: finalInvoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerBusiness: customer.businessName,
      customerAddress: customer.address,
      serviceName: serviceName || parsedItems[0]?.description || 'General Service',
      iqamaNo: iqamaNo ? String(iqamaNo).trim() : undefined,
      branchOffice: branchOffice ? String(branchOffice).trim() : 'JUB5 - Jubail - Al Madrasa',
      countryFlag: countryFlag || '🇧🇩',
      lastPaymentAmount: initialPayment > 0 ? initialPayment : undefined,
      workspaceUserId: customer.workspaceUserId,
      date: date || Date.now(),
      dueDate: dueDate || (Date.now() + 86400000 * 14), // default 14 days
      items: parsedItems,
      subtotal,
      taxRate: parsedTaxRate,
      taxAmount,
      discount: parsedDiscount,
      totalAmount,
      paidAmount,
      balanceDue,
      status,
      notes: notes ? notes.trim() : undefined,
      terms: terms ? terms.trim() : 'Payment is due within payment terms. Thanks for your business!',
      payments,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.invoices.unshift(newInvoice);

    // Update customer balance:
    // Adding invoice total increases due; initial payment reduces due.
    customer.balance = (customer.balance || 0) + totalAmount - initialPayment;
    customer.updatedAt = Date.now();

    // Keep Commission Sheet completely separate from regular customer invoices
    saveDatabase(db);

    notifySubscribers('invoice_created', { workspaceUserId: customer.workspaceUserId, invoice: newInvoice });
    notifySubscribers('customer_updated', { workspaceUserId: customer.workspaceUserId, customer });

    return res.status(201).json({ invoice: newInvoice, customer, success: true });
  });

  // 4. Record Partial or Full Payment on an Invoice
  app.post('/api/invoices/:id/payments', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const invId = req.params.id;
    const inv = db.invoices.find((i) => i.id === invId);

    if (!inv) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (currentUser.role !== 'owner' && inv.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot record payment on invoice from another workspace.' });
    }

    const {
      amount,
      paymentDate = Date.now(),
      paymentMethod = 'cash',
      reference = '',
      notes = '',
    } = req.body;

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount greater than 0 is required' });
    }

    const newPayment: DbInvoicePayment = {
      id: 'pay-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      invoiceId: inv.id,
      customerId: inv.customerId,
      amount: paymentAmount,
      paymentDate: paymentDate || Date.now(),
      paymentMethod: paymentMethod || 'cash',
      reference: reference ? String(reference).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      recordedByName: currentUser.name,
      createdAt: Date.now(),
    };

    inv.payments.push(newPayment);

    // Recalculate invoice finances
    const newPaidAmount = inv.payments.reduce((sum, p) => sum + p.amount, 0);
    const newBalanceDue = inv.totalAmount - newPaidAmount;

    inv.paidAmount = newPaidAmount;
    inv.balanceDue = newBalanceDue;

    // Requirement 2 & 3:
    // If balance is 0: paid
    // If balance is negative (< 0): overpaid / credit!
    // If payment reduces balance but still > 0: partial
    if (newBalanceDue === 0) {
      inv.status = 'paid';
    } else if (newBalanceDue < 0) {
      inv.status = 'overpaid'; // Excess payment / credit recorded!
    } else {
      inv.status = 'partial';
    }

    inv.updatedAt = Date.now();

    // Update customer balance: payment reduces customer's balance due
    const customer = db.customers.find((c) => c.id === inv.customerId);
    if (customer) {
      customer.balance = (customer.balance || 0) - paymentAmount;
      customer.updatedAt = Date.now();
    }

    // Automatically record real income transaction in the cashflow ledger
    const newTx: DbTransaction = {
      id: 'tx-invpay-' + Date.now(),
      userId: currentUser.id,
      workspaceUserId: inv.workspaceUserId,
      description: `Payment for Invoice #${inv.invoiceNumber} - ${inv.customerName}`,
      amount: paymentAmount,
      type: 'income',
      category: 'sales',
      paymentMethod: paymentMethod || 'cash',
      timestamp: paymentDate || Date.now(),
      syncedToCloud: true,
      customerName: inv.customerName,
      notes: `Invoice #${inv.invoiceNumber} payment ${reference ? `(Ref: ${reference})` : ''} - Remaining: ${newBalanceDue <= 0 ? (newBalanceDue < 0 ? `Credit ${Math.abs(newBalanceDue)}` : '0 (Paid)') : newBalanceDue}`,
      createdByName: currentUser.name,
    };
    db.transactions.unshift(newTx);

    saveDatabase(db);

    notifySubscribers('invoice_payment_recorded', { workspaceUserId: inv.workspaceUserId, invoice: inv, payment: newPayment });
    if (customer) {
      notifySubscribers('customer_updated', { workspaceUserId: inv.workspaceUserId, customer });
    }
    notifySubscribers('transaction_created', { workspaceUserId: inv.workspaceUserId, transaction: newTx });

    return res.status(201).json({
      success: true,
      invoice: inv,
      payment: newPayment,
      customer,
      isExcessCredit: newBalanceDue < 0,
      creditAmount: newBalanceDue < 0 ? Math.abs(newBalanceDue) : 0,
    });
  });

  // 4b. Update / Edit Invoice
  app.put('/api/invoices/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const invId = req.params.id;
    const inv = db.invoices.find((i) => i.id === invId);

    if (!inv) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (currentUser.role !== 'owner' && inv.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot edit invoice from another workspace.' });
    }

    const {
      customerName,
      customerPhone,
      customerBusiness,
      customerAddress,
      serviceName,
      iqamaNo,
      branchOffice,
      date,
      dueDate,
      items,
      taxRate,
      discount,
      notes,
      terms,
      totalAmount: overrideTotal,
    } = req.body;

    const oldBalanceDue = inv.balanceDue;

    if (customerName) inv.customerName = customerName.trim();
    if (customerPhone !== undefined) inv.customerPhone = customerPhone;
    if (customerBusiness !== undefined) inv.customerBusiness = customerBusiness;
    if (customerAddress !== undefined) inv.customerAddress = customerAddress;
    if (serviceName !== undefined) inv.serviceName = serviceName;
    if (iqamaNo !== undefined) inv.iqamaNo = iqamaNo;
    if (branchOffice !== undefined) inv.branchOffice = branchOffice;
    if (date) inv.date = typeof date === 'number' ? date : new Date(date).getTime();
    if (dueDate) inv.dueDate = typeof dueDate === 'number' ? dueDate : new Date(dueDate).getTime();
    if (notes !== undefined) inv.notes = notes;
    if (terms !== undefined) inv.terms = terms;

    if (Array.isArray(items) && items.length > 0) {
      inv.items = items.map((it: any, idx: number) => {
        const qty = Math.max(1, parseFloat(it.quantity) || 1);
        const price = parseFloat(it.unitPrice) || 0;
        return {
          id: it.id || `item-${Date.now()}-${idx}`,
          description: String(it.description || '').trim() || 'Service Item',
          quantity: qty,
          unitPrice: price,
          total: qty * price,
        };
      });
      inv.subtotal = inv.items.reduce((s, it) => s + it.total, 0);
      inv.taxRate = typeof taxRate === 'number' ? taxRate : inv.taxRate || 0;
      inv.discount = typeof discount === 'number' ? discount : inv.discount || 0;
      inv.taxAmount = (inv.subtotal * inv.taxRate) / 100;
      inv.totalAmount = Math.max(0, inv.subtotal + inv.taxAmount - inv.discount);
    } else if (overrideTotal !== undefined && overrideTotal > 0) {
      inv.totalAmount = overrideTotal;
      inv.subtotal = overrideTotal;
    }

    // Recalculate remaining balance
    inv.balanceDue = inv.totalAmount - inv.paidAmount;
    if (inv.balanceDue <= 0) {
      inv.status = inv.balanceDue < 0 ? 'overpaid' : 'paid';
    } else if (inv.paidAmount > 0) {
      inv.status = 'partial';
    } else {
      inv.status = 'unpaid';
    }

    inv.updatedAt = Date.now();

    // Adjust customer balance
    const customer = db.customers.find((c) => c.id === inv.customerId);
    if (customer) {
      const balanceDelta = inv.balanceDue - oldBalanceDue;
      customer.balance = (customer.balance || 0) + balanceDelta;
      customer.updatedAt = Date.now();
    }

    saveDatabase(db);

    notifySubscribers('invoice_updated', { workspaceUserId: inv.workspaceUserId, invoice: inv });
    if (customer) {
      notifySubscribers('customer_updated', { workspaceUserId: inv.workspaceUserId, customer });
    }

    return res.json({ success: true, invoice: inv, customer });
  });

  // 5. Delete Invoice
  app.delete('/api/invoices/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const invId = req.params.id;
    const index = db.invoices.findIndex((i) => i.id === invId);

    if (index === -1) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const inv = db.invoices[index];
    if (currentUser.role !== 'owner' && inv.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot delete invoice from another workspace.' });
    }

    // Reverse customer balance impact: subtract unpaid balance due
    const customer = db.customers.find((c) => c.id === inv.customerId);
    if (customer) {
      customer.balance = (customer.balance || 0) - inv.balanceDue;
      customer.updatedAt = Date.now();
    }

    db.invoices.splice(index, 1);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[invId] = Date.now();

    // Remove linked commission entry if auto-created from this invoice
    const linkedCommId = `comm-inv-${invId}`;
    const hadLinkedComm = (db.commissionEntries || []).some((c) => c.id === linkedCommId);
    if (hadLinkedComm) {
      db.commissionEntries = db.commissionEntries.filter((c) => c.id !== linkedCommId);
      db.deletedRecordIds[linkedCommId] = Date.now();
    }

    saveDatabase(db);

    notifySubscribers('invoice_deleted', { workspaceUserId: inv.workspaceUserId, invoiceId: invId });
    if (customer) {
      notifySubscribers('customer_updated', { workspaceUserId: inv.workspaceUserId, customer });
    }
    if (hadLinkedComm) {
      notifySubscribers('commission_deleted', { id: linkedCommId });
    }

    return res.json({ success: true, deletedId: invId, customer });
  });

  // 6. Generate Complete Customer Statement (Requirement 4)
  app.get('/api/customers/:id/statement', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const custId = req.params.id;
    const customer = db.customers.find((c) => c.id === custId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (currentUser.role !== 'owner' && customer.workspaceUserId !== currentUser.id) {
      return res.status(403).json({ error: 'Permission denied: Cannot view customer statement from another workspace.' });
    }

    // Get all invoices for this customer
    const customerInvoices = db.invoices
      .filter((inv) => inv.customerId === custId)
      .sort((a, b) => a.date - b.date);

    // Collect all payments made
    const customerPayments: DbInvoicePayment[] = [];
    customerInvoices.forEach((inv) => {
      if (Array.isArray(inv.payments)) {
        customerPayments.push(...inv.payments);
      }
    });
    customerPayments.sort((a, b) => a.paymentDate - b.paymentDate);

    const totalInvoiced = customerInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = customerInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const balanceDue = customer.balance;
    const isCredit = balanceDue < 0;
    const creditAmount = isCredit ? Math.abs(balanceDue) : 0;

    // Build comprehensive chronological statement ledger entries
    interface StatementEntry {
      id: string;
      date: number;
      type: 'invoice' | 'payment' | 'opening_balance';
      reference: string;
      description: string;
      debit: number; // Invoiced charges
      credit: number; // Payments received
      runningBalance: number;
    }

    const ledgerEntries: StatementEntry[] = [];
    let running = 0;

    // Optional opening balance entry if customer balance doesn't start at 0
    const calculatedNet = totalInvoiced - totalPaid;
    const openingOffset = customer.balance - calculatedNet;
    if (openingOffset !== 0) {
      running += openingOffset;
      ledgerEntries.push({
        id: 'entry-opening',
        date: customer.updatedAt - 86400000 * 30,
        type: 'opening_balance',
        reference: 'OPENING',
        description: openingOffset > 0 ? 'Opening Balance Due' : 'Opening Advance Credit',
        debit: openingOffset > 0 ? openingOffset : 0,
        credit: openingOffset < 0 ? Math.abs(openingOffset) : 0,
        runningBalance: running,
      });
    }

    // Merge invoices and payments chronologically
    const allEvents: Array<
      | { type: 'invoice'; date: number; data: DbInvoice }
      | { type: 'payment'; date: number; data: DbInvoicePayment }
    > = [
      ...customerInvoices.map((inv) => ({ type: 'invoice' as const, date: inv.date, data: inv })),
      ...customerPayments.map((pay) => ({ type: 'payment' as const, date: pay.paymentDate, data: pay })),
    ];
    allEvents.sort((a, b) => a.date - b.date);

    allEvents.forEach((ev) => {
      if (ev.type === 'invoice') {
        const inv = ev.data as DbInvoice;
        running += inv.totalAmount;
        ledgerEntries.push({
          id: `entry-inv-${inv.id}`,
          date: inv.date,
          type: 'invoice',
          reference: inv.invoiceNumber,
          description: `Invoice #${inv.invoiceNumber} (${inv.items.map((i) => i.description).join(', ')})`,
          debit: inv.totalAmount,
          credit: 0,
          runningBalance: running,
        });
      } else {
        const pay = ev.data as DbInvoicePayment;
        running -= pay.amount;
        const linkedInv = customerInvoices.find((i) => i.id === pay.invoiceId);
        ledgerEntries.push({
          id: `entry-pay-${pay.id}`,
          date: pay.paymentDate,
          type: 'payment',
          reference: pay.reference || 'PAYMENT',
          description: `Payment received via ${pay.paymentMethod.toUpperCase()} ${pay.reference ? `(${pay.reference})` : ''} on ${linkedInv ? `#${linkedInv.invoiceNumber}` : 'Account'}`,
          debit: 0,
          credit: pay.amount,
          runningBalance: running,
        });
      }
    });

    return res.json({
      statement: {
        customer,
        totalInvoiced,
        totalPaid,
        balanceDue,
        isCredit,
        creditAmount,
        invoices: customerInvoices,
        payments: customerPayments,
        ledgerEntries,
      },
    });
  });

  /* ------------------- DAILY HOME BAZAR & GROCERY GOODS API ------------------- */
  const buildMergedBuyersList = (): DbBazarBuyer[] => {
    const savedBuyers = db.globalSettings?.bazarBuyers || [];
    const userByUsername = new Map<string, DbUser>();
    (db.users || []).forEach((u) => {
      userByUsername.set(u.username.toLowerCase(), u);
    });

    const map = new Map<string, DbBazarBuyer>();
    savedBuyers.forEach((b) => {
      const matchedUser = userByUsername.get(b.buyerId.toLowerCase());
      map.set(b.buyerId.toLowerCase(), {
        ...b,
        photoUrl: b.photoUrl || matchedUser?.photoUrl,
        photoData: b.photoData || matchedUser?.photoData,
      });
    });

    (db.users || []).forEach((u) => {
      const key = u.username.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          buyerId: u.username,
          name: u.name,
          role: u.role,
          photoUrl: u.photoUrl,
          photoData: u.photoData,
        });
      }
    });

    return Array.from(map.values());
  };

  const saveBuyerPhotoFile = (buyerId: string, photoBase64: string, previousPhotoUrl?: string): { photoUrl: string; photoData: string } => {
    const matches = photoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image payload. Supported formats: JPG, PNG, WebP.');
    }
    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (!['jpg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif'].includes(ext)) {
      throw new Error('Unsupported format. Allowed: JPG, JPEG, PNG, WebP, GIF, SVG, HEIC.');
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      throw new Error('Image exceeds maximum allowed size of 25MB.');
    }

    if (previousPhotoUrl && previousPhotoUrl.startsWith('/api/photos/')) {
      const oldFilename = previousPhotoUrl.replace('/api/photos/', '');
      const oldPath = path.join(PHOTOS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    const safeBuyerKey = 'buyer_' + buyerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeBuyerKey}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(PHOTOS_DIR, filename), buffer);
    return { photoUrl: `/api/photos/${filename}`, photoData: photoBase64 };
  };

  // 1. Get All Home Bazar Entries, Summary & Buyers
  app.get('/api/home-bazar', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && (currentUser.isCommissionOnly || currentUser.canManageBazar === false)) {
      return res.status(403).json({ error: 'Permission denied: Daily Bazar access is disabled for this user.' });
    }
    const list = db.homeBazarEntries || [];
    const monthlyBudget = typeof db.globalSettings?.bazarMonthlyBudget === 'number'
      ? db.globalSettings.bazarMonthlyBudget
      : 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthPrefix = todayStr.slice(0, 7); // YYYY-MM

    let totalToday = 0;
    let totalThisMonth = 0;
    const categoryTotals: Record<string, number> = {
      fish_meat: 0,
      vegetables_fruits: 0,
      groceries_staples: 0,
      dairy_bakery: 0,
      cleaning_toiletries: 0,
      snacks_beverages: 0,
      other: 0,
    };

    const mergedBuyers = buildMergedBuyersList();

    // Buyer aggregation (display only — never modifies any buyer.amount)
    const buyerMap: Record<string, { buyerId: string; buyerName: string; totalSpent: number; itemCount: number }> = {};

    list.forEach((item) => {
      const amt = Number(item.amount) || 0;
      if (item.date === todayStr) {
        totalToday += amt;
      }
      if (item.date && item.date.startsWith(thisMonthPrefix)) {
        totalThisMonth += amt;
      }
      if (categoryTotals[item.category] !== undefined) {
        categoryTotals[item.category] += amt;
      } else {
        categoryTotals.other += amt;
      }

      const bId = item.buyerId || item.purchasedBy || 'Unknown';
      const bName = item.purchasedBy || item.buyerId || 'Unknown Buyer';
      if (!buyerMap[bId]) {
        buyerMap[bId] = { buyerId: bId, buyerName: bName, totalSpent: 0, itemCount: 0 };
      }
      buyerMap[bId].totalSpent += amt;
      buyerMap[bId].itemCount += 1;
    });

    const totalSpentAll = Object.values(buyerMap).reduce((s, b) => s + b.totalSpent, 0);
    const buyerSummaries = Object.values(buyerMap)
      .map((b) => ({
        ...b,
        percentage: totalSpentAll > 0 ? Math.round((b.totalSpent / totalSpentAll) * 100) : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const remainingBudget = monthlyBudget > 0 ? (monthlyBudget - totalThisMonth) : 0;

    const sorted = [...list].sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return diff !== 0 ? diff : b.createdAt - a.createdAt;
    });

    return res.json({
      entries: sorted,
      monthlyBudget,
      buyers: mergedBuyers,
      summary: {
        totalToday,
        totalThisMonth,
        monthlyBudget,
        remainingBudget,
        categoryTotals,
        buyerSummaries,
      },
    });
  });

  // 2. Add New Home Bazar Item (with Buyer ID — NO automatic ledger transaction or buyer amount mutation)
  app.post('/api/home-bazar', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && currentUser.canManageBazar === false) {
      return res.status(403).json({ error: 'Permission denied: Owner has disabled Daily Bazar entry access.' });
    }

    const {
      date = new Date().toISOString().slice(0, 10),
      itemName,
      category = 'other',
      quantity = '',
      amount,
      paymentMethod = 'cash',
      notes = '',
      purchasedBy,
      buyerId,
    } = req.body;

    const numAmount = amount === '' || amount === undefined || amount === null ? 0 : parseFloat(amount);
    if (!itemName || !String(itemName).trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Valid non-negative amount is required' });
    }

    const resolvedBuyerId = buyerId ? String(buyerId).trim() : (currentUser.username || currentUser.id);
    let resolvedPurchasedBy = purchasedBy ? String(purchasedBy).trim() : '';

    if (!resolvedPurchasedBy) {
      const foundBuyer = (db.globalSettings.bazarBuyers || []).find((b) => b.buyerId.toLowerCase() === resolvedBuyerId.toLowerCase());
      if (foundBuyer) {
        resolvedPurchasedBy = foundBuyer.name;
      } else {
        const foundUser = (db.users || []).find((u) => u.username.toLowerCase() === resolvedBuyerId.toLowerCase() || u.id === resolvedBuyerId);
        resolvedPurchasedBy = foundUser ? foundUser.name : currentUser.name;
      }
    }

    // Auto-register buyer ID if new (without setting or changing any buyer amount)
    if (!Array.isArray(db.globalSettings.bazarBuyers)) {
      db.globalSettings.bazarBuyers = [];
    }
    const buyerExists = db.globalSettings.bazarBuyers.some(
      (b) => b.buyerId.toLowerCase() === resolvedBuyerId.toLowerCase()
    );
    if (!buyerExists && resolvedBuyerId) {
      db.globalSettings.bazarBuyers.push({
        buyerId: resolvedBuyerId,
        name: resolvedPurchasedBy || resolvedBuyerId,
        role: 'Buyer',
      });
      notifySubscribers('bazar_buyers_updated', { buyers: buildMergedBuyersList() });
    }

    const newEntry: DbHomeBazarEntry = {
      id: 'hb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      userId: currentUser.id,
      workspaceUserId: currentUser.id,
      date: String(date).slice(0, 10),
      itemName: String(itemName).trim(),
      category,
      quantity: quantity ? String(quantity).trim() : undefined,
      amount: numAmount,
      paymentMethod: paymentMethod || 'cash',
      purchasedBy: resolvedPurchasedBy,
      buyerId: resolvedBuyerId,
      notes: notes ? String(notes).trim() : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!Array.isArray(db.homeBazarEntries)) {
      db.homeBazarEntries = [];
    }
    db.homeBazarEntries.unshift(newEntry);

    // Keep Home Bazar independent: do NOT auto-add bazar amount into db.transactions or alter Buyer ID amounts.
    saveDatabase(db);
    notifySubscribers('home_bazar_added', { entry: newEntry });

    return res.status(201).json({ success: true, entry: newEntry });
  });

  // 3. Update Home Bazar Item (Full Edit Support)
  app.put('/api/home-bazar/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && currentUser.canManageBazar === false) {
      return res.status(403).json({ error: 'Permission denied: Owner has disabled Daily Bazar edit access.' });
    }

    const entryId = req.params.id;
    const entry = (db.homeBazarEntries || []).find((e) => e.id === entryId);

    if (!entry) {
      return res.status(404).json({ error: 'Bazar entry not found' });
    }

    const { itemName, category, quantity, amount, paymentMethod, date, notes, purchasedBy, buyerId } = req.body;
    if (itemName !== undefined && String(itemName).trim()) entry.itemName = String(itemName).trim();
    if (category) entry.category = category;
    if (quantity !== undefined) entry.quantity = quantity ? String(quantity).trim() : undefined;
    if (amount !== undefined) {
      const num = parseFloat(amount);
      if (!isNaN(num) && num >= 0) entry.amount = num;
    }
    if (paymentMethod) entry.paymentMethod = paymentMethod;
    if (date) entry.date = String(date).slice(0, 10);
    if (notes !== undefined) entry.notes = notes ? String(notes).trim() : undefined;
    if (purchasedBy !== undefined) entry.purchasedBy = purchasedBy ? String(purchasedBy).trim() : entry.purchasedBy;
    if (buyerId !== undefined && String(buyerId).trim()) entry.buyerId = String(buyerId).trim();
    entry.updatedAt = Date.now();

    saveDatabase(db);
    notifySubscribers('home_bazar_updated', { entry });

    return res.json({ success: true, entry });
  });

  // 4. Delete Home Bazar Item
  app.delete('/api/home-bazar/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && (currentUser.canManageBazar === false || !currentUser.canDelete)) {
      return res.status(403).json({ error: 'Permission denied: Only Owner or users with Delete permission can remove bazar items.' });
    }

    const entryId = req.params.id;
    const idx = (db.homeBazarEntries || []).findIndex((e) => e.id === entryId);

    if (idx === -1) {
      return res.status(404).json({ error: 'Bazar entry not found' });
    }

    db.homeBazarEntries.splice(idx, 1);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[entryId] = Date.now();
    saveDatabase(db);
    notifySubscribers('home_bazar_deleted', { id: entryId });

    return res.json({ success: true, deletedId: entryId });
  });

  // 5. Update Monthly Bazar Budget
  app.put('/api/home-bazar/budget', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && currentUser.canManageBazar === false) {
      return res.status(403).json({ error: 'Permission denied: Owner has disabled Daily Bazar budget access.' });
    }

    const { budget } = req.body;
    const num = parseFloat(budget);
    if (isNaN(num) || num < 0) {
      return res.status(400).json({ error: 'Valid budget number is required' });
    }

    if (!db.globalSettings) {
      db.globalSettings = INITIAL_DATABASE.globalSettings;
    }
    db.globalSettings.bazarMonthlyBudget = num;
    db.globalSettings.updatedAt = Date.now();

    saveDatabase(db);
    notifySubscribers('home_bazar_budget_updated', { monthlyBudget: num });
    return res.json({ success: true, monthlyBudget: num });
  });

  // 6. Get All Bazar Buyers
  app.get('/api/home-bazar/buyers', authMiddleware, (req, res) => {
    return res.json({ success: true, buyers: buildMergedBuyersList() });
  });

  // 7. Add or Upsert Custom Bazar Buyer (supports Photo + Manual Amount without auto-mutating existing amounts)
  app.post('/api/home-bazar/buyers', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && !currentUser.canManageBuyers) {
      return res.status(403).json({ error: 'Permission denied: Only Owner or permitted users can manage Buyer IDs and Photos.' });
    }

    const { buyerId, name, phone, role, amount, notes, photoBase64, removePhoto } = req.body;
    if (!buyerId || !String(buyerId).trim()) {
      return res.status(400).json({ error: 'Buyer ID is required (e.g. BYR-01, MBR-05)' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Buyer name is required' });
    }

    const cleanId = String(buyerId).trim();
    const cleanName = String(name).trim();

    if (!Array.isArray(db.globalSettings.bazarBuyers)) {
      db.globalSettings.bazarBuyers = [];
    }

    const existingIdx = db.globalSettings.bazarBuyers.findIndex(
      (b) => b.buyerId.toLowerCase() === cleanId.toLowerCase()
    );
    const existingBuyer = existingIdx !== -1 ? db.globalSettings.bazarBuyers[existingIdx] : undefined;

    let photoUrl = existingBuyer?.photoUrl;
    let photoData = existingBuyer?.photoData;
    if (removePhoto) {
      if (photoUrl && photoUrl.startsWith('/api/photos/')) {
        const oldPath = path.join(PHOTOS_DIR, photoUrl.replace('/api/photos/', ''));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }
      photoUrl = undefined;
      photoData = undefined;
    } else if (photoBase64 && typeof photoBase64 === 'string') {
      try {
        const saved = saveBuyerPhotoFile(cleanId, photoBase64, photoUrl);
        photoUrl = saved.photoUrl;
        photoData = saved.photoData;
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Invalid buyer photo' });
      }
    }

    // Preserve existing buyer amount unless explicitly specified
    let resolvedAmount = existingBuyer?.amount;
    if (amount !== undefined && amount !== '' && amount !== null) {
      const parsedAmt = parseFloat(amount);
      if (!isNaN(parsedAmt) && parsedAmt >= 0) {
        resolvedAmount = parsedAmt;
      }
    }

    const buyerObj: DbBazarBuyer = {
      buyerId: cleanId,
      name: cleanName,
      phone: phone !== undefined ? (phone ? String(phone).trim() : undefined) : existingBuyer?.phone,
      role: role ? String(role).trim() : (existingBuyer?.role || 'Buyer'),
      amount: resolvedAmount,
      notes: notes !== undefined ? (notes ? String(notes).trim() : undefined) : existingBuyer?.notes,
      photoUrl,
      photoData,
      updatedAt: Date.now(),
    };

    if (existingIdx !== -1) {
      db.globalSettings.bazarBuyers[existingIdx] = buyerObj;
    } else {
      db.globalSettings.bazarBuyers.push(buyerObj);
    }

    db.globalSettings.updatedAt = Date.now();
    saveDatabase(db);
    notifySubscribers('bazar_buyers_updated', { buyers: buildMergedBuyersList() });

    return res.status(201).json({ success: true, buyer: buyerObj });
  });

  // 7b. Full Edit for an Existing Buyer ID (Owner or permitted user can change everything)
  app.put('/api/home-bazar/buyers/:buyerId', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && !currentUser.canManageBuyers) {
      return res.status(403).json({ error: 'Permission denied: Only Owner or permitted users can edit Buyer IDs and Photos.' });
    }

    const originalId = decodeURIComponent(req.params.buyerId).trim();
    if (!Array.isArray(db.globalSettings.bazarBuyers)) {
      db.globalSettings.bazarBuyers = [];
    }

    let idx = db.globalSettings.bazarBuyers.findIndex(
      (b) => b.buyerId.toLowerCase() === originalId.toLowerCase()
    );

    // If buyer came from a registered user not yet materialized in bazarBuyers, materialize it now
    if (idx === -1) {
      const matchedUser = (db.users || []).find(
        (u) => u.username.toLowerCase() === originalId.toLowerCase()
      );
      if (matchedUser) {
        db.globalSettings.bazarBuyers.push({
          buyerId: matchedUser.username,
          name: matchedUser.name,
          role: matchedUser.role,
          photoUrl: matchedUser.photoUrl,
          photoData: matchedUser.photoData,
        });
        idx = db.globalSettings.bazarBuyers.length - 1;
      }
    }

    if (idx === -1) {
      return res.status(404).json({ error: 'Buyer ID not found' });
    }

    const existing = db.globalSettings.bazarBuyers[idx];
    const { newBuyerId, name, phone, role, amount, notes, photoBase64, removePhoto } = req.body;

    const targetBuyerId = newBuyerId && String(newBuyerId).trim() ? String(newBuyerId).trim() : existing.buyerId;
    if (
      targetBuyerId.toLowerCase() !== existing.buyerId.toLowerCase() &&
      db.globalSettings.bazarBuyers.some((b, i) => i !== idx && b.buyerId.toLowerCase() === targetBuyerId.toLowerCase())
    ) {
      return res.status(400).json({ error: `Buyer ID '${targetBuyerId}' already exists.` });
    }

    let photoUrl = existing.photoUrl;
    let photoData = existing.photoData;
    if (removePhoto) {
      if (photoUrl && photoUrl.startsWith('/api/photos/')) {
        const oldPath = path.join(PHOTOS_DIR, photoUrl.replace('/api/photos/', ''));
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }
      photoUrl = undefined;
      photoData = undefined;
    } else if (photoBase64 && typeof photoBase64 === 'string') {
      try {
        const saved = saveBuyerPhotoFile(targetBuyerId, photoBase64, photoUrl);
        photoUrl = saved.photoUrl;
        photoData = saved.photoData;
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Invalid buyer photo' });
      }
    }

    // Preserve existing buyer amount unless explicitly edited (or cleared with null)
    let resolvedAmount = existing.amount;
    if (amount === null) {
      resolvedAmount = undefined;
    } else if (amount !== undefined && amount !== '') {
      const parsedAmt = parseFloat(amount);
      if (!isNaN(parsedAmt) && parsedAmt >= 0) {
        resolvedAmount = parsedAmt;
      }
    }

    const updatedBuyer: DbBazarBuyer = {
      ...existing,
      buyerId: targetBuyerId,
      name: name !== undefined && String(name).trim() ? String(name).trim() : existing.name,
      phone: phone !== undefined ? (phone ? String(phone).trim() : undefined) : existing.phone,
      role: role !== undefined ? (role ? String(role).trim() : 'Buyer') : existing.role,
      amount: resolvedAmount,
      notes: notes !== undefined ? (notes ? String(notes).trim() : undefined) : existing.notes,
      photoUrl,
      photoData,
      updatedAt: Date.now(),
    };

    const previousId = existing.buyerId;
    db.globalSettings.bazarBuyers[idx] = updatedBuyer;

    // If Buyer ID was renamed, update buyerId label on matching bazar entries without touching entry amounts
    if (targetBuyerId !== previousId && Array.isArray(db.homeBazarEntries)) {
      db.homeBazarEntries.forEach((entry) => {
        if ((entry.buyerId || '').toLowerCase() === previousId.toLowerCase()) {
          entry.buyerId = targetBuyerId;
          entry.purchasedBy = updatedBuyer.name;
          entry.updatedAt = Date.now();
        }
      });
    }

    db.globalSettings.updatedAt = Date.now();
    saveDatabase(db);
    notifySubscribers('bazar_buyers_updated', { buyers: buildMergedBuyersList() });
    if (targetBuyerId !== previousId) {
      notifySubscribers('home_bazar_updated', { renamedFrom: previousId, renamedTo: targetBuyerId });
    }

    return res.json({
      success: true,
      buyer: updatedBuyer,
      renamedFrom: targetBuyerId !== previousId ? previousId : undefined,
    });
  });

  // 8. Delete Custom Bazar Buyer
  app.delete('/api/home-bazar/buyers/:buyerId', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    if (currentUser.role !== 'owner' && (!currentUser.canManageBuyers || !currentUser.canDelete)) {
      return res.status(403).json({ error: 'Permission denied: Only Owner or permitted users with Delete access can remove Buyer IDs.' });
    }

    const targetId = decodeURIComponent(req.params.buyerId).trim().toLowerCase();
    if (!Array.isArray(db.globalSettings.bazarBuyers)) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const idx = db.globalSettings.bazarBuyers.findIndex(
      (b) => b.buyerId.toLowerCase() === targetId
    );
    if (idx === -1) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const target = db.globalSettings.bazarBuyers[idx];
    if (target.photoUrl && target.photoUrl.startsWith('/api/photos/')) {
      const oldPath = path.join(PHOTOS_DIR, target.photoUrl.replace('/api/photos/', ''));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    db.globalSettings.bazarBuyers.splice(idx, 1);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[`buyer:${target.buyerId.toLowerCase()}`] = Date.now();
    db.globalSettings.updatedAt = Date.now();
    saveDatabase(db);
    notifySubscribers('bazar_buyers_updated', { buyers: buildMergedBuyersList() });

    return res.json({ success: true, deletedBuyerId: req.params.buyerId });
  });

  /* ------------------- COMMISSION SHEET SPREADSHEET API ------------------- */
  function ensureCommissionPersonAccount(
    personName: string,
    extra?: { iqamaNo?: string; phone?: string; office?: string; linkedUserId?: string }
  ): DbCommissionPersonAccount | null {
    const cleanName = (personName || '').trim();
    if (!cleanName || cleanName.toLowerCase() === 'all' || cleanName.toLowerCase() === 'all persons') return null;

    if (!Array.isArray(db.commissionPersons)) db.commissionPersons = [];
    const existingIdx = db.commissionPersons.findIndex(
      (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    const matchedUser = (db.users || []).find(
      (u) => u.name.trim().toLowerCase() === cleanName.toLowerCase() || u.username.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIdx !== -1) {
      const existing = db.commissionPersons[existingIdx];
      let changed = false;
      if (extra?.iqamaNo !== undefined && extra.iqamaNo.trim() !== (existing.iqamaNo || '')) {
        existing.iqamaNo = extra.iqamaNo.trim();
        changed = true;
      }
      if (extra?.phone !== undefined && extra.phone.trim() !== (existing.phone || '')) {
        existing.phone = extra.phone.trim();
        changed = true;
      }
      if (extra?.office !== undefined && extra.office.trim() && !existing.office) {
        existing.office = extra.office.trim();
        changed = true;
      }
      if (!existing.linkedUserId && (extra?.linkedUserId || matchedUser?.id)) {
        existing.linkedUserId = extra?.linkedUserId || matchedUser?.id;
        changed = true;
      }
      if (changed) {
        existing.updatedAt = Date.now();
        db.commissionPersons[existingIdx] = existing;
      }
      return existing;
    }

    const created: DbCommissionPersonAccount = {
      id: 'person_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: cleanName,
      iqamaNo: extra?.iqamaNo?.trim() || '',
      phone: extra?.phone?.trim() || '',
      office: extra?.office?.trim() || '',
      linkedUserId: extra?.linkedUserId || matchedUser?.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.commissionPersons.push(created);
    return created;
  }

  function ensureCommissionMonth(dateOrYm?: string) {
    if (!Array.isArray(db.commissionMonths)) db.commissionMonths = [];
    const ym = dateOrYm && /^\d{4}-\d{2}/.test(dateOrYm) ? dateOrYm.slice(0, 7) : null;
    if (ym && !db.commissionMonths.includes(ym)) {
      db.commissionMonths.push(ym);
      db.commissionMonths.sort();
    }
  }

  // Auto-sync Commission Payouts & Person Account Ledger Entries in db.transactions
  function syncCommissionAccountingTransaction(entry: DbCommissionEntry, actor: DbUser) {
    const txId = `tx-comm-${entry.id}`;
    const existingIdx = (db.transactions || []).findIndex((t) => t.id === txId);
    const amount = Number(entry.commissionAmount) || 0;
    const shouldPost = entry.payoutStatus === 'Paid' && !entry.isClawback && entry.invoiceStatus !== 'Cancelled' && amount > 0;

    if (shouldPost) {
      const txObj: DbTransaction = {
        id: txId,
        userId: actor.id,
        workspaceUserId: entry.agentId || actor.id,
        description: `Commission Account (${entry.agent}): Invoice #${entry.invoiceNo} - ${entry.client}`,
        amount,
        type: 'expense',
        category: 'salary',
        paymentMethod: 'cash',
        timestamp: entry.paidAt || new Date(entry.date).getTime() || Date.now(),
        updatedAt: Date.now(),
        notes: `Auto-synced from Commission Statement • Service: ${entry.service}`,
        createdByName: actor.name,
        customerName: entry.agent,
        syncedToCloud: true,
      };
      if (existingIdx !== -1) {
        db.transactions[existingIdx] = txObj;
        notifySubscribers('transaction_updated', { workspaceUserId: txObj.workspaceUserId, transaction: txObj });
      } else {
        db.transactions.unshift(txObj);
        notifySubscribers('transaction_created', { workspaceUserId: txObj.workspaceUserId, transaction: txObj });
      }
    } else if (existingIdx !== -1) {
      const removed = db.transactions[existingIdx];
      db.transactions.splice(existingIdx, 1);
      notifySubscribers('transaction_deleted', { workspaceUserId: removed.workspaceUserId, transactionId: txId });
    }
  }

  // Resolve a record's agent name against manually registered Persons without ever auto-creating new Persons
  function resolveExplicitCommissionPerson(rawName?: string): { name: string; linkedUserId?: string } {
    const persons = db.commissionPersons || [];
    const trimmed = String(rawName || '').trim();
    if (!trimmed) {
      const primary = persons[0];
      return { name: primary?.name || 'RH FAYSAL', linkedUserId: primary?.linkedUserId };
    }
    const lower = trimmed.toLowerCase();
    const directMatch = persons.find((p) => p.name.trim().toLowerCase() === lower);
    if (directMatch) {
      return { name: directMatch.name, linkedUserId: directMatch.linkedUserId };
    }
    if (lower === 'faysal') {
      const rhMatch = persons.find((p) => p.name.trim().toLowerCase() === 'rh faysal');
      if (rhMatch) {
        return { name: rhMatch.name, linkedUserId: rhMatch.linkedUserId };
      }
    }
    return { name: trimmed };
  }

  // Commission Person Accounts API (Manual Persons only — NEVER auto-generated from entries or user profiles)
  app.get('/api/commission-persons', authMiddleware, (_req, res) => {
    const persons = db.commissionPersons || [];
    const entries = (db.commissionEntries || []).filter((c) => !isAutoSyncedCustomerInvoiceCommission(c));

    // Compute live account balances strictly for explicitly registered Persons
    const accountMap = new Map<string, any>();
    persons.forEach((p) => {
      accountMap.set(p.name.trim().toLowerCase(), {
        ...p,
        invoicesCount: 0,
        toPayNow: 0,
        alreadyPaid: 0,
        notYetEligible: 0,
        totalCommission: 0,
      });
    });

    entries.forEach((e) => {
      const key = (e.agent || '').trim().toLowerCase();
      if (!key || !accountMap.has(key)) {
        return; // Do NOT auto-generate Person accounts from entry variations
      }
      const acc = accountMap.get(key);
      acc.invoicesCount += 1;
      const amt = e.isClawback || e.invoiceStatus === 'Cancelled' ? 0 : (Number(e.commissionAmount) || 0);
      if (e.payoutStatus === 'Paid' && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
        acc.alreadyPaid += amt;
      } else if (e.eligible && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
        acc.toPayNow += amt;
      } else if (!e.eligible && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
        acc.notYetEligible += amt;
      }
      acc.totalCommission = acc.toPayNow + acc.alreadyPaid + acc.notYetEligible;
    });

    return res.json({ persons, accounts: Array.from(accountMap.values()) });
  });

  function applyCommissionPersonPhoto(person: DbCommissionPersonAccount, photoBase64: string) {
    const matches = photoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image payload. Supported formats: JPG, PNG, WebP.');
    }
    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (!['jpg', 'png', 'webp', 'gif', 'svg', 'heic', 'heif'].includes(ext)) {
      throw new Error('Unsupported format. Allowed: JPG, JPEG, PNG, WebP, GIF, SVG, HEIC.');
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      throw new Error('Image exceeds maximum allowed size of 25MB.');
    }
    if (person.photoUrl && person.photoUrl.startsWith('/api/photos/')) {
      const oldFilename = person.photoUrl.replace('/api/photos/', '');
      const oldPath = path.join(PHOTOS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }
    const filename = `${person.id}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(PHOTOS_DIR, filename), buffer);
    person.photoUrl = `/api/photos/${filename}`;
    person.photoData = photoBase64;
  }

  function removeCommissionPersonPhotoFiles(person: DbCommissionPersonAccount) {
    if (person.photoUrl && person.photoUrl.startsWith('/api/photos/')) {
      const oldFilename = person.photoUrl.replace('/api/photos/', '');
      const oldPath = path.join(PHOTOS_DIR, oldFilename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }
    person.photoUrl = undefined;
    person.photoData = undefined;
  }

  app.post('/api/commission-persons', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { name, iqamaNo, phone, office, linkedUserId, photoBase64 } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Person name is required' });
    }
    if (photoBase64 && currentUser.role !== 'owner') {
      return res.status(403).json({ error: 'Owner Only: Only the Owner can add or change a person photo.' });
    }
    const person = ensureCommissionPersonAccount(String(name).trim(), {
      iqamaNo: iqamaNo !== undefined ? String(iqamaNo) : undefined,
      phone: phone !== undefined ? String(phone) : undefined,
      office: office !== undefined ? String(office) : undefined,
      linkedUserId,
    });
    if (person && photoBase64 && typeof photoBase64 === 'string' && currentUser.role === 'owner') {
      try {
        applyCommissionPersonPhoto(person, photoBase64);
        person.updatedAt = Date.now();
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Invalid photo payload' });
      }
    }
    saveDatabase(db);
    notifySubscribers('commission_person_updated', { person });
    return res.status(201).json({ success: true, person });
  });

  app.put('/api/commission-persons/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;
    db.commissionPersons = db.commissionPersons || [];
    const idx = db.commissionPersons.findIndex((p) => p.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Person profile not found' });
    }
    const existing = db.commissionPersons[idx];
    const oldName = existing.name;
    const { name, iqamaNo, phone, office, photoBase64, removePhoto } = req.body;

    if ((photoBase64 || removePhoto) && currentUser.role !== 'owner') {
      return res.status(403).json({ error: 'Owner Only: Only the Owner can change or remove a person photo.' });
    }

    if (name && String(name).trim()) existing.name = String(name).trim();
    if (iqamaNo !== undefined) existing.iqamaNo = String(iqamaNo).trim();
    if (phone !== undefined) existing.phone = String(phone).trim();
    if (office !== undefined) existing.office = String(office).trim();

    if (removePhoto && currentUser.role === 'owner') {
      removeCommissionPersonPhotoFiles(existing);
    } else if (photoBase64 && typeof photoBase64 === 'string' && currentUser.role === 'owner') {
      try {
        applyCommissionPersonPhoto(existing, photoBase64);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Invalid photo payload' });
      }
    }

    existing.updatedAt = Date.now();
    db.commissionPersons[idx] = existing;

    // Keep entries linked if person name was edited
    if (name && oldName.toLowerCase() !== existing.name.toLowerCase()) {
      (db.commissionEntries || []).forEach((e) => {
        if (e.agent.toLowerCase() === oldName.toLowerCase()) {
          e.agent = existing.name;
          e.updatedAt = Date.now();
        }
      });
    }

    saveDatabase(db);
    notifySubscribers('commission_person_updated', { person: existing });
    return res.json({ success: true, person: existing });
  });

  // Delete Person Account (with optional record reassignment)
  app.delete('/api/commission-persons/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;
    const reassignTo = String((req.body && req.body.reassignTo) || req.query.reassignTo || '').trim();
    db.commissionPersons = db.commissionPersons || [];
    const idx = db.commissionPersons.findIndex((p) => p.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Person profile not found' });
    }
    const target = db.commissionPersons[idx];
    const oldNameLower = target.name.trim().toLowerCase();

    if (reassignTo && reassignTo.toLowerCase() !== oldNameLower) {
      const targetMatch = resolveExplicitCommissionPerson(reassignTo);
      (db.commissionEntries || []).forEach((e) => {
        if ((e.agent || '').trim().toLowerCase() === oldNameLower) {
          e.agent = targetMatch.name;
          if (targetMatch.linkedUserId) e.agentId = targetMatch.linkedUserId;
          e.updatedAt = Date.now();
        }
      });
    }

    removeCommissionPersonPhotoFiles(target);
    db.commissionPersons.splice(idx, 1);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[targetId] = Date.now();

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'COMMISSION_PERSON_DELETED',
      performedBy: currentUser.name,
      details: { personId: target.id, personName: target.name, reassignTo: reassignTo || null },
    });
    saveDatabase(db);
    notifySubscribers('commission_person_deleted', { id: targetId, person: target });
    if (reassignTo) {
      notifySubscribers('commission_updated', { type: 'person_reassigned' });
    }
    return res.json({ success: true, deletedId: targetId, deletedName: target.name });
  });

  // Merge one Person (and all their commission records) into another Person
  app.post('/api/commission-persons/merge', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { sourceId, sourceName, targetId, targetName } = req.body || {};
    db.commissionPersons = db.commissionPersons || [];

    const targetPerson =
      (targetId && db.commissionPersons.find((p) => p.id === targetId)) ||
      (targetName &&
        db.commissionPersons.find(
          (p) => p.name.trim().toLowerCase() === String(targetName).trim().toLowerCase()
        ));

    if (!targetPerson) {
      return res.status(404).json({ error: 'Target person account not found' });
    }

    const sourcePerson =
      (sourceId && db.commissionPersons.find((p) => p.id === sourceId)) ||
      (sourceName &&
        db.commissionPersons.find(
          (p) => p.name.trim().toLowerCase() === String(sourceName).trim().toLowerCase()
        ));

    const effectiveSourceName = (sourcePerson?.name || String(sourceName || '')).trim();
    if (!effectiveSourceName) {
      return res.status(400).json({ error: 'Source person to merge is required' });
    }
    if (
      (sourcePerson && sourcePerson.id === targetPerson.id) ||
      effectiveSourceName.toLowerCase() === targetPerson.name.trim().toLowerCase()
    ) {
      return res.status(400).json({ error: 'Cannot merge a person into themselves' });
    }

    const sourceLower = effectiveSourceName.toLowerCase();
    const now = Date.now();
    let mergedEntriesCount = 0;

    (db.commissionEntries || []).forEach((e) => {
      if ((e.agent || '').trim().toLowerCase() === sourceLower) {
        e.agent = targetPerson.name;
        if (targetPerson.linkedUserId) e.agentId = targetPerson.linkedUserId;
        e.updatedAt = now;
        mergedEntriesCount += 1;
      }
    });

    if (sourcePerson) {
      if (!targetPerson.iqamaNo && sourcePerson.iqamaNo) targetPerson.iqamaNo = sourcePerson.iqamaNo;
      if (!targetPerson.phone && sourcePerson.phone) targetPerson.phone = sourcePerson.phone;
      if (!targetPerson.office && sourcePerson.office) targetPerson.office = sourcePerson.office;
      if (!targetPerson.linkedUserId && sourcePerson.linkedUserId) {
        targetPerson.linkedUserId = sourcePerson.linkedUserId;
      }
      const reusedSourcePhoto = !targetPerson.photoUrl && !targetPerson.photoData && (sourcePerson.photoUrl || sourcePerson.photoData);
      if (reusedSourcePhoto) {
        targetPerson.photoUrl = sourcePerson.photoUrl;
        targetPerson.photoData = sourcePerson.photoData;
      } else {
        removeCommissionPersonPhotoFiles(sourcePerson);
      }
      targetPerson.updatedAt = now;

      db.commissionPersons = db.commissionPersons.filter((p) => p.id !== sourcePerson.id);
      db.deletedRecordIds = db.deletedRecordIds || {};
      db.deletedRecordIds[sourcePerson.id] = now;
    }

    db.auditLogs.unshift({
      id: 'audit-' + now,
      timestamp: now,
      action: 'COMMISSION_PERSON_MERGED',
      performedBy: currentUser.name,
      details: {
        from: effectiveSourceName,
        into: targetPerson.name,
        mergedEntriesCount,
      },
    });
    saveDatabase(db);
    notifySubscribers('commission_person_updated', { person: targetPerson });
    notifySubscribers('commission_updated', { type: 'person_merged' });

    return res.json({
      success: true,
      mergedEntriesCount,
      target: targetPerson,
      deletedSourceId: sourcePerson?.id || null,
    });
  });

  // Owner-Only Person Photo Upload & Delete endpoints
  app.post('/api/commission-persons/:id/photo', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;
    db.commissionPersons = db.commissionPersons || [];
    const person = db.commissionPersons.find((p) => p.id === targetId);
    if (!person) {
      return res.status(404).json({ error: 'Person profile not found' });
    }
    const { photoBase64 } = req.body;
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return res.status(400).json({ error: 'Valid photo base64 data is required' });
    }
    try {
      applyCommissionPersonPhoto(person, photoBase64);
      person.updatedAt = Date.now();
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to save person photo' });
    }
    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'PERSON_PHOTO_UPDATED',
      performedBy: currentUser.name,
      details: { personId: person.id, personName: person.name, photoUrl: person.photoUrl },
    });
    saveDatabase(db);
    notifySubscribers('commission_person_updated', { person });
    return res.json({ success: true, photoUrl: person.photoUrl, person });
  });

  app.delete('/api/commission-persons/:id/photo', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;
    db.commissionPersons = db.commissionPersons || [];
    const person = db.commissionPersons.find((p) => p.id === targetId);
    if (!person) {
      return res.status(404).json({ error: 'Person profile not found' });
    }
    removeCommissionPersonPhotoFiles(person);
    person.updatedAt = Date.now();
    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'PERSON_PHOTO_REMOVED',
      performedBy: currentUser.name,
      details: { personId: person.id, personName: person.name },
    });
    saveDatabase(db);
    notifySubscribers('commission_person_updated', { person });
    return res.json({ success: true, person });
  });

  // Monthly Sheet Files API
  app.get('/api/commission-months', authMiddleware, (_req, res) => {
    const months = Array.from(
      new Set([...(db.commissionMonths || []), new Date().toISOString().slice(0, 7)])
    ).sort();
    return res.json({ months });
  });

  app.post('/api/commission-months', authMiddleware, (req, res) => {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(String(month).trim())) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format (e.g. 2026-11)' });
    }
    const ym = String(month).trim();
    ensureCommissionMonth(ym);
    saveDatabase(db);
    notifySubscribers('commission_month_updated', { months: db.commissionMonths });
    return res.status(201).json({ success: true, months: db.commissionMonths });
  });

  app.delete('/api/commission-months/:month', authMiddleware, (req, res) => {
    const ym = req.params.month;
    db.commissionMonths = (db.commissionMonths || []).filter((m) => m !== ym);
    saveDatabase(db);
    notifySubscribers('commission_month_updated', { months: db.commissionMonths });
    return res.json({ success: true, months: db.commissionMonths });
  });

  app.get('/api/commissions', authMiddleware, (req, res) => {
    const { agent, period, office } = req.query;
    let list = (db.commissionEntries || []).filter((c) => !isAutoSyncedCustomerInvoiceCommission(c));

    if (agent && agent !== 'all') {
      const qAgent = String(agent).trim().toLowerCase();
      list = list.filter((c) => c.agent.toLowerCase() === qAgent);
    }
    if (period && period !== 'all') {
      const p = String(period);
      list = list.filter((c) => c.period === p || (c.date && c.date.startsWith(p)));
    }
    if (office && office !== 'all') {
      list = list.filter((c) => c.office === String(office));
    }

    // Compute statement totals
    const eligibleList = list.filter(
      (c) => c.eligible && !c.isClawback && c.invoiceStatus !== 'Cancelled' && c.payoutStatus !== 'Paid'
    );
    const waitingList = list.filter(
      (c) => !c.eligible && !c.isClawback && c.invoiceStatus !== 'Cancelled' && c.payoutStatus !== 'Paid'
    );
    const clawbackList = list.filter((c) => c.isClawback || c.invoiceStatus === 'Cancelled');

    const commissionDue = eligibleList.reduce((sum, c) => sum + (Number(c.commissionAmount) || 0), 0);
    const clawbackAmount = clawbackList.reduce(
      (sum, c) => sum + (c.clawbackAmount !== undefined ? -Math.abs(Number(c.clawbackAmount) || 0) : 0),
      0
    );
    const alreadyPaid = list
      .filter((c) => c.payoutStatus === 'Paid' && !c.isClawback && c.invoiceStatus !== 'Cancelled')
      .reduce((sum, c) => sum + (Number(c.commissionAmount) || 0), 0);
    const notYetEligibleAmount = waitingList.reduce((sum, c) => sum + (Number(c.commissionAmount) || 0), 0);

    const netPayout = commissionDue + clawbackAmount;
    const owedByAgent = netPayout < 0 ? Math.abs(netPayout) : 0;

    const summary = {
      agent: String(agent || 'all'),
      period: String(period || 'all'),
      printedDate: new Date().toISOString().slice(0, 10),
      totalInvoices: list.length,
      commissionDue,
      clawbackAmount,
      owedByAgent,
      alreadyPaid,
      notYetEligibleAmount,
      eligibleCount: eligibleList.length,
      waitingCount: waitingList.length,
      cancelledCount: clawbackList.length,
      currency: db.globalSettings.currency || 'SAR',
    };

    return res.json({
      entries: list,
      summary,
      persons: db.commissionPersons || [],
      months: Array.from(new Set([...(db.commissionMonths || []), new Date().toISOString().slice(0, 7)])).sort(),
    });
  });

  app.post('/api/commissions', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const {
      date,
      office,
      invoiceNo,
      invoiceStatus,
      agent,
      client,
      workerName,
      clientMobile,
      service,
      qty,
      ratePerUnit,
      invoiceTotal,
      remainingAmount,
      eligible,
      reasonNotEligible,
      commissionAmount,
      isClawback,
      clawbackAmount,
      payoutStatus,
      period,
      notes,
    } = req.body;

    if (!invoiceNo || !client || !service) {
      return res.status(400).json({ error: 'Invoice number, client name, and service are required' });
    }

    const unitQty = Math.max(1, Number(qty) || 1);
    const unitRate = Math.max(0, Number(ratePerUnit) || 0);
    // Respect exact user-entered commissionAmount (never invent an auto amount)
    const calculatedCommission =
      commissionAmount !== undefined && commissionAmount !== null && commissionAmount !== ''
        ? Math.max(0, Number(commissionAmount) || 0)
        : unitQty * unitRate;
    const clawbackFlag = Boolean(isClawback) || invoiceStatus === 'Cancelled';
    const eligibleFlag = clawbackFlag ? false : Boolean(eligible);
    // Do NOT fall back to currentUser.name or auto-create Person accounts
    const resolvedPerson = resolveExplicitCommissionPerson(agent);
    const resolvedAgent = resolvedPerson.name;
    const resolvedDate = date || new Date().toISOString().slice(0, 10);

    ensureCommissionMonth(resolvedDate);
    const personAcc = (db.commissionPersons || []).find(
      (p) => p.name.trim().toLowerCase() === resolvedAgent.toLowerCase()
    );

    const newEntry: DbCommissionEntry = {
      id: 'comm-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: resolvedDate,
      office: office || 'JUB5 - Jubail - Al Madrasa',
      invoiceNo: String(invoiceNo).trim(),
      invoiceStatus: clawbackFlag ? 'Cancelled' : invoiceStatus || (eligibleFlag ? 'Active' : 'Pending'),
      agent: resolvedAgent,
      agentId: resolvedPerson.linkedUserId || personAcc?.linkedUserId || currentUser.id,
      client: String(client).trim(),
      workerName: workerName?.trim() || undefined,
      clientMobile: clientMobile?.trim() || undefined,
      service: String(service).trim(),
      qty: unitQty,
      ratePerUnit: unitRate,
      invoiceTotal: Number(invoiceTotal) || 0,
      remainingAmount: Number(remainingAmount) || 0,
      eligible: eligibleFlag,
      reasonNotEligible: eligibleFlag ? undefined : reasonNotEligible || 'Pending invoice clearance',
      commissionAmount: clawbackFlag ? 0 : calculatedCommission,
      isClawback: clawbackFlag,
      clawbackAmount: clawbackFlag ? -Math.abs(Number(clawbackAmount) || 0) : undefined,
      payoutStatus: clawbackFlag
        ? 'Carried over'
        : payoutStatus || (eligibleFlag ? 'To pay' : 'Not eligible'),
      paidAt: payoutStatus === 'Paid' ? Date.now() : undefined,
      period: period || resolvedDate.slice(0, 7),
      notes: notes || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.commissionEntries = db.commissionEntries || [];
    db.commissionEntries.unshift(newEntry);

    // Auto-sync accounting ledger & audit announcement
    syncCommissionAccountingTransaction(newEntry, currentUser);
    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'COMMISSION_ENTRY_ADDED',
      performedBy: currentUser.name,
      details: {
        person: newEntry.agent,
        invoiceNo: newEntry.invoiceNo,
        client: newEntry.client,
        commissionAmount: newEntry.commissionAmount,
        payoutStatus: newEntry.payoutStatus,
      },
    });
    db.auditLogs = db.auditLogs.slice(0, 100);

    saveDatabase(db);
    notifySubscribers('commission_added', { entry: newEntry, person: personAcc || null });

    return res.status(201).json({ success: true, entry: newEntry, person: personAcc || null });
  });

  app.put('/api/commissions/:id', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const targetId = req.params.id;
    const index = db.commissionEntries.findIndex((c) => c.id === targetId);
    if (index === -1) {
      return res.status(404).json({ error: 'Commission entry not found' });
    }

    const existing = db.commissionEntries[index];
    const updates = req.body;

    if (updates.date) {
      existing.date = String(updates.date);
      ensureCommissionMonth(existing.date);
    }
    if (updates.invoiceNo) existing.invoiceNo = String(updates.invoiceNo).trim();
    if (updates.agent) {
      const resolvedPerson = resolveExplicitCommissionPerson(String(updates.agent));
      existing.agent = resolvedPerson.name;
      if (resolvedPerson.linkedUserId) existing.agentId = resolvedPerson.linkedUserId;
    }
    if (updates.period) existing.period = String(updates.period);
    if (updates.qty !== undefined) existing.qty = Math.max(1, Number(updates.qty) || 1);
    if (updates.ratePerUnit !== undefined) existing.ratePerUnit = Math.max(0, Number(updates.ratePerUnit) || 0);
    if (updates.invoiceTotal !== undefined) existing.invoiceTotal = Number(updates.invoiceTotal) || 0;
    if (updates.remainingAmount !== undefined) existing.remainingAmount = Math.max(0, Number(updates.remainingAmount) || 0);
    if (updates.client !== undefined) existing.client = String(updates.client).trim();
    if (updates.workerName !== undefined) existing.workerName = updates.workerName ? String(updates.workerName).trim() : undefined;
    if (updates.service !== undefined) existing.service = String(updates.service).trim();
    if (updates.office !== undefined) existing.office = String(updates.office).trim();
    if (updates.clientMobile !== undefined) existing.clientMobile = updates.clientMobile?.trim() || undefined;
    if (updates.notes !== undefined) existing.notes = updates.notes;

    if (updates.isClawback !== undefined) {
      existing.isClawback = Boolean(updates.isClawback);
    }
    if (updates.invoiceStatus) {
      existing.invoiceStatus = updates.invoiceStatus;
      if (updates.invoiceStatus === 'Cancelled') existing.isClawback = true;
    }

    if (existing.isClawback) {
      existing.eligible = false;
      existing.invoiceStatus = 'Cancelled';
      existing.commissionAmount = 0;
      const rawClawback =
        updates.clawbackAmount !== undefined
          ? Number(updates.clawbackAmount) || 0
          : existing.clawbackAmount || 0;
      existing.clawbackAmount = -Math.abs(rawClawback);
      existing.payoutStatus = 'Carried over';
      if (updates.reasonNotEligible !== undefined) {
        existing.reasonNotEligible = updates.reasonNotEligible;
      }
    } else {
      if (updates.eligible !== undefined) {
        existing.eligible = Boolean(updates.eligible);
      }
      existing.invoiceStatus = existing.eligible ? 'Active' : 'Pending';
      existing.clawbackAmount = undefined;

      if (updates.commissionAmount !== undefined) {
        existing.commissionAmount = Math.max(0, Number(updates.commissionAmount) || 0);
      } else if (updates.qty !== undefined || updates.ratePerUnit !== undefined || updates.isClawback === false) {
        existing.commissionAmount = existing.qty * existing.ratePerUnit;
      }

      if (existing.eligible) {
        existing.reasonNotEligible = undefined;
        if (updates.payoutStatus) {
          existing.payoutStatus = updates.payoutStatus;
        } else if (existing.payoutStatus !== 'Paid') {
          existing.payoutStatus = 'To pay';
        }
      } else {
        existing.reasonNotEligible =
          updates.reasonNotEligible !== undefined
            ? updates.reasonNotEligible
            : existing.reasonNotEligible || 'Pending invoice payment';
        if (existing.payoutStatus !== 'Paid') {
          existing.payoutStatus = 'Not eligible';
        }
      }
    }

    if (updates.payoutStatus && !existing.isClawback) {
      existing.payoutStatus = updates.payoutStatus;
    }
    if (updates.paidAt !== undefined) {
      existing.paidAt = updates.paidAt;
    } else if (existing.payoutStatus === 'Paid' && !existing.paidAt) {
      existing.paidAt = Date.now();
    }

    existing.updatedAt = Date.now();
    db.commissionEntries[index] = existing;
    syncCommissionAccountingTransaction(existing, currentUser);
    saveDatabase(db);
    notifySubscribers('commission_updated', { entry: existing });

    return res.json({ success: true, entry: existing });
  });

  app.delete('/api/commissions/:id', authMiddleware, (req, res) => {
    const targetId = req.params.id;
    db.commissionEntries = (db.commissionEntries || []).filter((c) => c.id !== targetId);
    db.deletedRecordIds = db.deletedRecordIds || {};
    db.deletedRecordIds[targetId] = Date.now();
    const linkedTxId = `tx-comm-${targetId}`;
    const hadTx = (db.transactions || []).some((t) => t.id === linkedTxId);
    if (hadTx) {
      db.transactions = db.transactions.filter((t) => t.id !== linkedTxId);
      db.deletedRecordIds[linkedTxId] = Date.now();
      notifySubscribers('transaction_deleted', { transactionId: linkedTxId });
    }
    saveDatabase(db);
    notifySubscribers('commission_deleted', { id: targetId });
    return res.json({ success: true });
  });

  // AI-Powered Document / Photo Commission Statement Extractor
  app.post('/api/commissions/ai-extract', authMiddleware, async (req, res) => {
    try {
      const { fileBase64, mimeType = 'image/png' } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: 'fileBase64 data is required for AI document extraction' });
      }

      const aiClient = await getAiClient();
      if (!aiClient) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server' });
      }
      const { ai, Type } = aiClient;

      // Strip potential data URL scheme
      const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: `You are an AI document extraction expert for Zara Accounting.
Analyze this scanned invoice list, agent commission statement sheet, or PDF table photo.
Extract every invoice row found in the table.
Columns typically include:
- Date (e.g. 2026-10-01)
- Office (e.g. JUB5 - Jubail - Al Madrasa)
- Invoice no. (e.g. 8295503408, 8447871758)
- Invoice status (Active, Pending, Cancelled)
- Agent (e.g. FAYSAL)
- Client name
- Client mobile (e.g. 0531598048, 0510534085)
- Service (e.g. 6-month visa, Sponsorship transfer, Iqama renewal - 6m, Iqama renewal - 9m)
- Qty (number, e.g. 1)
- Rate per unit (number)
- Invoice total (number)
- Remaining (number)
- Eligible (boolean: true for "Yes", false for "No")
- Reason
- Commission amount (number)
- Payout status ("To pay", "Paid", "Not eligible", or "Carried over")

Also extract top-level metadata if present:
- agentName: string
- period: string
Return valid JSON matching the schema.`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              agentName: { type: Type.STRING },
              period: { type: Type.STRING },
              entries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    office: { type: Type.STRING },
                    invoiceNo: { type: Type.STRING },
                    invoiceStatus: { type: Type.STRING },
                    agent: { type: Type.STRING },
                    client: { type: Type.STRING },
                    clientMobile: { type: Type.STRING },
                    service: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    ratePerUnit: { type: Type.NUMBER },
                    invoiceTotal: { type: Type.NUMBER },
                    remainingAmount: { type: Type.NUMBER },
                    eligible: { type: Type.BOOLEAN },
                    reasonNotEligible: { type: Type.STRING },
                    commissionAmount: { type: Type.NUMBER },
                    isClawback: { type: Type.BOOLEAN },
                    clawbackAmount: { type: Type.NUMBER },
                    payoutStatus: { type: Type.STRING },
                  },
                  required: ['date', 'invoiceNo', 'service', 'commissionAmount'],
                },
              },
            },
            required: ['entries'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"entries":[]}');
      return res.json({ success: true, ...parsed });
    } catch (err: any) {
      console.error('Failed to extract commission statement with Gemini AI:', err);
      return res.status(500).json({ error: err.message || 'AI document extraction failed' });
    }
  });

  // Batch Import Commission Entries
  app.post('/api/commissions/batch', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided to import' });
    }

    const now = Date.now();
    const created: DbCommissionEntry[] = [];

    for (let i = 0; i < entries.length; i++) {
      const it = entries[i];
      if (!it.invoiceNo || !it.client) continue;

      const unitQty = Math.max(1, Number(it.qty) || 1);
      const unitRate = Math.max(0, Number(it.ratePerUnit) || 0);
      const calculatedCommission =
        it.commissionAmount !== undefined && it.commissionAmount !== null
          ? Math.max(0, Number(it.commissionAmount) || 0)
          : unitQty * unitRate;
      const isClawback = Boolean(it.isClawback);
      const resolvedPerson = resolveExplicitCommissionPerson(it.agent);
      const agentName = resolvedPerson.name;
      const dateStr = it.date || new Date().toISOString().slice(0, 10);

      ensureCommissionMonth(dateStr);

      const newEntry: DbCommissionEntry = {
        id: 'comm-imp-' + now + '-' + i + '-' + Math.floor(Math.random() * 1000),
        date: dateStr,
        office: it.office || 'JUB5 - Jubail - Al Madrasa',
        invoiceNo: String(it.invoiceNo).trim(),
        invoiceStatus: it.invoiceStatus || (it.eligible ? 'Active' : (isClawback ? 'Cancelled' : 'Pending')),
        agent: agentName,
        agentId: resolvedPerson.linkedUserId || currentUser.id,
        client: String(it.client).trim(),
        workerName: it.workerName?.trim() || undefined,
        clientMobile: it.clientMobile?.trim() || undefined,
        service: String(it.service || 'Service').trim(),
        qty: unitQty,
        ratePerUnit: unitRate,
        invoiceTotal: Number(it.invoiceTotal) || 0,
        remainingAmount: Number(it.remainingAmount) || 0,
        eligible: Boolean(it.eligible),
        reasonNotEligible: it.reasonNotEligible || (it.eligible ? undefined : 'Pending clearance'),
        commissionAmount: isClawback ? 0 : calculatedCommission,
        isClawback,
        clawbackAmount: isClawback ? -Math.abs(Number(it.clawbackAmount) || 0) : undefined,
        payoutStatus: it.payoutStatus || (it.eligible ? 'To pay' : (isClawback ? 'Carried over' : 'Not eligible')),
        period: it.period || dateStr.slice(0, 7),
        notes: it.notes || 'Imported record',
        createdAt: now + i,
        updatedAt: now + i,
      };

      db.commissionEntries.unshift(newEntry);
      syncCommissionAccountingTransaction(newEntry, currentUser);
      created.push(newEntry);
    }

    saveDatabase(db);
    notifySubscribers('commissions_batch_updated', { count: created.length, entries: created });
    notifySubscribers('commission_person_updated', { persons: db.commissionPersons });
    return res.status(201).json({ success: true, count: created.length, entries: created });
  });

  app.post('/api/commissions/payout', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { agent, entryIds } = req.body;

    let targetEntries: DbCommissionEntry[] = [];
    if (Array.isArray(entryIds) && entryIds.length > 0) {
      targetEntries = (db.commissionEntries || []).filter((c) => entryIds.includes(c.id));
    } else if (agent && agent !== 'all') {
      targetEntries = (db.commissionEntries || []).filter(
        (c) =>
          c.agent.toLowerCase() === String(agent).toLowerCase() &&
          c.eligible &&
          !c.isClawback &&
          c.payoutStatus === 'To pay'
      );
    } else {
      targetEntries = (db.commissionEntries || []).filter(
        (c) => c.eligible && !c.isClawback && c.payoutStatus === 'To pay'
      );
    }

    if (targetEntries.length === 0) {
      return res.status(400).json({ error: 'No eligible commission entries found for payout' });
    }

    const now = Date.now();
    targetEntries.forEach((entry) => {
      entry.payoutStatus = 'Paid';
      entry.paidAt = now;
      entry.updatedAt = now;
      syncCommissionAccountingTransaction(entry, currentUser);
    });

    saveDatabase(db);
    notifySubscribers('commissions_payout_processed', { count: targetEntries.length, paidAt: now });
    return res.json({ success: true, count: targetEntries.length, paidAt: now });
  });

  /* ------------------- DRAFTS (Debounced Real-time Cloud Save) ------------------- */
  app.get('/api/draft', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const draft = db.drafts[currentUser.id] || { description: '', amount: '', updatedAt: 0 };
    return res.json({ draft });
  });

  app.post('/api/draft', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { description, amount, category, type } = req.body;

    db.drafts[currentUser.id] = {
      description: description || '',
      amount: amount || '',
      category,
      type,
      updatedAt: Date.now(),
    };
    saveDatabase(db);
    return res.json({ success: true, updatedAt: db.drafts[currentUser.id].updatedAt });
  });

  /* ------------------- APP VERSION & AUTO-UPDATE PUSH ------------------- */
  app.get('/api/app-version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.json(getAppVersionInfo());
  });

  app.post('/api/app-version/push-update', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const requestedVersion = typeof req.body?.version === 'string' ? req.body.version.trim() : '';
    if (requestedVersion) {
      db.globalSettings.version = requestedVersion;
    }
    const now = Date.now();
    db.globalSettings.forceRefreshAt = now;
    db.globalSettings.updatedAt = now;
    db.globalSettings.lastUpdatedBy = (req as any).user.name;

    db.auditLogs.unshift({
      id: 'audit-' + now,
      timestamp: now,
      action: 'APP_UPDATE_PUSHED',
      performedBy: (req as any).user.name,
      details: { version: db.globalSettings.version, forceRefreshAt: now },
    });
    saveDatabase(db);

    const versionInfo = getAppVersionInfo();
    notifySubscribers('global_settings_updated', { globalSettings: db.globalSettings });
    notifySubscribers('app_update_available', versionInfo);
    return res.json({ success: true, globalSettings: db.globalSettings, versionInfo });
  });

  /* ------------------- GLOBAL SETTINGS & BROADCAST (Owner Control) ------------------- */
  app.get('/api/global-settings', (req, res) => {
    return res.json({ globalSettings: db.globalSettings });
  });

  app.put('/api/global-settings', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const {
      appName,
      companyName,
      version,
      currency,
      broadcastMessage,
      broadcastType,
      broadcastActive,
      defaultTheme,
      headerBgColor,
      sidebarBgColor,
      forceRefreshClients,
    } = req.body;

    if (appName !== undefined && String(appName).trim()) db.globalSettings.appName = String(appName).trim();
    if (companyName !== undefined && String(companyName).trim()) db.globalSettings.companyName = String(companyName).trim();
    if (version !== undefined && String(version).trim()) db.globalSettings.version = String(version).trim();
    if (currency !== undefined) db.globalSettings.currency = currency;
    if (broadcastMessage !== undefined) db.globalSettings.broadcastMessage = broadcastMessage;
    if (broadcastType !== undefined) db.globalSettings.broadcastType = broadcastType;
    if (broadcastActive !== undefined) db.globalSettings.broadcastActive = broadcastActive;
    if (defaultTheme !== undefined) db.globalSettings.defaultTheme = defaultTheme;
    if (headerBgColor !== undefined) db.globalSettings.headerBgColor = headerBgColor || undefined;
    if (sidebarBgColor !== undefined) db.globalSettings.sidebarBgColor = sidebarBgColor || undefined;

    const now = Date.now();
    if (forceRefreshClients) {
      db.globalSettings.forceRefreshAt = now;
    }
    db.globalSettings.updatedAt = now;
    db.globalSettings.lastUpdatedBy = (req as any).user.name;

    db.auditLogs.unshift({
      id: 'audit-' + now,
      timestamp: now,
      action: 'GLOBAL_SETTINGS_UPDATED',
      performedBy: (req as any).user.name,
      details: req.body,
    });
    saveDatabase(db);

    notifySubscribers('global_settings_updated', { globalSettings: db.globalSettings });
    if (forceRefreshClients) {
      notifySubscribers('app_update_available', getAppVersionInfo());
    }
    return res.json({ globalSettings: db.globalSettings });
  });

  /* ------------------- CLOUD DATABASE BACKUP & RESTORE ------------------- */
  app.get('/api/backup/status', authMiddleware, (_req, res) => {
    let rollingCount = 0;
    try {
      rollingCount = fs
        .readdirSync(DB_BACKUPS_DIR)
        .filter((f) => f.startsWith('zara_db_') && f.endsWith('.json')).length;
    } catch {}
    return res.json({
      success: true,
      lastSavedAt: lastServerSaveAt,
      lastRollingBackupAt: lastRollingBackupAt || lastServerSaveAt,
      rollingSnapshotsCount: rollingCount,
    });
  });

  app.get('/api/backup', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: db.globalSettings.version,
      stats: {
        totalUsers: db.users.length,
        totalTransactions: db.transactions.length,
        totalCustomers: db.customers.length,
      },
      database: db,
    };
    return res.json(backupData);
  });

  app.post('/api/backup/restore', authMiddleware, ownerOnlyMiddleware, (req, res) => {
    const { database } = req.body;
    if (!database || !Array.isArray(database.users) || !Array.isArray(database.transactions)) {
      return res.status(400).json({ error: 'Invalid backup structure' });
    }

    db = database;
    db.commissionEntries = (db.commissionEntries || []).filter(
      (c) => !isAutoSyncedCustomerInvoiceCommission(c)
    );
    if (!db.sessions || typeof db.sessions !== 'object') db.sessions = {};
    SESSIONS.clear();
    for (const [tok, uid] of Object.entries(db.sessions)) {
      const matched = db.users.find((u) => u.id === uid);
      if (matched) SESSIONS.set(tok, matched);
    }
    saveDatabase(db);

    db.auditLogs.unshift({
      id: 'audit-' + Date.now(),
      timestamp: Date.now(),
      action: 'DATABASE_RESTORED',
      performedBy: (req as any).user.name,
      details: { timestamp: new Date().toISOString() },
    });
    saveDatabase(db);

    notifySubscribers('database_restored', { timestamp: Date.now() });
    return res.json({ success: true, message: 'Database successfully restored from backup' });
  });

  // Non-destructive persistent delta recovery: always restores missing/newer records & photos after container updates
  app.post('/api/sync/recover-if-empty', authMiddleware, (req, res) => {
    const currentUser = (req as any).user as DbUser;
    const { userPhotoData, userPhotos, snapshot } = req.body || {};
    let changed = false;

    const restorePhotoOnRecord = (rec: any, photoData: string): boolean => {
      if (!rec || typeof photoData !== 'string' || !photoData.startsWith('data:image/')) return false;
      const m = photoData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!m) return false;
      const diskFile = rec.photoUrl?.startsWith('/api/photos/')
        ? path.join(PHOTOS_DIR, rec.photoUrl.replace('/api/photos/', ''))
        : null;
      const missingOnDisk = !diskFile || !fs.existsSync(diskFile);
      if (!rec.photoData || missingOnDisk) {
        let ext = m[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const filename = `${rec.id}_recovered_${Date.now()}.${ext}`;
        try {
          fs.writeFileSync(path.join(PHOTOS_DIR, filename), Buffer.from(m[2], 'base64'));
          rec.photoUrl = `/api/photos/${filename}`;
          rec.photoData = photoData;
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    // 1. Restore user photos (current user + any cached userPhotos map from owner's browser vault)
    const userPhotoMap: Record<string, string> = {};
    if (userPhotos && typeof userPhotos === 'object') {
      Object.entries(userPhotos).forEach(([uid, pData]) => {
        if (typeof pData === 'string' && pData.startsWith('data:image/')) {
          userPhotoMap[uid] = pData;
        }
      });
    }
    if (typeof userPhotoData === 'string' && userPhotoData.startsWith('data:image/')) {
      userPhotoMap[currentUser.id] = userPhotoData;
    }

    Object.entries(userPhotoMap).forEach(([uid, pData]) => {
      const userObj = db.users.find((u) => u.id === uid);
      if (userObj && restorePhotoOnRecord(userObj, pData)) {
        for (const [tok, su] of SESSIONS.entries()) {
          if (su.id === userObj.id) SESSIONS.set(tok, userObj);
        }
        changed = true;
      }
    });

    // 2. Non-destructively merge missing or newer records & photos from browser vault snapshot
    if (snapshot && typeof snapshot === 'object') {
      db.deletedRecordIds = db.deletedRecordIds || {};
      const incomingDeleted = snapshot.deletedRecordIds && typeof snapshot.deletedRecordIds === 'object'
        ? snapshot.deletedRecordIds
        : {};
      Object.entries(incomingDeleted).forEach(([recId, delTs]) => {
        const tsNum = Number(delTs) || 0;
        if (tsNum > (db.deletedRecordIds![recId] || 0)) {
          db.deletedRecordIds![recId] = tsNum;
        }
      });

      const isTombstoned = (item: any): boolean => {
        if (!item?.id) return true;
        const delTs = db.deletedRecordIds?.[item.id] || 0;
        if (!delTs) return false;
        const itemTs = Number(item.updatedAt) || Number(item.createdAt) || 0;
        return itemTs <= delTs;
      };

      const mergeCollection = <T extends { id: string; updatedAt?: number; createdAt?: number }>(
        target: T[],
        incoming: any[],
        options?: { onMatch?: (existing: T, inc: any) => boolean; matchBy?: (existing: T, inc: any) => boolean }
      ) => {
        if (!Array.isArray(incoming)) return;
        incoming.forEach((item) => {
          if (!item || !item.id || isTombstoned(item)) return;
          const existingIdx = target.findIndex((it) =>
            it.id === item.id || (options?.matchBy ? options.matchBy(it, item) : false)
          );
          if (existingIdx === -1) {
            target.push(item);
            if ((item as any).photoData) {
              restorePhotoOnRecord(item, (item as any).photoData);
            }
            changed = true;
          } else {
            const existing = target[existingIdx] as any;
            const incUpdated = Number(item.updatedAt) || Number(item.createdAt) || 0;
            const extUpdated = Number(existing.updatedAt) || Number(existing.createdAt) || 0;
            if (incUpdated > extUpdated) {
              const preservedPhotoData = item.photoData || existing.photoData;
              const preservedPhotoUrl = item.photoUrl || existing.photoUrl;
              target[existingIdx] = {
                ...existing,
                ...item,
                id: existing.id,
                photoData: preservedPhotoData,
                photoUrl: preservedPhotoUrl,
              };
              if (preservedPhotoData) {
                restorePhotoOnRecord(target[existingIdx], preservedPhotoData);
              }
              changed = true;
            } else if (
              item.photoData &&
              (incUpdated >= extUpdated || Boolean(existing.photoUrl)) &&
              restorePhotoOnRecord(existing, item.photoData)
            ) {
              changed = true;
            }
            if (options?.onMatch && options.onMatch(target[existingIdx], item)) {
              changed = true;
            }
          }
        });
      };

      mergeCollection(db.transactions, snapshot.transactions);
      mergeCollection(db.customers, snapshot.customers);
      mergeCollection(db.invoices, snapshot.invoices);
      const explicitSnapshotCommissions = Array.isArray(snapshot.commissionEntries)
        ? snapshot.commissionEntries.filter((c: any) => !isAutoSyncedCustomerInvoiceCommission(c))
        : [];
      mergeCollection(db.commissionEntries, explicitSnapshotCommissions);
      db.commissionEntries = (db.commissionEntries || []).filter((c) => !isAutoSyncedCustomerInvoiceCommission(c));

      const existingPersons = db.commissionPersons || [];
      db.commissionPersons = existingPersons;
      const incomingPersons = Array.isArray(snapshot.commissionPersons)
        ? snapshot.commissionPersons.filter((p: any) => {
            if (!p?.name) return false;
            const low = String(p.name).trim().toLowerCase();
            if (low === 'faysal' && existingPersons.some((ep) => ep.name.trim().toLowerCase() === 'rh faysal')) {
              return false;
            }
            return true;
          })
        : [];
      mergeCollection(existingPersons, incomingPersons, {
        matchBy: (ext, inc) =>
          Boolean(ext.name && inc.name && ext.name.trim().toLowerCase() === inc.name.trim().toLowerCase()),
      });

      mergeCollection(db.homeBazarEntries, snapshot.homeBazarEntries);

      // Non-destructively restore missing or newer user accounts (preserving Owner & respecting delete tombstones)
      let usersChanged = false;
      if (Array.isArray(snapshot.users)) {
        snapshot.users.forEach((incUser: any) => {
          if (!incUser || !incUser.id || !incUser.username) return;
          const delTs = db.deletedRecordIds?.[incUser.id] || 0;
          const incTs = Number(incUser.updatedAt) || Number(incUser.createdAt) || 0;
          if (delTs && incTs <= delTs) return;

          const existingIdx = db.users.findIndex(
            (u) => u.id === incUser.id || u.username.toLowerCase() === String(incUser.username).trim().toLowerCase()
          );

          const candidatePhotoData = incUser.photoData || userPhotoMap[incUser.id];
          if (existingIdx === -1) {
            if (!incUser.passwordHash) return; // Cannot create loginable user without passwordHash
            const restoredUser: DbUser = {
              ...incUser,
              username: String(incUser.username).trim().toLowerCase(),
              status: incUser.status === 'disabled' ? 'disabled' : 'active',
              role: incUser.role === 'owner' ? 'staff' : (incUser.role || 'staff'),
              createdAt: Number(incUser.createdAt) || Date.now(),
              updatedAt: Number(incUser.updatedAt) || Number(incUser.createdAt) || Date.now(),
            };
            if (candidatePhotoData) {
              restorePhotoOnRecord(restoredUser, candidatePhotoData);
            }
            db.users.push(restoredUser);
            usersChanged = true;
            changed = true;
          } else {
            const existing = db.users[existingIdx];
            const extTs = Number(existing.updatedAt) || Number(existing.createdAt) || 0;
            if (incTs > extTs) {
              const safeRole = existing.role === 'owner' ? 'owner' : (incUser.role === 'owner' ? existing.role : (incUser.role || existing.role));
              const safeStatus = existing.role === 'owner' ? 'active' : (incUser.status || existing.status);
              const mergedUser: DbUser = {
                ...existing,
                ...incUser,
                id: existing.id,
                username: existing.username,
                role: safeRole,
                status: safeStatus,
                passwordHash: incUser.passwordHash || existing.passwordHash,
                photoData: candidatePhotoData || existing.photoData,
                photoUrl: incUser.photoUrl || existing.photoUrl,
                updatedAt: incTs,
              };
              if (mergedUser.photoData) {
                restorePhotoOnRecord(mergedUser, mergedUser.photoData);
              }
              db.users[existingIdx] = mergedUser;
              for (const [tok, su] of SESSIONS.entries()) {
                if (su.id === mergedUser.id) SESSIONS.set(tok, mergedUser);
              }
              usersChanged = true;
              changed = true;
            }
          }
        });
      }

      // Non-destructively restore globalSettings & bazarBuyers (currency, broadcast, monthly budget, buyer IDs + photos)
      let settingsChanged = false;
      if (snapshot.globalSettings && typeof snapshot.globalSettings === 'object') {
        const incSettings = snapshot.globalSettings;
        const incSetTs = Number(incSettings.updatedAt) || 0;
        const extSetTs = Number(db.globalSettings.updatedAt) || 0;

        if (incSetTs > extSetTs) {
          db.globalSettings = {
            ...db.globalSettings,
            appName: incSettings.appName || db.globalSettings.appName,
            companyName: incSettings.companyName || db.globalSettings.companyName,
            currency: incSettings.currency || db.globalSettings.currency,
            broadcastMessage: incSettings.broadcastMessage ?? db.globalSettings.broadcastMessage,
            broadcastType: incSettings.broadcastType || db.globalSettings.broadcastType,
            broadcastActive: incSettings.broadcastActive ?? db.globalSettings.broadcastActive,
            defaultTheme: incSettings.defaultTheme || db.globalSettings.defaultTheme,
            headerBgColor: incSettings.headerBgColor ?? db.globalSettings.headerBgColor,
            sidebarBgColor: incSettings.sidebarBgColor ?? db.globalSettings.sidebarBgColor,
            bazarMonthlyBudget:
              typeof incSettings.bazarMonthlyBudget === 'number'
                ? incSettings.bazarMonthlyBudget
                : db.globalSettings.bazarMonthlyBudget,
            updatedAt: incSetTs,
          };
          settingsChanged = true;
          changed = true;
        }

        if (Array.isArray(incSettings.bazarBuyers)) {
          db.globalSettings.bazarBuyers = db.globalSettings.bazarBuyers || [];
          incSettings.bazarBuyers.forEach((incBuyer: any) => {
            if (!incBuyer || !incBuyer.buyerId) return;
            const normBuyerId = String(incBuyer.buyerId).trim().toLowerCase();
            const delTs = db.deletedRecordIds?.[`buyer:${normBuyerId}`] || 0;
            const incTs = Number(incBuyer.updatedAt) || incSetTs || 0;
            if (delTs && incTs <= delTs) return;

            const extIdx = db.globalSettings.bazarBuyers!.findIndex(
              (b) => b.buyerId.toLowerCase() === normBuyerId
            );
            if (extIdx === -1) {
              const buyerCopy: DbBazarBuyer = { ...incBuyer };
              if (buyerCopy.photoData) {
                const tempRec: any = { ...buyerCopy, id: `buyer_${normBuyerId}` };
                if (restorePhotoOnRecord(tempRec, buyerCopy.photoData)) {
                  buyerCopy.photoUrl = tempRec.photoUrl;
                }
              }
              db.globalSettings.bazarBuyers!.push(buyerCopy);
              settingsChanged = true;
              changed = true;
            } else {
              const extBuyer = db.globalSettings.bazarBuyers![extIdx];
              const extTs = Number(extBuyer.updatedAt) || 0;
              if (incTs > extTs) {
                const updatedBuyer: DbBazarBuyer = {
                  ...extBuyer,
                  ...incBuyer,
                  photoData: incBuyer.photoData || extBuyer.photoData,
                  photoUrl: incBuyer.photoUrl || extBuyer.photoUrl,
                };
                if (updatedBuyer.photoData) {
                  const tempRec: any = { ...updatedBuyer, id: `buyer_${normBuyerId}` };
                  if (restorePhotoOnRecord(tempRec, updatedBuyer.photoData)) {
                    updatedBuyer.photoUrl = tempRec.photoUrl;
                  }
                }
                db.globalSettings.bazarBuyers![extIdx] = updatedBuyer;
                settingsChanged = true;
                changed = true;
              }
            }
          });
        }
      }

      const monthSet = new Set<string>([...(db.commissionMonths || [])]);
      if (Array.isArray(snapshot.commissionMonths)) {
        snapshot.commissionMonths.forEach((m: any) => {
          if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) {
            if (!monthSet.has(m)) changed = true;
            monthSet.add(m);
          }
        });
      }
      (db.commissionEntries || []).forEach((e) => {
        const ym = typeof e?.date === 'string' && /^\d{4}-\d{2}/.test(e.date) ? e.date.slice(0, 7) : e.period;
        if (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym)) {
          if (!monthSet.has(ym)) changed = true;
          monthSet.add(ym);
        }
      });
      db.commissionMonths = Array.from(monthSet).sort();

      if (usersChanged) {
        notifySubscribers('user_updated', { type: 'recovered' });
      }
      if (settingsChanged) {
        notifySubscribers('global_settings_updated', { globalSettings: db.globalSettings });
        notifySubscribers('bazar_buyers_updated', { buyers: buildMergedBuyersList() });
      }
    }

    if (changed) {
      saveDatabase(db);
      notifySubscribers('database_restored', { timestamp: Date.now() });
    }

    const updatedUser = db.users.find((u) => u.id === currentUser.id);
    const safeUser = updatedUser ? { ...updatedUser } : undefined;
    if (safeUser) delete (safeUser as any).passwordHash;
    return res.json({ success: true, recovered: changed, user: safeUser });
  });

  /* ------------------- REAL-TIME SSE ------------------- */
  app.get('/api/sync/events', (req, res) => {
    const token = req.query.token as string;
    let user = token ? SESSIONS.get(token) : undefined;
    if (!user && token && db.sessions && db.sessions[token]) {
      const uid = db.sessions[token];
      user = db.users.find((u) => u.id === uid);
      if (user) SESSIONS.set(token, user);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const clientId = crypto.randomUUID();
    const newClient = { id: clientId, res, userId: user ? user.id : 'anonymous' };
    clients.push(newClient);

    const versionInfo = getAppVersionInfo();
    let clientSeenBuildId = versionInfo.buildId;
    let clientSeenForceAt = versionInfo.forceRefreshAt;

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        clientId,
        time: Date.now(),
        ...versionInfo,
      })}\n\n`
    );

    const heartbeatTimer = setInterval(() => {
      try {
        const latestInfo = getAppVersionInfo();
        if (
          latestInfo.buildId !== clientSeenBuildId ||
          latestInfo.forceRefreshAt > clientSeenForceAt
        ) {
          clientSeenBuildId = latestInfo.buildId;
          clientSeenForceAt = latestInfo.forceRefreshAt;
          res.write(`event: app_update_available\ndata: ${JSON.stringify(latestInfo)}\n\n`);
        } else {
          res.write(`: keepalive ${Date.now()}\n\n`);
        }
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 12000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx !== -1) clients.splice(idx, 1);
    });
  });

  /* ------------------- VITE MIDDLEWARE ------------------- */
  const isProduction = isProductionEnv;
  let viteServer: any = null;
  if (!isProduction) {
    let viteMiddleware: express.RequestHandler | null = null;
    const viteReady = import('vite')
      .then(({ createServer }) =>
        createServer({
          server: {
            middlewareMode: true,
            hmr: false,
            ws: false,
            watch: null,
          },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteServer = vite;
        viteMiddleware = vite.middlewares;
        return vite;
      });
    // Prevent unhandled rejection if Vite fails before a request arrives
    viteReady.catch((err) => {
      console.error('Vite middleware initialization failed:', err);
    });

    app.get('/manifest.webmanifest', (_req, res) => {
      const distManifestPath = path.join(__dirname, 'dist', 'manifest.webmanifest');
      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      if (fs.existsSync(distManifestPath)) {
        return res.sendFile(distManifestPath);
      }
      return res.json({
        id: '/',
        name: 'ZARA Accounting - Cloud Ledger',
        short_name: 'ZARA Acc',
        description:
          'Enterprise cloud daily accounting ledger with real-time sync, daily invoices, and CRM.',
        theme_color: '#101A2C',
        background_color: '#101A2C',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        categories: ['business', 'finance'],
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      });
    });

    app.use(async (req, res, next) => {
      try {
        if (req.path === '/' || req.path.endsWith('.html') || req.path === '/sw.js' || req.path === '/registerSW.js') {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
        if (!viteMiddleware) {
          await viteReady;
        }
        return viteMiddleware!(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  } else {
    app.use(
      express.static(path.join(__dirname, 'dist'), {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (
            base === 'index.html' ||
            base === 'sw.js' ||
            base === 'registerSW.js' ||
            base === 'manifest.webmanifest'
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  let listenRetries = 0;
  const maxListenRetries = 4;
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`  VITE v8.3.0  ready in 120 ms\n\n  ➜  Local:   http://localhost:${PORT}/\n  ➜  Network: http://0.0.0.0:${PORT}/`);
    console.log(`ZARA Accounting Server running at http://0.0.0.0:${PORT}`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && listenRetries < maxListenRetries) {
      listenRetries += 1;
      console.warn(`Port ${PORT} busy during restart, retrying (${listenRetries}/${maxListenRetries})...`);
      setTimeout(() => {
        httpServer.close();
        httpServer.listen(PORT, '0.0.0.0');
      }, 400);
      return;
    }
    console.error('Server listen error:', err);
    process.exit(1);
  });

  const gracefulShutdown = async () => {
    for (const c of clients) {
      try {
        c.res.end();
      } catch {}
    }
    clients.length = 0;
    try {
      if (viteServer && typeof viteServer.close === 'function') {
        await viteServer.close();
      }
    } catch {}
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500).unref();
  };

  process.once('SIGTERM', gracefulShutdown);
  process.once('SIGINT', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Failed to start ZARA server:', err);
  process.exit(1);
});
