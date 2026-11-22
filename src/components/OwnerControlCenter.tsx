import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Crown, 
  UserPlus, 
  ShieldCheck, 
  Settings, 
  Radio, 
  Download, 
  Upload, 
  Check, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Lock, 
  CheckCircle, 
  X, 
  Building2, 
  BarChart3, 
  Coins, 
  Store,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  Camera,
  Mail
} from 'lucide-react';
import { UserAccount, GlobalAppSettings, Transaction } from '../types/accounting';
import { ApiService } from '../services/api';
import { firestoreSyncService, FirestoreSyncStatus } from '../services/firestoreSyncService';
import { formatCurrency, formatDateBangla, formatDateEn, toBanglaDigits } from '../utils/formatters';
import { ProfilePhotoModal } from './ProfilePhotoModal';
import { ZaraLogo } from './ZaraLogo';

interface OwnerControlCenterProps {
  currentUser: UserAccount;
  globalSettings: GlobalAppSettings;
  onUpdateGlobalSettings: (newSettings: GlobalAppSettings) => void;
  isBn: boolean;
  onSwitchWorkspace: (userId: string) => void;
  onUsersChanged?: () => void;
}

export const OwnerControlCenter: React.FC<OwnerControlCenterProps> = ({
  currentUser,
  globalSettings,
  onUpdateGlobalSettings,
  isBn,
  onSwitchWorkspace,
  onUsersChanged,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoModalUser, setPhotoModalUser] = useState<UserAccount | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tabs inside Owner Center
  const [ownerSubTab, setOwnerSubTab] = useState<'users' | 'broadcast' | 'consolidated' | 'backup'>('users');
  const [cloudVaultStatus, setCloudVaultStatus] = useState<FirestoreSyncStatus>(() => firestoreSyncService.getStatus());
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);

  useEffect(() => {
    return firestoreSyncService.subscribe(setCloudVaultStatus);
  }, []);

  const handleConnectAndSyncCloud = async () => {
    try {
      setIsConnectingCloud(true);
      setActionError(null);
      if (!cloudVaultStatus.isVerifiedOwner) {
        const user = await firestoreSyncService.connectCloudVault();
        if (!user) {
          setActionError(
            isBn
              ? 'গুগল সাইন-ইন পপআপ সম্পন্ন হওয়ার আগেই বন্ধ করা হয়েছে। আবার চেষ্টা করুন।'
              : 'Google sign-in popup was closed before completing. Please try again.'
          );
          return;
        }
      }
      const res = await ApiService.syncCloudFirestoreNow();
      await loadData();
      onUsersChanged?.();
      window.dispatchEvent(new CustomEvent('zara-vault-recovered'));
      setActionSuccess(
        res.recovered
          ? isBn
            ? 'ক্লাউড Firestore ভল্ট যুক্ত হয়েছে এবং সকল ইউজার ও ডাটা রিস্টোর হয়েছে।'
            : 'Firebase Cloud Vault connected and missing users & records restored.'
          : isBn
            ? 'ক্লাউড Firestore ভল্ট সিঙ্ক সম্পন্ন হয়েছে — সকল ইউজার ও ডাটা এখন স্থায়ীভাবে সংরক্ষিত।'
            : 'Firebase Cloud Vault synced — all users & data are now permanently saved.'
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to connect Firebase Cloud Vault');
    } finally {
      setIsConnectingCloud(false);
    }
  };

  // Create User Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newIdProvider, setNewIdProvider] = useState<'email' | 'apple'>('email');
  const [newEmail, setNewEmail] = useState('');
  const [newAppleId, setNewAppleId] = useState('');
  const [useEmailAsUserId, setUseEmailAsUserId] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'staff' | 'viewer'>('staff');
  const [newWorkspace, setNewWorkspace] = useState('');
  const [newCanExport, setNewCanExport] = useState(true);
  const [newCanDelete, setNewCanDelete] = useState(false);
  const [newCanAddTransactions, setNewCanAddTransactions] = useState(true);
  const [newCanViewLedger, setNewCanViewLedger] = useState(true);
  const [newCanEditCustomers, setNewCanEditCustomers] = useState(true);
  const [newCanDeleteCustomers, setNewCanDeleteCustomers] = useState(false);
  const [newCanApproveInvoices, setNewCanApproveInvoices] = useState(true);
  const [newCanChangeProfilePhoto, setNewCanChangeProfilePhoto] = useState(true);
  const [newCanManageCommissions, setNewCanManageCommissions] = useState(false);
  const [newCanAddCommissionRecords, setNewCanAddCommissionRecords] = useState(true);
  const [newCanEditCommissionRecords, setNewCanEditCommissionRecords] = useState(true);
  const [newCanDeleteCommissionRecords, setNewCanDeleteCommissionRecords] = useState(false);
  const [newCanPayCommissions, setNewCanPayCommissions] = useState(true);
  const [newCanImportCommissions, setNewCanImportCommissions] = useState(true);
  const [newCanManageCommissionMonths, setNewCanManageCommissionMonths] = useState(true);
  const [newCanAddCommissionPersons, setNewCanAddCommissionPersons] = useState(false);
  const [newCanEditCommissionPersons, setNewCanEditCommissionPersons] = useState(false);
  const [newCanChangeCommissionPersonPhoto, setNewCanChangeCommissionPersonPhoto] = useState(false);
  const [newCanMergeCommissionPersons, setNewCanMergeCommissionPersons] = useState(false);
  const [newCanDeleteCommissionPersons, setNewCanDeleteCommissionPersons] = useState(false);
  const [newCanManageBazar, setNewCanManageBazar] = useState(true);
  const [newCanManageBazarBuyers, setNewCanManageBazarBuyers] = useState(false);
  const [newIsCommissionOnly, setNewIsCommissionOnly] = useState(false);
  const [newIsCommissionBazarOnly, setNewIsCommissionBazarOnly] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editIdProvider, setEditIdProvider] = useState<'email' | 'apple'>('email');
  const [editEmail, setEditEmail] = useState('');
  const [editAppleId, setEditAppleId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<any>('user');
  const [editWorkspace, setEditWorkspace] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');
  const [editCanExport, setEditCanExport] = useState(true);
  const [editCanDelete, setEditCanDelete] = useState(false);
  const [editCanAddTransactions, setEditCanAddTransactions] = useState(true);
  const [editCanViewLedger, setEditCanViewLedger] = useState(true);
  const [editCanEditCustomers, setEditCanEditCustomers] = useState(true);
  const [editCanDeleteCustomers, setEditCanDeleteCustomers] = useState(false);
  const [editCanApproveInvoices, setEditCanApproveInvoices] = useState(true);
  const [editCanChangeProfilePhoto, setEditCanChangeProfilePhoto] = useState(true);
  const [editCanManageCommissions, setEditCanManageCommissions] = useState(false);
  const [editCanAddCommissionRecords, setEditCanAddCommissionRecords] = useState(true);
  const [editCanEditCommissionRecords, setEditCanEditCommissionRecords] = useState(true);
  const [editCanDeleteCommissionRecords, setEditCanDeleteCommissionRecords] = useState(false);
  const [editCanPayCommissions, setEditCanPayCommissions] = useState(true);
  const [editCanImportCommissions, setEditCanImportCommissions] = useState(true);
  const [editCanManageCommissionMonths, setEditCanManageCommissionMonths] = useState(true);
  const [editCanAddCommissionPersons, setEditCanAddCommissionPersons] = useState(false);
  const [editCanEditCommissionPersons, setEditCanEditCommissionPersons] = useState(false);
  const [editCanChangeCommissionPersonPhoto, setEditCanChangeCommissionPersonPhoto] = useState(false);
  const [editCanMergeCommissionPersons, setEditCanMergeCommissionPersons] = useState(false);
  const [editCanDeleteCommissionPersons, setEditCanDeleteCommissionPersons] = useState(false);
  const [editCanManageBazar, setEditCanManageBazar] = useState(true);
  const [editCanManageBazarBuyers, setEditCanManageBazarBuyers] = useState(false);
  const [editIsCommissionOnly, setEditIsCommissionOnly] = useState(false);
  const [editIsCommissionBazarOnly, setEditIsCommissionBazarOnly] = useState(false);

  const applyCommissionOnlyPresetToCreate = () => {
    setNewRole('staff');
    setNewIsCommissionOnly(true);
    setNewIsCommissionBazarOnly(false);
    setNewCanManageCommissions(true);
    setNewCanAddCommissionRecords(true);
    setNewCanEditCommissionRecords(true);
    setNewCanDeleteCommissionRecords(false);
    setNewCanPayCommissions(true);
    setNewCanImportCommissions(true);
    setNewCanManageCommissionMonths(true);
    setNewCanAddCommissionPersons(false);
    setNewCanEditCommissionPersons(false);
    setNewCanChangeCommissionPersonPhoto(false);
    setNewCanMergeCommissionPersons(false);
    setNewCanDeleteCommissionPersons(false);
    setNewCanAddTransactions(false);
    setNewCanViewLedger(false);
    setNewCanEditCustomers(false);
    setNewCanDeleteCustomers(false);
    setNewCanApproveInvoices(false);
    setNewCanManageBazar(false);
    setNewCanManageBazarBuyers(false);
    setNewCanChangeProfilePhoto(true);
    setNewCanDelete(false);
    setNewCanExport(true);
  };

  const applyCommissionBazarOnlyPresetToCreate = () => {
    setNewRole('staff');
    setNewIsCommissionOnly(false);
    setNewIsCommissionBazarOnly(true);
    setNewCanManageCommissions(true);
    setNewCanAddCommissionRecords(true);
    setNewCanEditCommissionRecords(true);
    setNewCanDeleteCommissionRecords(false);
    setNewCanPayCommissions(true);
    setNewCanImportCommissions(true);
    setNewCanManageCommissionMonths(true);
    setNewCanAddCommissionPersons(false);
    setNewCanEditCommissionPersons(false);
    setNewCanChangeCommissionPersonPhoto(false);
    setNewCanMergeCommissionPersons(false);
    setNewCanDeleteCommissionPersons(false);
    setNewCanManageBazar(true);
    setNewCanAddTransactions(false);
    setNewCanViewLedger(false);
    setNewCanEditCustomers(false);
    setNewCanDeleteCustomers(false);
    setNewCanApproveInvoices(false);
    setNewCanManageBazarBuyers(false);
    setNewCanChangeProfilePhoto(true);
    setNewCanDelete(false);
    setNewCanExport(true);
  };

  const applyCommissionOnlyPresetToEdit = () => {
    setEditRole('staff');
    setEditIsCommissionOnly(true);
    setEditIsCommissionBazarOnly(false);
    setEditCanManageCommissions(true);
    setEditCanAddCommissionRecords(true);
    setEditCanEditCommissionRecords(true);
    setEditCanDeleteCommissionRecords(false);
    setEditCanPayCommissions(true);
    setEditCanImportCommissions(true);
    setEditCanManageCommissionMonths(true);
    setEditCanAddCommissionPersons(false);
    setEditCanEditCommissionPersons(false);
    setEditCanChangeCommissionPersonPhoto(false);
    setEditCanMergeCommissionPersons(false);
    setEditCanDeleteCommissionPersons(false);
    setEditCanAddTransactions(false);
    setEditCanViewLedger(false);
    setEditCanEditCustomers(false);
    setEditCanDeleteCustomers(false);
    setEditCanApproveInvoices(false);
    setEditCanManageBazar(false);
    setEditCanManageBazarBuyers(false);
    setEditCanChangeProfilePhoto(true);
    setEditCanDelete(false);
    setEditCanExport(true);
  };

  const applyCommissionBazarOnlyPresetToEdit = () => {
    setEditRole('staff');
    setEditIsCommissionOnly(false);
    setEditIsCommissionBazarOnly(true);
    setEditCanManageCommissions(true);
    setEditCanAddCommissionRecords(true);
    setEditCanEditCommissionRecords(true);
    setEditCanDeleteCommissionRecords(false);
    setEditCanPayCommissions(true);
    setEditCanImportCommissions(true);
    setEditCanManageCommissionMonths(true);
    setEditCanAddCommissionPersons(false);
    setEditCanEditCommissionPersons(false);
    setEditCanChangeCommissionPersonPhoto(false);
    setEditCanMergeCommissionPersons(false);
    setEditCanDeleteCommissionPersons(false);
    setEditCanManageBazar(true);
    setEditCanAddTransactions(false);
    setEditCanViewLedger(false);
    setEditCanEditCustomers(false);
    setEditCanDeleteCustomers(false);
    setEditCanApproveInvoices(false);
    setEditCanManageBazarBuyers(false);
    setEditCanChangeProfilePhoto(true);
    setEditCanDelete(false);
    setEditCanExport(true);
  };

  // Broadcast & Global App Settings state
  const [appName, setAppName] = useState(globalSettings.appName);
  const [companyName, setCompanyName] = useState(globalSettings.companyName);
  const [appVersion, setAppVersion] = useState(globalSettings.version || '2.5.0-gold');
  const [broadcastMessage, setBroadcastMessage] = useState(globalSettings.broadcastMessage);
  const [broadcastType, setBroadcastType] = useState(globalSettings.broadcastType);
  const [broadcastActive, setBroadcastActive] = useState(globalSettings.broadcastActive);
  const [currency, setCurrency] = useState(globalSettings.currency);
  const [isPushingUpdate, setIsPushingUpdate] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userList, txList] = await Promise.all([
        ApiService.getUsers(),
        ApiService.getTransactions(undefined, true), // all = true for owner
      ]);
      setUsers(userList);
      setAllTransactions(txList);
    } catch (err: any) {
      console.error('Failed to load owner data:', err);
      setActionError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAppName(globalSettings.appName);
    setCompanyName(globalSettings.companyName);
    setAppVersion(globalSettings.version || '2.5.0-gold');
    setBroadcastMessage(globalSettings.broadcastMessage);
    setBroadcastType(globalSettings.broadcastType);
    setBroadcastActive(globalSettings.broadcastActive);
    setCurrency(globalSettings.currency);
  }, [globalSettings]);

  useEffect(() => {
    loadData();
    const unsubscribe = ApiService.subscribeToEvents((event, data) => {
      if (
        (event === 'connected' && !data?.reused) ||
        event === 'user_updated' ||
        event === 'user_created' ||
        event === 'user_deleted' ||
        event === 'bazar_buyers_updated' ||
        event === 'global_settings_updated' ||
        event === 'database_restored'
      ) {
        loadData();
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const isValidEmailAddress = (val: string) =>
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(val.trim());

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawMail = (newIdProvider === 'apple' ? (newAppleId || newEmail) : newEmail).trim().toLowerCase();
    const resolvedUsername = (useEmailAsUserId && rawMail ? rawMail : newUsername).trim().toLowerCase();

    if (!rawMail || !isValidEmailAddress(rawMail)) {
      setActionError(
        isBn
          ? 'User ID তৈরি করতে সঠিক মেইল অ্যাড্রেস বা Apple ID ইমেইল দেওয়া বাধ্যতামূলক!'
          : 'A valid Mail Address or Apple ID email is required to create a User ID.'
      );
      return;
    }

    if (!resolvedUsername || !newPassword || !newName) {
      setActionError(isBn ? 'সবগুলো প্রয়োজনীয় ফিল্ড পূরণ করুন' : 'Fill all required fields');
      return;
    }

    try {
      const created = await ApiService.createUser({
        username: resolvedUsername,
        email: rawMail,
        appleId: newIdProvider === 'apple' ? rawMail : (newAppleId.trim().toLowerCase() || undefined),
        idProvider: newIdProvider,
        name: newName,
        password: newPassword,
        role: newRole,
        workspaceName: newWorkspace || `${newName}'s Workspace`,
        canExport: newCanExport,
        canDelete: newCanDelete,
        canAddTransactions: newCanAddTransactions,
        canViewLedger: newCanViewLedger,
        canEditCustomers: newCanEditCustomers,
        canDeleteCustomers: newCanDeleteCustomers,
        canApproveInvoices: newCanApproveInvoices,
        canChangeProfilePhoto: newCanChangeProfilePhoto,
        canManageCommissions: newCanManageCommissions,
        canAddCommissionRecords: newCanAddCommissionRecords,
        canEditCommissionRecords: newCanEditCommissionRecords,
        canDeleteCommissionRecords: newCanDeleteCommissionRecords,
        canPayCommissions: newCanPayCommissions,
        canImportCommissions: newCanImportCommissions,
        canManageCommissionMonths: newCanManageCommissionMonths,
        canAddCommissionPersons: newCanAddCommissionPersons,
        canEditCommissionPersons: newCanEditCommissionPersons,
        canChangeCommissionPersonPhoto: newCanChangeCommissionPersonPhoto,
        canMergeCommissionPersons: newCanMergeCommissionPersons,
        canDeleteCommissionPersons: newCanDeleteCommissionPersons,
        canManageBazar: newCanManageBazar,
        canManageBuyers: newCanManageBazarBuyers,
        canManageBazarBuyers: newCanManageBazarBuyers,
        isCommissionOnly: newIsCommissionOnly,
        isCommissionBazarOnly: newIsCommissionBazarOnly,
      });

      setUsers((prev) => [...prev, created]);
      onUsersChanged?.();
      ApiService.syncVaultNow().catch(() => {});
      setShowCreateModal(false);
      setNewIdProvider('email');
      setNewEmail('');
      setNewAppleId('');
      setUseEmailAsUserId(true);
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewWorkspace('');
      setNewCanDeleteCustomers(false);
      setNewCanChangeProfilePhoto(true);
      setNewCanAddCommissionRecords(true);
      setNewCanEditCommissionRecords(true);
      setNewCanDeleteCommissionRecords(false);
      setNewCanPayCommissions(true);
      setNewCanImportCommissions(true);
      setNewCanManageCommissionMonths(true);
      setNewCanAddCommissionPersons(false);
      setNewCanEditCommissionPersons(false);
      setNewCanChangeCommissionPersonPhoto(false);
      setNewCanMergeCommissionPersons(false);
      setNewCanDeleteCommissionPersons(false);
      setNewCanManageBazarBuyers(false);
      setNewIsCommissionOnly(false);
      setNewIsCommissionBazarOnly(false);
      triggerToast(isBn ? `ইউজার "${created.name}" সফলভাবে তৈরি ও অটো-সিঙ্ক হয়েছে!` : `User "${created.name}" created & auto-synced!`);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Edit User Handler
  const startEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setEditIdProvider(u.idProvider === 'apple' || u.appleId ? 'apple' : 'email');
    setEditEmail(u.email || (u.username.includes('@') ? u.username : ''));
    setEditAppleId(u.appleId || '');
    setEditName(u.name);
    setEditPassword('');
    setEditRole(u.role);
    setEditWorkspace(u.workspaceName);
    setEditStatus(u.status);
    setEditCanExport(u.canExport);
    setEditCanDelete(u.canDelete);
    setEditCanAddTransactions(u.canAddTransactions ?? true);
    setEditCanViewLedger(u.canViewLedger ?? true);
    setEditCanEditCustomers(u.canEditCustomers ?? true);
    setEditCanDeleteCustomers(u.canDeleteCustomers ?? (u.role === 'owner' || u.role === 'admin' || Boolean(u.canDelete)));
    setEditCanApproveInvoices(u.canApproveInvoices ?? true);
    setEditCanChangeProfilePhoto(u.canChangeProfilePhoto ?? true);
    setEditCanManageCommissions(u.canManageCommissions ?? false);
    setEditCanAddCommissionRecords(u.canAddCommissionRecords ?? Boolean(u.canManageCommissions));
    setEditCanEditCommissionRecords(u.canEditCommissionRecords ?? Boolean(u.canManageCommissions));
    setEditCanDeleteCommissionRecords(u.canDeleteCommissionRecords ?? (Boolean(u.canManageCommissions) && Boolean(u.canDelete)));
    setEditCanPayCommissions(u.canPayCommissions ?? Boolean(u.canManageCommissions));
    setEditCanImportCommissions(u.canImportCommissions ?? Boolean(u.canManageCommissions));
    setEditCanManageCommissionMonths(u.canManageCommissionMonths ?? Boolean(u.canManageCommissions));
    setEditCanAddCommissionPersons(u.canAddCommissionPersons ?? false);
    setEditCanEditCommissionPersons(u.canEditCommissionPersons ?? Boolean(u.canAddCommissionPersons));
    setEditCanChangeCommissionPersonPhoto(
      u.canChangeCommissionPersonPhoto ?? (u.role === 'owner' || (u.role === 'admin' && u.canEditCommissionPersons !== false))
    );
    setEditCanMergeCommissionPersons(u.canMergeCommissionPersons ?? false);
    setEditCanDeleteCommissionPersons(u.canDeleteCommissionPersons ?? false);
    setEditCanManageBazar(u.canManageBazar ?? true);
    setEditCanManageBazarBuyers(u.role === 'owner' ? true : Boolean(u.canManageBazarBuyers));
    setEditIsCommissionOnly(Boolean(u.isCommissionOnly));
    setEditIsCommissionBazarOnly(Boolean(u.isCommissionBazarOnly));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanEmail = editEmail.trim().toLowerCase();
    const cleanAppleId = editAppleId.trim().toLowerCase();
    const effectiveMail = editIdProvider === 'apple' ? (cleanAppleId || cleanEmail) : cleanEmail;

    if (effectiveMail && !isValidEmailAddress(effectiveMail)) {
      setActionError(
        isBn
          ? 'সঠিক মেইল অ্যাড্রেস / Apple ID ইমেইল লিখুন'
          : 'Please enter a valid Mail Address / Apple ID email'
      );
      return;
    }

    try {
      const updated = await ApiService.updateUser(editingUser.id, {
        email: effectiveMail || '',
        appleId: editIdProvider === 'apple' ? (effectiveMail || '') : (cleanAppleId || ''),
        idProvider: editIdProvider,
        name: editName,
        password: editPassword || undefined,
        role: editRole,
        workspaceName: editWorkspace,
        status: editStatus,
        canExport: editCanExport,
        canDelete: editCanDelete,
        canAddTransactions: editCanAddTransactions,
        canViewLedger: editCanViewLedger,
        canEditCustomers: editCanEditCustomers,
        canDeleteCustomers: editCanDeleteCustomers,
        canApproveInvoices: editCanApproveInvoices,
        canChangeProfilePhoto: editCanChangeProfilePhoto,
        canManageCommissions: editCanManageCommissions,
        canAddCommissionRecords: editCanAddCommissionRecords,
        canEditCommissionRecords: editCanEditCommissionRecords,
        canDeleteCommissionRecords: editCanDeleteCommissionRecords,
        canPayCommissions: editCanPayCommissions,
        canImportCommissions: editCanImportCommissions,
        canManageCommissionMonths: editCanManageCommissionMonths,
        canAddCommissionPersons: editCanAddCommissionPersons,
        canEditCommissionPersons: editCanEditCommissionPersons,
        canChangeCommissionPersonPhoto: editCanChangeCommissionPersonPhoto,
        canMergeCommissionPersons: editCanMergeCommissionPersons,
        canDeleteCommissionPersons: editCanDeleteCommissionPersons,
        canManageBazar: editCanManageBazar,
        canManageBuyers: editCanManageBazarBuyers,
        canManageBazarBuyers: editCanManageBazarBuyers,
        isCommissionOnly: editIsCommissionOnly,
        isCommissionBazarOnly: editIsCommissionBazarOnly,
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onUsersChanged?.();
      ApiService.syncVaultNow().catch(() => {});
      setEditingUser(null);
      triggerToast(isBn ? 'ইউজার তথ্য আপডেট সম্পন্ন হয়েছে!' : 'User account updated successfully!');
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Dedicated 1-Click Toggle for Commission Sheet Only
  const handleToggleCommissionOnly = async (targetUser: UserAccount) => {
    if (targetUser.role === 'owner') return;
    const willBeCommOnly = !targetUser.isCommissionOnly;

    const updates: Partial<UserAccount> = willBeCommOnly
      ? {
          isCommissionOnly: true,
          isCommissionBazarOnly: false,
          canManageCommissions: true,
          canAddCommissionRecords: true,
          canEditCommissionRecords: true,
          canDeleteCommissionRecords: false,
          canPayCommissions: true,
          canImportCommissions: true,
          canManageCommissionMonths: true,
          canAddTransactions: false,
          canViewLedger: false,
          canEditCustomers: false,
          canDeleteCustomers: false,
          canApproveInvoices: false,
          canChangeProfilePhoto: true,
          canChangeCommissionPersonPhoto: false,
          canManageBazar: false,
          canManageBuyers: false,
          canManageBazarBuyers: false,
          canExport: true,
          canDelete: false,
        }
      : {
          isCommissionOnly: false,
          isCommissionBazarOnly: false,
          canManageCommissions: true,
          canAddTransactions: true,
          canViewLedger: true,
          canEditCustomers: true,
          canApproveInvoices: true,
          canManageBazar: true,
          canExport: true,
        };

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u))
    );

    try {
      const updated = await ApiService.updateUser(targetUser.id, updates);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onUsersChanged?.();
      ApiService.syncVaultNow().catch(() => {});
      triggerToast(
        willBeCommOnly
          ? (isBn ? `"${targetUser.name}" কে শুধু কমিশন শিট দেখার অনুমতি দেয়া হয়েছে!` : `User "${targetUser.name}" restricted to Commission Sheet only!`)
          : (isBn ? `"${targetUser.name}" এর সকল হিসাব ও খতিয়ান অনুমতি ফিরিয়ে দেয়া হয়েছে!` : `Standard permissions restored for "${targetUser.name}"!`)
      );
    } catch (err: any) {
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? targetUser : u)));
      setActionError(err.message);
    }
  };

  // Dedicated 1-Click Toggle for Commission Sheet + Daily Bazar Only
  const handleToggleCommissionBazarOnly = async (targetUser: UserAccount) => {
    if (targetUser.role === 'owner') return;
    const willBeCommBazarOnly = !targetUser.isCommissionBazarOnly;

    const updates: Partial<UserAccount> = willBeCommBazarOnly
      ? {
          isCommissionOnly: false,
          isCommissionBazarOnly: true,
          canManageCommissions: true,
          canAddCommissionRecords: true,
          canEditCommissionRecords: true,
          canDeleteCommissionRecords: false,
          canPayCommissions: true,
          canImportCommissions: true,
          canManageCommissionMonths: true,
          canChangeCommissionPersonPhoto: false,
          canManageBazar: true,
          canAddTransactions: false,
          canViewLedger: false,
          canEditCustomers: false,
          canDeleteCustomers: false,
          canApproveInvoices: false,
          canChangeProfilePhoto: true,
          canManageBuyers: false,
          canManageBazarBuyers: false,
          canExport: true,
          canDelete: false,
        }
      : {
          isCommissionOnly: false,
          isCommissionBazarOnly: false,
          canManageCommissions: true,
          canManageBazar: true,
          canAddTransactions: true,
          canViewLedger: true,
          canEditCustomers: true,
          canApproveInvoices: true,
          canExport: true,
        };

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, ...updates } : u))
    );

    try {
      const updated = await ApiService.updateUser(targetUser.id, updates);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onUsersChanged?.();
      triggerToast(
        willBeCommBazarOnly
          ? (isBn ? `"${targetUser.name}" কে শুধু কমিশন ও বাজার পেজের অনুমতি দেয়া হয়েছে!` : `User "${targetUser.name}" restricted to Commission & Bazar pages only!`)
          : (isBn ? `"${targetUser.name}" এর সকল হিসাব ও খতিয়ান অনুমতি ফিরিয়ে দেয়া হয়েছে!` : `Standard permissions restored for "${targetUser.name}"!`)
      );
    } catch (err: any) {
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? targetUser : u)));
      setActionError(err.message);
    }
  };

  // Toggle user status (Activate / Disable)
  const handleToggleStatus = async (user: UserAccount) => {
    if (user.role === 'owner') return;
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      const updated = await ApiService.updateUser(user.id, { status: newStatus });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onUsersChanged?.();
      triggerToast(
        newStatus === 'disabled' 
          ? (isBn ? `"${user.name}" এর অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে` : `User ${user.name} disabled`)
          : (isBn ? `"${user.name}" এর অ্যাকাউন্ট সক্রিয় করা হয়েছে` : `User ${user.name} activated`)
      );
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Trigger Delete User Modal (Safe for iFrame, no window.confirm)
  const handleDeleteUser = (user: UserAccount) => {
    if (user.role === 'owner') {
      setActionError(isBn ? 'মেইন ওনার একাউন্ট ডিলিট করা সম্ভব নয়' : 'Cannot delete the Primary Owner account');
      return;
    }
    setUserToDelete(user);
  };

  // Perform permanent user deletion
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.role === 'owner') {
      setActionError(isBn ? 'মেইন ওনার একাউন্ট ডিলিট করা সম্ভব নয়' : 'Cannot delete the Primary Owner account');
      setUserToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await ApiService.deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      onUsersChanged?.();
      triggerToast(isBn ? `ইউজার "${userToDelete.name}" সফলভাবে মুছে ফেলা হয়েছে` : `User "${userToDelete.name}" deleted successfully`);
      setUserToDelete(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  // 1-Click Interactive Permission Toggle
  const handleTogglePermission = async (
    targetUser: UserAccount,
    permKey:
      | 'canAddTransactions'
      | 'canViewLedger'
      | 'canEditCustomers'
      | 'canDeleteCustomers'
      | 'canApproveInvoices'
      | 'canChangeProfilePhoto'
      | 'canManageCommissions'
      | 'canAddCommissionRecords'
      | 'canEditCommissionRecords'
      | 'canDeleteCommissionRecords'
      | 'canPayCommissions'
      | 'canImportCommissions'
      | 'canManageCommissionMonths'
      | 'canAddCommissionPersons'
      | 'canEditCommissionPersons'
      | 'canChangeCommissionPersonPhoto'
      | 'canMergeCommissionPersons'
      | 'canDeleteCommissionPersons'
      | 'canManageBazar'
      | 'canManageBazarBuyers'
      | 'canExport'
      | 'canDelete'
  ) => {
    if (targetUser.role === 'owner') return;
    const resolveCurrentPerm = (): boolean => {
      if (permKey === 'canManageBazarBuyers') {
        return targetUser.canManageBazarBuyers === true;
      }
      if (targetUser[permKey] !== undefined) return Boolean(targetUser[permKey]);
      if (permKey === 'canChangeProfilePhoto') {
        return true;
      }
      if (permKey === 'canDeleteCustomers') {
        return targetUser.role === 'owner' || targetUser.role === 'admin' || Boolean(targetUser.canDelete);
      }
      if (permKey === 'canChangeCommissionPersonPhoto') {
        return targetUser.role === 'owner' || (targetUser.role === 'admin' && targetUser.canEditCommissionPersons !== false);
      }
      if (permKey === 'canDelete' || permKey === 'canManageCommissions' || permKey === 'canAddCommissionPersons' || permKey === 'canMergeCommissionPersons' || permKey === 'canDeleteCommissionPersons') {
        return false;
      }
      if (permKey === 'canEditCommissionPersons') {
        return Boolean(targetUser.canAddCommissionPersons);
      }
      if (permKey === 'canDeleteCommissionRecords') {
        return Boolean(targetUser.canManageCommissions) && Boolean(targetUser.canDelete);
      }
      if (
        permKey === 'canAddCommissionRecords' ||
        permKey === 'canEditCommissionRecords' ||
        permKey === 'canPayCommissions' ||
        permKey === 'canImportCommissions' ||
        permKey === 'canManageCommissionMonths'
      ) {
        return Boolean(targetUser.canManageCommissions);
      }
      return true;
    };
    const currentVal = resolveCurrentPerm();
    const newVal = !currentVal;

    const extraUpdates: Partial<UserAccount> = {};
    if (permKey === 'canManageBazarBuyers') {
      extraUpdates.canManageBuyers = newVal;
    }
    if (
      (permKey === 'canAddTransactions' ||
        permKey === 'canViewLedger' ||
        permKey === 'canEditCustomers' ||
        permKey === 'canApproveInvoices') &&
      newVal
    ) {
      extraUpdates.isCommissionOnly = false;
      extraUpdates.isCommissionBazarOnly = false;
    } else if (permKey === 'canManageBazar' && newVal && targetUser.isCommissionOnly) {
      extraUpdates.isCommissionOnly = false;
      if (targetUser.canManageCommissions) {
        extraUpdates.isCommissionBazarOnly = true;
      }
    } else if (permKey === 'canManageBazar' && !newVal && targetUser.isCommissionBazarOnly) {
      extraUpdates.isCommissionBazarOnly = false;
      if (targetUser.canManageCommissions) {
        extraUpdates.isCommissionOnly = true;
      }
    } else if (permKey === 'canManageCommissions' && !newVal) {
      extraUpdates.isCommissionOnly = false;
      extraUpdates.isCommissionBazarOnly = false;
    }

    const payload = { [permKey]: newVal, ...extraUpdates };

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, ...payload } : u))
    );

    try {
      const updated = await ApiService.updateUser(targetUser.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      onUsersChanged?.();
      ApiService.syncVaultNow().catch(() => {});
      triggerToast(
        isBn
          ? `"${targetUser.name}" এর অনুমতি আপডেট সম্পন্ন হয়েছে`
          : `Updated permission for ${targetUser.name}`
      );
    } catch (err: any) {
      // Revert on error
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? targetUser : u))
      );
      setActionError(err.message || 'Failed to update permission');
    }
  };

  // Save Global Settings
  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await ApiService.updateGlobalSettings({
        appName,
        companyName,
        version: appVersion,
        broadcastMessage,
        broadcastType,
        broadcastActive,
        currency,
        forceRefreshClients: true,
      });
      onUpdateGlobalSettings(updated);
      ApiService.syncVaultNow().catch(() => {});
      triggerToast(isBn ? 'গ্লোবাল সেটিংস ও ব্রডকাস্ট নোটিশ সকল ইউজারের অ্যাপে অটো-আপডেট হয়েছে!' : 'Global app settings saved — all user apps auto-updating now!');
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handlePushUpdateToAllUsers = async () => {
    setIsPushingUpdate(true);
    try {
      const updated = await ApiService.updateGlobalSettings({
        appName,
        companyName,
        version: appVersion,
        broadcastMessage,
        broadcastType,
        broadcastActive,
        currency,
        forceRefreshClients: true,
      });
      onUpdateGlobalSettings(updated);
      await ApiService.syncVaultNow().catch(() => {});
      triggerToast(
        isBn
          ? 'সকল ইউজারের অ্যাপে অটো-আপডেট ও রিফ্রেশ পাঠানো হয়েছে!'
          : 'Auto-update pushed! Every connected user app is updating now.'
      );
    } catch (err: any) {
      setActionError(err.message || 'Failed to push update');
    } finally {
      setIsPushingUpdate(false);
    }
  };

  // Backup & Restore
  const handleDownloadBackup = async () => {
    try {
      const backup = await ApiService.downloadBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zara_cloud_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast(isBn ? 'ডাটাবেজ ব্যাকআপ ডাউনলোড সফল হয়েছে!' : 'Cloud database backup downloaded successfully!');
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Per Workspace Consolidated Stats Calculation
  const workspaceStats = users.map((u) => {
    const userTxs = allTransactions.filter((t) => t.workspaceUserId === u.id);
    const inc = userTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = userTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return {
      user: u,
      txCount: userTxs.length,
      income: inc,
      expense: exp,
      balance: inc - exp,
    };
  });

  const totalSystemIncome = allTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalSystemExpense = allTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalSystemBalance = totalSystemIncome - totalSystemExpense;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Toast notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* Owner Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-xl relative overflow-hidden border border-amber-500/30">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ZaraLogo size="lg" showText={false} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">
                  {isBn ? 'মেইন ওনার কন্ট্রোল সেন্টার' : 'Main Owner Control Center'}
                </h1>
                <span className="bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                  <Crown className="w-3 h-3" />
                  Primary Owner Authority
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {isBn 
                  ? `লগইন ইউজার: ${currentUser.name} (${currentUser.username}) • মোট ${users.length}টি ওয়ার্কস্পেস ও ক্লাউড ডাটাবেজ নিয়ন্ত্রণ` 
                  : `Signed in: ${currentUser.name} (${currentUser.username}) • Managing ${users.length} workspace(s) & cloud database`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{isBn ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isBn ? 'নতুন ইউজার তৈরি করুন' : 'Add New User'}</span>
            </button>
          </div>
        </div>

        {/* Transferred System Notice Box inside Owner Control Box */}
        {globalSettings.broadcastMessage && (
          <div className="mt-5 p-3.5 rounded-xl bg-slate-950/70 border border-amber-400/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <Radio className="w-4 h-4 animate-pulse" />
              </span>
              <div className="text-xs">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-bold text-amber-300">
                    {isBn ? 'ক্লাউড সিস্টেম ব্রডকাস্ট নোটিশ' : 'Cloud System Broadcast Notice'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${globalSettings.broadcastActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
                    {globalSettings.broadcastActive ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
                  </span>
                </div>
                <p className="text-amber-100 font-medium text-[11px] leading-relaxed">
                  {globalSettings.broadcastMessage}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOwnerSubTab('broadcast')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 hover:text-black rounded-lg text-xs font-bold shadow-xs transition shrink-0 self-end sm:self-auto cursor-pointer"
            >
              {isBn ? 'নোটিশ এডিট করুন' : 'Manage Notice'}
            </button>
          </div>
        )}

        {/* Sub Navigation Tabs */}
        <div className="flex gap-2 mt-6 border-t border-slate-800 pt-3 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setOwnerSubTab('users')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              ownerSubTab === 'users'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isBn ? `ইউজার অ্যাকাউন্টস (${users.length} জন)` : `User Accounts (${users.length})`}</span>
          </button>

          <button
            onClick={() => setOwnerSubTab('consolidated')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              ownerSubTab === 'consolidated'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{isBn ? 'সম্মিলিত মাস্টার খতিয়ান (সকল ব্রাঞ্চ)' : 'Consolidated Workspaces'}</span>
          </button>

          <button
            onClick={() => setOwnerSubTab('broadcast')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              ownerSubTab === 'broadcast'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isBn ? 'গ্লোবাল নোটিশ ও ব্রডকাস্ট' : 'Global Settings & Broadcast'}</span>
          </button>

          <button
            onClick={() => setOwnerSubTab('backup')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              ownerSubTab === 'backup'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isBn ? 'ক্লাউড ব্যাকআপ ও রিস্টোর' : 'Cloud Backup & Restore'}</span>
          </button>
        </div>
      </div>

      {/* SubTab 1: User Management */}
      {ownerSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isBn ? 'সকল ইউজার অ্যাকাউন্ট ও পারমিশন কন্ট্রোল' : 'User Accounts & Permission Control'}
              </h2>
              <p className="text-xs text-slate-500">
                {isBn 
                  ? 'শুধুমাত্র ওনার নতুন ইউজার আইডি/পাসওয়ার্ড তৈরি ও পরিবর্তন করতে পারেন। প্রতিটি ইউজারের হিসাব সম্পূর্ণ আলাদা ও সুরক্ষিত।'
                  : 'Only the Owner can create User IDs, passwords, and permissions. Each user has a private accounting workspace.'}
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
              {users.length} {isBn ? 'জন সক্রিয়/মোট' : 'Total Accounts'}
            </span>
          </div>

          <div
            className={`px-4 sm:px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              cloudVaultStatus.isVerifiedOwner
                ? 'bg-emerald-50/70 border-emerald-100'
                : 'bg-amber-50/80 border-amber-100'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2.5 text-xs">
              <ShieldCheck
                className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${
                  cloudVaultStatus.isVerifiedOwner ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              <div>
                <p className="font-bold text-slate-900">
                  {cloudVaultStatus.isVerifiedOwner
                    ? isBn
                      ? `Firebase ক্লাউড ভল্ট সক্রিয় (${cloudVaultStatus.email})`
                      : `Firebase Cloud Vault Active (${cloudVaultStatus.email})`
                    : isBn
                      ? 'প্রতিটি আপডেটে ইউজার স্থায়ীভাবে সংরক্ষণ করতে Firebase ক্লাউড ভল্ট যুক্ত করুন'
                      : 'Connect Firebase Cloud Vault so added Users & Data survive every app update'}
                </p>
                <p className="text-[11px] text-slate-600">
                  {cloudVaultStatus.isVerifiedOwner
                    ? cloudVaultStatus.lastSyncedAt
                      ? `Last cloud sync: ${new Date(cloudVaultStatus.lastSyncedAt).toLocaleTimeString()}`
                      : 'All created users, permissions & ledger records auto-sync permanently to Firestore.'
                    : isBn
                      ? 'ব্রাউজার ভল্ট (IndexedDB) চালু আছে; ক্লাউড সিঙ্ক চালু করলে যেকোনো ডিভাইস/আপডেটে ইউজার কখনো হারাবে না।'
                      : 'Browser IndexedDB Vault is active; connecting Google Cloud Vault syncs all users permanently across deployments & devices.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectAndSyncCloud}
              disabled={isConnectingCloud || cloudVaultStatus.syncing}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                cloudVaultStatus.isVerifiedOwner
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnectingCloud || cloudVaultStatus.syncing ? 'animate-spin' : ''}`} />
              <span>
                {cloudVaultStatus.isVerifiedOwner
                  ? isBn
                    ? 'ক্লাউড সিঙ্ক করুন'
                    : 'Sync Cloud Now'
                  : isBn
                    ? 'Google দিয়ে ক্লাউড যুক্ত করুন'
                    : 'Connect Cloud Sync (Google)'}
              </span>
            </button>
          </div>

          <div className="overflow-x-auto divide-y divide-slate-100">
            {users.map((u) => {
              const isOwner = u.role === 'owner';
              const isDisabled = u.status === 'disabled';

              return (
                <div
                  key={u.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    isDisabled ? 'bg-slate-50/70 opacity-60' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => setPhotoModalUser(u)}
                      className={`relative w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden cursor-pointer group shadow-xs ${
                        isOwner
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : u.role === 'manager'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : u.role === 'staff'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : 'bg-purple-100 text-purple-900 border border-purple-200'
                      }`}
                      title={isBn ? 'প্রোফাইল ছবি পরিবর্তন বা আপলোড করুন' : 'Manage Profile Photo'}
                    >
                      {u.photoUrl ? (
                        <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" />
                      ) : isOwner ? (
                        <Crown className="w-5 h-5 text-amber-600" />
                      ) : (
                        <span>{u.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera className="w-4 h-4" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{u.name}</span>
                        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          @{u.username}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isOwner
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.status === 'active' ? (isBn ? 'সক্রিয় (Active)' : 'Active') : (isBn ? 'নিষ্ক্রিয় (Disabled)' : 'Disabled')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          {u.workspaceName}
                        </span>
                        {(u.appleId || u.idProvider === 'apple') && (
                          <span className="font-medium text-slate-900 bg-slate-200/80 border border-slate-300 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                            <span></span>
                            <span>{u.appleId || u.email}</span>
                          </span>
                        )}
                        {u.email && u.email !== u.appleId && (
                          <span className="font-medium text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                            <Mail className="w-3 h-3 text-blue-600" />
                            <span>{u.email}</span>
                          </span>
                        )}
                        {!u.email && !u.appleId && u.role !== 'owner' && (
                          <span className="font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                            <Mail className="w-3 h-3 text-amber-600" />
                            <span>{isBn ? 'মেইল যোগ করুন' : 'Add Mail / Apple ID'}</span>
                          </span>
                        )}
                        
                        {/* Granular Access Privileges Badges (Interactive 1-Click Toggles) */}
                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canAddTransactions')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে লেনদেন এন্ট্রি পারমিশন পরিবর্তন করুন' : 'Click to toggle Add Transactions permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canAddTransactions !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                          }`}
                        >
                          {u.canAddTransactions !== false ? '✓' : '✕'} {isBn ? 'লেনদেন' : 'Add Tx'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canViewLedger')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে খতিয়ান ভিউ পারমিশন পরিবর্তন করুন' : 'Click to toggle View Ledger permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canViewLedger !== false ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                          }`}
                        >
                          {u.canViewLedger !== false ? '✓' : '✕'} {isBn ? 'খতিয়ান' : 'Ledger'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canEditCustomers')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে গ্রাহক/CRM পারমিশন পরিবর্তন করুন' : 'Click to toggle Customer CRM permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canEditCustomers !== false ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                          }`}
                        >
                          {u.canEditCustomers !== false ? '✓' : '✕'} {isBn ? 'গ্রাহক CRM' : 'CRM'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canDeleteCustomers')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে গ্রাহক ডিলিট পারমিশন পরিবর্তন করুন' : 'Click to toggle Delete Customer permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canDeleteCustomers ?? (u.role === 'owner' || u.role === 'admin' || Boolean(u.canDelete))) ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canDeleteCustomers ?? (u.role === 'owner' || u.role === 'admin' || Boolean(u.canDelete))) ? '✓' : '✕'} {isBn ? 'ডিলিট CRM' : 'Del CRM'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canApproveInvoices')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে ইনভয়েস পারমিশন পরিবর্তন করুন' : 'Click to toggle Invoice permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canApproveInvoices !== false ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                          }`}
                        >
                          {u.canApproveInvoices !== false ? '✓' : '✕'} {isBn ? 'ইনভয়েস' : 'Invoices'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canManageCommissions')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন শিট দেখার পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Commission Sheet access')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canManageCommissions ? 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {u.canManageCommissions ? '✓' : '✕'} {isBn ? 'কমিশন শিট' : 'View Comm'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canAddCommissionRecords')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন রেকর্ড যোগ করার পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Add Commission Records')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canAddCommissionRecords ?? Boolean(u.canManageCommissions)) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canAddCommissionRecords ?? Boolean(u.canManageCommissions)) ? '✓' : '✕'} {isBn ? '+ রেকর্ড' : '+ Record'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canEditCommissionRecords')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন রেকর্ড এডিট পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Edit Commission Records')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canEditCommissionRecords ?? Boolean(u.canManageCommissions)) ? 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canEditCommissionRecords ?? Boolean(u.canManageCommissions)) ? '✓' : '✕'} {isBn ? 'এডিট রেকর্ড' : 'Edit Rec'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canDeleteCommissionRecords')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন রেকর্ড ডিলিট পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Delete Commission Records')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canDeleteCommissionRecords ?? (Boolean(u.canManageCommissions) && Boolean(u.canDelete))) ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canDeleteCommissionRecords ?? (Boolean(u.canManageCommissions) && Boolean(u.canDelete))) ? '✓' : '✕'} {isBn ? 'ডিলিট রেকর্ড' : 'Del Rec'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canPayCommissions')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন পেমেন্ট / Paid করার পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Pay / Mark Paid permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canPayCommissions ?? Boolean(u.canManageCommissions)) ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canPayCommissions ?? Boolean(u.canManageCommissions)) ? '✓' : '✕'} {isBn ? 'পে কমিশন' : 'Pay Comm'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canImportCommissions')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে Excel / PDF ইমপোর্ট পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Import Excel/PDF permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canImportCommissions ?? Boolean(u.canManageCommissions)) ? 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canImportCommissions ?? Boolean(u.canManageCommissions)) ? '✓' : '✕'} {isBn ? 'ইমপোর্ট' : 'Import Comm'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canManageCommissionMonths')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে মাসিক শিট খোলা/মুছা পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Manage Month Files permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canManageCommissionMonths ?? Boolean(u.canManageCommissions)) ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canManageCommissionMonths ?? Boolean(u.canManageCommissions)) ? '✓' : '✕'} {isBn ? 'মাস ফাইল' : 'Months'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canAddCommissionPersons')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে নতুন Person যোগ পারমিশন দিন/বন্ধ করুন' : 'Click to toggle + Add Person permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canAddCommissionPersons ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {u.canAddCommissionPersons ? '✓' : '✕'} {isBn ? '+ পার্সন' : '+ Person'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canEditCommissionPersons')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে Person তথ্য এডিট পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Edit Person permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canEditCommissionPersons ?? Boolean(u.canAddCommissionPersons)) ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canEditCommissionPersons ?? Boolean(u.canAddCommissionPersons)) ? '✓' : '✕'} {isBn ? 'এডিট পার্সন' : 'Edit Person'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canMergeCommissionPersons')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন Person মার্জ করার পারমিশন দিন' : 'Click to toggle Merge Commission Persons permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canMergeCommissionPersons ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {u.canMergeCommissionPersons ? '✓' : '✕'} {isBn ? 'মার্জ পার্সন' : 'Merge Person'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canDeleteCommissionPersons')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে কমিশন Person ডিলিট করার পারমিশন দিন' : 'Click to toggle Delete Commission Persons permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canDeleteCommissionPersons ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {u.canDeleteCommissionPersons ? '✓' : '✕'} {isBn ? 'ডিলিট পার্সন' : 'Del Person'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canChangeCommissionPersonPhoto')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে Person ছবি যোগ/পরিবর্তন পারমিশন দিন' : 'Click to toggle Person Photo edit/remove permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.canChangeCommissionPersonPhoto ?? (u.role === 'owner' || (u.role === 'admin' && u.canEditCommissionPersons !== false)))
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.canChangeCommissionPersonPhoto ?? (u.role === 'owner' || (u.role === 'admin' && u.canEditCommissionPersons !== false))) ? '✓' : '✕'} {isBn ? 'পার্সন ছবি' : 'Person Photo'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canManageBazar')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে দৈনিক বাজার খাতা পারমিশন পরিবর্তন করুন' : 'Click to toggle Daily Bazar access permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canManageBazar !== false ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                          }`}
                        >
                          {u.canManageBazar !== false ? '✓' : '✕'} {isBn ? 'বাজার' : 'Bazar'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canManageBazarBuyers')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে Bazar Buyer ID এডিট ও ডিলিট পারমিশন দিন/বন্ধ করুন' : 'Can Edit/Delete Bazar Buyer IDs')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            (u.role === 'owner' || u.canManageBazarBuyers === true) ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {(u.role === 'owner' || u.canManageBazarBuyers === true) ? '✓' : '✕'} {isBn ? 'ক্রেতার আইডি' : 'Buyer IDs'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleToggleCommissionOnly(u)}
                          title={isOwner ? undefined : (isBn ? 'এই ইউজারকে শুধু কমিশন শিট ব্যবহারের অনুমতি দিন (বাকি সব অপশন লুকানো থাকবে)' : 'Grant ONLY Commission Sheet access to this user (hides all other tabs)')}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.isCommissionOnly
                              ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400 font-extrabold'
                              : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                          }`}
                        >
                          ⚡ {u.isCommissionOnly ? (isBn ? 'শুধু কমিশন [অন]' : 'Comm Only [ON]') : (isBn ? 'শুধু কমিশন' : 'Only Comm')}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleToggleCommissionBazarOnly(u)}
                          title={isOwner ? undefined : (isBn ? 'এই ইউজারকে শুধু কমিশন শিট ও দৈনিক বাজার পেজ ব্যবহারের অনুমতি দিন (বাকি সব পেজ লুকানো থাকবে)' : 'Grant ONLY Commission Sheet & Daily Bazar page access (hides Dashboard, Invoices, CRM & Ledger)')}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.isCommissionBazarOnly
                              ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-400 font-extrabold'
                              : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700 border border-slate-200'
                          }`}
                        >
                          🛒 {u.isCommissionBazarOnly ? (isBn ? 'কমিশন + বাজার [অন]' : 'Comm + Bazar [ON]') : (isBn ? 'কমিশন + বাজার' : 'Comm + Bazar')}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canExport')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে এক্সপোর্ট পারমিশন পরিবর্তন করুন' : 'Click to toggle Export permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canExport ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {u.canExport ? '✓' : '✕'} {isBn ? 'এক্সপোর্ট' : 'Export'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canChangeProfilePhoto')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে নিজের প্রোফাইল ছবি পরিবর্তনের পারমিশন দিন/বন্ধ করুন' : 'Click to toggle Own Profile Photo permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canChangeProfilePhoto !== false ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                          }`}
                        >
                          {u.canChangeProfilePhoto !== false ? '✓' : '✕'} {isBn ? 'প্রোফাইল ছবি' : 'Profile Photo'}
                        </button>

                        <button
                          type="button"
                          disabled={isOwner}
                          onClick={() => handleTogglePermission(u, 'canDelete')}
                          title={isOwner ? undefined : (isBn ? 'ক্লিক করে রেকর্ড ডিলিট পারমিশন পরিবর্তন করুন' : 'Click to toggle Delete Records permission')}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 transition select-none ${
                            !isOwner ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
                          } ${
                            u.canDelete ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {u.canDelete ? '✓' : '✕'} {isBn ? 'ডিলিট' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    {/* Photo Management button */}
                    <button
                      onClick={() => setPhotoModalUser(u)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title={isBn ? 'প্রোফাইল ছবি পরিবর্তন' : 'Manage Photo'}
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isBn ? 'ছবি' : 'Photo'}</span>
                    </button>

                    {/* View/Switch into this user's private workspace */}
                    <button
                      onClick={() => onSwitchWorkspace(u.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title={isBn ? 'এই ইউজারের হিসাব দেখুন' : 'Switch into this user workspace'}
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>{isBn ? 'হিসাব ভিউ' : 'View Ledger'}</span>
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => startEditUser(u)}
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                      title={isBn ? 'সম্পাদনা / পাসওয়ার্ড পরিবর্তন' : 'Edit or Reset Password'}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Disable / Enable button (cannot disable primary owner) */}
                    {!isOwner && (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          u.status === 'active'
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={u.status === 'active' ? (isBn ? 'অ্যাকাউন্ট নিষ্ক্রিয় করুন' : 'Disable Account') : (isBn ? 'সক্রিয় করুন' : 'Enable Account')}
                      >
                        {u.status === 'active' ? (isBn ? 'লক' : 'Disable') : (isBn ? 'আনলক' : 'Activate')}
                      </button>
                    )}

                    {/* Delete button */}
                    {!isOwner && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title={isBn ? 'অ্যাকাউন্ট মুছে ফেলুন' : 'Delete Account'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SubTab 2: Consolidated Multi-Workspace Overview */}
      {ownerSubTab === 'consolidated' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">{isBn ? 'সকল ওয়ার্কস্পেস মোট জমা (আয়)' : 'Total Gross Income'}</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {formatCurrency(totalSystemIncome, globalSettings.currency, true)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{isBn ? 'সবগুলো ওয়ার্কস্পেস মিলিয়ে' : `Across ${users.length} workspace(s)`}</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">{isBn ? 'সকল ওয়ার্কস্পেস মোট খরচ (ব্যয়)' : 'Total Gross Expense'}</span>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {formatCurrency(totalSystemExpense, globalSettings.currency, true)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{isBn ? 'সকল আউটলেট খরচ' : 'Across all outlets'}</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">{isBn ? 'নেট ক্যাশ ব্যালেন্স (সার্বিক)' : 'Net System Balance'}</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(totalSystemBalance, globalSettings.currency, true)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{isBn ? 'মোট লভ্যাংশ ও ক্যাশ রিজার্ভ' : 'Total cash liquidity'}</p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {isBn ? 'ওয়ার্কস্পেস ভিত্তিক হিসাব সারাংশ' : 'Workspace Breakdown Table'}
              </h3>
              <span className="text-xs text-slate-500">{users.length} Workspaces</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">{isBn ? 'ওয়ার্কস্পেস / ইউজার' : 'Workspace / User'}</th>
                    <th className="p-3">{isBn ? 'ভূমিকা' : 'Role'}</th>
                    <th className="p-3 text-right">{isBn ? 'লেনদেন সংখ্যা' : 'Tx Count'}</th>
                    <th className="p-3 text-right">{isBn ? 'মোট আয়' : 'Income'}</th>
                    <th className="p-3 text-right">{isBn ? 'মোট ব্যয়' : 'Expense'}</th>
                    <th className="p-3 text-right">{isBn ? 'ব্যালেন্স' : 'Balance'}</th>
                    <th className="p-3 text-center">{isBn ? 'অ্যাকশন' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workspaceStats.map((st) => (
                    <tr key={st.user.id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-semibold text-slate-800">
                        {st.user.workspaceName}
                        <span className="block text-[11px] text-slate-400 font-normal">@{st.user.username} ({st.user.name})</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {st.user.role}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-medium">{st.txCount}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(st.income, globalSettings.currency, true)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(st.expense, globalSettings.currency, true)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(st.balance, globalSettings.currency, true)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onSwitchWorkspace(st.user.id)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                          {isBn ? 'হিসাব খুলুন' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Global Settings & Real-Time Broadcast */}
      {ownerSubTab === 'broadcast' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="pb-4 border-b border-slate-100 mb-5">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-500" />
              <span>{isBn ? 'গ্লোবাল অ্যাপ আপডেট ও রিয়েল-টাইম ব্রডকাস্ট' : 'Global App Updates & Real-Time Broadcast'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn 
                ? 'ওনার এখানে যেকোনো ঘোষণা বা পরিবর্তন করলে তা মুহূর্তের মধ্যে সকল ইউজারের অ্যাপে দৃশ্যমান হবে।' 
                : 'Any updates or announcements made here will instantly broadcast to all 8+ users in real time.'}
            </p>
          </div>

          <form onSubmit={handleSaveGlobalSettings} className="space-y-4 max-w-2xl">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isBn
                  ? 'অটো-আপডেট সক্রিয়: কোড ডিপ্লয়, পারমিশন পরিবর্তন বা যেকোনো ডেটা আপডেট হলে সকল ইউজারের মোবাইল ও ব্রাউজার অ্যাপ স্বয়ংক্রিয়ভাবে আপডেট হয়ে যাবে।'
                  : 'Always-On Auto-Update Active: Every code deploy, permission change, setting update, and ledger entry automatically updates every user app across desktop, mobile & PWA.'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'অ্যাপের নাম (Global App Name)' : 'App Name'}
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'প্রতিষ্ঠান / কোম্পানির নাম' : 'Company Name'}
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'অ্যাপ ভার্সন (App Version)' : 'App Version'}
                </label>
                <input
                  type="text"
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  placeholder="2.5.0-gold"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'লাইভ ব্রডকাস্ট নোটিশ (সকল ইউজারের স্ক্রিনে দেখাবে)' : 'Live Broadcast Announcement (Shows on all users screens)'}
              </label>
              <textarea
                rows={3}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder={isBn ? 'যেমন: রাত ১০টায় সার্ভার ব্যাকআপ নেওয়া হবে, সকল ক্যাশিয়ার হিসাব ক্লোজ করুন।' : 'Announcement text...'}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'নোটিশের ধরন (Color)' : 'Notice Type'}
                </label>
                <select
                  value={broadcastType}
                  onChange={(e) => setBroadcastType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                >
                  <option value="info">নীল (Information)</option>
                  <option value="warning">হলুদ (Warning)</option>
                  <option value="alert">লাল (Alert / Emergency)</option>
                  <option value="success">সবুজ (Success)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'ব্রডকাস্ট স্ট্যাটাস' : 'Broadcast Status'}
                </label>
                <select
                  value={broadcastActive ? 'true' : 'false'}
                  onChange={(e) => setBroadcastActive(e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                >
                  <option value="true">{isBn ? 'সক্রিয় (Active - অন)' : 'Active (Broadcast On)'}</option>
                  <option value="false">{isBn ? 'বন্ধ (Off)' : 'Off'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isBn ? 'ডিফল্ট কারেন্সি' : 'Default Currency'}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                >
                  <option value="SAR">⃁ SAR (Saudi Riyal)</option>
                  <option value="BDT">৳ BDT (টাকা)</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition cursor-pointer"
              >
                {isBn ? 'সকল ইউজারের জন্য গ্লোবাল আপডেট সেভ করুন' : 'Broadcast Updates to All Users'}
              </button>

              <button
                type="button"
                disabled={isPushingUpdate}
                onClick={handlePushUpdateToAllUsers}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPushingUpdate ? 'animate-spin' : ''}`} />
                <span>
                  {isBn
                    ? 'সকল ইউজারের অ্যাপ এখনই আপডেট/রিফ্রেশ করুন'
                    : 'Push Update & Refresh All User Apps Now'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SubTab 4: Cloud Database Backup & Restore */}
      {ownerSubTab === 'backup' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600" />
              <span>{isBn ? 'ক্লাউড ডাটাবেজ ব্যাকআপ ও রিস্টোর' : 'Cloud Database Snapshot & Backup'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn 
                ? 'কখনোই হিসাব হারাবে না। এক ক্লিকে সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড করুন বা আগের ব্যাকআপ রিস্টোর করুন।'
                : 'Never lose financial data. Download a complete JSON snapshot of all 8+ user workspaces, settings, and transactions.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{isBn ? 'সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড' : 'Download Full Database Backup'}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isBn 
                  ? 'সকল ইউজারের খতিয়ান, পাসওয়ার্ড হ্যাশ, সেটিংস এবং লেনদেন সুরক্ষিত JSON ফরম্যাটে সংরক্ষিত হবে।' 
                  : 'Exports all user workspaces, transactions, and audit logs into a single secure file.'}
              </p>
              <button
                onClick={handleDownloadBackup}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>{isBn ? 'এখনই ব্যাকআপ ডাউনলোড করুন' : 'Export JSON Snapshot'}</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>{isBn ? 'Firebase ক্লাউড ভল্ট ও সর্বক্ষণ স্বয়ংক্রিয় ব্যাকআপ' : 'Firebase Cloud Vault & Always-On Auto-Backup'}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isBn 
                  ? 'প্রতিটি পরিবর্তন সার্ভার চেকপয়েন্ট, IndexedDB ভল্ট (১২টি রোলিং স্ন্যাপশট) এবং Firebase Firestore ক্লাউড ডাটাবেজে সংরক্ষিত হয় যাতে কোনো আপডেটেই ইউজার বা ডাটা না হারায়।'
                  : 'Every edit saves to server checkpoints, IndexedDB Vault (12 rolling snapshots), and Firebase Firestore Cloud Database so users and accounting data never disappear across updates.'}
              </p>
              <div className="text-[11px] font-mono text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                Active: Server + IndexedDB Vault +{' '}
                {cloudVaultStatus.isVerifiedOwner
                  ? `Firebase Firestore (${cloudVaultStatus.email})`
                  : 'Firestore Ready (Connect Google)'}
              </div>
              <button
                type="button"
                onClick={handleConnectAndSyncCloud}
                disabled={isConnectingCloud || cloudVaultStatus.syncing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-4 h-4 ${isConnectingCloud || cloudVaultStatus.syncing ? 'animate-spin' : ''}`} />
                <span>
                  {cloudVaultStatus.isVerifiedOwner
                    ? isBn
                      ? 'এখনই Firebase ক্লাউড সিঙ্ক করুন'
                      : 'Sync Firebase Cloud Vault Now'
                    : isBn
                      ? 'Firebase ক্লাউড পার্সিস্টেন্স চালু করুন (Google)'
                      : 'Enable Firebase Cloud Vault (Sign in with Google)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 safe-area-top safe-area-bottom overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-hidden my-auto">
            <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-white">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{isBn ? 'নতুন ইউজার অ্যাকাউন্ট তৈরি (Owner Authority)' : 'Create New User Account'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-3 text-xs">
                {/* Account Source Selector: Mail Address vs Apple ID */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {isBn ? 'ইউজার আইডি তৈরির মাধ্যম (বাধ্যতামূলক)' : 'Account Source (Mandatory for User ID)'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNewIdProvider('email')}
                      className={`py-2 px-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        newIdProvider === 'email'
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBn ? 'মেইল অ্যাড্রেস' : 'Mail Address'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewIdProvider('apple')}
                      className={`py-2 px-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        newIdProvider === 'apple'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-sm leading-none"></span>
                      <span>Apple ID</span>
                    </button>
                  </div>
                </div>

                {/* Mandatory Mail Address / Apple ID Email */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {newIdProvider === 'apple'
                      ? (isBn ? 'Apple ID ইমেইল (বাধ্যতামূলক) *' : 'Apple ID Email (Required) *')
                      : (isBn ? 'মেইল অ্যাড্রেস (বাধ্যতামূলক) *' : 'Mail Address (Required) *')}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={newIdProvider === 'apple' ? 'name@icloud.com' : 'user@company.com'}
                    value={newIdProvider === 'apple' ? newAppleId : newEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (newIdProvider === 'apple') {
                        setNewAppleId(val);
                        setNewEmail(val);
                      } else {
                        setNewEmail(val);
                      }
                      if (useEmailAsUserId) {
                        setNewUsername(val.trim().toLowerCase());
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                  />
                  <label className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useEmailAsUserId}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseEmailAsUserId(checked);
                        if (checked) {
                          const src = (newIdProvider === 'apple' ? newAppleId : newEmail).trim().toLowerCase();
                          setNewUsername(src);
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>
                      {isBn
                        ? 'এই মেইল / Apple ID কেই সরাসরি User ID হিসেবে ব্যবহার করুন'
                        : 'Use this Mail / Apple ID directly as User ID'}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'ইউজারনেম / ইউজার আইডি (অনন্য)' : 'User ID / Username'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="user@company.com or cashier_mirpur"
                    value={newUsername}
                    onChange={(e) => {
                      setUseEmailAsUserId(false);
                      setNewUsername(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'সম্পূর্ণ নাম' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Shakil Ahmed"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'পাসওয়ার্ড (মালিক কর্তৃক নির্ধারিত)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'ভূমিকা (Role)' : 'Role'}
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="admin">Admin (প্রশাসনিক)</option>
                      <option value="manager">Manager (ম্যানেজার)</option>
                      <option value="staff">Staff / Cashier (স্টাফ)</option>
                      <option value="viewer">Viewer (নিরীক্ষক / রিড-অনলি)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'ওয়ার্কস্পেস নাম' : 'Workspace Name'}
                    </label>
                    <input
                      type="text"
                      placeholder="Mirpur Outlet Counter"
                      value={newWorkspace}
                      onChange={(e) => setNewWorkspace(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* Comprehensive User Access Control Section */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className="block font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-amber-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isBn ? 'বিশেষ অ্যাক্সেস সুবিধা ও পারমিশন কন্ট্রোল' : 'Access Privileges & Security Privileges'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={applyCommissionBazarOnlyPresetToCreate}
                        className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                      >
                        🛒 {isBn ? 'প্রিসেট: কমিশন + বাজার' : 'Preset: Comm + Bazar'}
                      </button>
                      <button
                        type="button"
                        onClick={applyCommissionOnlyPresetToCreate}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                      >
                        ⚡ {isBn ? 'প্রিসেট: শুধু কমিশন' : 'Preset: Comm Only'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 sm:col-span-2 p-1.5 rounded-lg bg-amber-50/90 border border-amber-200 select-none">
                      <input
                        type="checkbox"
                        checked={newIsCommissionBazarOnly}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewIsCommissionBazarOnly(checked);
                          if (checked) {
                            applyCommissionBazarOnlyPresetToCreate();
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>🛒 {isBn ? 'শুধু কমিশন শিট ও দৈনিক বাজার পেজের অনুমতি (বাকি সব পেজ লুকানো থাকবে)' : 'Only Commission Page + Bazar Page (Hide all other pages)'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800 sm:col-span-2 p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 select-none">
                      <input
                        type="checkbox"
                        checked={newIsCommissionOnly}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewIsCommissionOnly(checked);
                          if (checked) {
                            applyCommissionOnlyPresetToCreate();
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>⚡ {isBn ? 'শুধু কমিশন শিটের একক অনুমতি (বাকি সকল খতিয়ান ও মেনু বন্ধ থাকবে)' : 'Exclusive Commission Sheet Only (Hide all ledger & other menus)'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanAddTransactions}
                        onChange={(e) => setNewCanAddTransactions(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'দৈনিক লেনদেন যোগ (Add Tx)' : 'Add Transactions'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanViewLedger}
                        onChange={(e) => setNewCanViewLedger(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'খতিয়ান দর্শন (View Ledger)' : 'View Ledger'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanEditCustomers}
                        onChange={(e) => setNewCanEditCustomers(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'গ্রাহক তৈরি/সম্পাদনা (CRM)' : 'Edit Customers'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanDeleteCustomers}
                        onChange={(e) => setNewCanDeleteCustomers(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>{isBn ? 'গ্রাহক মুছে ফেলা (Del CRM)' : 'Delete Customers'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanApproveInvoices}
                        onChange={(e) => setNewCanApproveInvoices(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'ইনভয়েস ও রসিদ (Invoices)' : 'Approve Invoices'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanChangeProfilePhoto}
                        onChange={(e) => setNewCanChangeProfilePhoto(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'নিজের প্রোফাইল ছবি পরিবর্তন' : 'Change Own Profile Photo'}</span>
                    </label>

                    <div className="sm:col-span-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          {isBn ? 'কমিশন শিট আলাদা পারমিশন (Commission Sheet Actions)' : 'Commission Sheet Actions (Separate)'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewCanManageCommissions(true);
                              setNewCanAddCommissionRecords(true);
                              setNewCanEditCommissionRecords(true);
                              setNewCanDeleteCommissionRecords(true);
                              setNewCanPayCommissions(true);
                              setNewCanImportCommissions(true);
                              setNewCanManageCommissionMonths(true);
                            }}
                            className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold cursor-pointer hover:bg-emerald-700"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCanManageCommissions(false);
                              setNewCanAddCommissionRecords(false);
                              setNewCanEditCommissionRecords(false);
                              setNewCanDeleteCommissionRecords(false);
                              setNewCanPayCommissions(false);
                              setNewCanImportCommissions(false);
                              setNewCanManageCommissionMonths(false);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold cursor-pointer hover:bg-slate-300"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800 select-none">
                          <input
                            type="checkbox"
                            checked={newCanManageCommissions}
                            onChange={(e) => setNewCanManageCommissions(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? 'কমিশন শিট ট্যাব দেখুন' : 'View Commission Sheet'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanAddCommissionRecords}
                            onChange={(e) => setNewCanAddCommissionRecords(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? '+ রেকর্ড যোগ (Add Record)' : '+ Add Records'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanEditCommissionRecords}
                            onChange={(e) => setNewCanEditCommissionRecords(e.target.checked)}
                            className="rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span>{isBn ? 'রেকর্ড এডিট / ডাইরেক্ট এডিট' : 'Edit & Inline Edit Records'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-rose-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanDeleteCommissionRecords}
                            onChange={(e) => setNewCanDeleteCommissionRecords(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>{isBn ? 'কমিশন রেকর্ড ডিলিট' : 'Delete Records'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanPayCommissions}
                            onChange={(e) => setNewCanPayCommissions(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? 'পেমেন্ট / Paid করা' : 'Pay & Mark Paid'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanImportCommissions}
                            onChange={(e) => setNewCanImportCommissions(e.target.checked)}
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          <span>{isBn ? 'Excel / PDF ইমপোর্ট' : 'Import Excel / PDF'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 sm:col-span-2 select-none">
                          <input
                            type="checkbox"
                            checked={newCanManageCommissionMonths}
                            onChange={(e) => setNewCanManageCommissionMonths(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>{isBn ? 'মাসিক শিট তৈরি ও ডিলিট (Month Files)' : 'Add / Delete Month Files'}</span>
                        </label>
                      </div>
                    </div>

                    <div className="sm:col-span-2 p-2.5 rounded-lg bg-teal-50/70 border border-teal-200 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                          {isBn ? 'কমিশন Person অ্যাকাউন্ট (আলাদা পারমিশন)' : 'Person Accounts (Separate)'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewCanAddCommissionPersons(true);
                              setNewCanEditCommissionPersons(true);
                              setNewCanChangeCommissionPersonPhoto(true);
                              setNewCanMergeCommissionPersons(true);
                              setNewCanDeleteCommissionPersons(true);
                            }}
                            className="px-1.5 py-0.5 rounded bg-teal-600 text-white text-[9px] font-bold cursor-pointer hover:bg-teal-700"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCanAddCommissionPersons(false);
                              setNewCanEditCommissionPersons(false);
                              setNewCanChangeCommissionPersonPhoto(false);
                              setNewCanMergeCommissionPersons(false);
                              setNewCanDeleteCommissionPersons(false);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold cursor-pointer hover:bg-slate-300"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanAddCommissionPersons}
                            onChange={(e) => setNewCanAddCommissionPersons(e.target.checked)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span>{isBn ? '+ পার্সন যোগ' : '+ Add Person'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanEditCommissionPersons}
                            onChange={(e) => setNewCanEditCommissionPersons(e.target.checked)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span>{isBn ? 'পার্সন এডিট' : 'Edit Person'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-emerald-800 select-none">
                          <input
                            type="checkbox"
                            checked={newCanChangeCommissionPersonPhoto}
                            onChange={(e) => setNewCanChangeCommissionPersonPhoto(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? 'পার্সন ছবি পরিবর্তন' : 'Person Photo'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={newCanMergeCommissionPersons}
                            onChange={(e) => setNewCanMergeCommissionPersons(e.target.checked)}
                            className="rounded text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>{isBn ? 'পার্সন মার্জ' : 'Merge Persons'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-rose-700 sm:col-span-2 select-none">
                          <input
                            type="checkbox"
                            checked={newCanDeleteCommissionPersons}
                            onChange={(e) => setNewCanDeleteCommissionPersons(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>{isBn ? 'পার্সন ডিলিট' : 'Delete Persons'}</span>
                        </label>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanManageBazar}
                        onChange={(e) => setNewCanManageBazar(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'দৈনিক বাজার খাতা (Daily Bazar)' : 'Daily Bazar Access'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanManageBazarBuyers}
                        onChange={(e) => setNewCanManageBazarBuyers(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{isBn ? 'দৈনিক বাজার Buyer ID এডিট ও ডিলিট' : 'Can Edit/Delete Bazar Buyer IDs'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={newCanExport}
                        onChange={(e) => setNewCanExport(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'এক্সপোর্ট রিপোর্ট (Export)' : 'Export CSV/Excel'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-700 sm:col-span-2 select-none">
                      <input
                        type="checkbox"
                        checked={newCanDelete}
                        onChange={(e) => setNewCanDelete(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>{isBn ? 'রেকর্ড ডিলিট করার সর্বোচ্চ অনুমতি (Danger)' : 'Can Delete Records (Permanent)'}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-5 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/90 flex gap-2 text-xs">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  {isBn ? 'ইউজার তৈরি করুন' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 safe-area-top safe-area-bottom overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl relative flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-hidden my-auto">
            <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-white">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 min-w-0">
                <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">{isBn ? `ইউজার সম্পাদনা: @${editingUser.username}` : `Edit User: @${editingUser.username}`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'নাম' : 'Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    {isBn ? 'লগইন আইডেন্টিটি মাধ্যম (Mail / Apple ID)' : 'Mail Address / Apple ID Source'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 mb-2">
                    <button
                      type="button"
                      onClick={() => setEditIdProvider('email')}
                      className={`py-1.5 px-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editIdProvider === 'email'
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBn ? 'মেইল অ্যাড্রেস' : 'Mail Address'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIdProvider('apple')}
                      className={`py-1.5 px-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editIdProvider === 'apple'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-sm leading-none"></span>
                      <span>Apple ID</span>
                    </button>
                  </div>
                  <input
                    type="email"
                    placeholder={editIdProvider === 'apple' ? 'name@icloud.com' : 'user@company.com'}
                    value={editIdProvider === 'apple' ? (editAppleId || editEmail) : editEmail}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (editIdProvider === 'apple') {
                        setEditAppleId(val);
                        if (!editEmail) setEditEmail(val);
                      } else {
                        setEditEmail(val);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'নতুন পাসওয়ার্ড (যদি পরিবর্তন করতে চান)' : 'New Password (Leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    placeholder={isBn ? 'নতুন পাসওয়ার্ড দিন...' : 'Type new password...'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'ভূমিকা (Role)' : 'Role'}
                    </label>
                    <select
                      disabled={editingUser.role === 'owner'}
                      value={editRole}
                      onChange={(e) => {
                        const nextRole = e.target.value;
                        setEditRole(nextRole);
                        if (nextRole === 'admin') {
                          setEditIsCommissionOnly(false);
                          setEditIsCommissionBazarOnly(false);
                          setEditCanAddTransactions(true);
                          setEditCanViewLedger(true);
                          setEditCanEditCustomers(true);
                          setEditCanDeleteCustomers(true);
                          setEditCanApproveInvoices(true);
                          setEditCanChangeProfilePhoto(true);
                          setEditCanManageCommissions(true);
                          setEditCanAddCommissionRecords(true);
                          setEditCanEditCommissionRecords(true);
                          setEditCanDeleteCommissionRecords(true);
                          setEditCanPayCommissions(true);
                          setEditCanImportCommissions(true);
                          setEditCanManageCommissionMonths(true);
                          setEditCanAddCommissionPersons(true);
                          setEditCanEditCommissionPersons(true);
                          setEditCanChangeCommissionPersonPhoto(true);
                          setEditCanMergeCommissionPersons(true);
                          setEditCanDeleteCommissionPersons(true);
                          setEditCanManageBazar(true);
                          setEditCanDelete(true);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white disabled:bg-slate-100"
                    >
                      {editingUser.role === 'owner' && <option value="owner">Owner (মালিক)</option>}
                      <option value="admin">Admin (প্রশাসনিক)</option>
                      <option value="manager">Manager (ম্যানেজার)</option>
                      <option value="staff">Staff / Cashier (স্টাফ)</option>
                      <option value="viewer">Viewer (নিরীক্ষক / রিড-অনলি)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'অ্যাকাউন্ট স্ট্যাটাস' : 'Status'}
                    </label>
                    <select
                      disabled={editingUser.role === 'owner'}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white disabled:bg-slate-100"
                    >
                      <option value="active">{isBn ? 'সক্রিয় (Active)' : 'Active'}</option>
                      <option value="disabled">{isBn ? 'নিষ্ক্রিয় (Disabled)' : 'Disabled'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isBn ? 'ওয়ার্কস্পেস নাম' : 'Workspace Name'}
                  </label>
                  <input
                    type="text"
                    value={editWorkspace}
                    onChange={(e) => setEditWorkspace(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                {/* Comprehensive User Access Control Section for Editing */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className="block font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-blue-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isBn ? 'বিশেষ অ্যাক্সেস সুবিধা ও পারমিশন কন্ট্রোল' : 'Access Privileges & Security Privileges'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={applyCommissionBazarOnlyPresetToEdit}
                        className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                      >
                        🛒 {isBn ? 'প্রিসেট: কমিশন + বাজার' : 'Preset: Comm + Bazar'}
                      </button>
                      <button
                        type="button"
                        onClick={applyCommissionOnlyPresetToEdit}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold cursor-pointer transition flex items-center gap-1"
                      >
                        ⚡ {isBn ? 'প্রিসেট: শুধু কমিশন' : 'Preset: Comm Only'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 sm:col-span-2 p-1.5 rounded-lg bg-amber-50/90 border border-amber-200 select-none">
                      <input
                        type="checkbox"
                        checked={editIsCommissionBazarOnly}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditIsCommissionBazarOnly(checked);
                          if (checked) {
                            applyCommissionBazarOnlyPresetToEdit();
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>🛒 {isBn ? 'শুধু কমিশন শিট ও দৈনিক বাজার পেজের অনুমতি (বাকি সব পেজ লুকানো থাকবে)' : 'Only Commission Page + Bazar Page (Hide all other pages)'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-800 sm:col-span-2 p-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200 select-none">
                      <input
                        type="checkbox"
                        checked={editIsCommissionOnly}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditIsCommissionOnly(checked);
                          if (checked) {
                            applyCommissionOnlyPresetToEdit();
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>⚡ {isBn ? 'শুধু কমিশন শিটের একক অনুমতি (বাকি সকল খতিয়ান ও মেনু বন্ধ থাকবে)' : 'Exclusive Commission Sheet Only (Hide all ledger & other menus)'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanAddTransactions}
                        onChange={(e) => setEditCanAddTransactions(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{isBn ? 'দৈনিক লেনদেন যোগ (Add Tx)' : 'Add Transactions'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanViewLedger}
                        onChange={(e) => setEditCanViewLedger(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{isBn ? 'খতিয়ান দর্শন (View Ledger)' : 'View Ledger'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanEditCustomers}
                        onChange={(e) => setEditCanEditCustomers(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{isBn ? 'গ্রাহক তৈরি/সম্পাদনা (CRM)' : 'Edit Customers'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanDeleteCustomers}
                        onChange={(e) => setEditCanDeleteCustomers(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>{isBn ? 'গ্রাহক মুছে ফেলা (Del CRM)' : 'Delete Customers'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanApproveInvoices}
                        onChange={(e) => setEditCanApproveInvoices(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{isBn ? 'ইনভয়েস ও রসিদ (Invoices)' : 'Approve Invoices'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanChangeProfilePhoto}
                        onChange={(e) => setEditCanChangeProfilePhoto(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'নিজের প্রোফাইল ছবি পরিবর্তন' : 'Change Own Profile Photo'}</span>
                    </label>

                    <div className="sm:col-span-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          {isBn ? 'কমিশন শিট আলাদা পারমিশন (Commission Sheet Actions)' : 'Commission Sheet Actions (Separate)'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditCanManageCommissions(true);
                              setEditCanAddCommissionRecords(true);
                              setEditCanEditCommissionRecords(true);
                              setEditCanDeleteCommissionRecords(true);
                              setEditCanPayCommissions(true);
                              setEditCanImportCommissions(true);
                              setEditCanManageCommissionMonths(true);
                            }}
                            className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold cursor-pointer hover:bg-emerald-700"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCanManageCommissions(false);
                              setEditCanAddCommissionRecords(false);
                              setEditCanEditCommissionRecords(false);
                              setEditCanDeleteCommissionRecords(false);
                              setEditCanPayCommissions(false);
                              setEditCanImportCommissions(false);
                              setEditCanManageCommissionMonths(false);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold cursor-pointer hover:bg-slate-300"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800 select-none">
                          <input
                            type="checkbox"
                            checked={editCanManageCommissions}
                            onChange={(e) => setEditCanManageCommissions(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>{isBn ? 'কমিশন শিট ট্যাব দেখুন' : 'View Commission Sheet'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanAddCommissionRecords}
                            onChange={(e) => setEditCanAddCommissionRecords(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? '+ রেকর্ড যোগ (Add Record)' : '+ Add Records'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanEditCommissionRecords}
                            onChange={(e) => setEditCanEditCommissionRecords(e.target.checked)}
                            className="rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span>{isBn ? 'রেকর্ড এডিট / ডাইরেক্ট এডিট' : 'Edit & Inline Edit Records'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-rose-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanDeleteCommissionRecords}
                            onChange={(e) => setEditCanDeleteCommissionRecords(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>{isBn ? 'কমিশন রেকর্ড ডিলিট' : 'Delete Records'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanPayCommissions}
                            onChange={(e) => setEditCanPayCommissions(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? 'পেমেন্ট / Paid করা' : 'Pay & Mark Paid'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanImportCommissions}
                            onChange={(e) => setEditCanImportCommissions(e.target.checked)}
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          <span>{isBn ? 'Excel / PDF ইমপোর্ট' : 'Import Excel / PDF'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 sm:col-span-2 select-none">
                          <input
                            type="checkbox"
                            checked={editCanManageCommissionMonths}
                            onChange={(e) => setEditCanManageCommissionMonths(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span>{isBn ? 'মাসিক শিট তৈরি ও ডিলিট (Month Files)' : 'Add / Delete Month Files'}</span>
                        </label>
                      </div>
                    </div>

                    <div className="sm:col-span-2 p-2.5 rounded-lg bg-teal-50/70 border border-teal-200 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                          {isBn ? 'কমিশন Person অ্যাকাউন্ট (আলাদা পারমিশন)' : 'Person Accounts (Separate)'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditCanAddCommissionPersons(true);
                              setEditCanEditCommissionPersons(true);
                              setEditCanChangeCommissionPersonPhoto(true);
                              setEditCanMergeCommissionPersons(true);
                              setEditCanDeleteCommissionPersons(true);
                            }}
                            className="px-1.5 py-0.5 rounded bg-teal-600 text-white text-[9px] font-bold cursor-pointer hover:bg-teal-700"
                          >
                            All On
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCanAddCommissionPersons(false);
                              setEditCanEditCommissionPersons(false);
                              setEditCanChangeCommissionPersonPhoto(false);
                              setEditCanMergeCommissionPersons(false);
                              setEditCanDeleteCommissionPersons(false);
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold cursor-pointer hover:bg-slate-300"
                          >
                            All Off
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanAddCommissionPersons}
                            onChange={(e) => setEditCanAddCommissionPersons(e.target.checked)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span>{isBn ? '+ পার্সন যোগ' : '+ Add Person'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanEditCommissionPersons}
                            onChange={(e) => setEditCanEditCommissionPersons(e.target.checked)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span>{isBn ? 'পার্সন এডিট' : 'Edit Person'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-emerald-800 select-none">
                          <input
                            type="checkbox"
                            checked={editCanChangeCommissionPersonPhoto}
                            onChange={(e) => setEditCanChangeCommissionPersonPhoto(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{isBn ? 'পার্সন ছবি পরিবর্তন' : 'Person Photo'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={editCanMergeCommissionPersons}
                            onChange={(e) => setEditCanMergeCommissionPersons(e.target.checked)}
                            className="rounded text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>{isBn ? 'পার্সন মার্জ' : 'Merge Persons'}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium text-rose-700 sm:col-span-2 select-none">
                          <input
                            type="checkbox"
                            checked={editCanDeleteCommissionPersons}
                            onChange={(e) => setEditCanDeleteCommissionPersons(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>{isBn ? 'পার্সন ডিলিট' : 'Delete Persons'}</span>
                        </label>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanManageBazar}
                        onChange={(e) => setEditCanManageBazar(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>{isBn ? 'দৈনিক বাজার খাতা (Daily Bazar)' : 'Daily Bazar Access'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanManageBazarBuyers}
                        onChange={(e) => setEditCanManageBazarBuyers(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{isBn ? 'দৈনিক বাজার Buyer ID এডিট ও ডিলিট' : 'Can Edit/Delete Bazar Buyer IDs'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={editCanExport}
                        onChange={(e) => setEditCanExport(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{isBn ? 'এক্সপোর্ট রিপোর্ট (Export)' : 'Export CSV/Excel'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-rose-700 sm:col-span-2 select-none">
                      <input
                        type="checkbox"
                        checked={editCanDelete}
                        onChange={(e) => setEditCanDelete(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>{isBn ? 'রেকর্ড ডিলিট করার সর্বোচ্চ অনুমতি (Danger)' : 'Can Delete Records (Permanent)'}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-5 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/90 flex gap-2 text-xs">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  {isBn ? 'আপডেট সেভ করুন' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Photo Management Modal for Owner */}
      {photoModalUser && (
        <ProfilePhotoModal
          targetUser={photoModalUser}
          currentUser={currentUser}
          currentLang={isBn ? 'bn' : 'en'}
          isOpen={true}
          onClose={() => setPhotoModalUser(null)}
          onPhotoUpdated={(userId, newPhotoUrl) => {
            setUsers((prev) =>
              prev.map((user) => (user.id === userId ? { ...user, photoUrl: newPhotoUrl } : user))
            );
            onUsersChanged?.();
          }}
        />
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL (Safe for AI Studio iFrame) */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 safe-area-top safe-area-bottom overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border border-rose-100 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto overscroll-contain my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-3 text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-slate-900 mb-1">
              {isBn ? 'ইউজার একাউন্ট মুছে ফেলবেন?' : 'Delete User Account?'}
            </h3>

            <p className="text-xs text-center text-slate-600 mb-4 leading-relaxed">
              {isBn
                ? `আপনি কি নিশ্চিত যে "${userToDelete.name}" (@${userToDelete.username}) এর একাউন্ট ও সকল ওয়ার্কস্পেস পারমিশন স্থায়ীভাবে মুছে ফেলতে চান?`
                : `Are you sure you want to permanently delete "${userToDelete.name}" (@${userToDelete.username})? All access privileges will be removed.`}
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 mb-4 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">{isBn ? 'ওয়ার্কস্পেস:' : 'Workspace:'}</span>
                <span className="font-semibold text-slate-800">{userToDelete.workspaceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isBn ? 'ভূমিকা:' : 'Role:'}</span>
                <span className="font-semibold text-slate-800 uppercase">{userToDelete.role}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteUser}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                {isDeleting ? (
                  <span>{isBn ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...'}</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>{isBn ? 'হ্যাঁ, মুছে ফেলুন' : 'Delete Account'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
