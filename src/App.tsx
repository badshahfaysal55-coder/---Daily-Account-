/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTabId } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardOverview } from './components/DashboardOverview';
import { QuickEntryCard } from './components/QuickEntryCard';
import { DailyInvoicesView } from './components/DailyInvoicesView';
import { HomeBazarLedger } from './components/HomeBazarLedger';
import { LedgerList } from './components/LedgerList';
import { CustomersLedger } from './components/CustomersLedger';
import { AppearanceSettings } from './components/AppearanceSettings';
import { CommissionSheet } from './components/CommissionSheet';
import { ReactNativeCodeViewer } from './components/ReactNativeCodeViewer';
import { SyncLogsViewer } from './components/SyncLogsViewer';
import { PrintVoucherModal } from './components/PrintVoucherModal';
import { ProfilePhotoModal } from './components/ProfilePhotoModal';
import { OwnerControlCenter } from './components/OwnerControlCenter';
import { AuthModal } from './components/AuthModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { OfflineIndicator, MobileInstallBanner } from './components/PWAInstallButton';
import { googleDriveService } from './services/googleDriveService';
import { StorageService } from './services/storageService';
import { ApiService } from './services/api';
import { VaultStorage } from './services/vaultStorage';
import { firestoreSyncService } from './services/firestoreSyncService';
import { testSupabaseConnection, isSupabaseConfigured, SupabaseConnectionStatus } from './services/supabaseClient';
import { Transaction, UserProfile, UserAccount, GlobalAppSettings, AppTheme, DisplayMode, Customer, CurrencyCode, AppVersionInfo } from './types/accounting';
import { t, Language } from './utils/translations';
import { getUserPagePermissions, canAccessNavTab, getDefaultNavTab, getDefaultEntrySubTab } from './utils/permissions';
import { 
  Cloud, 
  Database, 
  Crown, 
  Server,
  Palette,
  ShieldCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  Radio,
  X
} from 'lucide-react';

export default function App() {
  const [currentUserAccount, setCurrentUserAccount] = useState<UserAccount>(() => {
    const cached = ApiService.getCachedUser();
    if (cached) return cached;
    return {
      id: 'usr_owner_faisal',
      username: 'rh.faysal007',
      name: 'Faysal Ahmed (Main Owner)',
      role: 'owner',
      workspaceName: 'Executive HQ Workspace',
      status: 'active',
      canExport: true,
      canDelete: true,
      theme: 'midnight-gold',
      displayMode: 'light',
      language: 'en',
      createdAt: Date.now(),
    };
  });

  const [allUsersList, setAllUsersList] = useState<UserAccount[]>([]);
  const [selectedWorkspaceUserId, setSelectedWorkspaceUserId] = useState<string | null>(null);

  // 5 Themes: 'midnight-gold' (Default) | 'royal-blue' | 'emerald-green' | 'graphite-black' | 'emerald-graphite'
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    const cached = ApiService.getCachedUser();
    if (cached?.theme) return cached.theme;
    const saved = localStorage.getItem('zara_preferred_theme') as AppTheme | null;
    return saved || 'midnight-gold';
  });
  const [currentMode, setCurrentMode] = useState<DisplayMode>(() => {
    const cached = ApiService.getCachedUser();
    if (cached?.displayMode) return cached.displayMode;
    const saved = localStorage.getItem('zara_preferred_mode') as DisplayMode | null;
    return saved || 'light';
  });
  const [currentLang, setCurrentLang] = useState<Language>(() => {
    const cached = ApiService.getCachedUser();
    if (cached?.language === 'bn' || cached?.language === 'en') return cached.language;
    const saved = localStorage.getItem('zara_preferred_lang');
    return saved === 'bn' || saved === 'en' ? saved : 'en';
  });
  const [useBanglaNumerals, setUseBanglaNumerals] = useState<boolean>(() => {
    const cached = ApiService.getCachedUser();
    if (cached?.useBanglaNumerals !== undefined) return Boolean(cached.useBanglaNumerals);
    const savedNum = localStorage.getItem('zara_preferred_numerals_bn');
    if (savedNum === 'true' || savedNum === 'false') return savedNum === 'true';
    const saved = localStorage.getItem('zara_preferred_lang');
    return saved === 'bn';
  });

  // Navigation & Sidebar
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [entrySubTab, setEntrySubTab] = useState<'invoices' | 'bazar' | 'quick'>('invoices');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Custom Header & Option Bar (Sidebar) Colors (empty string = follow active theme)
  const [headerBgColor, setHeaderBgColor] = useState<string>(() => {
    const cached = ApiService.getCachedUser();
    if (cached?.headerBgColor) return cached.headerBgColor;
    return localStorage.getItem('zara_header_color') || '';
  });
  const [sidebarBgColor, setSidebarBgColor] = useState<string>(() => {
    const cached = ApiService.getCachedUser();
    if (cached?.sidebarBgColor) return cached.sidebarBgColor;
    return localStorage.getItem('zara_sidebar_color') || '';
  });

  const handleApplyHeaderColor = (color: string) => {
    setHeaderBgColor(color);
    if (color) {
      localStorage.setItem('zara_header_color', color);
    } else {
      localStorage.removeItem('zara_header_color');
    }
    setCurrentUserAccount((prev) => {
      const updated = { ...prev, headerBgColor: color || undefined };
      ApiService.setCachedUser(updated);
      return updated;
    });
    ApiService.updateUserPreferences(currentUserAccount.id, { headerBgColor: color }).catch(() => {});
    if (currentUserAccount.role === 'owner') {
      setGlobalSettings((prev) => ({ ...prev, headerBgColor: color || undefined }));
      ApiService.updateGlobalSettings({ headerBgColor: color }).catch(() => {});
    }
  };

  const handleApplySidebarColor = (color: string) => {
    setSidebarBgColor(color);
    if (color) {
      localStorage.setItem('zara_sidebar_color', color);
    } else {
      localStorage.removeItem('zara_sidebar_color');
    }
    setCurrentUserAccount((prev) => {
      const updated = { ...prev, sidebarBgColor: color || undefined };
      ApiService.setCachedUser(updated);
      return updated;
    });
    ApiService.updateUserPreferences(currentUserAccount.id, { sidebarBgColor: color }).catch(() => {});
    if (currentUserAccount.role === 'owner') {
      setGlobalSettings((prev) => ({ ...prev, sidebarBgColor: color || undefined }));
      ApiService.updateGlobalSettings({ sidebarBgColor: color }).catch(() => {});
    }
  };

  const handleSelectCurrency = (curr: CurrencyCode) => {
    setUser((prev) => ({ ...prev, currency: curr }));
    setGlobalSettings((prev) => ({ ...prev, currency: curr }));
    localStorage.setItem('zara_preferred_currency', curr);
    ApiService.updateGlobalSettings({ currency: curr }).catch(() => {});
  };

  const [globalSettings, setGlobalSettings] = useState<GlobalAppSettings>({
    appName: 'ZARA Accounting App',
    companyName: 'ZARA Group & Holdings Ltd.',
    version: '2.5.0-gold',
    currency: (localStorage.getItem('zara_preferred_currency') as CurrencyCode) || 'SAR',
    broadcastMessage: 'Welcome to ZARA Accounting Cloud System. All records are automatically synced to the cloud database.',
    broadcastType: 'info',
    broadcastActive: true,
    defaultTheme: 'midnight-gold',
    updatedAt: Date.now(),
    lastUpdatedBy: 'rh.faysal007 (Owner)',
  });

  const [user, setUser] = useState<UserProfile>(() => {
    const savedCurr = (localStorage.getItem('zara_preferred_currency') as CurrencyCode) || 'SAR';
    return {
      userId: 'usr_owner_faisal',
      name: 'Faysal Ahmed (Main Owner)',
      phoneOrEmail: 'rh.faysal007@gmail.com',
      currency: savedCurr,
      useBanglaNumerals: false,
      language: 'en',
      theme: 'midnight-gold',
      displayMode: 'light',
      storageMode: 'cloud_hybrid',
      isSimulatedOffline: false,
    };
  });

  const currentUserRef = useRef<UserAccount>(currentUserAccount);
  useEffect(() => {
    currentUserRef.current = currentUserAccount;
  }, [currentUserAccount]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [selectedTxForPrint, setSelectedTxForPrint] = useState<Transaction | null>(null);
  const [isPrintAll, setIsPrintAll] = useState(false);

  // Undo notification
  const [undoToast, setUndoToast] = useState<{ message: string; item: Transaction } | null>(null);

  // Supabase test status
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [checkingSupabase, setCheckingSupabase] = useState(false);

  // App-Wide Real-Time Auto-Sync & Auto-Update State
  const [isAppSyncing, setIsAppSyncing] = useState<boolean>(false);
  const [lastAppSyncedAt, setLastAppSyncedAt] = useState<Date>(new Date());
  const [isApplyingAppUpdate, setIsApplyingAppUpdate] = useState<boolean>(false);
  const [broadcastDismissedAt, setBroadcastDismissedAt] = useState<number>(0);
  const baselineVersionRef = useRef<{ buildId: string | null; forceRefreshAt: number | null }>({
    buildId: null,
    forceRefreshAt: null,
  });
  const isReloadingForUpdateRef = useRef<boolean>(false);

  // Sync DOM with theme & mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.setAttribute('data-mode', currentMode);
    if (currentMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentTheme, currentMode]);

  // Enforce strict per-page & sub-tab permissions (e.g. Commission Only, Commission + Bazar Only, Bazar Only)
  useEffect(() => {
    const perms = getUserPagePermissions(currentUserAccount);
    if (!canAccessNavTab(currentUserAccount, activeTab)) {
      setActiveTab(getDefaultNavTab(currentUserAccount));
    }
    if (entrySubTab === 'invoices' && !perms.canAccessInvoices) {
      setEntrySubTab(getDefaultEntrySubTab(currentUserAccount));
    } else if (entrySubTab === 'bazar' && !perms.canAccessBazar) {
      setEntrySubTab(getDefaultEntrySubTab(currentUserAccount));
    } else if (entrySubTab === 'quick' && !perms.canAccessQuickCash) {
      setEntrySubTab(getDefaultEntrySubTab(currentUserAccount));
    }
  }, [currentUserAccount, activeTab, entrySubTab]);

  // Apply authoritative user & global settings without overwriting saved preferences
  const applyAuthoritativeState = (authoritativeUser?: UserAccount | null, settingsRes?: GlobalAppSettings | null) => {
    if (settingsRes) {
      setGlobalSettings(settingsRes);
      if (settingsRes.currency) {
        localStorage.setItem('zara_preferred_currency', settingsRes.currency);
      }
    }

    if (authoritativeUser) {
      if (authoritativeUser.status === 'disabled') {
        ApiService.clearToken();
        setAuthModalOpen(true);
        return;
      }

      if (authoritativeUser.photoData) {
        ApiService.setPhotoBackup(authoritativeUser.id, authoritativeUser.photoData);
      }
      const fallbackPhotoBackup = ApiService.getPhotoBackup(authoritativeUser.id);
      const effectivePhotoUrl = authoritativeUser.photoUrl || fallbackPhotoBackup || undefined;
      const effectivePhotoData = authoritativeUser.photoData || fallbackPhotoBackup || undefined;

      const resolvedUser: UserAccount = {
        ...authoritativeUser,
        photoUrl: effectivePhotoUrl,
        photoData: effectivePhotoData,
      };

      setCurrentUserAccount(resolvedUser);
      ApiService.setCachedUser(resolvedUser);

      if (authoritativeUser.theme) {
        setCurrentTheme(authoritativeUser.theme);
        localStorage.setItem('zara_preferred_theme', authoritativeUser.theme);
      }
      if (authoritativeUser.displayMode) {
        setCurrentMode(authoritativeUser.displayMode);
        localStorage.setItem('zara_preferred_mode', authoritativeUser.displayMode);
      }
      if (authoritativeUser.language) {
        setCurrentLang(authoritativeUser.language);
        localStorage.setItem('zara_preferred_lang', authoritativeUser.language);
      }
      const nextNumerals =
        authoritativeUser.useBanglaNumerals !== undefined
          ? Boolean(authoritativeUser.useBanglaNumerals)
          : authoritativeUser.language === 'bn';
      setUseBanglaNumerals(nextNumerals);
      localStorage.setItem('zara_preferred_numerals_bn', String(nextNumerals));

      const effectiveHeader = authoritativeUser.headerBgColor ?? settingsRes?.headerBgColor;
      if (effectiveHeader !== undefined) {
        setHeaderBgColor(effectiveHeader || '');
        if (effectiveHeader) localStorage.setItem('zara_header_color', effectiveHeader);
        else localStorage.removeItem('zara_header_color');
      }

      const effectiveSidebar = authoritativeUser.sidebarBgColor ?? settingsRes?.sidebarBgColor;
      if (effectiveSidebar !== undefined) {
        setSidebarBgColor(effectiveSidebar || '');
        if (effectiveSidebar) localStorage.setItem('zara_sidebar_color', effectiveSidebar);
        else localStorage.removeItem('zara_sidebar_color');
      }

      setUser((prev) => ({
        ...prev,
        userId: authoritativeUser.id,
        name: authoritativeUser.name,
        photoUrl: effectivePhotoUrl,
        photoData: effectivePhotoData,
        currency: settingsRes?.currency || prev.currency,
        language: authoritativeUser.language || prev.language,
        useBanglaNumerals: nextNumerals,
        theme: authoritativeUser.theme || prev.theme,
        displayMode: authoritativeUser.displayMode || prev.displayMode,
      }));
    } else if (settingsRes) {
      if (settingsRes.currency) {
        setUser((prev) => ({ ...prev, currency: settingsRes.currency }));
      }
      if (settingsRes.defaultTheme && !localStorage.getItem('zara_preferred_theme')) {
        setCurrentTheme(settingsRes.defaultTheme);
      }
      if (settingsRes.headerBgColor !== undefined && !currentUserRef.current.headerBgColor) {
        setHeaderBgColor(settingsRes.headerBgColor || '');
        if (settingsRes.headerBgColor) localStorage.setItem('zara_header_color', settingsRes.headerBgColor);
        else localStorage.removeItem('zara_header_color');
      }
      if (settingsRes.sidebarBgColor !== undefined && !currentUserRef.current.sidebarBgColor) {
        setSidebarBgColor(settingsRes.sidebarBgColor || '');
        if (settingsRes.sidebarBgColor) localStorage.setItem('zara_sidebar_color', settingsRes.sidebarBgColor);
        else localStorage.removeItem('zara_sidebar_color');
      }
    }
  };

  const hasAttemptedRecoveryRef = useRef(false);

  // Initial load / Full App Sync (with automatic self-healing recovery across updates)
  const loadInitialData = async () => {
    try {
      setIsAppSyncing(true);
      const [settingsRes, meRes, usersRes, txRes, custRes] = await Promise.all([
        ApiService.getGlobalSettings().catch(() => globalSettings),
        ApiService.getMe().catch((err) => {
          if (err?.message?.includes('removed') || err?.message?.includes('suspended')) {
            ApiService.clearToken();
            setAuthModalOpen(true);
          }
          return null;
        }),
        ApiService.getUsers().catch(() => []),
        ApiService.getTransactions(
          selectedWorkspaceUserId || undefined,
          selectedWorkspaceUserId === null
        ).catch(() => StorageService.getTransactions()),
        ApiService.getCustomers().catch(() => []),
      ]);

      if (usersRes) setAllUsersList(usersRes);
      if (txRes) setTransactions(txRes);
      if (custRes) setCustomers(custRes);

      let authoritativeUser =
        meRes?.user ||
        (usersRes && usersRes.length > 0 ? usersRes.find((u) => u.id === currentUserRef.current.id) : undefined);

      // Auto-recover saved photos & any newer records if server container restarted/updated
      if (authoritativeUser && !hasAttemptedRecoveryRef.current) {
        hasAttemptedRecoveryRef.current = true;
        const backupPhoto = ApiService.getPhotoBackup(authoritativeUser.id);
        const savedVault = await VaultStorage.loadVault().catch(() => null);
        const userPhotos: Record<string, string> = {
          ...(savedVault?.userPhotos || {}),
          ...(backupPhoto ? { [authoritativeUser.id]: backupPhoto } : {}),
        };
        const hasVaultData = Boolean(
          savedVault &&
            ((savedVault.users?.length || 0) > 1 ||
              Boolean(savedVault.globalSettings) ||
              (savedVault.transactions?.length || 0) > 0 ||
              (savedVault.customers?.length || 0) > 0 ||
              (savedVault.invoices?.length || 0) > 0 ||
              (savedVault.commissionEntries?.length || 0) > 0 ||
              (savedVault.commissionPersons?.length || 0) > 0 ||
              (savedVault.homeBazarEntries?.length || 0) > 0 ||
              Object.keys(userPhotos).length > 0)
        );
        const needsPhotoRecovery = Boolean(
          (backupPhoto && !authoritativeUser.photoData) || Object.keys(userPhotos).length > 0
        );

        if (needsPhotoRecovery || hasVaultData) {
          try {
            const recRes = await ApiService.recoverIfEmpty({
              userPhotoData: backupPhoto || undefined,
              userPhotos,
              snapshot: hasVaultData ? savedVault : undefined,
            });
            if (recRes?.recovered) {
              if (recRes.user) authoritativeUser = recRes.user;
              const [refreshedSettings, refreshedUsers, refreshedTx, refreshedCust] = await Promise.all([
                ApiService.getGlobalSettings().catch(() => settingsRes),
                ApiService.getUsers().catch(() => usersRes),
                ApiService.getTransactions(
                  selectedWorkspaceUserId || undefined,
                  selectedWorkspaceUserId === null
                ).catch(() => txRes),
                ApiService.getCustomers().catch(() => custRes),
              ]);
              if (refreshedSettings) settingsRes && Object.assign(settingsRes, refreshedSettings);
              if (refreshedUsers) setAllUsersList(refreshedUsers);
              if (refreshedTx) setTransactions(refreshedTx);
              if (refreshedCust) setCustomers(refreshedCust);
              window.dispatchEvent(new CustomEvent('zara-vault-recovered'));
            }
          } catch {
            // non-fatal
          }
        }
      }

      applyAuthoritativeState(authoritativeUser, settingsRes);

      // Save merged authoritative snapshot to IndexedDB + localStorage after recovery
      ApiService.syncVaultNow().catch(() => {});

      setLastAppSyncedAt(new Date());
    } catch {
      const localList = StorageService.getTransactions();
      setTransactions(localList);
    } finally {
      setIsAppSyncing(false);
    }
  };

  const handleIncomingVersionInfo = async (info?: Partial<AppVersionInfo> | null) => {
    if (!info || !info.buildId || isReloadingForUpdateRef.current) return;

    const incomingBuildId = String(info.buildId);
    const incomingForceAt = Number(info.forceRefreshAt) || 0;

    if (baselineVersionRef.current.buildId === null) {
      baselineVersionRef.current = {
        buildId: incomingBuildId,
        forceRefreshAt: incomingForceAt,
      };
      try {
        sessionStorage.setItem('zara_applied_build_id', incomingBuildId);
        sessionStorage.setItem('zara_applied_force_refresh', String(incomingForceAt));
      } catch {}
      return;
    }

    const buildChanged = incomingBuildId !== baselineVersionRef.current.buildId;
    const ownerPushedUpdate =
      baselineVersionRef.current.forceRefreshAt !== null &&
      incomingForceAt > baselineVersionRef.current.forceRefreshAt;

    if (!buildChanged && !ownerPushedUpdate) return;

    // Guard against reload loops on mobile Safari / PWA / slow connections
    try {
      const lastReloadAt = Number(sessionStorage.getItem('zara_last_app_update_reload_at') || '0');
      const appliedBuild = sessionStorage.getItem('zara_applied_build_id');
      const appliedForce = Number(sessionStorage.getItem('zara_applied_force_refresh') || '0');
      if (
        Date.now() - lastReloadAt < 10000 ||
        (appliedBuild === incomingBuildId && incomingForceAt <= appliedForce)
      ) {
        baselineVersionRef.current = { buildId: incomingBuildId, forceRefreshAt: incomingForceAt };
        return;
      }
      sessionStorage.setItem('zara_last_app_update_reload_at', String(Date.now()));
      sessionStorage.setItem('zara_applied_build_id', incomingBuildId);
      sessionStorage.setItem('zara_applied_force_refresh', String(incomingForceAt));
    } catch {}

    isReloadingForUpdateRef.current = true;
    setIsApplyingAppUpdate(true);

    try {
      await ApiService.syncVaultNow().catch(() => {});
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
        if (reg) {
          await reg.update().catch(() => {});
        }
      }
    } catch {}

    setTimeout(() => {
      (window as any).__zaraPageUnloading = true;
      window.location.reload();
    }, 650);
  };

  const checkAppVersionNow = async () => {
    try {
      const info = await ApiService.getAppVersion();
      await handleIncomingVersionInfo(info);
    } catch {
      // ignore transient network check failures
    }
  };

  const hasSyncedCloudOnAuthRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubFirestore = firestoreSyncService.subscribe((fsStatus) => {
      if (
        fsStatus.isVerifiedOwner &&
        fsStatus.uid &&
        currentUserRef.current.role === 'owner' &&
        hasSyncedCloudOnAuthRef.current !== fsStatus.uid
      ) {
        hasSyncedCloudOnAuthRef.current = fsStatus.uid;
        ApiService.syncCloudFirestoreNow()
          .then((res) => {
            if (res.recovered) {
              loadInitialData();
              window.dispatchEvent(new CustomEvent('zara-vault-recovered'));
            }
          })
          .catch((err) => {
            console.warn('Initial Firestore cloud sync error:', err?.message || err);
          });
      } else if (!fsStatus.isAuthenticated) {
        hasSyncedCloudOnAuthRef.current = null;
      }
    });
    return () => {
      unsubFirestore();
    };
  }, [currentUserAccount.id]);

  useEffect(() => {
    loadInitialData();
    checkAppVersionNow();
    checkSupabase();

    // Global real-time event subscription for all modules, all User IDs & app updates
    const unsubscribe = ApiService.subscribeToEvents((event, data) => {
      if ((event === 'connected' || event === 'app_update_available') && data?.buildId) {
        handleIncomingVersionInfo(data);
        if (event === 'connected' && data?.reused) return;
      }

      if (event === 'global_settings_updated' && data?.globalSettings) {
        applyAuthoritativeState(null, data.globalSettings);
        if (data.globalSettings.forceRefreshAt) {
          handleIncomingVersionInfo({
            buildId: baselineVersionRef.current.buildId || 'push',
            forceRefreshAt: data.globalSettings.forceRefreshAt,
          });
        }
      }

      if (event === 'user_updated' && data) {
        const targetId = data.userId;
        if (targetId === currentUserRef.current.id) {
          if (data.type === 'deleted' || data.user?.status === 'disabled') {
            ApiService.clearToken();
            setAuthModalOpen(true);
            return;
          }
          if (data.user) {
            applyAuthoritativeState(data.user, null);
          }
        } else if (data.user) {
          // Immediately reflect updates to other User IDs in allUsersList
          setAllUsersList((prev) => {
            if (data.type === 'deleted') {
              return prev.filter((u) => u.id !== targetId);
            }
            const exists = prev.some((u) => u.id === data.user.id);
            if (exists) {
              return prev.map((u) => (u.id === data.user.id ? data.user : u));
            }
            return [...prev, data.user];
          });
        } else if (data.type === 'deleted' && targetId) {
          setAllUsersList((prev) => prev.filter((u) => u.id !== targetId));
        }
      }

      // Any data change across invoices, transactions, commissions, customers, bazar, or workspaces triggers instant state synchronization
      if (event !== 'connected') {
        loadInitialData();
        if (currentUserRef.current.role === 'owner' && event !== 'app_update_available') {
          ApiService.scheduleVaultSync();
        }
      }
    });

    // Background heartbeat sync every 10 seconds + version check every 10 seconds
    const syncInterval = setInterval(() => {
      loadInitialData();
    }, 10000);

    const versionInterval = setInterval(() => {
      checkAppVersionNow();
    }, 10000);

    // Auto-sync & auto-update check when window / browser tab gains focus, visibility, or reconnects online
    const handleFocusSync = () => {
      loadInitialData();
      checkAppVersionNow();
    };
    window.addEventListener('focus', handleFocusSync);
    window.addEventListener('online', handleFocusSync);
    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible') {
        loadInitialData();
        checkAppVersionNow();
      } else {
        ApiService.syncVaultNow().catch(() => {});
      }
    };
    const handlePageHide = () => {
      ApiService.syncVaultNow().catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibilitySync);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
      clearInterval(versionInterval);
      window.removeEventListener('focus', handleFocusSync);
      window.removeEventListener('online', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [selectedWorkspaceUserId, currentUserAccount.id]);

  const checkSupabase = async () => {
    setCheckingSupabase(true);
    const status = await testSupabaseConnection();
    setSupabaseStatus(status);
    setCheckingSupabase(false);
  };

  const handleUpdateUser = (updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
    if (updates.language) setCurrentLang(updates.language);
    if (updates.useBanglaNumerals !== undefined) setUseBanglaNumerals(updates.useBanglaNumerals);
  };

  const handleApplyTheme = async (newTheme: AppTheme) => {
    setCurrentTheme(newTheme);
    setCurrentUserAccount((prev) => ({ ...prev, theme: newTheme, headerBgColor: undefined, sidebarBgColor: undefined }));
    setUser((prev) => ({ ...prev, theme: newTheme }));
    localStorage.setItem('zara_preferred_theme', newTheme);
    // Clear custom chrome overrides so the selected theme colors take effect immediately
    setHeaderBgColor('');
    setSidebarBgColor('');
    localStorage.removeItem('zara_header_color');
    localStorage.removeItem('zara_sidebar_color');
    try {
      await ApiService.updateUserPreferences(currentUserAccount.id, {
        theme: newTheme,
        headerBgColor: '',
        sidebarBgColor: '',
      });
    } catch {}
  };

  const handleApplyMode = async (newMode: DisplayMode) => {
    setCurrentMode(newMode);
    setCurrentUserAccount((prev) => ({ ...prev, displayMode: newMode }));
    setUser((prev) => ({ ...prev, displayMode: newMode }));
    localStorage.setItem('zara_preferred_mode', newMode);
    try {
      await ApiService.updateUserPreferences(currentUserAccount.id, { displayMode: newMode });
    } catch {}
  };

  const handleApplyLang = async (newLang: Language) => {
    setCurrentLang(newLang);
    setUseBanglaNumerals(newLang === 'bn');
    setUser((prev) => ({ ...prev, language: newLang, useBanglaNumerals: newLang === 'bn' }));
    localStorage.setItem('zara_preferred_lang', newLang);
    localStorage.setItem('zara_preferred_numerals_bn', String(newLang === 'bn'));
    try {
      await ApiService.updateUserPreferences(currentUserAccount.id, {
        language: newLang,
        useBanglaNumerals: newLang === 'bn',
      });
    } catch {}
  };

  const handleApplyNumerals = async (useBnDigits: boolean) => {
    setUseBanglaNumerals(useBnDigits);
    setCurrentUserAccount((prev) => ({ ...prev, useBanglaNumerals: useBnDigits }));
    setUser((prev) => ({ ...prev, useBanglaNumerals: useBnDigits }));
    localStorage.setItem('zara_preferred_numerals_bn', String(useBnDigits));
    try {
      await ApiService.updateUserPreferences(currentUserAccount.id, { useBanglaNumerals: useBnDigits });
    } catch {}
  };

  const handleToggleMode = () => {
    const next = currentMode === 'light' ? 'dark' : 'light';
    handleApplyMode(next);
  };

  const handleToggleLang = () => {
    const next = currentLang === 'bn' ? 'en' : 'bn';
    handleApplyLang(next);
  };

  const handleTransactionAdded = async (newTx: Transaction) => {
    try {
      const saved = await ApiService.createTransaction({
        description: newTx.description,
        amount: newTx.amount,
        type: newTx.type,
        category: newTx.category,
        paymentMethod: newTx.paymentMethod,
        notes: newTx.notes,
        targetWorkspaceUserId: selectedWorkspaceUserId || currentUserAccount.id,
      });
      setTransactions((prev) => [saved, ...prev]);
    } catch {
      const updated = StorageService.saveTransaction(newTx);
      setTransactions(updated);
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    try {
      const updated = await ApiService.updateTransaction(id, updates);
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      const updated = StorageService.updateTransaction(id, updates);
      setTransactions(updated);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const itemToDelete = transactions.find((t) => t.id === id);
    try {
      await ApiService.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      if (itemToDelete) {
        setUndoToast({
          message:
            currentLang === 'bn'
              ? `"${itemToDelete.description}" মুছে ফেলা হয়েছে`
              : `Deleted "${itemToDelete.description}"`,
          item: itemToDelete,
        });
        setTimeout(() => setUndoToast(null), 5000);
      }
    } catch {
      const { updatedList, deletedItem } = StorageService.deleteTransaction(id);
      setTransactions(updatedList);
      if (deletedItem) {
        setUndoToast({
          message:
            currentLang === 'bn'
              ? `"${deletedItem.description}" মুছে ফেলা হয়েছে`
              : `Deleted "${deletedItem.description}"`,
          item: deletedItem,
        });
        setTimeout(() => setUndoToast(null), 5000);
      }
    }
  };

  const handleUndoDelete = () => {
    if (!undoToast) return;
    handleTransactionAdded(undoToast.item);
    setUndoToast(null);
  };

  const openPrintForSingle = (tx: Transaction) => {
    setSelectedTxForPrint(tx);
    setIsPrintAll(false);
    setPrintModalOpen(true);
  };

  const openPrintAll = () => {
    setSelectedTxForPrint(null);
    setIsPrintAll(true);
    setPrintModalOpen(true);
  };

  const handleLoginSuccess = (account: UserAccount, settings: GlobalAppSettings) => {
    applyAuthoritativeState(account, settings);

    if (account.role !== 'owner') {
      setSelectedWorkspaceUserId(account.id);
      const nextSub = getDefaultEntrySubTab(account);
      setEntrySubTab(nextSub);
      if (!canAccessNavTab(account, activeTab)) {
        setActiveTab(getDefaultNavTab(account));
      } else {
        const perms = getUserPagePermissions(account);
        if (perms.isCommissionOnly || perms.isCommissionBazarOnly || perms.isBazarOnly) {
          setActiveTab(getDefaultNavTab(account));
        }
      }
    } else {
      setSelectedWorkspaceUserId(null);
    }
    loadInitialData();
  };

  const handleLogout = async () => {
    await ApiService.logout();
    setAuthModalOpen(true);
  };

  const handlePhotoUpdated = (userId: string, newPhotoUrl?: string) => {
    const backupPhoto = ApiService.getPhotoBackup(userId) || undefined;
    if (currentUserAccount.id === userId) {
      setCurrentUserAccount((prev) => ({
        ...prev,
        photoUrl: newPhotoUrl,
        photoData: newPhotoUrl ? backupPhoto : undefined,
      }));
      setUser((prev) => ({
        ...prev,
        photoUrl: newPhotoUrl,
        photoData: newPhotoUrl ? backupPhoto : undefined,
      }));
    }
    setAllUsersList((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, photoUrl: newPhotoUrl, photoData: newPhotoUrl ? backupPhoto : undefined }
          : u
      )
    );
  };

  const isBn = currentLang === 'bn';
  const userPerms = getUserPagePermissions(currentUserAccount);

  return (
    <div
      style={{
        backgroundColor: 'var(--theme-bg)',
        color: 'var(--theme-text-main)',
      }}
      className="min-h-[100dvh] w-full overflow-x-clip flex font-sans transition-colors duration-200"
    >
      {/* 1. Collapsible Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        currentUser={currentUserAccount}
        globalSettings={globalSettings}
        currentLang={currentLang}
        currentTheme={currentTheme}
        totalTransactionsCount={transactions.length}
        allUsersList={allUsersList}
        selectedWorkspaceUserId={selectedWorkspaceUserId}
        onSelectWorkspace={setSelectedWorkspaceUserId}
        onLogout={handleLogout}
        onOpenPhotoModal={() => setPhotoModalOpen(true)}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        sidebarBgColor={sidebarBgColor}
        onApplyTheme={handleApplyTheme}
        isSyncing={isAppSyncing}
        lastSyncedAt={lastAppSyncedAt}
        onManualSync={loadInitialData}
        onOpenGoogleDriveModal={() => setDriveModalOpen(true)}
      />

      {/* 2. Main Content Canvas with dynamic left padding for Sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0 ${
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'
        }`}
      >
        {/* Top Header */}
        <Header
          user={user}
          currentUserAccount={currentUserAccount}
          globalSettings={globalSettings}
          currentTheme={currentTheme}
          currentMode={currentMode}
          currentLang={currentLang}
          onApplyTheme={handleApplyTheme}
          onToggleMode={handleToggleMode}
          onToggleLang={handleToggleLang}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onOpenPhotoModal={() => setPhotoModalOpen(true)}
          onLogout={handleLogout}
          onToggleSidebarMobile={() => setMobileMenuOpen(true)}
          headerBgColor={headerBgColor}
          onSelectCurrency={handleSelectCurrency}
          isSyncing={isAppSyncing}
          lastSyncedAt={lastAppSyncedAt}
          onManualSync={loadInitialData}
          onOpenGoogleDriveModal={() => setDriveModalOpen(true)}
        />

        {/* Main Viewport Canvas */}
        <div
          className={`flex-1 flex flex-col relative overflow-x-clip transition-colors duration-200 ${
            activeTab === 'dashboard' ? 'bg-[#E5E7EB] dark:bg-[#1E232B]' : ''
          }`}
        >
          {activeTab === 'dashboard' && (
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden text-slate-800/[0.075] dark:text-slate-200/[0.055]"
            >
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern
                    id="zara-dashboard-watermark"
                    width="260"
                    height="170"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(-24)"
                  >
                    <text
                      x="130"
                      y="95"
                      textAnchor="middle"
                      fill="currentColor"
                      fontFamily="Poppins, Inter, system-ui, sans-serif"
                      fontWeight="900"
                      fontSize="38"
                      letterSpacing="8"
                    >
                      ZARA
                    </text>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#zara-dashboard-watermark)" />
              </svg>
            </div>
          )}

          <main
            className={`relative z-10 flex-1 w-full mx-auto py-3 sm:py-6 space-y-4 sm:space-y-6 transition-all duration-200 ${
              activeTab === 'commission'
                ? 'max-w-none px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-10'
                : 'max-w-7xl px-3 sm:px-6'
            }`}
          >
            <MobileInstallBanner isBn={isBn} />

            {/* Auto-Updating App Banner (shown momentarily before smooth reload on new deployments/Owner push) */}
            {isApplyingAppUpdate && (
              <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-3 shadow-lg border border-emerald-400/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>
                    {isBn
                      ? 'নতুন আপডেট পাওয়া গেছে! আপনার অ্যাপ স্বয়ংক্রিয়ভাবে আপডেট হচ্ছে...'
                      : 'New update detected — automatically updating your app...'}
                  </span>
                </div>
              </div>
            )}

            {/* Live Global Broadcast Banner pushed by Owner to all User Apps */}
            {globalSettings.broadcastActive &&
              globalSettings.broadcastMessage?.trim() &&
              globalSettings.updatedAt > broadcastDismissedAt && (
                <div
                  className={`rounded-2xl px-4 py-2.5 border shadow-xs flex items-center justify-between gap-3 text-xs ${
                    globalSettings.broadcastType === 'alert'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                      : globalSettings.broadcastType === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      : globalSettings.broadcastType === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Radio className="w-4 h-4 shrink-0 animate-pulse" />
                    <span className="font-medium truncate">{globalSettings.broadcastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBroadcastDismissedAt(globalSettings.updatedAt || Date.now())}
                    className="p-1 rounded-lg opacity-70 hover:opacity-100 transition cursor-pointer shrink-0"
                    aria-label="Dismiss announcement"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

          {/* TAB 1: World-Class Financial Dashboard Overview */}
          {activeTab === 'dashboard' && userPerms.canAccessDashboard && (
            <DashboardOverview
              transactions={transactions}
              customers={customers}
              user={user}
              currentUserAccount={currentUserAccount}
              currentLang={currentLang}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onQuickAddIncome={() => setActiveTab('entry')}
              onQuickAddExpense={() => setActiveTab('entry')}
              onPrintTransaction={openPrintForSingle}
              onOpenReport={openPrintAll}
              onEditTransaction={(tx) => {
                setActiveTab('ledger');
              }}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {/* TAB 2: Daily Entry (Invoices / Bazar Account / Quick Cash) */}
          {activeTab === 'entry' && userPerms.canAccessEntry && (
            <div className="space-y-6">
              {/* Daily Entry Sub-Tab Selector (only renders permitted sub-tabs) */}
              {(userPerms.canAccessInvoices || userPerms.canAccessQuickCash) && (
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <div className="w-full sm:w-auto flex sm:inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs overflow-x-auto gap-1">
                    {userPerms.canAccessInvoices && (
                      <button
                        onClick={() => setEntrySubTab('invoices')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                          entrySubTab === 'invoices'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>🧾</span>
                        <span>{isBn ? 'ইনভয়েস ও রসিদ' : 'Daily Invoices'}</span>
                      </button>
                    )}
                    {userPerms.canAccessBazar && (
                      <button
                        onClick={() => setEntrySubTab('bazar')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                          entrySubTab === 'bazar'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>🛒</span>
                        <span>{isBn ? 'দৈনিক বাজার খাতা' : 'Daily Bazar'}</span>
                      </button>
                    )}
                    {userPerms.canAccessQuickCash && (
                      <button
                        onClick={() => setEntrySubTab('quick')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                          entrySubTab === 'quick'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>⚡</span>
                        <span>{isBn ? 'কুইক ক্যাশ' : 'Quick Cash'}</span>
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                    {entrySubTab === 'invoices' && (isBn ? 'রিয়াদ টাইম ৫:০০ AM অনুযায়ী দৈনিক ইনভয়েস ও রসিদ' : 'Daily Invoices & Receipts from 5:00 AM Riyadh time')}
                    {entrySubTab === 'bazar' && (isBn ? 'দৈনিক বাজার ও মুদি মালামাল হিসাব (সম্পূর্ণ নিয়ন্ত্রণ ও এডিটেবল)' : 'Daily Bazar, Fresh Market & Grocery Expense Ledger')}
                    {entrySubTab === 'quick' && (isBn ? 'স্বয়ংক্রিয় ক্লাউড সিঙ্ক ক্যাশ ট্রানজ্যাকশন' : 'Auto-Save Cash Income & Expense')}
                  </div>
                </div>
              )}

              {/* Sub-view Rendering */}
              {entrySubTab === 'invoices' && userPerms.canAccessInvoices && (
                <DailyInvoicesView
                  currentUser={currentUserAccount}
                  globalSettings={globalSettings}
                  currentLang={currentLang}
                  currency={user.currency}
                  useBanglaNumerals={useBanglaNumerals}
                  customers={customers}
                  onOpenQuickCash={userPerms.canAccessQuickCash ? () => setEntrySubTab('quick') : undefined}
                  onOpenBazarAccount={userPerms.canAccessBazar ? () => setEntrySubTab('bazar') : undefined}
                />
              )}

              {entrySubTab === 'bazar' && userPerms.canAccessBazar && (
                <HomeBazarLedger
                  currentUser={currentUserAccount}
                  globalSettings={globalSettings}
                  currentLang={currentLang}
                  currency={user.currency}
                  useBanglaNumerals={useBanglaNumerals}
                  onBackToInvoices={userPerms.canAccessInvoices ? () => setEntrySubTab('invoices') : undefined}
                />
              )}

              {entrySubTab === 'quick' && userPerms.canAccessQuickCash && (
                <QuickEntryCard user={user} onTransactionAdded={handleTransactionAdded} />
              )}
            </div>
          )}

          {/* TAB 3: Ledger Book */}
          {activeTab === 'ledger' && userPerms.canAccessLedger && (
            <LedgerList
              transactions={transactions}
              user={user}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onPrintTransaction={openPrintForSingle}
              onPrintAllLedger={openPrintAll}
            />
          )}

          {/* TAB 4: Customers & Vendors CRM */}
          {activeTab === 'customers' && userPerms.canAccessCustomers && (
            <CustomersLedger
              currentUser={currentUserAccount}
              globalSettings={globalSettings}
              currentLang={currentLang}
              currency={user.currency}
              useBanglaNumerals={useBanglaNumerals}
              customers={customers}
              onCustomersUpdated={loadInitialData}
            />
          )}

          {/* TAB 5: Owner Control Center (Owner Only) */}
          {activeTab === 'owner_control' && userPerms.canAccessOwnerControl && (
            <OwnerControlCenter
              currentUser={currentUserAccount}
              globalSettings={globalSettings}
              onUpdateGlobalSettings={setGlobalSettings}
              isBn={isBn}
              onUsersChanged={loadInitialData}
              onSwitchWorkspace={(wsUserId) => {
                setSelectedWorkspaceUserId(wsUserId);
                setActiveTab('dashboard');
              }}
            />
          )}

          {/* TAB 6: Appearance & 4 Themes Settings */}
          {activeTab === 'appearance' && userPerms.canAccessAppearance && (
            <AppearanceSettings
              currentUser={currentUserAccount}
              currentTheme={currentTheme}
              currentMode={currentMode}
              currentLang={currentLang}
              useBanglaNumerals={useBanglaNumerals}
              globalSettings={globalSettings}
              currentCurrency={user.currency}
              currentHeaderColor={headerBgColor}
              currentSidebarColor={sidebarBgColor}
              onApplyTheme={handleApplyTheme}
              onApplyMode={handleApplyMode}
              onApplyLang={handleApplyLang}
              onApplyNumerals={handleApplyNumerals}
              onApplyCurrency={handleSelectCurrency}
              onApplyHeaderColor={handleApplyHeaderColor}
              onApplySidebarColor={handleApplySidebarColor}
              onUpdateGlobalSettings={setGlobalSettings}
            />
          )}

          {/* TAB 7: Commission Sheet (Excel Style) */}
          {activeTab === 'commission' && userPerms.canAccessCommission && (
            <CommissionSheet
              currentUser={currentUserAccount}
              globalSettings={globalSettings}
              currentLang={currentLang}
              useBanglaNumerals={useBanglaNumerals}
            />
          )}

          {/* TAB 8: React Native Code Exporter */}
          {activeTab === 'rn_code' && userPerms.canAccessRnCode && <ReactNativeCodeViewer user={user} />}

          {/* TAB 9: Sync & Audit Logs */}
          {activeTab === 'logs' && userPerms.canAccessLogs && <SyncLogsViewer user={user} />}
        </main>
        </div>

        {/* Corporate Footer */}
        <footer
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-card-border)',
          }}
          className="border-t py-4 mt-auto text-xs text-slate-500 dark:text-slate-400 transition-colors"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-white font-heading">
                {globalSettings.appName || 'ZARA Accounting'}
              </span>
              <span>•</span>
              <span className="font-medium capitalize" style={{ color: 'var(--theme-accent)' }}>
                {currentTheme.replace('-', ' ')} Corporate System
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-400">User: @{currentUserAccount.username}</span>
              <span>•</span>
              <span className="capitalize font-bold text-slate-700 dark:text-slate-300">
                {currentUserAccount.role}
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* 3. Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        currentLang={currentLang}
        currentUser={currentUserAccount}
      />

      {/* Profile Photo Management Modal for Current User */}
      {photoModalOpen && (
        <ProfilePhotoModal
          targetUser={currentUserAccount}
          currentUser={currentUserAccount}
          currentLang={currentLang}
          isOpen={true}
          onClose={() => setPhotoModalOpen(false)}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}

      {/* Auth Modal with separate Owner portal & MFA */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
        isBn={isBn}
        currentLang={currentLang}
        canClose={true}
      />

      {/* Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <span>{undoToast.message}</span>
          <button
            onClick={handleUndoDelete}
            className="text-amber-400 font-bold hover:underline cursor-pointer shrink-0"
          >
            {isBn ? 'বাতিল করুন (Undo)' : 'Undo'}
          </button>
        </div>
      )}

      {/* Corporate Print Voucher & Graphic Invoice Modal (Exact Screenshot Match) */}
      {printModalOpen && (
        <PrintVoucherModal
          transaction={selectedTxForPrint}
          allTransactions={transactions}
          isPrintAll={isPrintAll}
          user={user}
          currentUserAccount={currentUserAccount}
          currentLang={currentLang}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* Google Drive Real-Time Cloud Sync & Backup Modal */}
      <GoogleDriveSyncModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        isBn={currentLang === 'bn'}
        currency={globalSettings.currency}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator isBn={isBn} />
    </div>
  );
}
