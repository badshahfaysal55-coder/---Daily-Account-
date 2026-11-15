import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  BookOpen,
  Users,
  FileSpreadsheet,
  Crown,
  Palette,
  Database,
  Code2,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Cloud,
  Smartphone
} from 'lucide-react';
import { UserAccount, GlobalAppSettings, AppTheme, DisplayMode } from '../types/accounting';
import { ZaraLogo } from './ZaraLogo';
import { t, Language } from '../utils/translations';
import { openPWAInstallGuide } from './PWAInstallButton';

export type NavTabId =
  | 'dashboard'
  | 'entry'
  | 'ledger'
  | 'customers'
  | 'commission'
  | 'owner_control'
  | 'appearance'
  | 'rn_code'
  | 'logs';

interface SidebarProps {
  activeTab: NavTabId;
  setActiveTab: (tab: NavTabId) => void;
  isOpen: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser: UserAccount;
  globalSettings: GlobalAppSettings;
  currentLang: Language;
  currentTheme: AppTheme;
  totalTransactionsCount: number;
  allUsersList: UserAccount[];
  selectedWorkspaceUserId: string | null;
  onSelectWorkspace: (id: string | null) => void;
  onLogout: () => void;
  onOpenPhotoModal: () => void;
  onOpenAuthModal: () => void;
  sidebarBgColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  globalSettings,
  currentLang,
  currentTheme,
  totalTransactionsCount,
  allUsersList,
  selectedWorkspaceUserId,
  onSelectWorkspace,
  onLogout,
  onOpenPhotoModal,
  onOpenAuthModal,
  sidebarBgColor,
}) => {
  const isBn = currentLang === 'bn';
  const isOwner = currentUser.role === 'owner';

  const navItems = [
    {
      id: 'dashboard' as NavTabId,
      label: isBn ? 'ড্যাশবোর্ড' : 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      color: 'text-amber-500',
    },
    {
      id: 'entry' as NavTabId,
      label: isBn ? 'দৈনিক এন্ট্রি' : 'Daily Entry',
      icon: PlusCircle,
      badge: isBn ? 'রসিদ' : 'Invoices',
      color: 'text-emerald-500',
    },
    {
      id: 'customers' as NavTabId,
      label: isBn ? 'গ্রাহক ও বাকি খাতা' : 'Customers CRM',
      icon: Users,
      badge: null,
      color: 'text-purple-500',
    },
    // Owner Only
    ...(isOwner
      ? [
          {
            id: 'owner_control' as NavTabId,
            label: isBn ? 'ওনার কন্ট্রোল সেন্টার' : 'Owner Control',
            icon: Crown,
            badge: isBn ? 'মেইন ওনার' : 'Owner',
            color: 'text-[#D4AF37]',
            highlight: true,
          },
        ]
      : []),
    {
      id: 'commission' as NavTabId,
      label: isBn ? 'কমিশন শিট' : 'Commission Sheet',
      icon: FileSpreadsheet,
      badge: isBn ? 'নতুন' : 'Excel',
      color: 'text-emerald-400',
    },
    {
      id: 'appearance' as NavTabId,
      label: isBn ? 'থিম ও অ্যাপিয়ারেন্স' : 'Themes & Styling',
      icon: Palette,
      badge: '5',
      color: 'text-pink-500',
    },
    {
      id: 'rn_code' as NavTabId,
      label: isBn ? 'মোবাইল সোর্স কোড' : 'Mobile App Code',
      icon: Code2,
      badge: 'RN',
      color: 'text-indigo-500',
    },
    {
      id: 'logs' as NavTabId,
      label: isBn ? 'সিঙ্ক ও অডিট লগ' : 'Sync & Audit Logs',
      icon: FileText,
      badge: null,
      color: 'text-slate-400',
    },
  ];

  const isCommissionOnly = Boolean(
    currentUser.isCommissionOnly ||
    (currentUser.canManageCommissions &&
      !currentUser.canViewLedger &&
      !currentUser.canAddTransactions &&
      !currentUser.canEditCustomers &&
      !currentUser.canApproveInvoices &&
      currentUser.role !== 'owner' &&
      currentUser.role !== 'admin')
  );

  const visibleNavItems = isCommissionOnly
    ? navItems.filter((item) => item.id === 'commission' || item.id === 'appearance')
    : navItems;

  const handleSelectNav = (id: NavTabId) => {
    setActiveTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          backgroundColor: sidebarBgColor || 'var(--theme-primary)',
          borderColor: 'var(--theme-accent-border)',
        }}
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col text-slate-200 border-r shadow-2xl transition-all duration-300 ease-in-out
          ${isOpen ? 'w-64' : 'w-20'}
          ${isMobileOpen ? 'translate-x-0 !w-72' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand & Logo Header */}
        <div className="h-20 px-4 flex items-center justify-between border-b border-[#1E293B]">
          <div className="flex items-center gap-3 overflow-hidden">
            <ZaraLogo size="sm" showText={false} />
            {(isOpen || isMobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-white text-base tracking-tight font-heading truncate">
                  {globalSettings.appName || 'ZARA Accounting'}
                </span>
                <span className="text-[10px] font-bold text-[#D4AF37] tracking-wider uppercase flex items-center gap-1">
                  <Cloud className="w-2.5 h-2.5" />
                  Cloud Enterprise
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* User Card inside Sidebar */}
        <div className="p-3 border-b border-[#1E293B]">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            {/* User Profile Avatar with photo */}
            <div
              onClick={onOpenPhotoModal}
              className="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] to-amber-200 shrink-0 cursor-pointer group"
              title={isBn ? 'প্রোফাইল ছবি পরিবর্তন করুন' : 'Click to update profile photo'}
            >
              <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center">
                {currentUser.photoUrl || currentUser.photoData ? (
                  <img
                    src={currentUser.photoUrl || currentUser.photoData}
                    alt={currentUser.name}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (currentUser.photoData && img.src !== currentUser.photoData) {
                        img.src = currentUser.photoData;
                      }
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-black text-amber-400">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold">
                Edit
              </div>
            </div>

            {(isOpen || isMobileOpen) && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate block">
                    {currentUser.name}
                  </span>
                  {isOwner && (
                    <span className="bg-[#D4AF37] text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                      Owner
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 truncate block">
                  @{currentUser.username} • {currentUser.workspaceName}
                </span>
              </div>
            )}
          </div>

          {/* Owner Multi-Workspace Switcher inside Sidebar */}
          {isOwner && allUsersList.length > 0 && (isOpen || isMobileOpen) && (
            <div className="mt-2.5">
              <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                <span>{isBn ? 'ওয়ার্কস্পেস ফিল্টার:' : 'Workspace Scope:'}</span>
              </label>
              <select
                value={selectedWorkspaceUserId || ''}
                onChange={(e) => onSelectWorkspace(e.target.value || null)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:border-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="">{t('allWorkspaces', currentLang)}</option>
                {allUsersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.workspaceName} ({u.name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                style={
                  isActive && !item.highlight
                    ? {
                        backgroundColor: 'var(--theme-accent-light)',
                        color: 'var(--theme-accent)',
                        borderColor: 'var(--theme-accent-border)',
                      }
                    : undefined
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? item.highlight
                      ? 'theme-gradient-bg text-slate-950 font-bold shadow-md'
                      : 'border'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={!isOpen && !isMobileOpen ? item.label : undefined}
              >
                <Icon
                  style={isActive && !item.highlight ? { color: 'var(--theme-accent)' } : undefined}
                  className={`w-4 h-4 shrink-0 ${
                    isActive && !item.highlight ? '' : item.color
                  }`}
                />
                {(isOpen || isMobileOpen) && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {(isOpen || isMobileOpen) && item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                      isActive && item.highlight
                        ? 'bg-slate-950 text-amber-300'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-[#1E293B] space-y-2">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              openPWAInstallGuide();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 transition cursor-pointer ${
              !isOpen && !isMobileOpen ? 'justify-center px-0' : ''
            }`}
            title={isBn ? 'iOS ও Android ফোনে অ্যাপ ডাউনলোড করুন' : 'Download App (iOS / Android)'}
          >
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            {(isOpen || isMobileOpen) && (
              <span className="truncate">
                {isBn ? 'মোবাইল অ্যাপ (iOS / Android)' : 'Install App (iOS / Android)'}
              </span>
            )}
          </button>

          {/* Quick theme badge */}
          {(isOpen || isMobileOpen) && (
            <div className="px-3 py-2 rounded-xl bg-black/25 border border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{isBn ? 'বর্তমান থিম' : 'Theme'}:</span>
              <span className="font-bold capitalize" style={{ color: 'var(--theme-accent)' }}>
                {currentTheme.replace('-', ' ')}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenAuthModal}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer ${
                !isOpen && !isMobileOpen ? 'px-0' : ''
              }`}
              title={isBn ? 'ইউজার পরিবর্তন' : 'Switch User'}
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {(isOpen || isMobileOpen) && <span>{isBn ? 'সুইচ ইউজার' : 'Switch'}</span>}
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
              title={isBn ? 'লগআউট' : 'Logout'}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
