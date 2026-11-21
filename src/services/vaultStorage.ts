export interface PersistentVaultSnapshot {
  savedAt: number;
  users?: any[];
  globalSettings?: any;
  transactions?: any[];
  customers?: any[];
  invoices?: any[];
  commissionEntries?: any[];
  commissionPersons?: any[];
  commissionMonths?: string[];
  homeBazarEntries?: any[];
  deletedRecordIds?: Record<string, number>;
  deletedCommissionMonths?: Record<string, number>;
  userPhotos?: Record<string, string>;
}

const VAULT_LS_KEY = 'zara_persistent_vault_v1';
const VAULT_LAST_BACKUP_AT_KEY = 'zara_last_auto_backup_at';
const IDB_NAME = 'zara_persistent_vault_db';
const IDB_STORE = 'vault';
const IDB_KEY = 'latest_snapshot';
const IDB_HISTORY_KEY = 'snapshot_history';

function openVaultDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readKeyFromIDB<T>(key: string): Promise<T | null> {
  const db = await openVaultDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeKeyToIDB(key: string, value: any): Promise<void> {
  const db = await openVaultDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export const VaultStorage = {
  getLastBackupTime(): number {
    try {
      const raw = localStorage.getItem(VAULT_LAST_BACKUP_AT_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch {
      return 0;
    }
  },

  async getSnapshotHistory(): Promise<PersistentVaultSnapshot[]> {
    const list = await readKeyFromIDB<PersistentVaultSnapshot[]>(IDB_HISTORY_KEY);
    return Array.isArray(list) ? list : [];
  },

  async loadVault(): Promise<PersistentVaultSnapshot | null> {
    const idbData = await readKeyFromIDB<PersistentVaultSnapshot>(IDB_KEY);
    let lsData: PersistentVaultSnapshot | null = null;
    try {
      const raw = localStorage.getItem(VAULT_LS_KEY);
      if (raw) lsData = JSON.parse(raw);
    } catch {
      lsData = null;
    }

    if (idbData && lsData) {
      return (idbData.savedAt || 0) >= (lsData.savedAt || 0) ? idbData : lsData;
    }
    return idbData || lsData || null;
  },

  async recordDeletion(recordId: string): Promise<void> {
    if (!recordId) return;
    return this.recordDeletions([recordId]);
  },

  async recordDeletions(recordIds: string[]): Promise<void> {
    const cleanIds = recordIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (cleanIds.length === 0) return;
    try {
      const existing = (await this.loadVault()) || { savedAt: Date.now() };
      const now = Date.now();
      const deletedRecordIds = { ...(existing.deletedRecordIds || {}) };
      cleanIds.forEach((id) => {
        deletedRecordIds[id] = now;
      });
      const idSet = new Set(cleanIds);
      await this.saveVault({
        ...existing,
        savedAt: now,
        transactions: existing.transactions?.filter((x: any) => !idSet.has(x?.id)),
        customers: existing.customers?.filter((x: any) => !idSet.has(x?.id)),
        invoices: existing.invoices?.filter((x: any) => !idSet.has(x?.id)),
        commissionEntries: existing.commissionEntries?.filter((x: any) => !idSet.has(x?.id)),
        commissionPersons: existing.commissionPersons?.filter((x: any) => !idSet.has(x?.id)),
        homeBazarEntries: existing.homeBazarEntries?.filter((x: any) => !idSet.has(x?.id)),
        users: existing.users?.filter((x: any) => !idSet.has(x?.id)),
        deletedRecordIds,
      });
    } catch {
      // non-fatal
    }
  },

  async recordDeletedMonth(month: string): Promise<void> {
    if (!month) return;
    try {
      const existing = (await this.loadVault()) || { savedAt: Date.now() };
      const now = Date.now();
      await this.saveVault({
        ...existing,
        savedAt: now,
        commissionMonths: (existing.commissionMonths || []).filter((m) => m !== month),
        deletedCommissionMonths: {
          ...(existing.deletedCommissionMonths || {}),
          [month]: now,
        },
      });
    } catch {
      // non-fatal
    }
  },

  async saveVault(snapshot: PersistentVaultSnapshot): Promise<void> {
    const now = snapshot.savedAt || Date.now();
    const payload: PersistentVaultSnapshot = {
      ...snapshot,
      savedAt: now,
    };
    await writeKeyToIDB(IDB_KEY, payload);

    try {
      localStorage.setItem(VAULT_LAST_BACKUP_AT_KEY, String(now));
    } catch {}

    // Maintain up to 12 rolling auto-backup snapshots in IndexedDB (at least 60s apart or when record count changes)
    try {
      const history = await this.getSnapshotHistory();
      const latestHist = history[0];
      const latestCount =
        (latestHist?.users?.length || 0) +
        (latestHist?.transactions?.length || 0) +
        (latestHist?.invoices?.length || 0) +
        (latestHist?.commissionEntries?.length || 0) +
        (latestHist?.homeBazarEntries?.length || 0) +
        (latestHist?.customers?.length || 0);
      const nextCount =
        (payload.users?.length || 0) +
        (payload.transactions?.length || 0) +
        (payload.invoices?.length || 0) +
        (payload.commissionEntries?.length || 0) +
        (payload.homeBazarEntries?.length || 0) +
        (payload.customers?.length || 0);

      if (!latestHist || now - (latestHist.savedAt || 0) >= 60000 || latestCount !== nextCount) {
        const updatedHistory = [payload, ...history].slice(0, 12);
        await writeKeyToIDB(IDB_HISTORY_KEY, updatedHistory);
      }
    } catch {
      // ignore rolling history failure
    }

    // Also mirror to localStorage (strip oversized photoData only if quota is tight)
    try {
      localStorage.setItem(VAULT_LS_KEY, JSON.stringify(payload));
    } catch {
      try {
        const compact: PersistentVaultSnapshot = {
          ...payload,
          users: (payload.users || []).map((u: any) => ({ ...u, photoData: undefined })),
          globalSettings: payload.globalSettings
            ? {
                ...payload.globalSettings,
                bazarBuyers: Array.isArray(payload.globalSettings.bazarBuyers)
                  ? payload.globalSettings.bazarBuyers.map((b: any) => ({ ...b, photoData: undefined }))
                  : undefined,
              }
            : undefined,
          customers: (payload.customers || []).map((c: any) => ({ ...c, photoData: undefined })),
          commissionPersons: (payload.commissionPersons || []).map((p: any) => ({ ...p, photoData: undefined })),
          userPhotos: undefined,
        };
        localStorage.setItem(VAULT_LS_KEY, JSON.stringify(compact));
      } catch {
        // ignore if localStorage is completely full; IndexedDB already holds the full snapshot
      }
    }
  },
};
