import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PersistentVaultSnapshot } from './vaultStorage';

const app = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

const OWNER_ADMIN_EMAIL = 'rh.faysal007@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot per integration guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

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

export interface FirestoreSyncStatus {
  isAuthenticated: boolean;
  isVerifiedOwner: boolean;
  email: string | null;
  uid: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
  syncing: boolean;
}

type CreatedAtCache = Map<string, Timestamp>;

class FirestoreSyncService {
  private listeners: Array<(status: FirestoreSyncStatus) => void> = [];
  private currentUser: FirebaseUser | null = null;
  private lastSyncedAt: number | null = null;
  private lastError: string | null = null;
  private syncing = false;

  // Tracks createdAt Timestamp and last synced signature per Firestore path so updates preserve createdAt and skip unchanged docs
  private createdAtCache: CreatedAtCache = new Map();
  private syncedSignatureCache: Map<string, string> = new Map();
  private cloudDocIdsByCollection: Map<string, Set<string>> = new Map();
  private adminVerifiedUid: string | null = null;
  private syncQueue: Promise<unknown> = Promise.resolve();
  private lastPushedSettingsAt = 0;

  private runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.syncQueue.then(task, task);
    this.syncQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  constructor() {
    onAuthStateChanged(firebaseAuth, (user) => {
      this.currentUser = user;
      if (!user) {
        this.adminVerifiedUid = null;
        this.cloudDocIdsByCollection.clear();
        this.createdAtCache.clear();
        this.syncedSignatureCache.clear();
      }
      this.emit();
    });
  }

  public subscribe(cb: (status: FirestoreSyncStatus) => void): () => void {
    this.listeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public getStatus(): FirestoreSyncStatus {
    const email = this.currentUser?.email?.toLowerCase() || null;
    const isVerifiedOwner = Boolean(
      this.currentUser &&
        this.currentUser.emailVerified &&
        email === OWNER_ADMIN_EMAIL
    );
    return {
      isAuthenticated: Boolean(this.currentUser),
      isVerifiedOwner,
      email: this.currentUser?.email || null,
      uid: this.currentUser?.uid || null,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      syncing: this.syncing,
    };
  }

  private emit() {
    const s = this.getStatus();
    this.listeners.forEach((l) => {
      try {
        l(s);
      } catch {}
    });
  }

  public subscribeToGlobalSettings(onRemoteUpdate: (remoteSettings: any) => void): () => void {
    const uid = this.getVerifiedOwnerUid();
    if (!uid) return () => {};
    const settingsPath = 'appSettings/global';
    const ref = doc(firestoreDb, 'appSettings', 'global');
    let firstSnapshot = true;

    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          firstSnapshot = false;
          return;
        }
        const data = snap.data() as any;
        if (data?.ownerUid && data.ownerUid !== uid) {
          firstSnapshot = false;
          return;
        }
        const remoteUpdatedAt = Number(data?.clientUpdatedAt) || 0;
        const remoteForceAt = Number(data?.forceRefreshAt) || 0;
        if (firstSnapshot) {
          firstSnapshot = false;
          // Still surface initial remote forceRefresh/update if newer than local baseline
          if (remoteUpdatedAt <= this.lastPushedSettingsAt && remoteForceAt === 0) {
            return;
          }
        }
        if (this.syncing || remoteUpdatedAt <= this.lastPushedSettingsAt) {
          return;
        }
        try {
          onRemoteUpdate(data);
        } catch {}
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.GET, settingsPath);
        }
      }
    );
  }

  private pendingVaultSignIn: Promise<FirebaseUser | null> | null = null;
  private pendingAppleSignIn: Promise<{ idToken: string; email: string | null; displayName: string | null }> | null = null;

  public async connectCloudVault(): Promise<FirebaseUser | null> {
    if (this.pendingVaultSignIn) {
      return this.pendingVaultSignIn;
    }

    this.pendingVaultSignIn = (async () => {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(firebaseAuth, provider);
        this.currentUser = result.user;
        this.lastError = null;
        this.emit();
        return result.user;
      } catch (err: any) {
        const code = String(err?.code || '');
        const msg = String(err?.message || '');
        if (
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          msg.includes('popup-closed-by-user') ||
          msg.includes('cancelled-popup-request')
        ) {
          return null;
        }
        if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
          throw new Error('Popup was blocked by your browser. Please allow popups or open the app in a new tab.');
        }
        throw err;
      } finally {
        this.pendingVaultSignIn = null;
      }
    })();

    return this.pendingVaultSignIn;
  }

  public async signInWithAppleId(): Promise<{ idToken: string; email: string | null; displayName: string | null }> {
    if (this.pendingAppleSignIn) {
      return this.pendingAppleSignIn;
    }

    this.pendingAppleSignIn = (async () => {
      try {
        const helperApp =
          getApps().find((a) => a.name === 'apple-auth-helper') ||
          initializeApp(firebaseConfig, 'apple-auth-helper');
        const helperAuth = getAuth(helperApp);
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        const result = await signInWithPopup(helperAuth, provider);
        const idToken = await result.user.getIdToken();
        const email = result.user.email || result.user.providerData?.[0]?.email || null;
        const displayName = result.user.displayName || null;
        await signOut(helperAuth).catch(() => {});
        return { idToken, email, displayName };
      } finally {
        this.pendingAppleSignIn = null;
      }
    })();

    return this.pendingAppleSignIn;
  }

  private getVerifiedOwnerUid(): string | null {
    const u = this.currentUser || firebaseAuth.currentUser;
    if (!u || !u.emailVerified) return null;
    if ((u.email || '').toLowerCase() !== OWNER_ADMIN_EMAIL) return null;
    return u.uid;
  }

  private async ensureAdminDoc(uid: string, email: string): Promise<void> {
    if (this.adminVerifiedUid === uid) return;
    const adminPath = `admins/${uid}`;
    try {
      const ref = doc(firestoreDb, 'admins', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid,
          email: clampStr(email, 254),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      this.adminVerifiedUid = uid;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, adminPath);
    }
  }

  private async listCollection(colName: string, ownerUid: string): Promise<any[]> {
    try {
      const q = query(collection(firestoreDb, colName), where('ownerUid', '==', ownerUid));
      const snap = await getDocs(q);
      const rows: any[] = [];
      const docIds = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        const key = `${colName}/${d.id}`;
        docIds.add(d.id);
        if (data?.createdAt instanceof Timestamp) {
          this.createdAtCache.set(key, data.createdAt);
        }
        rows.push({ _docId: d.id, ...data });
      });
      this.cloudDocIdsByCollection.set(colName, docIds);
      return rows;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colName);
    }
  }

  private async upsertDoc(
    colName: string,
    docId: string,
    payloadWithoutTimestamps: Record<string, any>
  ): Promise<void> {
    const key = `${colName}/${docId}`;
    const signature = JSON.stringify(payloadWithoutTimestamps);
    if (this.syncedSignatureCache.get(key) === signature) {
      return; // Unchanged since last sync
    }

    const ref = doc(firestoreDb, colName, docId);
    let existingCreatedAt = this.createdAtCache.get(key);
    let existsInCloud = Boolean(existingCreatedAt);

    if (!existsInCloud) {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          existsInCloud = true;
          const data = snap.data();
          if (data?.createdAt instanceof Timestamp) {
            existingCreatedAt = data.createdAt;
            this.createdAtCache.set(key, data.createdAt);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, key);
      }
    }

    try {
      if (existsInCloud && existingCreatedAt) {
        try {
          await setDoc(ref, {
            ...payloadWithoutTimestamps,
            createdAt: existingCreatedAt,
            updatedAt: serverTimestamp(),
          });
        } catch (updateErr) {
          const serverSnap = await getDocFromServer(ref).catch(() => null);
          const serverCreatedAt = serverSnap?.data()?.createdAt;
          if (serverSnap?.exists()) {
            const nextCreatedAt = serverCreatedAt instanceof Timestamp ? serverCreatedAt : serverTimestamp();
            if (serverCreatedAt instanceof Timestamp) {
              this.createdAtCache.set(key, serverCreatedAt);
            } else {
              this.createdAtCache.delete(key);
            }
            await setDoc(ref, {
              ...payloadWithoutTimestamps,
              createdAt: nextCreatedAt,
              updatedAt: serverTimestamp(),
            });
          } else {
            throw updateErr;
          }
        }
      } else {
        try {
          await setDoc(ref, {
            ...payloadWithoutTimestamps,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          // Cache resolved server timestamp so subsequent updates reuse createdAt
          const createdSnap = await getDocFromServer(ref)
            .catch(() => getDoc(ref))
            .catch(() => null);
          const createdTs = createdSnap?.data()?.createdAt;
          if (createdTs instanceof Timestamp) {
            this.createdAtCache.set(key, createdTs);
          }
        } catch (createErr) {
          // Handle cross-tab/concurrent create race: if another tab created the doc after our initial getDoc,
          // fetch the server doc's createdAt and retry once as an update preserving createdAt.
          const retrySnap = await getDocFromServer(ref).catch(() => null);
          const retryCreatedAt = retrySnap?.data()?.createdAt;
          if (retrySnap?.exists() && retryCreatedAt instanceof Timestamp) {
            existsInCloud = true;
            existingCreatedAt = retryCreatedAt;
            this.createdAtCache.set(key, retryCreatedAt);
            await setDoc(ref, {
              ...payloadWithoutTimestamps,
              createdAt: retryCreatedAt,
              updatedAt: serverTimestamp(),
            });
          } else {
            throw createErr;
          }
        }
      }
      this.syncedSignatureCache.set(key, signature);
      const colSet = this.cloudDocIdsByCollection.get(colName);
      if (colSet) colSet.add(docId);
    } catch (err) {
      handleFirestoreError(
        err,
        existsInCloud ? OperationType.UPDATE : OperationType.CREATE,
        key
      );
    }
  }

  private async removeDoc(colName: string, docId: string): Promise<void> {
    const colSet = this.cloudDocIdsByCollection.get(colName);
    if (colSet && !colSet.has(docId)) {
      return; // Already absent from Firestore
    }
    const key = `${colName}/${docId}`;
    try {
      await deleteDoc(doc(firestoreDb, colName, docId));
      this.createdAtCache.delete(key);
      this.syncedSignatureCache.delete(key);
      if (colSet) colSet.delete(docId);
    } catch (err) {
      // Ignore not-found or handle permission errors strictly
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(err, OperationType.DELETE, key);
      }
    }
  }

  public pullSnapshot(): Promise<PersistentVaultSnapshot | null> {
    return this.runSerialized(async () => {
      const uid = this.getVerifiedOwnerUid();
      if (!uid) return null;

      const email = (this.currentUser?.email || firebaseAuth.currentUser?.email || OWNER_ADMIN_EMAIL).toLowerCase();
      this.syncing = true;
      this.emit();

      try {
      await this.ensureAdminDoc(uid, email);

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
        this.listCollection('appSettings', uid),
        this.listCollection('users', uid),
        this.listCollection('bazarBuyers', uid),
        this.listCollection('transactions', uid),
        this.listCollection('customers', uid),
        this.listCollection('invoices', uid),
        this.listCollection('commissionEntries', uid),
        this.listCollection('commissionPersons', uid),
        this.listCollection('commissionMonths', uid),
        this.listCollection('homeBazarEntries', uid),
        this.listCollection('deletedRecords', uid),
      ]);

      const deletedRecordIds: Record<string, number> = {};
      deletedRows.forEach((d) => {
        if (d.recordId && typeof d.deletedAtMs === 'number') {
          deletedRecordIds[d.recordId] = d.deletedAtMs;
        }
      });

      const stripInternal = (row: any) => {
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
      };

      const rawSettings = settingsRows.find((s) => s._docId === 'global') || settingsRows[0];
      const buyersList = buyerRows.map((b) => {
        const clean = stripInternal(b);
        return clean;
      });
      const globalSettings = rawSettings
        ? {
            ...stripInternal(rawSettings),
            bazarBuyers: buyersList,
          }
        : buyersList.length > 0
          ? { bazarBuyers: buyersList, updatedAt: Date.now() }
          : undefined;

      const snapshot: PersistentVaultSnapshot = {
        savedAt: Date.now(),
        users: userRows.map(stripInternal),
        globalSettings,
        transactions: txRows.map(stripInternal),
        customers: custRows.map(stripInternal),
        invoices: invRows.map((inv) => normalizePulledInvoice(stripInternal(inv))),
        commissionEntries: commRows.map(stripInternal).filter((ce: any) => {
          const id = String(ce?.id || '');
          const notes = String(ce?.notes || '');
          const isAutoSynced = id.startsWith('comm-inv-') || notes === 'Auto-synced from Daily Invoices';
          if (!isAutoSynced) return true;
          return !((Number(ce?.commissionAmount) || 0) === 0 && (Number(ce?.ratePerUnit) || 0) === 0 && !ce?.isClawback && ce?.invoiceStatus !== 'Cancelled');
        }),
        commissionPersons: personRows.map(stripInternal),
        commissionMonths: monthRows.map((m) => String(m.month || '')).filter(Boolean).sort(),
        homeBazarEntries: bazarRows.map((raw) => {
          const clean = stripInternal(raw);
          if (!clean.itemName && clean.item) clean.itemName = clean.item;
          if (!clean.purchasedBy && clean.buyer) clean.purchasedBy = clean.buyer;
          if (!clean.userId) clean.userId = 'usr_owner_faisal';
          if (!clean.workspaceUserId) clean.workspaceUserId = clean.userId;
          return clean;
        }),
        deletedRecordIds,
      };

      this.lastSyncedAt = Date.now();
      this.lastError = null;
      return snapshot;
    } catch (err: any) {
      this.lastError = err?.message || 'Firestore pull failed';
      throw err;
      } finally {
        this.syncing = false;
        this.emit();
      }
    });
  }

  public pushDatabase(database: any): Promise<boolean> {
    return this.runSerialized(async () => {
      const uid = this.getVerifiedOwnerUid();
      if (!uid || !database) return false;
      const email = (this.currentUser?.email || firebaseAuth.currentUser?.email || OWNER_ADMIN_EMAIL).toLowerCase();

      this.syncing = true;
      this.emit();

      try {
      await this.ensureAdminDoc(uid, email);

      // 1. Deleted tombstones first (and prune deleted docs from cloud)
      const deletedMap: Record<string, number> = database.deletedRecordIds || {};
      for (const [recId, ts] of Object.entries(deletedMap)) {
        if (!recId) continue;
        const safeDelId = toSafeDocId('del_', recId);
        await this.upsertDoc('deletedRecords', safeDelId, {
          ownerUid: uid,
          recordId: clampStr(recId, 128),
          deletedAtMs: clampNum(ts, Date.now()),
        });
      }

      // 2. App Settings
      const gs = database.globalSettings;
      if (gs && typeof gs === 'object') {
        const settingsDoc: Record<string, any> = {
          ownerUid: uid,
          appName: clampStr(gs.appName || 'ZF Accounting', 120),
          companyName: clampStr(gs.companyName || 'ZARA Enterprises Ltd.', 160),
          version: clampStr(gs.version || 'v4.0 Enterprise', 40),
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
        settingsDoc.dataUpdatedAt = clampNum(gs.dataUpdatedAt || database.savedAt || gs.updatedAt, Date.now());
        this.lastPushedSettingsAt = Math.max(this.lastPushedSettingsAt, settingsDoc.clientUpdatedAt);
        await this.upsertDoc('appSettings', 'global', settingsDoc);

        // Bazar Buyers
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
          await this.upsertDoc('bazarBuyers', docId, buyerDoc);
        }
        for (const [recId] of Object.entries(deletedMap)) {
          if (recId.startsWith('buyer:')) {
            const rawBuyerId = recId.slice('buyer:'.length);
            const docId = toSafeDocId('buyer_', rawBuyerId);
            if (!activeBuyerIds.has(docId)) {
              await this.removeDoc('bazarBuyers', docId);
            }
          }
        }
      }

      // 3. Users
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
        if (u.isCommissionOnly !== undefined) userDoc.isCommissionOnly = Boolean(u.isCommissionOnly);
        if (u.isCommissionBazarOnly !== undefined) userDoc.isCommissionBazarOnly = Boolean(u.isCommissionBazarOnly);
        if (u.theme) userDoc.theme = clampStr(u.theme, 40);
        if (u.displayMode === 'light' || u.displayMode === 'dark') userDoc.displayMode = u.displayMode;
        if (u.language === 'bn' || u.language === 'en') userDoc.language = u.language;
        if (u.useBanglaNumerals !== undefined) userDoc.useBanglaNumerals = Boolean(u.useBanglaNumerals);
        if (u.headerBgColor) userDoc.headerBgColor = clampStr(u.headerBgColor, 40);
        if (u.sidebarBgColor) userDoc.sidebarBgColor = clampStr(u.sidebarBgColor, 40);
        if (u.photoUrl) userDoc.photoUrl = clampStr(u.photoUrl, 512);
        await this.upsertDoc('users', docId, userDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('usr_') && !activeUserIds.has(recId)) {
          await this.removeDoc('users', toSafeDocId('', recId));
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
        await this.upsertDoc('transactions', docId, txDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if ((recId.startsWith('tx_') || recId.startsWith('tx-')) && !activeTxIds.has(toSafeDocId('', recId))) {
          await this.removeDoc('transactions', toSafeDocId('', recId));
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
        await this.upsertDoc('customers', docId, custDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('cust') && !activeCustIds.has(toSafeDocId('', recId))) {
          await this.removeDoc('customers', toSafeDocId('', recId));
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
        await this.upsertDoc('invoices', docId, invDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('inv') && !activeInvIds.has(toSafeDocId('', recId))) {
          await this.removeDoc('invoices', toSafeDocId('', recId));
        }
      }

      // 7. Commission Entries (exclude auto-synced 0-commission customer invoices)
      const activeCommIds = new Set<string>();
      for (const ce of database.commissionEntries || []) {
        if (!ce?.id) continue;
        const ceId = String(ce.id || '');
        const ceNotes = String(ce.notes || '');
        const isAutoSyncedZero =
          (ceId.startsWith('comm-inv-') || ceNotes === 'Auto-synced from Daily Invoices') &&
          (Number(ce.commissionAmount) || 0) === 0 &&
          (Number(ce.ratePerUnit) || 0) === 0 &&
          !ce.isClawback &&
          ce.invoiceStatus !== 'Cancelled';
        if (isAutoSyncedZero) continue;
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
        await this.upsertDoc('commissionEntries', docId, ceDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if ((recId.startsWith('comm_') || recId.startsWith('comm-')) && !activeCommIds.has(toSafeDocId('', recId))) {
          await this.removeDoc('commissionEntries', toSafeDocId('', recId));
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
        await this.upsertDoc('commissionPersons', docId, cpDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('person_') && !activePersonIds.has(toSafeDocId('', recId))) {
          await this.removeDoc('commissionPersons', toSafeDocId('', recId));
        }
      }

      // 9. Commission Months
      const activeMonths = new Set<string>();
      for (const m of database.commissionMonths || []) {
        if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) {
          activeMonths.add(m);
          await this.upsertDoc('commissionMonths', toSafeDocId('month_', m), {
            ownerUid: uid,
            month: m,
          });
        }
      }
      const deletedMonthsMap: Record<string, number> = database.deletedCommissionMonths || {};
      for (const [ym] of Object.entries(deletedMonthsMap)) {
        if (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym) && !activeMonths.has(ym)) {
          await this.removeDoc('commissionMonths', toSafeDocId('month_', ym));
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
        await this.upsertDoc('homeBazarEntries', docId, hbDoc);
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (
          (recId.startsWith('hb-') || recId.startsWith('hb_') || recId.startsWith('bazar_') || recId.startsWith('bz-')) &&
          !activeBazarIds.has(toSafeDocId('', recId))
        ) {
          await this.removeDoc('homeBazarEntries', toSafeDocId('', recId));
        }
      }

      this.lastSyncedAt = Date.now();
      this.lastError = null;
      return true;
    } catch (err: any) {
      this.lastError = err?.message || 'Firestore push failed';
      throw err;
      } finally {
        this.syncing = false;
        this.emit();
      }
    });
  }
}

export const firestoreSyncService = new FirestoreSyncService();
