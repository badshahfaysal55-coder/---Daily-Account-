import { Transaction, CloudAccountDoc } from '../types/accounting';

const MMKV_STORAGE_KEY = 'accounting_local_mmkv_v1';
const DRAFT_STORAGE_KEY = 'accounting_draft_v1';
const CLOUD_SYNC_LOG_KEY = 'accounting_cloud_sync_log';
const TRANSACTIONS_KEY = 'accounting_transactions_v1';

// No hardcoded sample/auto transactions (transactions are strictly user-entered)
const INITIAL_TRANSACTIONS: Transaction[] = [];

export interface StorageLogEntry {
  id: string;
  timestamp: number;
  type: 'local_mmkv' | 'firestore_cloud' | 'offline_error';
  message: string;
  payload: any;
}

export const StorageService = {
  // Local MMKV equivalent
  getLocalDraft(): { description: string; amount: string; category?: string; type?: 'expense' | 'income' } {
    try {
      const data = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return { description: '', amount: '' };
  },

  setLocalDraft(data: { description: string; amount: string; category?: string; type?: 'expense' | 'income' }) {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
      // Also mimic mmkv.set('latest_account', amount)
      localStorage.setItem('latest_account', data.amount);
    } catch (e) {
      console.error('Local MMKV save error:', e);
    }
  },

  // Save to simulated Firestore with network simulation
  async syncToFirestore(
    userId: string,
    payload: {
      description: string;
      amount: number;
      type?: 'expense' | 'income';
      category?: string;
    },
    isSimulatedOffline = false
  ): Promise<{ success: boolean; updatedAt: string; error?: string }> {
    // Artificial latency (300-600ms) to mirror cloud roundtrip
    await new Promise((resolve) => setTimeout(resolve, 450));

    if (isSimulatedOffline || !navigator.onLine) {
      // Record offline log
      this.appendLog({
        id: 'log-' + Date.now(),
        timestamp: Date.now(),
        type: 'offline_error',
        message: 'Cloud Sync Error: Network unavailable (Save failed)',
        payload,
      });
      throw new Error('Cloud Sync Error: Network unavailable (Offline)');
    }

    const doc: CloudAccountDoc = {
      description: payload.description,
      amount: payload.amount,
      type: payload.type || 'expense',
      category: payload.category || 'bazaar',
      updatedAt: new Date().toISOString(),
      lastSavedBy: userId,
    };

    // Store in localStorage under cloud document key
    localStorage.setItem(`firestore_accounts_${userId}`, JSON.stringify(doc));

    this.appendLog({
      id: 'log-' + Date.now(),
      timestamp: Date.now(),
      type: 'firestore_cloud',
      message: `firestore().collection('accounts').doc('${userId}').set({ ... }, { merge: true })`,
      payload: doc,
    });

    return {
      success: true,
      updatedAt: doc.updatedAt,
    };
  },

  getFirestoreCloudDoc(userId: string): CloudAccountDoc | null {
    try {
      const item = localStorage.getItem(`firestore_accounts_${userId}`);
      if (item) return JSON.parse(item);
    } catch {
      // fallback
    }
    return null;
  },

  // Full Ledger Transactions list
  getTransactions(): Transaction[] {
    try {
      const data = localStorage.getItem(TRANSACTIONS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }
    // Seed initial
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
    return INITIAL_TRANSACTIONS;
  },

  saveTransaction(tx: Transaction): Transaction[] {
    const list = this.getTransactions();
    const updated = [tx, ...list];
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    return updated;
  },

  updateTransaction(id: string, updates: Partial<Transaction>): Transaction[] {
    const list = this.getTransactions();
    const updated = list.map((item) => (item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item));
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    return updated;
  },

  deleteTransaction(id: string): { updatedList: Transaction[]; deletedItem: Transaction | null } {
    const list = this.getTransactions();
    const deletedItem = list.find((item) => item.id === id) || null;
    const updatedList = list.filter((item) => item.id !== id);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updatedList));
    return { updatedList, deletedItem };
  },

  // Audit Logs
  getLogs(): StorageLogEntry[] {
    try {
      const data = localStorage.getItem(CLOUD_SYNC_LOG_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return [];
  },

  appendLog(entry: StorageLogEntry) {
    const logs = this.getLogs();
    const updated = [entry, ...logs].slice(0, 50); // keep last 50
    localStorage.setItem(CLOUD_SYNC_LOG_KEY, JSON.stringify(updated));
  },

  clearLogs() {
    localStorage.removeItem(CLOUD_SYNC_LOG_KEY);
  },

  resetAllData() {
    localStorage.removeItem(TRANSACTIONS_KEY);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(CLOUD_SYNC_LOG_KEY);
    localStorage.removeItem('latest_account');
    return INITIAL_TRANSACTIONS;
  },
};
