import { Capacitor } from '@capacitor/core';
import { Transaction, UserAccount, GlobalAppSettings, Customer, Invoice, InvoicePayment, CustomerStatement, CommissionEntry, CommissionPersonAccount, CommissionStatementSummary, HomeBazarEntry, HomeBazarSummary, BazarBuyer, AppVersionInfo } from '../types/accounting';
import { VaultStorage, PersistentVaultSnapshot } from './vaultStorage';
import { googleDriveService } from './googleDriveService';
import { firebaseAuth, firestoreSyncService } from './firestoreSyncService';

const TOKEN_KEY = 'zara_auth_token_v1';
const CACHED_USER_KEY = 'zara_cached_user_v1';
const CROSS_TAB_STORAGE_KEY = 'zara_cross_tab_sync_v1';
const NATIVE_DEFAULT_API_BASE = 'https://ais-pre-otwyikgrhfjkomxcdz7g2q-73319294110.europe-west2.run.app';

export function resolveApiUrl(endpoint: string): string {
  if (!endpoint.startsWith('/')) return endpoint;
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    const customBase = (() => {
      try {
        return localStorage.getItem('zara_api_base_url') || '';
      } catch {
        return '';
      }
    })();
    const envBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
    const base = (customBase || envBase || NATIVE_DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}${endpoint}`;
  }
  return endpoint;
}
let vaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncingVaultNow = false;

type SyncEventListener = (event: string, data: any) => void;
const SSE_EVENT_NAMES = [
  'connected',
  'app_update_available',
  // Transactions
  'transaction_created',
  'transaction_updated',
  'transaction_deleted',
  // Customers
  'customer_created',
  'customer_updated',
  'customer_deleted',
  // Invoices
  'invoice_created',
  'invoice_updated',
  'invoice_deleted',
  'invoice_payment_recorded',
  // Commissions
  'commission_added',
  'commission_updated',
  'commission_deleted',
  'commissions_batch_updated',
  'commissions_payout_processed',
  'commission_person_updated',
  'commission_person_deleted',
  'commission_month_updated',
  // Daily Home Bazar
  'home_bazar_added',
  'home_bazar_updated',
  'home_bazar_deleted',
  'home_bazar_budget_updated',
  'bazar_buyers_updated',
  // Users & Settings
  'user_created',
  'user_updated',
  'user_deleted',
  'global_settings_updated',
  'cloud_sync_pulse',
  'database_restored',
];

const sseListeners = new Set<SyncEventListener>();
let sharedEventSource: EventSource | null = null;
let sharedEventToken: string | null = null;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let crossTabBound = false;

function applySseDeletionToVault(eventName: string, data: any) {
  if (!data || typeof data !== 'object') return;
  try {
    if (eventName === 'transaction_deleted' && data.transactionId) {
      VaultStorage.recordDeletion(data.transactionId).catch(() => {});
    } else if (eventName === 'customer_deleted' && data.customerId) {
      VaultStorage.recordDeletion(data.customerId).catch(() => {});
    } else if (eventName === 'invoice_deleted' && data.invoiceId) {
      VaultStorage.recordDeletion(data.invoiceId).catch(() => {});
    } else if (eventName === 'commission_deleted' && data.id) {
      VaultStorage.recordDeletion(data.id).catch(() => {});
    } else if (eventName === 'commission_person_deleted') {
      if (data.id === 'ALL' && Array.isArray(data.deletedIds)) {
        VaultStorage.recordDeletions(data.deletedIds).catch(() => {});
      } else if (data.id) {
        VaultStorage.recordDeletion(data.id).catch(() => {});
      }
    } else if (eventName === 'home_bazar_deleted' && data.id) {
      VaultStorage.recordDeletion(data.id).catch(() => {});
    } else if ((eventName === 'user_updated' && data.type === 'deleted' && data.userId) || (eventName === 'user_deleted' && data.userId)) {
      VaultStorage.recordDeletion(data.userId).catch(() => {});
    } else if (eventName === 'commission_month_updated' && data.deletedMonth) {
      VaultStorage.recordDeletedMonth(data.deletedMonth).catch(() => {});
    }
  } catch {
    // non-fatal
  }
}

function dispatchToListeners(eventName: string, data: any) {
  applySseDeletionToVault(eventName, data);
  sseListeners.forEach((cb) => {
    try {
      cb(eventName, data);
    } catch {
      // keep dispatching to remaining listeners
    }
  });
}

function broadcastCrossTab(eventName: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!broadcastChannel) {
        broadcastChannel = new BroadcastChannel('zara_realtime_sync');
      }
      broadcastChannel.postMessage({ event: eventName, data, at: Date.now() });
      return;
    }
  } catch {
    // fallback to storage event
  }
  try {
    localStorage.setItem(CROSS_TAB_STORAGE_KEY, JSON.stringify({ event: eventName, data, at: Date.now() }));
  } catch {}
}

function ensureCrossTabListeners() {
  if (typeof window === 'undefined' || crossTabBound) return;
  crossTabBound = true;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!broadcastChannel) {
        broadcastChannel = new BroadcastChannel('zara_realtime_sync');
      }
      broadcastChannel.addEventListener('message', (msg) => {
        const payload = msg?.data;
        if (payload?.event) {
          dispatchToListeners(payload.event, payload.data ?? {});
        }
      });
    }
  } catch {}

  window.addEventListener('storage', (e) => {
    if (e.key === CROSS_TAB_STORAGE_KEY && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue);
        if (payload?.event) {
          dispatchToListeners(payload.event, payload.data ?? {});
        }
      } catch {}
    }
  });

  window.addEventListener('online', () => {
    if (sseListeners.size > 0) {
      ensureSharedEventSource(true);
    }
  });
}

function teardownSharedEventSource() {
  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }
  if (sharedEventSource) {
    sharedEventSource.close();
    sharedEventSource = null;
  }
  sharedEventToken = null;
}

function ensureSharedEventSource(forceRestart = false) {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  ensureCrossTabListeners();

  const currentToken = localStorage.getItem(TOKEN_KEY) || '';
  if (!forceRestart && sharedEventSource && sharedEventToken === currentToken && sharedEventSource.readyState !== EventSource.CLOSED) {
    return;
  }

  teardownSharedEventSource();
  sharedEventToken = currentToken;

  const sseUrl = resolveApiUrl(`/api/sync/events${currentToken ? `?token=${encodeURIComponent(currentToken)}` : ''}`);
  const es = new EventSource(sseUrl);
  sharedEventSource = es;

  SSE_EVENT_NAMES.forEach((name) => {
    es.addEventListener(name, (event: Event) => {
      const msgEvent = event as MessageEvent;
      let parsed: any = {};
      try {
        parsed = msgEvent.data ? JSON.parse(msgEvent.data) : {};
      } catch {
        parsed = {};
      }
      dispatchToListeners(name, parsed);
    });
  });

  es.onerror = () => {
    if (sharedEventSource !== es) return;
    if (es.readyState === EventSource.CLOSED || navigator.onLine) {
      teardownSharedEventSource();
      if (sseListeners.size > 0 && !sseReconnectTimer) {
        sseReconnectTimer = setTimeout(() => {
          sseReconnectTimer = null;
          if (sseListeners.size > 0) {
            ensureSharedEventSource(true);
          }
        }, 2500);
      }
    }
  };
}

let isPageUnloading = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    isPageUnloading = true;
  });
  window.addEventListener('pagehide', () => {
    isPageUnloading = true;
  });
  window.addEventListener('pageshow', () => {
    isPageUnloading = false;
  });
}

export function isTransientFetchError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('the internet connection appears to be offline') ||
    msg.includes('aborted') ||
    err?.name === 'AbortError'
  );
}

export function isAppUnloading(): boolean {
  return isPageUnloading || Boolean(typeof window !== 'undefined' && (window as any).__zaraPageUnloading);
}

const delayMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const ApiService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    const prev = localStorage.getItem(TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, token);
    if (prev !== token && sseListeners.size > 0) {
      ensureSharedEventSource(true);
    }
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CACHED_USER_KEY);
    if (sseListeners.size > 0) {
      ensureSharedEventSource(true);
    }
  },

  getCachedUser(): UserAccount | null {
    try {
      const data = localStorage.getItem(CACHED_USER_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  },

  setCachedUser(user: UserAccount) {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  },

  async ensureSession(): Promise<{ user: UserAccount; token: string }> {
    const existingToken = this.getToken();
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(resolveApiUrl('/api/auth/session'), {
          cache: 'no-store',
          headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            this.setToken(data.token);
            if (data.user) this.setCachedUser(data.user);
            return data;
          }
        }
        break;
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && isTransientFetchError(err) && !isAppUnloading()) {
          await delayMs(300);
          continue;
        }
        break;
      }
    }
    throw lastErr || new Error('Unable to initialize session');
  },

  async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    let token = this.getToken();
    if (!token && endpoint !== '/api/auth/login' && endpoint !== '/api/auth/session') {
      try {
        const session = await this.ensureSession();
        token = session.token;
      } catch {
        // fallback
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const method = (options.method || 'GET').toUpperCase();
    const maxAttempts = method === 'GET' && !isRetry ? 3 : 1;
    let response: Response | null = null;
    let lastFetchErr: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        response = await fetch(resolveApiUrl(endpoint), {
          cache: 'no-store',
          ...options,
          headers,
        });
        lastFetchErr = null;
        break;
      } catch (err) {
        lastFetchErr = err;
        if (attempt < maxAttempts - 1 && isTransientFetchError(err) && !isAppUnloading()) {
          await delayMs(attempt === 0 ? 350 : 750);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastFetchErr || new Error('Network request failed');
    }

    // Auto-save refreshed or auto-issued token from server response header
    const returnedToken = response.headers.get('x-auth-token');
    if (returnedToken && returnedToken !== token) {
      this.setToken(returnedToken);
    }

    // Auto-retry once on 401 Unauthorized by re-syncing session (unless account was explicitly removed)
    if (response.status === 401 && !isRetry && endpoint !== '/api/auth/login') {
      let accountRemoved = false;
      try {
        const errClone = await response.clone().json();
        accountRemoved = Boolean(errClone?.accountRemoved);
      } catch {
        // ignore
      }
      if (accountRemoved) {
        this.clearToken();
        throw new Error('Your session ended because this account was removed or changed by the Owner.');
      }
      try {
        const fresh = await this.ensureSession();
        if (fresh?.token) {
          return this.request<T>(endpoint, options, true);
        }
      } catch {
        // proceed to throw error
      }
    }

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (
      method !== 'GET' &&
      !endpoint.startsWith('/api/auth/') &&
      endpoint !== '/api/draft' &&
      endpoint !== '/api/sync/recover-if-empty'
    ) {
      this.scheduleVaultSync();
      broadcastCrossTab('database_restored', { endpoint, timestamp: Date.now() });
    }
    return data as T;
  },

  scheduleVaultSync() {
    if (vaultSyncTimer) clearTimeout(vaultSyncTimer);
    vaultSyncTimer = setTimeout(() => {
      this.syncVaultNow().catch(() => {});
    }, 400);
  },

  async syncVaultNow(): Promise<void> {
    if (isSyncingVaultNow) return;
    isSyncingVaultNow = true;
    try {
      const existingVault = await VaultStorage.loadVault().catch(() => null);
      const mergeCollectionSafe = (
        existingArr: any[] | undefined,
        serverArr: any[] | undefined,
        deletedMap: Record<string, number>
      ): { merged: any[]; vaultHadMissingOnServer: boolean } => {
        const byId = new Map<string, any>();
        const serverIds = new Set<string>();
        let vaultHadMissingOnServer = false;

        (serverArr || []).forEach((item) => {
          if (item?.id) {
            serverIds.add(item.id);
            byId.set(item.id, item);
          }
        });

        (existingArr || []).forEach((oldItem) => {
          if (!oldItem?.id) return;
          const delTs = deletedMap[oldItem.id] || 0;
          const oldTs = Number(oldItem.updatedAt) || Number(oldItem.createdAt) || Number(oldItem.timestamp) || 0;
          if (delTs && oldTs <= delTs) return; // Explicitly deleted

          const srvItem = byId.get(oldItem.id);
          if (!srvItem) {
            byId.set(oldItem.id, oldItem);
            vaultHadMissingOnServer = true;
          } else {
            const srvTs = Number(srvItem.updatedAt) || Number(srvItem.createdAt) || Number(srvItem.timestamp) || 0;
            if (oldTs > srvTs) {
              byId.set(oldItem.id, { ...srvItem, ...oldItem, photoData: oldItem.photoData || srvItem.photoData });
              vaultHadMissingOnServer = true;
            }
          }
        });

        return { merged: Array.from(byId.values()), vaultHadMissingOnServer };
      };

      const isAutoSyncedCustomerInvoice = (entry: any): boolean => {
        if (!entry || typeof entry !== 'object') return false;
        const id = String(entry.id || '');
        const notes = String(entry.notes || '');
        const isAutoSyncedSource =
          id.startsWith('comm-inv-') || notes === 'Auto-synced from Daily Invoices';
        if (!isAutoSyncedSource) return false;
        const commAmt = Number(entry.commissionAmount) || 0;
        const rate = Number(entry.ratePerUnit) || 0;
        return commAmt === 0 && rate === 0 && !entry.isClawback && entry.invoiceStatus !== 'Cancelled';
      };

      const cached = this.getCachedUser();
      if (cached?.role === 'owner') {
        const bk = await this.downloadBackup();
        if (bk?.database) {
          const mergedDeleted: Record<string, number> = {
            ...(existingVault?.deletedRecordIds || {}),
            ...(bk.database.deletedRecordIds || {}),
          };
          const mergedDeletedMonths: Record<string, number> = {
            ...(existingVault?.deletedCommissionMonths || {}),
            ...(bk.database.deletedCommissionMonths || {}),
          };

          const mergedUsersRes = mergeCollectionSafe(existingVault?.users, bk.database.users, mergedDeleted);
          const mergedTxRes = mergeCollectionSafe(existingVault?.transactions, bk.database.transactions, mergedDeleted);
          const mergedCustRes = mergeCollectionSafe(existingVault?.customers, bk.database.customers, mergedDeleted);
          const mergedInvRes = mergeCollectionSafe(existingVault?.invoices, bk.database.invoices, mergedDeleted);
          const mergedCommRes = mergeCollectionSafe(
            (existingVault?.commissionEntries || []).filter((c: any) => !isAutoSyncedCustomerInvoice(c)),
            (bk.database.commissionEntries || []).filter((c: any) => !isAutoSyncedCustomerInvoice(c)),
            mergedDeleted
          );
          const mergedPersonsRes = mergeCollectionSafe(existingVault?.commissionPersons, bk.database.commissionPersons, mergedDeleted);
          const mergedBazarRes = mergeCollectionSafe(existingVault?.homeBazarEntries, bk.database.homeBazarEntries, mergedDeleted);

          const serverMonthSet = new Set<string>(bk.database.commissionMonths || []);
          const monthSet = new Set<string>(serverMonthSet);
          (existingVault?.commissionMonths || []).forEach((m: string) => {
            if (!mergedDeletedMonths[m]) monthSet.add(m);
          });

          const userPhotos: Record<string, string> = { ...(existingVault?.userPhotos || {}) };
          mergedUsersRes.merged.forEach((u: any) => {
            if (u?.id && u?.photoData) userPhotos[u.id] = u.photoData;
          });

          const extSettingsTs = Number(existingVault?.globalSettings?.updatedAt) || 0;
          const srvSettingsTs = Number(bk.database.globalSettings?.updatedAt) || 0;
          const mergedSettings =
            extSettingsTs > srvSettingsTs
              ? { ...bk.database.globalSettings, ...existingVault?.globalSettings }
              : bk.database.globalSettings;

          const snap: PersistentVaultSnapshot = {
            savedAt: Date.now(),
            users: mergedUsersRes.merged,
            globalSettings: mergedSettings,
            transactions: mergedTxRes.merged,
            customers: mergedCustRes.merged,
            invoices: mergedInvRes.merged,
            commissionEntries: mergedCommRes.merged,
            commissionPersons: mergedPersonsRes.merged,
            commissionMonths: Array.from(monthSet).sort(),
            homeBazarEntries: mergedBazarRes.merged,
            deletedRecordIds: mergedDeleted,
            deletedCommissionMonths: mergedDeletedMonths,
            userPhotos,
          };
          await VaultStorage.saveVault(snap);

          const needsRecoveryPush =
            mergedUsersRes.vaultHadMissingOnServer ||
            mergedTxRes.vaultHadMissingOnServer ||
            mergedCustRes.vaultHadMissingOnServer ||
            mergedInvRes.vaultHadMissingOnServer ||
            mergedCommRes.vaultHadMissingOnServer ||
            mergedPersonsRes.vaultHadMissingOnServer ||
            mergedBazarRes.vaultHadMissingOnServer;

          if (needsRecoveryPush) {
            await this.recoverIfEmpty({
              userPhotos,
              snapshot: snap,
            }).catch(() => {});
          }

          firestoreSyncService
            .pushDatabase({
              ...bk.database,
              users: snap.users,
              globalSettings: snap.globalSettings,
              transactions: snap.transactions,
              customers: snap.customers,
              invoices: snap.invoices,
              commissionEntries: snap.commissionEntries,
              commissionPersons: snap.commissionPersons,
              commissionMonths: snap.commissionMonths,
              homeBazarEntries: snap.homeBazarEntries,
              deletedRecordIds: snap.deletedRecordIds,
              deletedCommissionMonths: snap.deletedCommissionMonths,
            })
            .catch((err) => {
              console.warn('Cloud Firestore sync deferred:', err?.message || err);
            });
          const driveStatus = googleDriveService.getStatus();
          if (driveStatus.isConnected && driveStatus.autoSyncEnabled) {
            googleDriveService.triggerDebouncedAutoSync(async () => ({
              transactions: snap.transactions || [],
              customers: snap.customers || [],
              invoices: snap.invoices || [],
              homeBazar: snap.homeBazarEntries || [],
              commissionEntries: snap.commissionEntries || [],
              commissionPersons: snap.commissionPersons || [],
              globalSettings: snap.globalSettings,
            }));
          }
        }
      } else {
        const [txs, custs, invs, comms, bazarRes, tombstones] = await Promise.all([
          this.getTransactions().catch(() => null),
          this.getCustomers().catch(() => null),
          this.getInvoices().catch(() => null),
          this.getCommissions().catch(() => null),
          this.getHomeBazar().catch(() => null),
          this.getSyncTombstones().catch(() => null),
        ]);
        const existing = existingVault || { savedAt: Date.now() };
        const deletedMap: Record<string, number> = {
          ...(existing.deletedRecordIds || {}),
          ...(tombstones?.deletedRecordIds || {}),
        };
        const deletedMonthsMap: Record<string, number> = {
          ...(existing.deletedCommissionMonths || {}),
          ...(tombstones?.deletedCommissionMonths || {}),
        };
        const mergedTx = txs ? mergeCollectionSafe(existing.transactions, txs, deletedMap) : { merged: existing.transactions || [], vaultHadMissingOnServer: false };
        const mergedCust = custs ? mergeCollectionSafe(existing.customers, custs, deletedMap) : { merged: existing.customers || [], vaultHadMissingOnServer: false };
        const mergedInv = invs ? mergeCollectionSafe(existing.invoices, invs, deletedMap) : { merged: existing.invoices || [], vaultHadMissingOnServer: false };
        const mergedComm = comms
          ? mergeCollectionSafe(
              (existing.commissionEntries || []).filter((c: any) => !isAutoSyncedCustomerInvoice(c)),
              (comms.entries || []).filter((c: any) => !isAutoSyncedCustomerInvoice(c)),
              deletedMap
            )
          : {
              merged: (existing.commissionEntries || []).filter((c: any) => !isAutoSyncedCustomerInvoice(c)),
              vaultHadMissingOnServer: false,
            };
        const mergedPersons = comms?.persons ? mergeCollectionSafe(existing.commissionPersons, comms.persons, deletedMap) : { merged: existing.commissionPersons || [], vaultHadMissingOnServer: false };
        const mergedBazar = bazarRes ? mergeCollectionSafe(existing.homeBazarEntries, bazarRes.entries, deletedMap) : { merged: existing.homeBazarEntries || [], vaultHadMissingOnServer: false };

        const resolvedMonths = comms?.months
          ? Array.from(
              new Set([
                ...comms.months,
                ...(existing.commissionMonths || []).filter((m) => !deletedMonthsMap[m]),
              ])
            ).sort()
          : (existing.commissionMonths || []).filter((m) => !deletedMonthsMap[m]);

        const snap: PersistentVaultSnapshot = {
          ...existing,
          savedAt: Date.now(),
          transactions: mergedTx.merged,
          customers: mergedCust.merged,
          invoices: mergedInv.merged,
          commissionEntries: mergedComm.merged,
          commissionPersons: mergedPersons.merged,
          commissionMonths: resolvedMonths,
          homeBazarEntries: mergedBazar.merged,
          deletedRecordIds: deletedMap,
          deletedCommissionMonths: deletedMonthsMap,
        };
        await VaultStorage.saveVault(snap);

        if (
          mergedTx.vaultHadMissingOnServer ||
          mergedCust.vaultHadMissingOnServer ||
          mergedInv.vaultHadMissingOnServer ||
          mergedComm.vaultHadMissingOnServer ||
          mergedPersons.vaultHadMissingOnServer ||
          mergedBazar.vaultHadMissingOnServer
        ) {
          await this.recoverIfEmpty({
            userPhotos: snap.userPhotos,
            snapshot: snap,
          }).catch(() => {});
        }
      }
    } catch {
      // ignore transient sync failure
    } finally {
      isSyncingVaultNow = false;
    }
  },

  // Auth APIs
  async login(username: string, password: string): Promise<{ token: string; user: UserAccount; globalSettings: GlobalAppSettings }> {
    const data = await this.request<{ token: string; user: UserAccount; globalSettings: GlobalAppSettings }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.setToken(data.token);
    this.setCachedUser(data.user);
    return data;
  },

  async loginWithAppleToken(idToken: string): Promise<{ token: string; user: UserAccount; globalSettings: GlobalAppSettings }> {
    const data = await this.request<{ token: string; user: UserAccount; globalSettings: GlobalAppSettings }>('/api/auth/apple-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    this.setToken(data.token);
    this.setCachedUser(data.user);
    return data;
  },

  async getMe(): Promise<{ user: UserAccount; globalSettings: GlobalAppSettings }> {
    const data = await this.request<{ user: UserAccount; globalSettings: GlobalAppSettings }>('/api/auth/me');
    this.setCachedUser(data.user);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    this.clearToken();
  },

  // Transactions APIs
  async getTransactions(workspaceUserId?: string, all = false): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (workspaceUserId) params.set('workspaceUserId', workspaceUserId);
    if (all) params.set('all', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ transactions: Transaction[] }>(`/api/transactions${query}`);
    return res.transactions;
  },

  async createTransaction(payload: {
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
    notes?: string;
    targetWorkspaceUserId?: string;
  }): Promise<Transaction> {
    const res = await this.request<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.transaction;
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const res = await this.request<{ transaction: Transaction }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.transaction;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    await this.request(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(id);
    return true;
  },

  // Draft Debounced Sync
  async getDraft(): Promise<{ description: string; amount: string; category?: string; type?: 'income' | 'expense' }> {
    const res = await this.request<{ draft: any }>('/api/draft');
    return res.draft;
  },

  async saveDraft(data: { description: string; amount: string; category?: string; type?: 'income' | 'expense' }): Promise<{ success: boolean; updatedAt: number }> {
    return this.request<{ success: boolean; updatedAt: number }>('/api/draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // User Management (Owner Only)
  async getUsers(): Promise<UserAccount[]> {
    const res = await this.request<{ users: UserAccount[] }>('/api/users');
    return res.users;
  },

  async createUser(userData: {
    username: string;
    email: string;
    appleId?: string;
    idProvider?: 'email' | 'apple';
    name: string;
    password: string;
    role: string;
    workspaceName?: string;
    canExport?: boolean;
    canDelete?: boolean;
    canAddTransactions?: boolean;
    canViewLedger?: boolean;
    canEditCustomers?: boolean;
    canDeleteCustomers?: boolean;
    canApproveInvoices?: boolean;
    canChangeProfilePhoto?: boolean;
    canManageCommissions?: boolean;
    canAddCommissionRecords?: boolean;
    canEditCommissionRecords?: boolean;
    canDeleteCommissionRecords?: boolean;
    canPayCommissions?: boolean;
    canImportCommissions?: boolean;
    canManageCommissionMonths?: boolean;
    canAddCommissionPersons?: boolean;
    canEditCommissionPersons?: boolean;
    canChangeCommissionPersonPhoto?: boolean;
    canDeleteCommissionPersons?: boolean;
    canMergeCommissionPersons?: boolean;
    canManageBazar?: boolean;
    canManageBuyers?: boolean;
    isCommissionOnly?: boolean;
    isCommissionBazarOnly?: boolean;
  }): Promise<UserAccount> {
    const res = await this.request<{ user: UserAccount }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return res.user;
  },

  async updateUser(id: string, updates: Partial<UserAccount & { password?: string }>): Promise<UserAccount> {
    const res = await this.request<{ user: UserAccount }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.user;
  },

  async deleteUser(id: string): Promise<boolean> {
    await this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(id);
    return true;
  },

  // Profile Photo Management (with persistent browser backup)
  getPhotoBackup(userId: string): string | null {
    try {
      return localStorage.getItem(`zara_user_photo_backup_${userId}`);
    } catch {
      return null;
    }
  },

  setPhotoBackup(userId: string, photoData: string | null) {
    try {
      if (photoData) {
        localStorage.setItem(`zara_user_photo_backup_${userId}`, photoData);
      } else {
        localStorage.removeItem(`zara_user_photo_backup_${userId}`);
      }
    } catch {
      // ignore storage quota errors
    }
  },

  async uploadUserPhoto(userId: string, photoBase64: string): Promise<{ success: boolean; photoUrl: string; user: UserAccount }> {
    this.setPhotoBackup(userId, photoBase64);
    const res = await this.request<{ success: boolean; photoUrl: string; user: UserAccount }>(`/api/users/${userId}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photoBase64 }),
    });
    if (res.user) {
      this.setCachedUser({ ...res.user, photoData: res.user.photoData || photoBase64 });
    }
    return res;
  },

  async deleteUserPhoto(userId: string): Promise<{ success: boolean; user: UserAccount }> {
    this.setPhotoBackup(userId, null);
    const res = await this.request<{ success: boolean; user: UserAccount }>(`/api/users/${userId}/photo`, {
      method: 'DELETE',
    });
    return res;
  },

  // Save personal preferences (Theme, DisplayMode, Language, Numerals, Colors) to cloud DB
  async updateUserPreferences(
    id: string,
    prefs: {
      theme?: string;
      displayMode?: string;
      language?: string;
      useBanglaNumerals?: boolean;
      headerBgColor?: string;
      sidebarBgColor?: string;
    }
  ): Promise<UserAccount> {
    const res = await this.request<{ user: UserAccount }>(`/api/users/${id}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
    this.setCachedUser(res.user);
    return res.user;
  },

  // Customers & Vendors (CRM Ledger)
  async getCustomers(): Promise<Customer[]> {
    try {
      const res = await this.request<{ customers: Customer[] }>('/api/customers');
      return res.customers;
    } catch (err) {
      if (isTransientFetchError(err) || isAppUnloading()) {
        const vault = await VaultStorage.loadVault().catch(() => null);
        if (vault && Array.isArray(vault.customers)) {
          return vault.customers as Customer[];
        }
      }
      throw err;
    }
  },

  async createCustomer(payload: Partial<Customer> & { photoBase64?: string }): Promise<Customer> {
    const res = await this.request<{ customer: Customer; success: boolean }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.customer;
  },

  async updateCustomer(id: string, payload: Partial<Customer> & { photoBase64?: string; removePhoto?: boolean }): Promise<Customer> {
    const res = await this.request<{ customer: Customer; success: boolean }>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.customer;
  },

  async deleteCustomer(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/api/customers/${id}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(id);
    return res.success;
  },

  async uploadCustomerPhoto(photoBase64: string): Promise<string> {
    const res = await this.request<{ photoUrl: string }>('/api/customers/photo', {
      method: 'POST',
      body: JSON.stringify({ photoBase64 }),
    });
    return res.photoUrl;
  },

  // Invoices, Partial Payments & Customer Statements
  async getInvoices(customerId?: string): Promise<Invoice[]> {
    const url = customerId ? `/api/invoices?customerId=${encodeURIComponent(customerId)}` : '/api/invoices';
    try {
      const res = await this.request<{ invoices: Invoice[] }>(url);
      return res.invoices || [];
    } catch (err) {
      if (isTransientFetchError(err) || isAppUnloading()) {
        const vault = await VaultStorage.loadVault().catch(() => null);
        if (vault && Array.isArray(vault.invoices)) {
          const cached = vault.invoices as Invoice[];
          return customerId ? cached.filter((inv) => inv.customerId === customerId) : cached;
        }
      }
      throw err;
    }
  },

  async getInvoice(id: string): Promise<Invoice> {
    const res = await this.request<{ invoice: Invoice }>(`/api/invoices/${id}`);
    return res.invoice;
  },

  async createInvoice(payload: {
    customerId: string;
    invoiceNumber?: string;
    date?: number;
    dueDate?: number;
    items: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>;
    taxRate?: number;
    discount?: number;
    notes?: string;
    terms?: string;
    initialPaymentAmount?: number;
    initialPaymentMethod?: 'cash' | 'bkash' | 'nagad' | 'bank';
    initialPaymentRef?: string;
  }): Promise<{ invoice: Invoice; customer: Customer }> {
    const res = await this.request<{ invoice: Invoice; customer: Customer; success: boolean }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { invoice: res.invoice, customer: res.customer };
  },

  async recordInvoicePayment(invoiceId: string, paymentData: {
    amount: number;
    paymentDate?: number;
    paymentMethod: 'cash' | 'bkash' | 'nagad' | 'bank';
    reference?: string;
    notes?: string;
  }): Promise<{
    invoice: Invoice;
    payment: InvoicePayment;
    customer: Customer;
    isExcessCredit: boolean;
    creditAmount: number;
  }> {
    const res = await this.request<{
      success: boolean;
      invoice: Invoice;
      payment: InvoicePayment;
      customer: Customer;
      isExcessCredit: boolean;
      creditAmount: number;
    }>(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    return res;
  },

  async updateInvoice(
    invoiceId: string,
    payload: {
      customerName?: string;
      customerPhone?: string;
      customerBusiness?: string;
      customerAddress?: string;
      serviceName?: string;
      iqamaNo?: string;
      branchOffice?: string;
      date?: number;
      dueDate?: number;
      items?: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>;
      taxRate?: number;
      discount?: number;
      totalAmount?: number;
      notes?: string;
      terms?: string;
    }
  ): Promise<{ invoice: Invoice; customer?: Customer }> {
    const res = await this.request<{ success: boolean; invoice: Invoice; customer?: Customer }>(`/api/invoices/${invoiceId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { invoice: res.invoice, customer: res.customer };
  },

  async deleteInvoice(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean; customer?: Customer }>(`/api/invoices/${id}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(id);
    return res.success;
  },

  async getCustomerStatement(customerId: string): Promise<CustomerStatement> {
    const res = await this.request<{ statement: CustomerStatement }>(`/api/customers/${customerId}/statement`);
    return res.statement;
  },

  // Daily Home Bazar & Grocery Goods Account API
  async getHomeBazar(): Promise<{ entries: HomeBazarEntry[]; monthlyBudget: number; summary: HomeBazarSummary; buyers?: BazarBuyer[] }> {
    const res = await this.request<{ entries: HomeBazarEntry[]; monthlyBudget: number; summary: HomeBazarSummary; buyers?: BazarBuyer[] }>('/api/home-bazar');
    return res;
  },

  async createHomeBazarEntry(data: {
    date?: string;
    itemName: string;
    category: string;
    quantity?: string;
    amount: number;
    paymentMethod?: 'cash' | 'bkash' | 'nagad' | 'bank';
    notes?: string;
    purchasedBy?: string;
    buyerId?: string;
  }): Promise<HomeBazarEntry> {
    const res = await this.request<{ success: boolean; entry: HomeBazarEntry }>('/api/home-bazar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.entry;
  },

  async updateHomeBazarEntry(
    id: string,
    data: {
      date?: string;
      itemName?: string;
      category?: string;
      quantity?: string;
      amount?: number;
      paymentMethod?: 'cash' | 'bkash' | 'nagad' | 'bank';
      notes?: string;
      purchasedBy?: string;
      buyerId?: string;
    }
  ): Promise<HomeBazarEntry> {
    const res = await this.request<{ success: boolean; entry: HomeBazarEntry }>(`/api/home-bazar/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.entry;
  },

  async deleteHomeBazarEntry(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean; deletedId: string }>(`/api/home-bazar/${id}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(id);
    return res.success;
  },

  async updateHomeBazarBudget(budget: number): Promise<number> {
    const res = await this.request<{ success: boolean; monthlyBudget: number }>('/api/home-bazar/budget', {
      method: 'PUT',
      body: JSON.stringify({ budget }),
    });
    return res.monthlyBudget;
  },

  async getBazarBuyers(): Promise<BazarBuyer[]> {
    const res = await this.request<{ success: boolean; buyers: BazarBuyer[] }>('/api/home-bazar/buyers');
    return res.buyers || [];
  },

  async addBazarBuyer(data: {
    buyerId: string;
    name: string;
    phone?: string;
    role?: string;
    amount?: number;
    notes?: string;
    photoBase64?: string;
    removePhoto?: boolean;
  }): Promise<BazarBuyer> {
    const res = await this.request<{ success: boolean; buyer: BazarBuyer }>('/api/home-bazar/buyers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.buyer;
  },

  async updateBazarBuyer(
    targetBuyerId: string,
    data: {
      newBuyerId?: string;
      name?: string;
      phone?: string;
      role?: string;
      amount?: number | null;
      notes?: string;
      photoBase64?: string;
      removePhoto?: boolean;
    }
  ): Promise<{ buyer: BazarBuyer; renamedFrom?: string }> {
    const res = await this.request<{ success: boolean; buyer: BazarBuyer; renamedFrom?: string }>(
      `/api/home-bazar/buyers/${encodeURIComponent(targetBuyerId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return { buyer: res.buyer, renamedFrom: res.renamedFrom };
  },

  async deleteBazarBuyer(buyerId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean; deletedBuyerId: string }>(`/api/home-bazar/buyers/${encodeURIComponent(buyerId)}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(`buyer:${String(buyerId).trim().toLowerCase()}`);
    return res.success;
  },

  // App Version & Auto-Update Push
  async getAppVersion(): Promise<AppVersionInfo> {
    const res = await fetch(resolveApiUrl('/api/app-version'), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Version check failed: ${res.status}`);
    }
    return res.json();
  },

  async pushAppUpdate(version?: string): Promise<{ success: boolean; globalSettings: GlobalAppSettings; versionInfo: AppVersionInfo }> {
    const res = await this.request<{ success: boolean; globalSettings: GlobalAppSettings; versionInfo: AppVersionInfo }>(
      '/api/app-version/push-update',
      {
        method: 'POST',
        body: JSON.stringify(version ? { version } : {}),
      }
    );
    this.syncVaultNow().catch(() => {});
    return res;
  },

  // Global Settings (Owner Only)
  async getGlobalSettings(): Promise<GlobalAppSettings> {
    const res = await this.request<{ globalSettings: GlobalAppSettings }>('/api/global-settings');
    return res.globalSettings;
  },

  async updateGlobalSettings(settings: Partial<GlobalAppSettings> & { forceRefreshClients?: boolean }): Promise<GlobalAppSettings> {
    const res = await this.request<{ globalSettings: GlobalAppSettings }>('/api/global-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    this.syncVaultNow().catch(() => {});
    return res.globalSettings;
  },

  // Commission Sheet Spreadsheet API
  async getCommissions(params?: { agent?: string; period?: string; office?: string; createdByUserId?: string }): Promise<{
    entries: CommissionEntry[];
    summary: CommissionStatementSummary;
    persons?: CommissionPersonAccount[];
    months?: string[];
    users?: Array<{ id: string; username: string; name: string; role: string }>;
  }> {
    const query = new URLSearchParams();
    if (params?.agent) query.set('agent', params.agent);
    if (params?.period) query.set('period', params.period);
    if (params?.office) query.set('office', params.office);
    if (params?.createdByUserId && params.createdByUserId !== 'all') query.set('createdByUserId', params.createdByUserId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await this.request<{
      entries: CommissionEntry[];
      summary: CommissionStatementSummary;
      persons?: CommissionPersonAccount[];
      months?: string[];
      users?: Array<{ id: string; username: string; name: string; role: string }>;
    }>(`/api/commissions${qs}`);
    const filteredEntries = (res.entries || []).filter((entry) => {
      const id = String(entry?.id || '');
      const notes = String(entry?.notes || '');
      const isAutoSyncedSource =
        id.startsWith('comm-inv-') || notes === 'Auto-synced from Daily Invoices';
      if (!isAutoSyncedSource) return true;
      const commAmt = Number(entry.commissionAmount) || 0;
      const rate = Number(entry.ratePerUnit) || 0;
      return !(commAmt === 0 && rate === 0 && !entry.isClawback && entry.invoiceStatus !== 'Cancelled');
    });
    return {
      ...res,
      entries: filteredEntries,
    };
  },

  async getCommissionPersons(): Promise<{ persons: CommissionPersonAccount[]; accounts: Array<CommissionPersonAccount & { invoicesCount: number; toPayNow: number; alreadyPaid: number; notYetEligible: number; totalCommission: number }> }> {
    return this.request(`/api/commission-persons`);
  },

  async upsertCommissionPerson(payload: { name: string; iqamaNo?: string; phone?: string; office?: string; linkedUserId?: string; photoBase64?: string }): Promise<CommissionPersonAccount> {
    const res = await this.request<{ success: boolean; person: CommissionPersonAccount }>('/api/commission-persons', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.person?.id && (payload.photoBase64 || res.person.photoData)) {
      this.setPhotoBackup(res.person.id, payload.photoBase64 || res.person.photoData || null);
    }
    return res.person;
  },

  async updateCommissionPerson(id: string, payload: Partial<CommissionPersonAccount> & { photoBase64?: string; removePhoto?: boolean }): Promise<CommissionPersonAccount> {
    const res = await this.request<{ success: boolean; person: CommissionPersonAccount }>(`/api/commission-persons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.person?.id) {
      if (payload.removePhoto) {
        this.setPhotoBackup(res.person.id, null);
      } else if (payload.photoBase64 || res.person.photoData) {
        this.setPhotoBackup(res.person.id, payload.photoBase64 || res.person.photoData || null);
      }
    }
    return res.person;
  },

  async uploadCommissionPersonPhoto(personId: string, photoBase64: string, personName?: string): Promise<{ success: boolean; photoUrl: string; person: CommissionPersonAccount }> {
    this.setPhotoBackup(personId, photoBase64);
    const res = await this.request<{ success: boolean; photoUrl: string; person: CommissionPersonAccount }>(`/api/commission-persons/${personId}/photo`, {
      method: 'POST',
      body: JSON.stringify(personName ? { photoBase64, personName } : { photoBase64 }),
    });
    if (res.person?.id) {
      this.setPhotoBackup(res.person.id, photoBase64);
    }
    return res;
  },

  async deleteCommissionPersonPhoto(personId: string): Promise<{ success: boolean; person: CommissionPersonAccount }> {
    this.setPhotoBackup(personId, null);
    return this.request<{ success: boolean; person: CommissionPersonAccount }>(`/api/commission-persons/${personId}/photo`, {
      method: 'DELETE',
    });
  },

  async deleteCommissionPerson(personId: string, reassignTo?: string): Promise<{ success: boolean; deletedId: string; deletedName: string }> {
    const res = await this.request<{ success: boolean; deletedId: string; deletedName: string }>(
      `/api/commission-persons/${encodeURIComponent(personId)}`,
      {
        method: 'DELETE',
        body: JSON.stringify(reassignTo ? { reassignTo } : {}),
      }
    );
    await VaultStorage.recordDeletion(personId);
    this.setPhotoBackup(personId, null);
    return res;
  },

  async deleteAllCommissionPersons(clearEntryAgents = false): Promise<{ success: boolean; deletedCount: number; deletedIds: string[] }> {
    const res = await this.request<{ success: boolean; deletedCount: number; deletedIds: string[] }>(
      '/api/commission-persons',
      {
        method: 'DELETE',
        body: JSON.stringify({ clearEntryAgents }),
      }
    );
    for (const pid of res.deletedIds || []) {
      await VaultStorage.recordDeletion(pid);
      this.setPhotoBackup(pid, null);
    }
    return res;
  },

  async mergeCommissionPersons(payload: {
    sourceId?: string;
    sourceName?: string;
    targetId?: string;
    targetName?: string;
  }): Promise<{ success: boolean; mergedEntriesCount: number; target: CommissionPersonAccount; deletedSourceId: string | null }> {
    const res = await this.request<{
      success: boolean;
      mergedEntriesCount: number;
      target: CommissionPersonAccount;
      deletedSourceId: string | null;
    }>('/api/commission-persons/merge', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.deletedSourceId) {
      await VaultStorage.recordDeletion(res.deletedSourceId);
      this.setPhotoBackup(res.deletedSourceId, null);
    }
    return res;
  },

  async getCommissionMonths(): Promise<string[]> {
    const res = await this.request<{ months: string[] }>('/api/commission-months');
    return res.months || [];
  },

  async addCommissionMonth(month: string): Promise<string[]> {
    const res = await this.request<{ success: boolean; months: string[] }>('/api/commission-months', {
      method: 'POST',
      body: JSON.stringify({ month }),
    });
    return res.months || [];
  },

  async deleteCommissionMonth(month: string): Promise<string[]> {
    const res = await this.request<{ success: boolean; months: string[] }>(`/api/commission-months/${encodeURIComponent(month)}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletedMonth(month);
    return res.months || [];
  },

  async createCommission(payload: Partial<CommissionEntry>): Promise<CommissionEntry> {
    const res = await this.request<{ success: boolean; entry: CommissionEntry }>('/api/commissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.entry;
  },

  async updateCommission(id: string, payload: Partial<CommissionEntry>): Promise<CommissionEntry> {
    const res = await this.request<{ success: boolean; entry: CommissionEntry }>(`/api/commissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.entry;
  },

  async deleteCommission(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/api/commissions/${id}`, {
      method: 'DELETE',
    });
    await VaultStorage.recordDeletion(id);
    return res.success;
  },

  async settleCommissionPayout(payload: { agent?: string; entryIds?: string[]; notes?: string }): Promise<{ success: boolean; count: number; paidAt: number }> {
    return this.request<{ success: boolean; count: number; paidAt: number }>('/api/commissions/payout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // AI Document & Photo Commission Scanner
  async extractCommissionWithAi(fileBase64: string, mimeType = 'image/png'): Promise<{ success: boolean; agentName?: string; period?: string; entries: any[] }> {
    return this.request<{ success: boolean; agentName?: string; period?: string; entries: any[] }>('/api/commissions/ai-extract', {
      method: 'POST',
      body: JSON.stringify({ fileBase64, mimeType }),
    });
  },

  async importCommissionsBatch(entries: any[]): Promise<{ success: boolean; count: number; entries: CommissionEntry[] }> {
    return this.request<{ success: boolean; count: number; entries: CommissionEntry[] }>('/api/commissions/batch', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    });
  },

  // Cloud Backup & Restore (Owner Only)
  async downloadBackup(): Promise<any> {
    return this.request<any>('/api/backup');
  },

  async restoreBackup(database: any): Promise<any> {
    return this.request<any>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ database }),
    });
  },

  async getSyncTombstones(): Promise<{ deletedRecordIds: Record<string, number>; deletedCommissionMonths: Record<string, number> }> {
    return this.request<{ deletedRecordIds: Record<string, number>; deletedCommissionMonths: Record<string, number> }>('/api/sync/tombstones');
  },

  async recoverIfEmpty(payload: { userPhotoData?: string; userPhotos?: Record<string, string>; snapshot?: any }): Promise<{ success: boolean; recovered: boolean; user?: UserAccount }> {
    return this.request<{ success: boolean; recovered: boolean; user?: UserAccount }>('/api/sync/recover-if-empty', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async syncCloudFirestoreNow(): Promise<{ pulled: boolean; recovered: boolean; pushed: boolean }> {
    const cached = this.getCachedUser();
    if (cached?.role !== 'owner') {
      return { pulled: false, recovered: false, pushed: false };
    }
    const cloudSnap = await firestoreSyncService.pullSnapshot();
    let recovered = false;
    if (cloudSnap) {
      const localVault = await VaultStorage.loadVault().catch(() => null);
      const userPhotos: Record<string, string> = { ...(localVault?.userPhotos || {}) };
      const mergedSnap: PersistentVaultSnapshot = {
        ...cloudSnap,
        userPhotos,
      };
      const recRes = await this.recoverIfEmpty({
        userPhotos,
        snapshot: mergedSnap,
      }).catch(() => ({ success: false, recovered: false }));
      recovered = Boolean(recRes?.recovered);
    }

    const bk = await this.downloadBackup().catch(() => null);
    let pushed = false;
    if (bk?.database) {
      pushed = await firestoreSyncService.pushDatabase(bk.database).catch(() => false);
      const existingVault = await VaultStorage.loadVault().catch(() => null);
      const userPhotos: Record<string, string> = { ...(existingVault?.userPhotos || {}) };
      (bk.database.users || []).forEach((u: any) => {
        if (u?.id && u?.photoData) userPhotos[u.id] = u.photoData;
      });
      await VaultStorage.saveVault({
        savedAt: Date.now(),
        users: bk.database.users || [],
        globalSettings: bk.database.globalSettings,
        transactions: bk.database.transactions || [],
        customers: bk.database.customers || [],
        invoices: bk.database.invoices || [],
        commissionEntries: (bk.database.commissionEntries || []).filter((c: any) => {
          const id = String(c?.id || '');
          const notes = String(c?.notes || '');
          const isAutoSynced = id.startsWith('comm-inv-') || notes === 'Auto-synced from Daily Invoices';
          if (!isAutoSynced) return true;
          return !((Number(c?.commissionAmount) || 0) === 0 && (Number(c?.ratePerUnit) || 0) === 0 && !c?.isClawback && c?.invoiceStatus !== 'Cancelled');
        }),
        commissionPersons: bk.database.commissionPersons || [],
        commissionMonths: bk.database.commissionMonths || [],
        homeBazarEntries: bk.database.homeBazarEntries || [],
        deletedRecordIds: bk.database.deletedRecordIds || {},
        userPhotos,
      }).catch(() => {});
    }

    await this.syncAdminFirestore('both').catch(() => null);

    return { pulled: Boolean(cloudSnap), recovered, pushed };
  },

  async getAdminFirestoreStatus(): Promise<{
    configured: boolean;
    projectId: string;
    databaseId: string;
    status: 'unconfigured' | 'ready' | 'needs_owner_uid' | 'permission_denied' | 'error';
    hasOwnerUid: boolean;
    lastSyncedAt: number | null;
    lastPushedAt: number | null;
    lastPulledAt: number | null;
    lastError: string | null;
    syncing: boolean;
  } | null> {
    try {
      const idToken = await firebaseAuth.currentUser?.getIdToken().catch(() => undefined);
      const token = this.getToken();
      const hasExplicitSession = Boolean(token && !token.startsWith('token_auto_'));
      if (!idToken && !hasExplicitSession) return null;
      const res = await fetch(resolveApiUrl('/api/admin/firestore/status'), {
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(idToken ? { 'X-Firebase-Id-Token': idToken } : {}),
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async syncAdminFirestore(direction: 'push' | 'pull' | 'both' = 'both'): Promise<any> {
    const idToken = await firebaseAuth.currentUser?.getIdToken().catch(() => undefined);
    const token = this.getToken();
    const hasExplicitSession = Boolean(token && !token.startsWith('token_auto_'));
    if (!idToken && !hasExplicitSession) return null;
    return this.request<any>('/api/admin/firestore/sync', {
      method: 'POST',
      headers: idToken ? { 'X-Firebase-Id-Token': idToken } : {},
      body: JSON.stringify({ direction, ...(idToken ? { idToken } : {}) }),
    });
  },

  // Real-Time Push Events Listener (Shared Singleton SSE + Cross-Tab BroadcastChannel)
  subscribeToEvents(onEvent: (event: string, data: any) => void): () => void {
    sseListeners.add(onEvent);
    ensureSharedEventSource(false);

    if (sharedEventSource && sharedEventSource.readyState === EventSource.OPEN) {
      try {
        onEvent('connected', { time: Date.now(), reused: true });
      } catch {}
    }

    return () => {
      sseListeners.delete(onEvent);
      if (sseListeners.size === 0) {
        teardownSharedEventSource();
      }
    };
  },
};
