import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApp, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_ADMIN_EMAIL = 'rh.faysal007@gmail.com';
const FIREBASE_CONFIG_PATH = path.join(__dirname, 'firebase-applet-config.json');

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

export type AdminSyncState =
  | 'unconfigured'
  | 'ready'
  | 'needs_owner_uid'
  | 'permission_denied'
  | 'error';

export interface AdminFirestoreStatus {
  configured: boolean;
  projectId: string;
  databaseId: string;
  status: AdminSyncState;
  hasOwnerUid: boolean;
  lastSyncedAt: number | null;
  lastPushedAt: number | null;
  lastPulledAt: number | null;
  lastError: string | null;
  syncing: boolean;
}

let cachedConfig: FirebaseAppletConfig | null = null;
let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

let cachedOwnerUid: string | null = null;
let syncState: AdminSyncState = 'unconfigured';
let lastSyncedAt: number | null = null;
let lastPushedAt: number | null = null;
let lastPulledAt: number | null = null;
let lastError: string | null = null;
let syncing = false;
let debouncedTimer: ReturnType<typeof setTimeout> | null = null;
let syncQueue: Promise<unknown> = Promise.resolve();

const createdAtCache = new Map<string, Timestamp>();
const syncedSignatureCache = new Map<string, string>();
const cloudDocIdsByCollection = new Map<string, Set<string>>();

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  if (cachedConfig) return cachedConfig;
  try {
    if (!fs.existsSync(FIREBASE_CONFIG_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf-8'));
    if (!raw?.projectId || raw.projectId === 'remixed-project-id') return null;
    cachedConfig = {
      projectId: String(raw.projectId),
      firestoreDatabaseId:
        typeof raw.firestoreDatabaseId === 'string' &&
        raw.firestoreDatabaseId !== 'remixed-firestore-database-id'
          ? raw.firestoreDatabaseId
          : undefined,
    };
    return cachedConfig;
  } catch {
    return null;
  }
}

export function initFirebaseAdmin(): { app: App; db: Firestore; auth: Auth; config: FirebaseAppletConfig } | null {
  const cfg = loadFirebaseConfig();
  if (!cfg) {
    syncState = 'unconfigured';
    return null;
  }
  if (!adminApp) {
    adminApp = getApps().length
      ? getApp()
      : initializeApp({
          projectId: cfg.projectId,
        });
    adminDb =
      cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== '(default)'
        ? getFirestore(adminApp, cfg.firestoreDatabaseId)
        : getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    if (syncState === 'unconfigured') {
      syncState = cachedOwnerUid ? 'ready' : 'needs_owner_uid';
    }
  }
  return {
    app: adminApp!,
    db: adminDb!,
    auth: adminAuth!,
    config: cfg,
  };
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = (err as any)?.code;
  const msg = String((err as any)?.message || err || '').toUpperCase();
  return code === 7 || msg.includes('PERMISSION_DENIED') || msg.includes('INSUFFICIENT');
}

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = syncQueue.then(task, task);
  syncQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function toSafeDocId(prefix: string, rawKey: string): string {
  const clean = String(rawKey || '').trim();
  if (/^[a-zA-Z0-9_\-]+$/.test(prefix + clean) && (prefix + clean).length <= 128) {
    return prefix + clean;
  }
  let hex = '';
  for (let i = 0; i < clean.length; i++) {
    hex += clean.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return (prefix + hex).slice(0, 128);
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.slice(0, maxLen);
}

function clampNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePulledInvoice(raw: any): any {
  const totalAmount = clampNum(raw?.totalAmount, 0);
  const paidAmount = clampNum(raw?.paidAmount, 0);
  const balanceDue =
    typeof raw?.balanceDue === 'number' && Number.isFinite(raw.balanceDue)
      ? raw.balanceDue
      : totalAmount - paidAmount;
  const remainingAmount = Math.max(0, balanceDue);
  const discount =
    typeof raw?.discount === 'number' && Number.isFinite(raw.discount)
      ? raw.discount
      : clampNum(raw?.discountAmount, 0);
  const taxRate = clampNum(raw?.taxRate, 0);
  const derivedStatus =
    balanceDue < 0
      ? 'overpaid'
      : balanceDue === 0 && totalAmount > 0
        ? 'paid'
        : paidAmount > 0
          ? 'partial'
          : 'unpaid';
  const status = ['unpaid', 'partial', 'paid', 'overpaid'].includes(raw?.status)
    ? raw.status
    : raw?.status === 'Cancelled'
      ? 'Cancelled'
      : derivedStatus;
  return {
    ...raw,
    totalAmount,
    paidAmount,
    balanceDue,
    remainingAmount,
    discount,
    taxRate,
    status,
    payments: Array.isArray(raw?.payments) ? raw.payments : [],
  };
}

function isAutoSyncedZeroCommission(ce: any): boolean {
  const ceId = String(ce?.id || '');
  const ceNotes = String(ce?.notes || '');
  return (
    (ceId.startsWith('comm-inv-') || ceNotes === 'Auto-synced from Daily Invoices') &&
    (Number(ce?.commissionAmount) || 0) === 0 &&
    (Number(ce?.ratePerUnit) || 0) === 0 &&
    !ce?.isClawback &&
    ce?.invoiceStatus !== 'Cancelled'
  );
}

export async function verifyFirebaseOwnerIdToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  const ctx = initFirebaseAdmin();
  if (!ctx || !idToken || typeof idToken !== 'string') return null;
  try {
    const decoded = await ctx.auth.verifyIdToken(idToken);
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!decoded.uid || !decoded.email_verified || email !== OWNER_ADMIN_EMAIL) {
      return null;
    }
    cachedOwnerUid = decoded.uid;
    if (syncState === 'needs_owner_uid') syncState = 'ready';
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

export function setKnownOwnerUid(uid?: string | null) {
  if (uid && /^[a-zA-Z0-9_\-]+$/.test(uid)) {
    cachedOwnerUid = uid;
    if (syncState === 'needs_owner_uid') {
      syncState = 'ready';
    }
  }
}

async function resolveOwnerUid(database: any, ownerUidOverride?: string): Promise<string | null> {
  if (ownerUidOverride && /^[a-zA-Z0-9_\-]+$/.test(ownerUidOverride)) {
    cachedOwnerUid = ownerUidOverride;
    return ownerUidOverride;
  }
  if (database?.ownerFirebaseUid && typeof database.ownerFirebaseUid === 'string') {
    cachedOwnerUid = database.ownerFirebaseUid;
    return cachedOwnerUid;
  }
  if (cachedOwnerUid) return cachedOwnerUid;

  const ctx = initFirebaseAdmin();
  if (!ctx) return null;

  try {
    const adminSnap = await ctx.db
      .collection('admins')
      .where('email', '==', OWNER_ADMIN_EMAIL)
      .limit(1)
      .get();
    if (!adminSnap.empty) {
      cachedOwnerUid = adminSnap.docs[0].id;
      return cachedOwnerUid;
    }
    const settingsSnap = await ctx.db.collection('appSettings').doc('global').get();
    const sOwnerUid = settingsSnap.exists ? settingsSnap.data()?.ownerUid : null;
    if (typeof sOwnerUid === 'string' && sOwnerUid.length > 0) {
      cachedOwnerUid = sOwnerUid;
      return cachedOwnerUid;
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      syncState = 'permission_denied';
      lastError = 'Firestore Admin permission pending for runtime service account';
    } else {
      syncState = 'error';
      lastError = err instanceof Error ? err.message : 'Unable to query Firestore admins';
    }
    throw err;
  }
  return null;
}

async function ensureAdminDoc(ctx: { db: Firestore }, uid: string): Promise<void> {
  const ref = ctx.db.collection('admins').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid,
      email: OWNER_ADMIN_EMAIL,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

async function upsertDoc(
  ctx: { db: Firestore },
  colName: string,
  docId: string,
  payloadWithoutTimestamps: Record<string, any>
): Promise<boolean> {
  const key = `${colName}/${docId}`;
  const signature = JSON.stringify(payloadWithoutTimestamps);
  if (syncedSignatureCache.get(key) === signature) {
    return false;
  }

  const ref = ctx.db.collection(colName).doc(docId);
  let existingCreatedAt = createdAtCache.get(key);

  if (!existingCreatedAt) {
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.createdAt instanceof Timestamp) {
        existingCreatedAt = data.createdAt;
        createdAtCache.set(key, existingCreatedAt);
      }
    }
  }

  if (existingCreatedAt) {
    await ref.set({
      ...payloadWithoutTimestamps,
      createdAt: existingCreatedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      ...payloadWithoutTimestamps,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const createdSnap = await ref.get().catch(() => null);
    const ts = createdSnap?.data()?.createdAt;
    if (ts instanceof Timestamp) {
      createdAtCache.set(key, ts);
    }
  }

  syncedSignatureCache.set(key, signature);
  const colSet = cloudDocIdsByCollection.get(colName);
  if (colSet) colSet.add(docId);
  return true;
}

async function removeDoc(ctx: { db: Firestore }, colName: string, docId: string): Promise<void> {
  const colSet = cloudDocIdsByCollection.get(colName);
  if (colSet && !colSet.has(docId)) return;
  const key = `${colName}/${docId}`;
  try {
    await ctx.db.collection(colName).doc(docId).delete();
    createdAtCache.delete(key);
    syncedSignatureCache.delete(key);
    if (colSet) colSet.delete(docId);
  } catch (err) {
    if (isPermissionDeniedError(err)) throw err;
  }
}

async function listOwnerCollection(ctx: { db: Firestore }, colName: string, ownerUid: string): Promise<any[]> {
  const snap = await ctx.db.collection(colName).where('ownerUid', '==', ownerUid).get();
  const rows: any[] = [];
  const docIds = new Set<string>();
  snap.forEach((d) => {
    const data = d.data();
    const key = `${colName}/${d.id}`;
    docIds.add(d.id);
    if (data?.createdAt instanceof Timestamp) {
      createdAtCache.set(key, data.createdAt);
    }
    rows.push({ _docId: d.id, ...data });
  });
  cloudDocIdsByCollection.set(colName, docIds);
  return rows;
}

function stripInternalDocFields(row: any): any {
  const copy = { ...row };
  const cCreated = typeof copy.clientCreatedAt === 'number' ? copy.clientCreatedAt : undefined;
  const cUpdated = typeof copy.clientUpdatedAt === 'number' ? copy.clientUpdatedAt : undefined;
  delete copy._docId;
  delete copy.ownerUid;
  delete copy.createdAt;
  delete copy.updatedAt;
  delete copy.clientCreatedAt;
  delete copy.clientUpdatedAt;
  if (cCreated !== undefined) copy.createdAt = cCreated;
  if (cUpdated !== undefined) copy.updatedAt = cUpdated;
  return copy;
}

export async function pushToFirestoreAdmin(
  database: any,
  ownerUidOverride?: string
): Promise<{ pushed: boolean; writes: number; status: AdminSyncState }> {
  return runSerialized(async () => {
    const ctx = initFirebaseAdmin();
    if (!ctx || !database) {
      return { pushed: false, writes: 0, status: syncState };
    }

    syncing = true;
    try {
      const uid = await resolveOwnerUid(database, ownerUidOverride);
      if (!uid) {
        syncState = 'needs_owner_uid';
        return { pushed: false, writes: 0, status: syncState };
      }

      if (database.ownerFirebaseUid !== uid) {
        database.ownerFirebaseUid = uid;
      }

      await ensureAdminDoc(ctx, uid);
      let writes = 0;

      // 1. Deleted Tombstones
      const deletedMap: Record<string, number> = database.deletedRecordIds || {};
      for (const [recId, ts] of Object.entries(deletedMap)) {
        if (!recId) continue;
        const safeDelId = toSafeDocId('del_', recId);
        if (
          await upsertDoc(ctx, 'deletedRecords', safeDelId, {
            ownerUid: uid,
            recordId: clampStr(recId, 128),
            deletedAtMs: clampNum(ts, Date.now()),
          })
        ) {
          writes++;
        }
      }

      // 2. Global Settings & Bazar Buyers
      const gs = database.globalSettings;
      if (gs && typeof gs === 'object') {
        const settingsDoc: Record<string, any> = {
          ownerUid: uid,
          appName: clampStr(gs.appName || 'ZF Accounting', 120),
          companyName: clampStr(gs.companyName || 'ZARA Enterprises Ltd.', 160),
          version: clampStr(gs.version || '2.5.0-cloud', 40),
          currency: ['BDT', 'USD', 'EUR', 'SAR'].includes(gs.currency) ? gs.currency : 'SAR',
          broadcastMessage: clampStr(gs.broadcastMessage || '', 1000),
          broadcastType: ['info', 'warning', 'alert', 'success'].includes(gs.broadcastType)
            ? gs.broadcastType
            : 'info',
          broadcastActive: Boolean(gs.broadcastActive),
          lastUpdatedBy: clampStr(gs.lastUpdatedBy || 'System', 120),
          clientUpdatedAt: clampNum(gs.updatedAt, Date.now()),
        };
        if (gs.defaultTheme) settingsDoc.defaultTheme = clampStr(gs.defaultTheme, 40);
        if (gs.headerBgColor) settingsDoc.headerBgColor = clampStr(gs.headerBgColor, 40);
        if (gs.sidebarBgColor) settingsDoc.sidebarBgColor = clampStr(gs.sidebarBgColor, 40);
        if (typeof gs.bazarMonthlyBudget === 'number') {
          settingsDoc.bazarMonthlyBudget = clampNum(gs.bazarMonthlyBudget, 0);
        }
        if (typeof gs.forceRefreshAt === 'number') {
          settingsDoc.forceRefreshAt = clampNum(gs.forceRefreshAt, 0);
        }
        settingsDoc.dataUpdatedAt = clampNum(gs.dataUpdatedAt || gs.updatedAt, Date.now());
        if (await upsertDoc(ctx, 'appSettings', 'global', settingsDoc)) {
          writes++;
        }

        const delegateEmails = (database.users || [])
          .filter((u: any) => u && u.status !== 'disabled' && u.email && (u.role === 'owner' || u.canManageBazarBuyers === true || u.canManageBazar !== false))
          .map((u: any) => String(u.email).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 50);

        const buyers = Array.isArray(gs.bazarBuyers) ? gs.bazarBuyers : [];
        const activeBuyerIds = new Set<string>();
        for (const b of buyers) {
          if (!b?.buyerId) continue;
          const docId = toSafeDocId('buyer_', b.buyerId);
          activeBuyerIds.add(docId);
          const buyerDoc: Record<string, any> = {
            ownerUid: uid,
            buyerId: clampStr(b.buyerId, 80),
            name: clampStr(b.name || b.buyerId, 120),
            clientUpdatedAt: clampNum(b.updatedAt || gs.updatedAt, Date.now()),
          };
          if (b.phone) buyerDoc.phone = clampStr(b.phone, 40);
          if (b.role) buyerDoc.role = clampStr(b.role, 40);
          if (typeof b.amount === 'number' && Number.isFinite(b.amount)) buyerDoc.amount = b.amount;
          if (b.notes) buyerDoc.notes = clampStr(b.notes, 1000);
          if (b.photoUrl) buyerDoc.photoUrl = clampStr(b.photoUrl, 512);
          if (delegateEmails.length > 0) buyerDoc.delegateEmails = delegateEmails;
          if (await upsertDoc(ctx, 'bazarBuyers', docId, buyerDoc)) {
            writes++;
          }
        }
        for (const [recId] of Object.entries(deletedMap)) {
          if (recId.startsWith('buyer:')) {
            const rawBuyerId = recId.slice('buyer:'.length);
            const docId = toSafeDocId('buyer_', rawBuyerId);
            if (!activeBuyerIds.has(docId)) {
              await removeDoc(ctx, 'bazarBuyers', docId);
            }
          }
        }
      }

      // 3. Users & Bazar Buyer Delegates
      const activeUserIds = new Set<string>();
      for (const u of database.users || []) {
        if (!u?.id || !u?.username || !u?.passwordHash) continue;
        const docId = toSafeDocId('', u.id);
        activeUserIds.add(docId);
        const userDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          username: clampStr(u.username, 64),
          name: clampStr(u.name || u.username, 120),
          passwordHash: clampStr(u.passwordHash, 256),
          role: ['owner', 'admin', 'manager', 'staff', 'viewer'].includes(u.role) ? u.role : 'staff',
          workspaceName: clampStr(u.workspaceName || `${u.name || u.username}'s Workspace`, 120),
          status: u.status === 'disabled' ? 'disabled' : 'active',
          canExport: Boolean(u.canExport),
          canDelete: Boolean(u.canDelete),
          clientCreatedAt: clampNum(u.createdAt, Date.now()),
          clientUpdatedAt: clampNum(u.updatedAt || u.createdAt, Date.now()),
        };
        if (u.email) userDoc.email = clampStr(u.email, 254);
        if (u.appleId) userDoc.appleId = clampStr(u.appleId, 254);
        if (u.idProvider === 'email' || u.idProvider === 'apple') userDoc.idProvider = u.idProvider;
        if (u.canAddTransactions !== undefined) userDoc.canAddTransactions = Boolean(u.canAddTransactions);
        if (u.canViewLedger !== undefined) userDoc.canViewLedger = Boolean(u.canViewLedger);
        if (u.canEditCustomers !== undefined) userDoc.canEditCustomers = Boolean(u.canEditCustomers);
        if (u.canDeleteCustomers !== undefined) userDoc.canDeleteCustomers = Boolean(u.canDeleteCustomers);
        if (u.canApproveInvoices !== undefined) userDoc.canApproveInvoices = Boolean(u.canApproveInvoices);
        if (u.canChangeProfilePhoto !== undefined) userDoc.canChangeProfilePhoto = Boolean(u.canChangeProfilePhoto);
        if (u.canManageCommissions !== undefined) userDoc.canManageCommissions = Boolean(u.canManageCommissions);
        if (u.canAddCommissionRecords !== undefined) userDoc.canAddCommissionRecords = Boolean(u.canAddCommissionRecords);
        if (u.canEditCommissionRecords !== undefined) userDoc.canEditCommissionRecords = Boolean(u.canEditCommissionRecords);
        if (u.canDeleteCommissionRecords !== undefined) userDoc.canDeleteCommissionRecords = Boolean(u.canDeleteCommissionRecords);
        if (u.canPayCommissions !== undefined) userDoc.canPayCommissions = Boolean(u.canPayCommissions);
        if (u.canImportCommissions !== undefined) userDoc.canImportCommissions = Boolean(u.canImportCommissions);
        if (u.canManageCommissionMonths !== undefined) userDoc.canManageCommissionMonths = Boolean(u.canManageCommissionMonths);
        if (u.canAddCommissionPersons !== undefined) userDoc.canAddCommissionPersons = Boolean(u.canAddCommissionPersons);
        if (u.canEditCommissionPersons !== undefined) userDoc.canEditCommissionPersons = Boolean(u.canEditCommissionPersons);
        if (u.canDeleteCommissionPersons !== undefined) userDoc.canDeleteCommissionPersons = Boolean(u.canDeleteCommissionPersons);
        if (u.canMergeCommissionPersons !== undefined) userDoc.canMergeCommissionPersons = Boolean(u.canMergeCommissionPersons);
        if (u.canChangeCommissionPersonPhoto !== undefined) userDoc.canChangeCommissionPersonPhoto = Boolean(u.canChangeCommissionPersonPhoto);
        if (u.canManageBazar !== undefined) userDoc.canManageBazar = Boolean(u.canManageBazar);
        if (u.canManageBuyers !== undefined) userDoc.canManageBuyers = Boolean(u.canManageBuyers);
        if (u.canManageBazarBuyers !== undefined) userDoc.canManageBazarBuyers = Boolean(u.canManageBazarBuyers);
        if (u.isCommissionOnly !== undefined) userDoc.isCommissionOnly = Boolean(u.isCommissionOnly);
        if (u.isCommissionBazarOnly !== undefined) userDoc.isCommissionBazarOnly = Boolean(u.isCommissionBazarOnly);
        if (u.theme) userDoc.theme = clampStr(u.theme, 40);
        if (u.displayMode === 'light' || u.displayMode === 'dark') userDoc.displayMode = u.displayMode;
        if (u.language === 'bn' || u.language === 'en') userDoc.language = u.language;
        if (u.useBanglaNumerals !== undefined) userDoc.useBanglaNumerals = Boolean(u.useBanglaNumerals);
        if (u.headerBgColor) userDoc.headerBgColor = clampStr(u.headerBgColor, 40);
        if (u.sidebarBgColor) userDoc.sidebarBgColor = clampStr(u.sidebarBgColor, 40);
        if (u.photoUrl) userDoc.photoUrl = clampStr(u.photoUrl, 512);
        if (await upsertDoc(ctx, 'users', docId, userDoc)) {
          writes++;
        }
        if (u.email && u.status !== 'disabled') {
          const emailLower = String(u.email).trim().toLowerCase();
          await upsertDoc(ctx, 'bazarBuyerDelegates', emailLower, {
            ownerUid: uid,
            email: clampStr(emailLower, 254),
            userId: docId,
            canManageBazarBuyers: u.role === 'owner' || u.canManageBazarBuyers === true,
            canManageBazar: u.role === 'owner' || u.canManageBazar !== false,
            clientUpdatedAt: clampNum(u.updatedAt || u.createdAt, Date.now()),
          }).catch(() => false);
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('usr_') && !activeUserIds.has(toSafeDocId('', recId))) {
          await removeDoc(ctx, 'users', toSafeDocId('', recId));
        }
      }

      // 4. Transactions
      const activeTxIds = new Set<string>();
      for (const t of database.transactions || []) {
        if (!t?.id) continue;
        const docId = toSafeDocId('', t.id);
        activeTxIds.add(docId);
        const txDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          userId: clampStr(t.userId || '', 128),
          workspaceUserId: clampStr(t.workspaceUserId || t.userId || '', 128),
          description: clampStr(t.description || '', 500),
          amount: clampNum(t.amount, 0),
          type: t.type === 'income' ? 'income' : 'expense',
          category: clampStr(t.category || 'General', 100),
          paymentMethod: ['cash', 'bkash', 'nagad', 'bank'].includes(t.paymentMethod) ? t.paymentMethod : 'cash',
          timestamp: clampNum(t.timestamp, Date.now()),
          clientUpdatedAt: clampNum(t.updatedAt || t.timestamp, Date.now()),
        };
        if (t.notes) txDoc.notes = clampStr(t.notes, 2000);
        if (t.createdByName) txDoc.createdByName = clampStr(t.createdByName, 120);
        if (t.customerName) txDoc.customerName = clampStr(t.customerName, 120);
        if (await upsertDoc(ctx, 'transactions', docId, txDoc)) {
          writes++;
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if ((recId.startsWith('tx_') || recId.startsWith('tx-')) && !activeTxIds.has(toSafeDocId('', recId))) {
          await removeDoc(ctx, 'transactions', toSafeDocId('', recId));
        }
      }

      // 5. Customers
      const activeCustIds = new Set<string>();
      for (const c of database.customers || []) {
        if (!c?.id || !c?.name) continue;
        const docId = toSafeDocId('', c.id);
        activeCustIds.add(docId);
        const custDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          workspaceUserId: clampStr(c.workspaceUserId || '', 128),
          name: clampStr(c.name, 160),
          phone: clampStr(c.phone || '', 40),
          type: c.type === 'vendor' ? 'vendor' : 'customer',
          balance: clampNum(c.balance, 0),
          clientUpdatedAt: clampNum(c.updatedAt, Date.now()),
        };
        if (c.whatsapp) custDoc.whatsapp = clampStr(c.whatsapp, 40);
        if (c.photoUrl) custDoc.photoUrl = clampStr(c.photoUrl, 512);
        if (c.email) custDoc.email = clampStr(c.email, 254);
        if (c.address) custDoc.address = clampStr(c.address, 500);
        if (c.businessName) custDoc.businessName = clampStr(c.businessName, 160);
        if (c.notes) custDoc.notes = clampStr(c.notes, 2000);
        if (await upsertDoc(ctx, 'customers', docId, custDoc)) {
          writes++;
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('cust') && !activeCustIds.has(toSafeDocId('', recId))) {
          await removeDoc(ctx, 'customers', toSafeDocId('', recId));
        }
      }

      // 6. Invoices
      const activeInvIds = new Set<string>();
      for (const inv of database.invoices || []) {
        if (!inv?.id) continue;
        const docId = toSafeDocId('', inv.id);
        activeInvIds.add(docId);
        const items = Array.isArray(inv.items)
          ? inv.items.slice(0, 50).map((it: any) => ({
              id: clampStr(it?.id || '', 64),
              description: clampStr(it?.description || '', 300),
              quantity: clampNum(it?.quantity, 1),
              unitPrice: clampNum(it?.unitPrice, 0),
              total: clampNum(it?.total, 0),
            }))
          : [];
        const totalAmount = clampNum(inv.totalAmount, 0);
        const paidAmount = clampNum(inv.paidAmount, 0);
        const discount = clampNum(inv.discount ?? inv.discountAmount, 0);
        const taxRate = clampNum(inv.taxRate, 0);
        const balanceDue =
          typeof inv.balanceDue === 'number' && Number.isFinite(inv.balanceDue)
            ? inv.balanceDue
            : totalAmount - paidAmount;
        const remainingAmount = Math.max(
          0,
          typeof inv.remainingAmount === 'number' && inv.remainingAmount > 0
            ? inv.remainingAmount
            : balanceDue
        );
        const derivedStatus =
          balanceDue < 0
            ? 'overpaid'
            : balanceDue === 0 && totalAmount > 0
              ? 'paid'
              : paidAmount > 0
                ? 'partial'
                : 'unpaid';
        const status = ['unpaid', 'partial', 'paid', 'overpaid'].includes(inv.status)
          ? inv.status
          : inv.status === 'Cancelled'
            ? 'Cancelled'
            : derivedStatus;
        const payments = Array.isArray(inv.payments)
          ? inv.payments.slice(0, 100).map((p: any) => ({
              id: clampStr(p?.id || '', 64),
              invoiceId: clampStr(p?.invoiceId || docId, 128),
              customerId: clampStr(p?.customerId || inv.customerId || '', 128),
              amount: clampNum(p?.amount, 0),
              paymentDate: clampNum(p?.paymentDate, Date.now()),
              paymentMethod: ['cash', 'bkash', 'nagad', 'bank'].includes(p?.paymentMethod) ? p.paymentMethod : 'cash',
              ...(p?.reference ? { reference: clampStr(p.reference, 160) } : {}),
              ...(p?.notes ? { notes: clampStr(p.notes, 500) } : {}),
              ...(p?.recordedByName ? { recordedByName: clampStr(p.recordedByName, 120) } : {}),
              createdAt: clampNum(p?.createdAt, Date.now()),
            }))
          : [];
        const invDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          workspaceUserId: clampStr(inv.workspaceUserId || '', 128),
          invoiceNumber: clampStr(inv.invoiceNumber || '', 64),
          customerId: clampStr(inv.customerId || '', 128),
          customerName: clampStr(inv.customerName || '', 160),
          date: clampNum(inv.date, Date.now()),
          dueDate: clampNum(inv.dueDate, Date.now()),
          items,
          subtotal: clampNum(inv.subtotal, 0),
          taxRate,
          taxAmount: clampNum(inv.taxAmount, 0),
          discount,
          discountAmount: clampNum(inv.discountAmount ?? discount, 0),
          totalAmount,
          paidAmount,
          balanceDue,
          remainingAmount,
          status,
          payments,
          clientCreatedAt: clampNum(inv.createdAt, Date.now()),
          clientUpdatedAt: clampNum(inv.updatedAt || inv.createdAt, Date.now()),
        };
        if (inv.customerPhone) invDoc.customerPhone = clampStr(inv.customerPhone, 40);
        if (inv.customerBusiness) invDoc.customerBusiness = clampStr(inv.customerBusiness, 160);
        if (inv.customerAddress) invDoc.customerAddress = clampStr(inv.customerAddress, 500);
        if (inv.serviceName) invDoc.serviceName = clampStr(inv.serviceName, 200);
        if (inv.iqamaNo) invDoc.iqamaNo = clampStr(inv.iqamaNo, 64);
        if (inv.branchOffice) invDoc.branchOffice = clampStr(inv.branchOffice, 160);
        if (inv.countryFlag) invDoc.countryFlag = clampStr(inv.countryFlag, 16);
        if (typeof inv.lastPaymentAmount === 'number' && Number.isFinite(inv.lastPaymentAmount)) {
          invDoc.lastPaymentAmount = inv.lastPaymentAmount;
        }
        if (inv.notes) invDoc.notes = clampStr(inv.notes, 2000);
        if (inv.terms) invDoc.terms = clampStr(inv.terms, 1000);
        if (inv.createdByName) invDoc.createdByName = clampStr(inv.createdByName, 120);
        if (await upsertDoc(ctx, 'invoices', docId, invDoc)) {
          writes++;
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('inv') && !activeInvIds.has(toSafeDocId('', recId))) {
          await removeDoc(ctx, 'invoices', toSafeDocId('', recId));
        }
      }

      // 7. Commission Entries
      const activeCommIds = new Set<string>();
      for (const ce of database.commissionEntries || []) {
        if (!ce?.id || isAutoSyncedZeroCommission(ce)) continue;
        const docId = toSafeDocId('', ce.id);
        activeCommIds.add(docId);
        const ceDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          date: clampStr(ce.date || '', 32),
          office: clampStr(ce.office || '', 160),
          invoiceNo: clampStr(ce.invoiceNo || '', 64),
          invoiceStatus: ['Active', 'Pending', 'Cancelled'].includes(ce.invoiceStatus)
            ? ce.invoiceStatus
            : 'Active',
          agent: clampStr(ce.agent || '', 120),
          client: clampStr(ce.client || '', 160),
          service: clampStr(ce.service || '', 200),
          qty: clampNum(ce.qty, 1),
          ratePerUnit: clampNum(ce.ratePerUnit, 0),
          invoiceTotal: clampNum(ce.invoiceTotal, 0),
          remainingAmount: clampNum(ce.remainingAmount, 0),
          eligible: Boolean(ce.eligible),
          commissionAmount: clampNum(ce.commissionAmount, 0),
          payoutStatus: ['To pay', 'Paid', 'Not eligible', 'Carried over'].includes(ce.payoutStatus)
            ? ce.payoutStatus
            : 'To pay',
          clientCreatedAt: clampNum(ce.createdAt, Date.now()),
          clientUpdatedAt: clampNum(ce.updatedAt || ce.createdAt, Date.now()),
        };
        if (ce.agentId) ceDoc.agentId = clampStr(ce.agentId, 128);
        if (ce.workerName) ceDoc.workerName = clampStr(ce.workerName, 160);
        if (ce.clientMobile) ceDoc.clientMobile = clampStr(ce.clientMobile, 40);
        if (ce.reasonNotEligible) ceDoc.reasonNotEligible = clampStr(ce.reasonNotEligible, 500);
        if (ce.isClawback !== undefined) ceDoc.isClawback = Boolean(ce.isClawback);
        if (typeof ce.clawbackAmount === 'number') ceDoc.clawbackAmount = ce.clawbackAmount;
        if (typeof ce.paidAt === 'number') ceDoc.paidAt = ce.paidAt;
        if (ce.period) ceDoc.period = clampStr(ce.period, 64);
        if (ce.notes) ceDoc.notes = clampStr(ce.notes, 2000);
        if (ce.createdByUserId) ceDoc.createdByUserId = clampStr(ce.createdByUserId, 128);
        if (ce.createdByName) ceDoc.createdByName = clampStr(ce.createdByName, 120);
        if (await upsertDoc(ctx, 'commissionEntries', docId, ceDoc)) {
          writes++;
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if ((recId.startsWith('comm_') || recId.startsWith('comm-')) && !activeCommIds.has(toSafeDocId('', recId))) {
          await removeDoc(ctx, 'commissionEntries', toSafeDocId('', recId));
        }
      }

      // 8. Commission Persons
      const activePersonIds = new Set<string>();
      for (const cp of database.commissionPersons || []) {
        if (!cp?.id || !cp?.name) continue;
        const docId = toSafeDocId('', cp.id);
        activePersonIds.add(docId);
        const cpDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          name: clampStr(cp.name, 160),
          clientCreatedAt: clampNum(cp.createdAt, Date.now()),
          clientUpdatedAt: clampNum(cp.updatedAt || cp.createdAt, Date.now()),
        };
        if (cp.iqamaNo) cpDoc.iqamaNo = clampStr(cp.iqamaNo, 64);
        if (cp.phone) cpDoc.phone = clampStr(cp.phone, 40);
        if (cp.office) cpDoc.office = clampStr(cp.office, 160);
        if (cp.linkedUserId) cpDoc.linkedUserId = clampStr(cp.linkedUserId, 128);
        if (cp.photoUrl) cpDoc.photoUrl = clampStr(cp.photoUrl, 512);
        if (cp.createdByUserId) cpDoc.createdByUserId = clampStr(cp.createdByUserId, 128);
        if (cp.createdByName) cpDoc.createdByName = clampStr(cp.createdByName, 120);
        if (await upsertDoc(ctx, 'commissionPersons', docId, cpDoc)) {
          writes++;
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('person_') && !activePersonIds.has(toSafeDocId('', recId))) {
          await removeDoc(ctx, 'commissionPersons', toSafeDocId('', recId));
        }
      }

      // 9. Commission Months
      const activeMonths = new Set<string>();
      for (const m of database.commissionMonths || []) {
        if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) {
          activeMonths.add(m);
          if (
            await upsertDoc(ctx, 'commissionMonths', toSafeDocId('month_', m), {
              ownerUid: uid,
              month: m,
            })
          ) {
            writes++;
          }
        }
      }
      const deletedMonthsMap: Record<string, number> = database.deletedCommissionMonths || {};
      for (const [ym] of Object.entries(deletedMonthsMap)) {
        if (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym) && !activeMonths.has(ym)) {
          await removeDoc(ctx, 'commissionMonths', toSafeDocId('month_', ym));
        }
      }

      // 10. Home Bazar Entries
      const activeBazarIds = new Set<string>();
      for (const hb of database.homeBazarEntries || []) {
        if (!hb?.id) continue;
        const docId = toSafeDocId('', hb.id);
        activeBazarIds.add(docId);
        const hbDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          userId: clampStr(hb.userId || '', 128),
          workspaceUserId: clampStr(hb.workspaceUserId || hb.userId || '', 128),
          date: clampStr(hb.date || '', 32),
          itemName: clampStr(hb.itemName || hb.item || '', 200),
          category: clampStr(hb.category || 'other', 100),
          amount: clampNum(hb.amount, 0),
          paymentMethod: ['cash', 'bkash', 'nagad', 'bank'].includes(hb.paymentMethod) ? hb.paymentMethod : 'cash',
          clientCreatedAt: clampNum(hb.createdAt, Date.now()),
          clientUpdatedAt: clampNum(hb.updatedAt || hb.createdAt, Date.now()),
        };
        if (hb.quantity) hbDoc.quantity = clampStr(hb.quantity, 80);
        if (hb.purchasedBy || hb.buyer) hbDoc.purchasedBy = clampStr(hb.purchasedBy || hb.buyer, 120);
        if (hb.buyerId) hbDoc.buyerId = clampStr(hb.buyerId, 80);
        if (hb.notes) hbDoc.notes = clampStr(hb.notes, 2000);
        if (await upsertDoc(ctx, 'homeBazarEntries', docId, hbDoc)) {
          writes++;
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (
          (recId.startsWith('hb-') || recId.startsWith('hb_') || recId.startsWith('bazar_') || recId.startsWith('bz-')) &&
          !activeBazarIds.has(toSafeDocId('', recId))
        ) {
          await removeDoc(ctx, 'homeBazarEntries', toSafeDocId('', recId));
        }
      }

      const now = Date.now();
      syncState = 'ready';
      lastSyncedAt = now;
      lastPushedAt = now;
      lastError = null;
      return { pushed: true, writes, status: syncState };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        syncState = 'permission_denied';
        lastError = 'Firestore Admin permission denied (grant roles/datastore.user to runtime service account)';
      } else {
        syncState = 'error';
        lastError = err instanceof Error ? err.message : 'Firestore Admin push failed';
      }
      return { pushed: false, writes: 0, status: syncState };
    } finally {
      syncing = false;
    }
  });
}

export async function pullFromFirestoreAdmin(
  database: any,
  ownerUidOverride?: string
): Promise<{
  pulled: boolean;
  changed: boolean;
  settingsChanged: boolean;
  status: AdminSyncState;
}> {
  return runSerialized(async () => {
    const ctx = initFirebaseAdmin();
    if (!ctx || !database) {
      return { pulled: false, changed: false, settingsChanged: false, status: syncState };
    }

    syncing = true;
    try {
      const uid = await resolveOwnerUid(database, ownerUidOverride);
      if (!uid) {
        syncState = 'needs_owner_uid';
        return { pulled: false, changed: false, settingsChanged: false, status: syncState };
      }

      if (database.ownerFirebaseUid !== uid) {
        database.ownerFirebaseUid = uid;
      }

      const [
        settingsRows,
        userRows,
        buyerRows,
        txRows,
        custRows,
        invRows,
        commRows,
        personRows,
        monthRows,
        bazarRows,
        deletedRows,
      ] = await Promise.all([
        listOwnerCollection(ctx, 'appSettings', uid),
        listOwnerCollection(ctx, 'users', uid),
        listOwnerCollection(ctx, 'bazarBuyers', uid),
        listOwnerCollection(ctx, 'transactions', uid),
        listOwnerCollection(ctx, 'customers', uid),
        listOwnerCollection(ctx, 'invoices', uid),
        listOwnerCollection(ctx, 'commissionEntries', uid),
        listOwnerCollection(ctx, 'commissionPersons', uid),
        listOwnerCollection(ctx, 'commissionMonths', uid),
        listOwnerCollection(ctx, 'homeBazarEntries', uid),
        listOwnerCollection(ctx, 'deletedRecords', uid),
      ]);

      let changed = false;
      let settingsChanged = false;

      database.deletedRecordIds = database.deletedRecordIds || {};
      deletedRows.forEach((d) => {
        if (d?.recordId && typeof d.deletedAtMs === 'number') {
          if (d.deletedAtMs > (database.deletedRecordIds[d.recordId] || 0)) {
            database.deletedRecordIds[d.recordId] = d.deletedAtMs;
            changed = true;
          }
        }
      });

      const isTombstoned = (item: any): boolean => {
        if (!item?.id) return true;
        const delTs = database.deletedRecordIds?.[item.id] || 0;
        if (!delTs) return false;
        const itemTs = Number(item.updatedAt) || Number(item.createdAt) || 0;
        return itemTs <= delTs;
      };

      const mergeCollection = (target: any[], incoming: any[]) => {
        if (!Array.isArray(target) || !Array.isArray(incoming)) return;
        incoming.forEach((raw) => {
          const item = stripInternalDocFields(raw);
          if (!item?.id || isTombstoned(item)) return;
          const idx = target.findIndex((it) => it.id === item.id);
          if (idx === -1) {
            target.push(item);
            changed = true;
          } else {
            const existing = target[idx];
            const incTs = Number(item.updatedAt) || Number(item.createdAt) || 0;
            const extTs = Number(existing.updatedAt) || Number(existing.createdAt) || 0;
            if (incTs > extTs) {
              target[idx] = {
                ...existing,
                ...item,
                id: existing.id,
                photoData: item.photoData || existing.photoData,
                photoUrl: item.photoUrl || existing.photoUrl,
              };
              changed = true;
            }
          }
        });
      };

      // Merge Transactions, Customers, Invoices, Commissions, Persons, Bazar
      mergeCollection(database.transactions, txRows);
      mergeCollection(database.customers, custRows);
      mergeCollection(
        database.invoices,
        invRows.map((raw) => normalizePulledInvoice(stripInternalDocFields(raw)))
      );
      mergeCollection(
        database.commissionEntries,
        commRows.map(stripInternalDocFields).filter((c) => !isAutoSyncedZeroCommission(c))
      );
      database.commissionPersons = database.commissionPersons || [];
      mergeCollection(database.commissionPersons, personRows);
      mergeCollection(
        database.homeBazarEntries,
        bazarRows.map((raw) => {
          const clean = stripInternalDocFields(raw);
          if (!clean.userId) clean.userId = 'usr_owner_faisal';
          if (!clean.workspaceUserId) clean.workspaceUserId = clean.userId;
          return clean;
        })
      );

      // Merge Commission Months
      const monthSet = new Set<string>(database.commissionMonths || []);
      monthRows.forEach((m) => {
        const ym = String(m?.month || '');
        if (/^\d{4}-\d{2}$/.test(ym) && !database.deletedCommissionMonths?.[ym]) {
          if (!monthSet.has(ym)) changed = true;
          monthSet.add(ym);
        }
      });
      database.commissionMonths = Array.from(monthSet).sort();

      // Merge Users (preserving Owner role/active status)
      userRows.forEach((rawU) => {
        const incU = stripInternalDocFields(rawU);
        if (!incU?.id || !incU?.username || isTombstoned(incU)) return;
        const idx = (database.users || []).findIndex(
          (u: any) => u.id === incU.id || u.username.toLowerCase() === String(incU.username).toLowerCase()
        );
        if (idx === -1) {
          if (!incU.passwordHash) return;
          database.users.push({
            ...incU,
            role: incU.role === 'owner' ? 'staff' : incU.role || 'staff',
            status: incU.status === 'disabled' ? 'disabled' : 'active',
          });
          changed = true;
        } else {
          const extU = database.users[idx];
          const incTs = Number(incU.updatedAt) || Number(incU.createdAt) || 0;
          const extTs = Number(extU.updatedAt) || Number(extU.createdAt) || 0;
          if (incTs > extTs) {
            database.users[idx] = {
              ...extU,
              ...incU,
              id: extU.id,
              username: extU.username,
              role: extU.role === 'owner' ? 'owner' : incU.role === 'owner' ? extU.role : incU.role || extU.role,
              status: extU.role === 'owner' ? 'active' : incU.status || extU.status,
              passwordHash: incU.passwordHash || extU.passwordHash,
              photoData: incU.photoData || extU.photoData,
              photoUrl: incU.photoUrl || extU.photoUrl,
            };
            changed = true;
          }
        }
      });

      // Merge Global Settings & Bazar Buyers
      const rawSettings = settingsRows.find((s) => s._docId === 'global') || settingsRows[0];
      if (rawSettings) {
        const incS = stripInternalDocFields(rawSettings);
        const incSetTs = Number(incS.updatedAt) || 0;
        const extSetTs = Number(database.globalSettings?.updatedAt) || 0;
        if (incSetTs > extSetTs) {
          database.globalSettings = {
            ...database.globalSettings,
            appName: incS.appName || database.globalSettings.appName,
            companyName: incS.companyName || database.globalSettings.companyName,
            version: incS.version || database.globalSettings.version,
            currency: incS.currency || database.globalSettings.currency,
            broadcastMessage: incS.broadcastMessage ?? database.globalSettings.broadcastMessage,
            broadcastType: incS.broadcastType || database.globalSettings.broadcastType,
            broadcastActive: incS.broadcastActive ?? database.globalSettings.broadcastActive,
            defaultTheme: incS.defaultTheme || database.globalSettings.defaultTheme,
            headerBgColor: incS.headerBgColor ?? database.globalSettings.headerBgColor,
            sidebarBgColor: incS.sidebarBgColor ?? database.globalSettings.sidebarBgColor,
            bazarMonthlyBudget:
              typeof incS.bazarMonthlyBudget === 'number'
                ? incS.bazarMonthlyBudget
                : database.globalSettings.bazarMonthlyBudget,
            forceRefreshAt:
              typeof incS.forceRefreshAt === 'number'
                ? Math.max(Number(database.globalSettings.forceRefreshAt) || 0, incS.forceRefreshAt)
                : database.globalSettings.forceRefreshAt,
            updatedAt: incSetTs,
            lastUpdatedBy: incS.lastUpdatedBy || database.globalSettings.lastUpdatedBy,
          };
          settingsChanged = true;
          changed = true;
        }
      }

      if (buyerRows.length > 0) {
        database.globalSettings.bazarBuyers = database.globalSettings.bazarBuyers || [];
        buyerRows.forEach((rawB) => {
          const incB = stripInternalDocFields(rawB);
          if (!incB?.buyerId) return;
          const normId = String(incB.buyerId).trim().toLowerCase();
          const delTs = database.deletedRecordIds?.[`buyer:${normId}`] || 0;
          const incTs = Number(incB.updatedAt) || 0;
          if (delTs && incTs <= delTs) return;
          const idx = database.globalSettings.bazarBuyers.findIndex(
            (b: any) => String(b.buyerId || '').toLowerCase() === normId
          );
          if (idx === -1) {
            database.globalSettings.bazarBuyers.push(incB);
            settingsChanged = true;
            changed = true;
          } else {
            const extB = database.globalSettings.bazarBuyers[idx];
            if (incTs > (Number(extB.updatedAt) || 0)) {
              database.globalSettings.bazarBuyers[idx] = {
                ...extB,
                ...incB,
                photoData: incB.photoData || extB.photoData,
                photoUrl: incB.photoUrl || extB.photoUrl,
              };
              settingsChanged = true;
              changed = true;
            }
          }
        });
      }

      const now = Date.now();
      syncState = 'ready';
      lastSyncedAt = now;
      lastPulledAt = now;
      lastError = null;
      return { pulled: true, changed, settingsChanged, status: syncState };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        syncState = 'permission_denied';
        lastError = 'Firestore Admin permission denied (grant roles/datastore.user to runtime service account)';
      } else {
        syncState = 'error';
        lastError = err instanceof Error ? err.message : 'Firestore Admin pull failed';
      }
      return { pulled: false, changed: false, settingsChanged: false, status: syncState };
    } finally {
      syncing = false;
    }
  });
}

export function scheduleAdminFirestoreSync(database: any) {
  const cfg = loadFirebaseConfig();
  if (!cfg || !database) return;
  if (debouncedTimer) clearTimeout(debouncedTimer);
  debouncedTimer = setTimeout(() => {
    debouncedTimer = null;
    pushToFirestoreAdmin(database).catch(() => {});
  }, 1500);
}

export function getAdminFirestoreStatus(): AdminFirestoreStatus {
  const cfg = loadFirebaseConfig();
  return {
    configured: Boolean(cfg),
    projectId: cfg?.projectId || '',
    databaseId: cfg?.firestoreDatabaseId || '(default)',
    status: syncState,
    hasOwnerUid: Boolean(cachedOwnerUid),
    lastSyncedAt,
    lastPushedAt,
    lastPulledAt,
    lastError,
    syncing,
  };
}
