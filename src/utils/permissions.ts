import { UserAccount } from '../types/accounting';
import { NavTabId } from '../components/Sidebar';

export interface UserPagePermissions {
  isOwner: boolean;
  isAdmin: boolean;
  isCommissionOnly: boolean;
  isCommissionBazarOnly: boolean;
  isBazarOnly: boolean;
  canAccessOwnerControl: boolean;
  canAccessDashboard: boolean;
  canAccessInvoices: boolean;
  canAccessQuickCash: boolean;
  canAccessBazar: boolean;
  canAccessEntry: boolean;
  canAccessLedger: boolean;
  canAccessCustomers: boolean;
  canAccessCommission: boolean;
  canAccessAppearance: boolean;
  canAccessRnCode: boolean;
  canAccessLogs: boolean;
}

export function getUserPagePermissions(user: UserAccount): UserPagePermissions {
  const isOwner = user.role === 'owner';
  const isAdmin = user.role === 'admin';

  if (isOwner) {
    return {
      isOwner: true,
      isAdmin: true,
      isCommissionOnly: false,
      isCommissionBazarOnly: false,
      isBazarOnly: false,
      canAccessOwnerControl: true,
      canAccessDashboard: true,
      canAccessInvoices: true,
      canAccessQuickCash: true,
      canAccessBazar: true,
      canAccessEntry: true,
      canAccessLedger: true,
      canAccessCustomers: true,
      canAccessCommission: true,
      canAccessAppearance: true,
      canAccessRnCode: true,
      canAccessLogs: true,
    };
  }

  const hasCoreAccounting =
    user.canViewLedger === true ||
    user.canAddTransactions === true ||
    user.canEditCustomers === true ||
    user.canApproveInvoices === true;

  const hasAnyCoreDefault =
    user.canViewLedger !== false ||
    user.canAddTransactions !== false ||
    user.canEditCustomers !== false ||
    user.canApproveInvoices !== false;

  const hasBazar = user.canManageBazar !== false;
  const hasComm = Boolean(user.canManageCommissions);

  const isCommissionBazarOnly = Boolean(
    !isAdmin &&
      (user.isCommissionBazarOnly ||
        (hasComm &&
          hasBazar &&
          !user.canViewLedger &&
          !user.canAddTransactions &&
          !user.canEditCustomers &&
          !user.canApproveInvoices))
  );

  const isCommissionOnly = Boolean(
    !isAdmin &&
      !isCommissionBazarOnly &&
      (user.isCommissionOnly ||
        (hasComm &&
          !hasBazar &&
          !user.canViewLedger &&
          !user.canAddTransactions &&
          !user.canEditCustomers &&
          !user.canApproveInvoices))
  );

  const isBazarOnly = Boolean(
    !isAdmin &&
      !isCommissionOnly &&
      !isCommissionBazarOnly &&
      hasBazar &&
      !hasComm &&
      !user.canViewLedger &&
      !user.canAddTransactions &&
      !user.canEditCustomers &&
      !user.canApproveInvoices
  );

  const restrictedOnlyMode = isCommissionOnly || isCommissionBazarOnly || isBazarOnly;

  const canAccessInvoices = !restrictedOnlyMode && user.canApproveInvoices !== false;
  const canAccessQuickCash = !restrictedOnlyMode && user.canAddTransactions !== false;
  const canAccessBazar = !isCommissionOnly && hasBazar;
  const canAccessEntry = canAccessInvoices || canAccessBazar || canAccessQuickCash;
  const canAccessDashboard = !restrictedOnlyMode && (isAdmin || hasAnyCoreDefault || hasCoreAccounting);
  const canAccessLedger = !restrictedOnlyMode && user.canViewLedger !== false;
  const canAccessCustomers =
    !restrictedOnlyMode &&
    (user.canEditCustomers !== false ||
      user.canDeleteCustomers === true ||
      user.canApproveInvoices !== false);
  const canAccessCommission = isAdmin || hasComm || isCommissionOnly || isCommissionBazarOnly;
  const canAccessAppearance = !isCommissionBazarOnly && !isBazarOnly;
  const canAccessRnCode = !restrictedOnlyMode && (isAdmin || user.canViewLedger !== false);
  const canAccessLogs = !restrictedOnlyMode && (isAdmin || user.canViewLedger !== false);

  return {
    isOwner: false,
    isAdmin,
    isCommissionOnly,
    isCommissionBazarOnly,
    isBazarOnly,
    canAccessOwnerControl: false,
    canAccessDashboard,
    canAccessInvoices,
    canAccessQuickCash,
    canAccessBazar,
    canAccessEntry,
    canAccessLedger,
    canAccessCustomers,
    canAccessCommission,
    canAccessAppearance,
    canAccessRnCode,
    canAccessLogs,
  };
}

export function canAccessNavTab(user: UserAccount, tab: NavTabId): boolean {
  const perms = getUserPagePermissions(user);
  switch (tab) {
    case 'dashboard':
      return perms.canAccessDashboard;
    case 'entry':
      return perms.canAccessEntry;
    case 'ledger':
      return perms.canAccessLedger;
    case 'customers':
      return perms.canAccessCustomers;
    case 'commission':
      return perms.canAccessCommission;
    case 'owner_control':
      return perms.canAccessOwnerControl;
    case 'appearance':
      return perms.canAccessAppearance;
    case 'rn_code':
      return perms.canAccessRnCode;
    case 'logs':
      return perms.canAccessLogs;
    default:
      return false;
  }
}

export function getDefaultNavTab(user: UserAccount): NavTabId {
  const perms = getUserPagePermissions(user);
  if (perms.canAccessDashboard) return 'dashboard';
  if (perms.canAccessCommission) return 'commission';
  if (perms.canAccessEntry) return 'entry';
  if (perms.canAccessCustomers) return 'customers';
  if (perms.canAccessLedger) return 'ledger';
  return 'appearance';
}

export function getDefaultEntrySubTab(user: UserAccount): 'invoices' | 'bazar' | 'quick' {
  const perms = getUserPagePermissions(user);
  if (perms.canAccessInvoices) return 'invoices';
  if (perms.canAccessBazar) return 'bazar';
  return 'quick';
}
