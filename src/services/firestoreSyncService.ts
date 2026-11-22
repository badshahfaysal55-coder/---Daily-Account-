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
  updateDoc,
  deleteDoc,
  deleteField,
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

  public subscribeToBazarBuyers(
    onBuyersUpdate: (buyers: any[]) => void
  ): () => void {
    const u = this.currentUser || firebaseAuth.currentUser;
    if (!u || !u.emailVerified) return () => {};
    const ownerUid = this.getVerifiedOwnerUid();
    const emailLower = (u.email || '').trim().toLowerCase();
    const q = ownerUid
      ? query(collection(firestoreDb, 'bazarBuyers'), where('ownerUid', '==', ownerUid))
      : emailLower
        ? query(collection(firestoreDb, 'bazarBuyers'), where('delegateEmails', 'array-contains', emailLower))
        : null;
    if (!q) return () => {};

    let firstSnapshot = true;
    return onSnapshot(
      q,
      (snap) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          if (snap.empty) return;
        }
        const buyers = snap.docs.map((d) => {
          const data = { ...d.data() } as any;
          delete data.ownerUid;
          delete data.createdAt;
          delete data.updatedAt;
          delete data.delegateEmails;
          const cUpdated = typeof data.clientUpdatedAt === 'number' ? data.clientUpdatedAt : undefined;
          delete data.clientUpdatedAt;
          if (cUpdated !== undefined) data.updatedAt = cUpdated;
          return data;
        });
        try {
          onBuyersUpdate(buyers);
        } catch {}
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.LIST, 'bazarBuyers');
        }
      }
    );
  }

  public subscribeToUsers(
    onUsersUpdate: (users: any[]) => void
  ): () => void {
    const uid = this.getVerifiedOwnerUid();
    if (!uid) return () => {};
    const q = query(collection(firestoreDb, 'users'), where('ownerUid', '==', uid));
    let firstSnapshot = true;

    return onSnapshot(
      q,
      (snap) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }
        if (this.syncing) return;
        const users = snap.docs.map((d) => {
          const data = { ...d.data() } as any;
          const cCreated = typeof data.clientCreatedAt === 'number' ? data.clientCreatedAt : undefined;
          const cUpdated = typeof data.clientUpdatedAt === 'number' ? data.clientUpdatedAt : undefined;
          delete data.ownerUid;
          delete data.createdAt;
          delete data.updatedAt;
          delete data.clientCreatedAt;
          delete data.clientUpdatedAt;
          if (cCreated !== undefined) data.createdAt = cCreated;
          if (cUpdated !== undefined) data.updatedAt = cUpdated;
          return data;
        });
        try {
          onUsersUpdate(users);
        } catch {}
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      }
    );
  }

  public subscribeToDelegatePermission(
    onDelegateUpdate: (perm: { canManageBazarBuyers: boolean; canManageBazar?: boolean; ownerUid?: string } | null) => void
  ): () => void {
    const u = this.currentUser || firebaseAuth.currentUser;
    const emailLower = (u?.email || '').trim().toLowerCase();
    if (!u || !u.emailVerified || !emailLower) return () => {};
    const path = `bazarBuyerDelegates/${emailLower}`;
    const ref = doc(firestoreDb, 'bazarBuyerDelegates', emailLower);

    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onDelegateUpdate(null);
          return;
        }
        const data = snap.data() as any;
        onDelegateUpdate({
          canManageBazarBuyers: Boolean(data?.canManageBazarBuyers),
          canManageBazar: data?.canManageBazar !== undefined ? Boolean(data.canManageBazar) : undefined,
          ownerUid: data?.ownerUid,
        });
      },
      (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      }
    );
  }

  public async upsertBazarBuyer(buyer: {
    buyerId: string;
    name: string;
    phone?: string;
    role?: string;
    amount?: number;
    notes?: string;
    photoUrl?: string;
    delegateEmails?: string[];
    updatedAt?: number;
  }): Promise<boolean> {
    const u = this.currentUser || firebaseAuth.currentUser;
    if (!u || !u.emailVerified || !buyer?.buyerId) return false;
    let resolvedOwnerUid = this.getVerifiedOwnerUid();
    if (!resolvedOwnerUid && u.email) {
      try {
        const delSnap = await getDoc(doc(firestoreDb, 'bazarBuyerDelegates', u.email.trim().toLowerCase()));
        if (delSnap.exists() && delSnap.data()?.canManageBazarBuyers === true) {
          resolvedOwnerUid = delSnap.data()?.ownerUid || null;
        }
      } catch {
        return false;
      }
    }
    if (!resolvedOwnerUid) return false;

    const docId = toSafeDocId('buyer_', buyer.buyerId);
    const buyerDoc: Record<string, any> = {
      ownerUid: resolvedOwnerUid,
      buyerId: clampStr(buyer.buyerId, 80),
      name: clampStr(buyer.name || buyer.buyerId, 120),
      clientUpdatedAt: clampNum(buyer.updatedAt, Date.now()),
    };
    if (buyer.phone) buyerDoc.phone = clampStr(buyer.phone, 40);
    if (buyer.role) buyerDoc.role = clampStr(buyer.role, 40);
    if (typeof buyer.amount === 'number' && Number.isFinite(buyer.amount)) buyerDoc.amount = buyer.amount;
    if (buyer.notes) buyerDoc.notes = clampStr(buyer.notes, 1000);
    if (buyer.photoUrl) buyerDoc.photoUrl = clampStr(buyer.photoUrl, 512);

    const emailSet = new Set<string>(
      Array.isArray(buyer.delegateEmails)
        ? buyer.delegateEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
        : []
    );
    if (emailSet.size === 0) {
      try {
        const existingSnap = await getDoc(doc(firestoreDb, 'bazarBuyers', docId));
        if (existingSnap.exists()) {
          const existingList = existingSnap.data()?.delegateEmails;
          if (Array.isArray(existingList)) {
            existingList.forEach((e: unknown) => {
              if (typeof e === 'string' && e.trim()) emailSet.add(e.trim().toLowerCase());
            });
          }
        }
      } catch {}
    }
    if (!this.getVerifiedOwnerUid() && u.email) {
      emailSet.add(u.email.trim().toLowerCase());
    }
    if (emailSet.size > 0) {
      buyerDoc.delegateEmails = Array.from(emailSet).slice(0, 50);
    }

    await this.upsertDoc('bazarBuyers', docId, buyerDoc);
    return true;
  }

  public async deleteBazarBuyerById(buyerId: string): Promise<boolean> {
    const u = this.currentUser || firebaseAuth.currentUser;
    if (!u || !u.emailVerified || !buyerId) return false;
    let authorized = Boolean(this.getVerifiedOwnerUid());
    if (!authorized && u.email) {
      try {
        const delSnap = await getDoc(doc(firestoreDb, 'bazarBuyerDelegates', u.email.trim().toLowerCase()));
        authorized = Boolean(delSnap.exists() && delSnap.data()?.canManageBazarBuyers === true);
      } catch {
        return false;
      }
    }
    if (!authorized) return false;

    const docId = toSafeDocId('buyer_', buyerId);
    const key = `bazarBuyers/${docId}`;
    try {
      await deleteDoc(doc(firestoreDb, 'bazarBuyers', docId));
      this.createdAtCache.delete(key);
      this.syncedSignatureCache.delete(key);
      const colSet = this.cloudDocIdsByCollection.get('bazarBuyers');
      if (colSet) colSet.delete(docId);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(err, OperationType.DELETE, key);
      }
      return false;
    }
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
          const serverData = serverSnap?.data();
          const serverCreatedAt = serverData?.createdAt;
          if (serverSnap?.exists()) {
            const nextCreatedAt = serverCreatedAt instanceof Timestamp ? serverCreatedAt : serverTimestamp();
            if (serverCreatedAt instanceof Timestamp) {
              this.createdAtCache.set(key, serverCreatedAt);
            } else {
              this.createdAtCache.delete(key);
            }
            try {
              await setDoc(ref, {
                ...payloadWithoutTimestamps,
                createdAt: nextCreatedAt,
                updatedAt: serverTimestamp(),
              });
            } catch (secondUpdateErr) {
              if (serverCreatedAt instanceof Timestamp) {
                const patchPayload: Record<string, any> = {
                  ...payloadWithoutTimestamps,
                  updatedAt: serverTimestamp(),
                };
                if (serverData && typeof serverData === 'object') {
                  for (const existingKey of Object.keys(serverData)) {
                    if (
                      existingKey !== 'createdAt' &&
                      existingKey !== 'updatedAt' &&
                      !(existingKey in payloadWithoutTimestamps)
                    ) {
                      patchPayload[existingKey] = deleteField();
                    }
                  }
                }
                await updateDoc(ref, patchPayload);
              } else {
                throw secondUpdateErr;
              }
            }
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
          const retryData = retrySnap?.data();
          const retryCreatedAt = retryData?.createdAt;
          if (retrySnap?.exists()) {
            existsInCloud = true;
            if (retryCreatedAt instanceof Timestamp) {
              existingCreatedAt = retryCreatedAt;
              this.createdAtCache.set(key, retryCreatedAt);
              try {
                await setDoc(ref, {
                  ...payloadWithoutTimestamps,
                  createdAt: retryCreatedAt,
                  updatedAt: serverTimestamp(),
                });
              } catch {
                const patchPayload: Record<string, any> = {
                  ...payloadWithoutTimestamps,
                  updatedAt: serverTimestamp(),
                };
                if (retryData && typeof retryData === 'object') {
                  for (const existingKey of Object.keys(retryData)) {
                    if (
                      existingKey !== 'createdAt' &&
                      existingKey !== 'updatedAt' &&
                      !(existingKey in payloadWithoutTimestamps)
                    ) {
                      patchPayload[existingKey] = deleteField();
                    }
                  }
                }
                await updateDoc(ref, patchPayload);
              }
            } else {
              await setDoc(ref, {
                ...payloadWithoutTimestamps,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } else {
            throw createErr;
          }
        }
      }
      this.syncedSignatureCache.set(key, signature);
      const colSet = this.cloudDocIdsByCollection.get(colName);
      if (colSet) colSet.add(docId);
    } catch (err) {
      let diagSummary = '';
      try {
        const diagSnap = await getDocFromServer(ref).catch(() => null);
        const diagData = diagSnap?.data();
        const diagKeys = diagData && typeof diagData === 'object' ? Object.keys(diagData) : [];
        const payloadKeys = Object.keys(payloadWithoutTimestamps);
        const curUid = this.currentUser?.uid || firebaseAuth.currentUser?.uid;
        const diagObj: Record<string, unknown> = {
          path: key,
          existsInCloud,
          hasCachedCreatedAt: Boolean(existingCreatedAt),
          serverExists: Boolean(diagSnap?.exists()),
          serverCreatedAtIsTs: diagData?.createdAt instanceof Timestamp,
          serverHasOwnerUid: Boolean(diagData && 'ownerUid' in diagData),
          serverOwnerUidMatches: diagData?.ownerUid === curUid,
          serverHasId: Boolean(diagData && 'id' in diagData),
          serverIdMatches: diagData?.id === docId,
          serverRole: typeof diagData?.role === 'string' ? diagData.role : typeof diagData?.role,
          addedKeys: payloadKeys.filter((k) => !diagKeys.includes(k)),
          removedKeys: diagKeys.filter((k) => k !== 'createdAt' && k !== 'updatedAt' && !payloadKeys.includes(k)),
        };
        if (colName === 'users') {
          const requiredUserKeys = [
            'ownerUid', 'id', 'username', 'name', 'passwordHash', 'role', 'workspaceName',
            'status', 'canExport', 'canDelete', 'clientCreatedAt', 'clientUpdatedAt',
          ];
          const allowedUserKeys = new Set([
            'ownerUid', 'id', 'username', 'email', 'appleId', 'idProvider', 'name', 'passwordHash',
            'role', 'workspaceName', 'status', 'canExport', 'canDelete', 'canAddTransactions',
            'canViewLedger', 'canEditCustomers', 'canDeleteCustomers', 'canApproveInvoices',
            'canChangeProfilePhoto', 'canManageCommissions', 'canAddCommissionRecords',
            'canEditCommissionRecords', 'canDeleteCommissionRecords', 'canPayCommissions',
            'canImportCommissions', 'canManageCommissionMonths', 'canAddCommissionPersons',
            'canEditCommissionPersons', 'canDeleteCommissionPersons', 'canMergeCommissionPersons',
            'canChangeCommissionPersonPhoto', 'canManageBazar', 'canManageBuyers',
            'canManageBazarBuyers', 'isCommissionOnly', 'isCommissionBazarOnly', 'theme',
            'displayMode', 'language', 'useBanglaNumerals', 'headerBgColor', 'sidebarBgColor',
            'photoUrl', 'clientCreatedAt', 'clientUpdatedAt',
          ]);
          const boolFields = [
            'canExport', 'canDelete', 'canAddTransactions', 'canViewLedger', 'canEditCustomers',
            'canDeleteCustomers', 'canApproveInvoices', 'canChangeProfilePhoto',
            'canManageCommissions', 'canAddCommissionRecords', 'canEditCommissionRecords',
            'canDeleteCommissionRecords', 'canPayCommissions', 'canImportCommissions',
            'canManageCommissionMonths', 'canAddCommissionPersons', 'canEditCommissionPersons',
            'canDeleteCommissionPersons', 'canMergeCommissionPersons',
            'canChangeCommissionPersonPhoto', 'canManageBazar', 'canManageBuyers',
            'canManageBazarBuyers', 'isCommissionOnly', 'isCommissionBazarOnly', 'useBanglaNumerals',
          ];
          const failedUserChecks: string[] = [];
          const missingReq = requiredUserKeys.filter((k) => !(k in payloadWithoutTimestamps));
          if (missingReq.length) failedUserChecks.push(`missingReq:${missingReq.join(',')}`);
          const extraKeys = payloadKeys.filter((k) => !allowedUserKeys.has(k));
          if (extraKeys.length) failedUserChecks.push(`extraKeys:${extraKeys.join(',')}`);
          for (const bf of boolFields) {
            if (bf in payloadWithoutTimestamps && typeof payloadWithoutTimestamps[bf] !== 'boolean') {
              failedUserChecks.push(`notBool:${bf}:${typeof payloadWithoutTimestamps[bf]}`);
            }
          }
          if (typeof payloadWithoutTimestamps.clientCreatedAt !== 'number' || !Number.isFinite(payloadWithoutTimestamps.clientCreatedAt)) {
            failedUserChecks.push('badClientCreatedAt');
          }
          if (typeof payloadWithoutTimestamps.clientUpdatedAt !== 'number' || !Number.isFinite(payloadWithoutTimestamps.clientUpdatedAt)) {
            failedUserChecks.push('badClientUpdatedAt');
          }
          if ('displayMode' in payloadWithoutTimestamps && !['light', 'dark'].includes(String(payloadWithoutTimestamps.displayMode))) {
            failedUserChecks.push(`badDisplayMode:${String(payloadWithoutTimestamps.displayMode)}`);
          }
          if ('language' in payloadWithoutTimestamps && !['bn', 'en'].includes(String(payloadWithoutTimestamps.language))) {
            failedUserChecks.push(`badLanguage:${String(payloadWithoutTimestamps.language)}`);
          }
          if ('idProvider' in payloadWithoutTimestamps && !['email', 'apple'].includes(String(payloadWithoutTimestamps.idProvider))) {
            failedUserChecks.push(`badIdProvider:${String(payloadWithoutTimestamps.idProvider)}`);
          }
          if ('theme' in payloadWithoutTimestamps && (typeof payloadWithoutTimestamps.theme !== 'string' || payloadWithoutTimestamps.theme.length > 40)) {
            failedUserChecks.push('badTheme');
          }
          if ('headerBgColor' in payloadWithoutTimestamps && (typeof payloadWithoutTimestamps.headerBgColor !== 'string' || payloadWithoutTimestamps.headerBgColor.length > 40)) {
            failedUserChecks.push('badHeaderBgColor');
          }
          if ('sidebarBgColor' in payloadWithoutTimestamps && (typeof payloadWithoutTimestamps.sidebarBgColor !== 'string' || payloadWithoutTimestamps.sidebarBgColor.length > 40)) {
            failedUserChecks.push('badSidebarBgColor');
          }
          diagObj.userChecks = {
            ownerUidMatch: payloadWithoutTimestamps.ownerUid === curUid,
            idValid: /^[a-zA-Z0-9_-]{1,128}$/.test(String(payloadWithoutTimestamps.id || '')),
            usernameLen: String(payloadWithoutTimestamps.username || '').length,
            nameLen: String(payloadWithoutTimestamps.name || '').length,
            pwLen: String(payloadWithoutTimestamps.passwordHash || '').length,
            role: payloadWithoutTimestamps.role,
            status: payloadWithoutTimestamps.status,
            wsLen: String(payloadWithoutTimestamps.workspaceName || '').length,
            hasEmail: 'email' in payloadWithoutTimestamps,
            hasPhotoUrl: 'photoUrl' in payloadWithoutTimestamps,
            photoUrlLen: typeof payloadWithoutTimestamps.photoUrl === 'string' ? payloadWithoutTimestamps.photoUrl.length : -1,
            failedUserChecks,
            payloadKeyCount: payloadKeys.length,
            diagKeyCount: diagKeys.length,
          };
        }
        diagSummary = ` | diag=${JSON.stringify(diagObj)}`;
      } catch {}
      const baseMsg = err instanceof Error ? err.message : String(err);
      handleFirestoreError(
        new Error(`${baseMsg}${diagSummary}`),
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

        // Compute active Bazar Buyer delegate emails from user list
        const buyerDelegateEmails: string[] = [];
        for (const u of database.users || []) {
          if (!u || u.status === 'disabled') continue;
          const isDelegate = u.role === 'owner' || u.canManageBazarBuyers === true;
          if (!isDelegate) continue;
          const uMail = String(u.email || (String(u.username || '').includes('@') ? u.username : '')).trim().toLowerCase();
          if (uMail && uMail.includes('@') && !buyerDelegateEmails.includes(uMail)) {
            buyerDelegateEmails.push(uMail);
          }
        }

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
          if (buyerDelegateEmails.length > 0) {
            buyerDoc.delegateEmails = buyerDelegateEmails.slice(0, 50);
          }
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

      // 3. Users & Bazar Buyer Delegates
      const activeUserIds = new Set<string>();
      const activeDelegateEmails = new Set<string>();
      for (const u of database.users || []) {
        if (!u?.id || !u?.username || !u?.passwordHash) continue;
        const docId = toSafeDocId('', u.id);
        const safeUsername = clampStr(u.username, 64).trim();
        const safePasswordHash = clampStr(u.passwordHash, 256);
        if (safeUsername.length < 2 || safePasswordHash.length < 16) continue;
        activeUserIds.add(docId);
        const userDoc: Record<string, any> = {
          ownerUid: uid,
          id: docId,
          username: safeUsername,
          name: clampStr(u.name || safeUsername, 120) || safeUsername,
          passwordHash: safePasswordHash,
          role: ['owner', 'admin', 'manager', 'staff', 'viewer'].includes(u.role) ? u.role : 'staff',
          workspaceName: clampStr(u.workspaceName || `${u.name || safeUsername}'s Workspace`, 120),
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
        await this.upsertDoc('users', docId, userDoc);

        const rawMail = String(u.email || (String(u.username || '').includes('@') ? u.username : '')).trim().toLowerCase();
        if (rawMail && rawMail.length >= 3 && rawMail.includes('@')) {
          const canManageBazarBuyersFlag = u.role === 'owner' ? true : u.status !== 'disabled' && u.canManageBazarBuyers === true;
          activeDelegateEmails.add(rawMail);
          await this.upsertDoc('bazarBuyerDelegates', rawMail, {
            ownerUid: uid,
            email: clampStr(rawMail, 254),
            userId: docId,
            canManageBazarBuyers: canManageBazarBuyersFlag,
            canManageBazar: u.status !== 'disabled' && u.canManageBazar !== false,
            clientUpdatedAt: clampNum(u.updatedAt || u.createdAt, Date.now()),
          });
        }
      }
      for (const [recId] of Object.entries(deletedMap)) {
        if (recId.startsWith('usr_') && !activeUserIds.has(recId)) {
          await this.removeDoc('users', toSafeDocId('', recId));
        }
      }
      const existingDelegateSet = this.cloudDocIdsByCollection.get('bazarBuyerDelegates');
      if (existingDelegateSet) {
        for (const existingEmail of Array.from(existingDelegateSet)) {
          if (!activeDelegateEmails.has(existingEmail)) {
            await this.removeDoc('bazarBuyerDelegates', existingEmail);
          }
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
