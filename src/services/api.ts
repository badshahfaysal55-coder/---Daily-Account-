import { Transaction, UserAccount, GlobalAppSettings, Customer, Invoice, InvoicePayment, CustomerStatement, CommissionEntry, CommissionPersonAccount, CommissionStatementSummary, HomeBazarEntry, HomeBazarSummary, BazarBuyer } from '../types/accounting';
import { VaultStorage, PersistentVaultSnapshot } from './vaultStorage';
import { googleDriveService } from './googleDriveService';

const TOKEN_KEY = 'zara_auth_token_v1';
const CACHED_USER_KEY = 'zara_cached_user_v1';
let vaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncingVaultNow = false;

export const ApiService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CACHED_USER_KEY);
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
    const res = await fetch('/api/auth/session', {
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
    throw new Error('Unable to initialize session');
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

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

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
    const method = (options.method || 'GET').toUpperCase();
    if (
      method !== 'GET' &&
      !endpoint.startsWith('/api/auth/') &&
      endpoint !== '/api/draft' &&
      endpoint !== '/api/sync/recover-if-empty'
    ) {
      this.scheduleVaultSync();
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
      const cached = this.getCachedUser();
      if (cached?.role === 'owner') {
        const bk = await this.downloadBackup();
        if (bk?.database) {
          const userPhotos: Record<string, string> = {};
          (bk.database.users || []).forEach((u: any) => {
            if (u?.id && u?.photoData) userPhotos[u.id] = u.photoData;
          });
          const snap: PersistentVaultSnapshot = {
            savedAt: Date.now(),
            transactions: bk.database.transactions || [],
            customers: bk.database.customers || [],
            invoices: bk.database.invoices || [],
            commissionEntries: bk.database.commissionEntries || [],
            commissionPersons: bk.database.commissionPersons || [],
            commissionMonths: bk.database.commissionMonths || [],
            homeBazarEntries: bk.database.homeBazarEntries || [],
            deletedRecordIds: bk.database.deletedRecordIds || {},
            userPhotos,
          };
          await VaultStorage.saveVault(snap);
          const driveStatus = googleDriveService.getStatus();
          if (driveStatus.isConnected && driveStatus.autoSyncEnabled) {
            googleDriveService.triggerDebouncedAutoSync(async () => ({
              transactions: snap.transactions || [],
              customers: snap.customers || [],
              invoices: snap.invoices || [],
              homeBazar: snap.homeBazarEntries || [],
              commissionEntries: snap.commissionEntries || [],
              commissionPersons: snap.commissionPersons || [],
              globalSettings: bk.database.globalSettings,
            }));
          }
        }
      } else {
        const [txs, custs, invs, comms, bazarRes] = await Promise.all([
          this.getTransactions().catch(() => null),
          this.getCustomers().catch(() => null),
          this.getInvoices().catch(() => null),
          this.getCommissions().catch(() => null),
          this.getHomeBazar().catch(() => null),
        ]);
        const existing = (await VaultStorage.loadVault()) || { savedAt: Date.now() };
        const snap: PersistentVaultSnapshot = {
          ...existing,
          savedAt: Date.now(),
          ...(txs ? { transactions: txs } : {}),
          ...(custs ? { customers: custs } : {}),
          ...(invs ? { invoices: invs } : {}),
          ...(comms
            ? {
                commissionEntries: comms.entries || [],
                commissionPersons: comms.persons || existing.commissionPersons || [],
                commissionMonths: comms.months || existing.commissionMonths || [],
              }
            : {}),
          ...(bazarRes ? { homeBazarEntries: bazarRes.entries || [] } : {}),
        };
        await VaultStorage.saveVault(snap);
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
    name: string;
    password: string;
    role: string;
    workspaceName?: string;
    canExport?: boolean;
    canDelete?: boolean;
    canAddTransactions?: boolean;
    canViewLedger?: boolean;
    canEditCustomers?: boolean;
    canApproveInvoices?: boolean;
    canManageCommissions?: boolean;
    isCommissionOnly?: boolean;
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
    const res = await this.request<{ customers: Customer[] }>('/api/customers');
    return res.customers;
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
    const res = await this.request<{ invoices: Invoice[] }>(url);
    return res.invoices;
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

  async addBazarBuyer(data: { buyerId: string; name: string; phone?: string; role?: string }): Promise<BazarBuyer> {
    const res = await this.request<{ success: boolean; buyer: BazarBuyer }>('/api/home-bazar/buyers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.buyer;
  },

  async deleteBazarBuyer(buyerId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean; deletedBuyerId: string }>(`/api/home-bazar/buyers/${encodeURIComponent(buyerId)}`, {
      method: 'DELETE',
    });
    return res.success;
  },

  // Global Settings (Owner Only)
  async getGlobalSettings(): Promise<GlobalAppSettings> {
    const res = await this.request<{ globalSettings: GlobalAppSettings }>('/api/global-settings');
    return res.globalSettings;
  },

  async updateGlobalSettings(settings: Partial<GlobalAppSettings>): Promise<GlobalAppSettings> {
    const res = await this.request<{ globalSettings: GlobalAppSettings }>('/api/global-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return res.globalSettings;
  },

  // Commission Sheet Spreadsheet API
  async getCommissions(params?: { agent?: string; period?: string; office?: string }): Promise<{ entries: CommissionEntry[]; summary: CommissionStatementSummary; persons?: CommissionPersonAccount[]; months?: string[] }> {
    const query = new URLSearchParams();
    if (params?.agent) query.set('agent', params.agent);
    if (params?.period) query.set('period', params.period);
    if (params?.office) query.set('office', params.office);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ entries: CommissionEntry[]; summary: CommissionStatementSummary; persons?: CommissionPersonAccount[]; months?: string[] }>(`/api/commissions${qs}`);
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

  async uploadCommissionPersonPhoto(personId: string, photoBase64: string): Promise<{ success: boolean; photoUrl: string; person: CommissionPersonAccount }> {
    this.setPhotoBackup(personId, photoBase64);
    const res = await this.request<{ success: boolean; photoUrl: string; person: CommissionPersonAccount }>(`/api/commission-persons/${personId}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photoBase64 }),
    });
    return res;
  },

  async deleteCommissionPersonPhoto(personId: string): Promise<{ success: boolean; person: CommissionPersonAccount }> {
    this.setPhotoBackup(personId, null);
    return this.request<{ success: boolean; person: CommissionPersonAccount }>(`/api/commission-persons/${personId}/photo`, {
      method: 'DELETE',
    });
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

  async recoverIfEmpty(payload: { userPhotoData?: string; userPhotos?: Record<string, string>; snapshot?: any }): Promise<{ success: boolean; recovered: boolean; user?: UserAccount }> {
    return this.request<{ success: boolean; recovered: boolean; user?: UserAccount }>('/api/sync/recover-if-empty', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Real-Time Push Events Listener (Global Event Stream)
  subscribeToEvents(onEvent: (event: string, data: any) => void): () => void {
    const token = this.getToken();
    const eventSource = new EventSource(`/api/sync/events?token=${token || ''}`);

    const handleEvent = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(event.type, parsed);
      } catch {
        // ignore
      }
    };

    const eventNames = [
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
      'database_restored',
    ];

    eventNames.forEach((name) => {
      eventSource.addEventListener(name, handleEvent as any);
    });

    return () => {
      eventSource.close();
    };
  },
};
