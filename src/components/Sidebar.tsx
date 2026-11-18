import React, { useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  FileSpreadsheet,
  Crown,
  Palette,
  Code2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Cloud,
  ShoppingBag,
  Bell,
  RefreshCw,
  X
} from 'lucide-react';
import { UserAccount, GlobalAppSettings, AppTheme } from '../types/accounting';
import { ZaraLogo } from './ZaraLogo';
import { Language } from '../utils/translations';
import { PWAInstallButton } from './PWAInstallButton';
import { getUserPagePermissions, canAccessNavTab } from '../utils/permissions';

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
  onApplyTheme?: (theme: AppTheme) => void;
  isSyncing?: boolean;
  lastSyncedAt?: Date;
  onManualSync?: () => void;
  onOpenGoogleDriveModal?: () => void;
  totalTransactionsCount?: number;
  allUsersList?: UserAccount[];
  selectedWorkspaceUserId?: string | null;
  onSelectWorkspace?: (id: string | null) => void;
  onLogout: () => void;
  onOpenPhotoModal: () => void;
  onOpenAuthModal: () => void;
  sidebarBgColor?: string;
}

const LUXURY_THEMES: Array<{
  id: AppTheme;
  nameBn: string;
  nameEn: string;
  color: string;
  secondaryColor?: string;
}> = [
  { id: 'midnight-gold', nameBn: 'মিডনাইট গোল্ড', nameEn: 'Midnight Gold', color: '#D4AF37' },
  { id: 'royal-blue', nameBn: 'রয়েল ব্লু', nameEn: 'Royal Blue', color: '#3B82F6' },
  { id: 'emerald-green', nameBn: 'এমারেল্ড গ্রিন', nameEn: 'Emerald Green', color: '#10B981' },
  { id: 'graphite-black', nameBn: 'গ্রাফাইট ব্ল্যাক', nameEn: 'Graphite Black', color: '#94A3B8' },
  {
    id: 'emerald-graphite',
    nameBn: 'এমারেল্ড গ্রাফাইট',
    nameEn: 'Emerald Graphite',
    color: '#10B981',
    secondaryColor: '#18181B',
  },
];

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
  onApplyTheme,
  isSyncing = false,
  lastSyncedAt,
  onManualSync,
  onOpenGoogleDriveModal,
  onLogout,
  onOpenPhotoModal,
  onOpenAuthModal,
  sidebarBgColor,
}) => {
  const isBn = currentLang === 'bn';
  const isOwner = currentUser.role === 'owner';
  const isExpanded = isOpen || isMobileOpen;

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);

  const perms = getUserPagePermissions(currentUser);
  const isBazarExclusiveEntry = perms.canAccessBazar && !perms.canAccessInvoices && !perms.canAccessQuickCash;

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
      label: isBazarExclusiveEntry
        ? (isBn ? 'দৈনিক বাজার খাতা' : 'Daily Bazar')
        : (isBn ? 'দৈনিক এন্ট্রি' : 'Daily Entry'),
      icon: isBazarExclusiveEntry ? ShoppingBag : PlusCircle,
      badge: isBazarExclusiveEntry ? (isBn ? 'বাজার' : 'Bazar') : (isBn ? 'রসিদ' : 'Invoices'),
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

  const visibleNavItems = navItems.filter((item) => canAccessNavTab(currentUser, item.id));
  const activeThemeMeta = LUXURY_THEMES.find((th) => th.id === currentTheme) || LUXURY_THEMES[4];

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
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col text-slate-200 border-r shadow-2xl transition-all duration-300 ease-in-out safe-area-top
          ${isOpen ? 'w-64' : 'w-20'}
          ${isMobileOpen ? 'translate-x-0 !w-72 max-w-[85vw]' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand & Logo Header */}
        <div className="h-16 sm:h-20 px-4 flex items-center justify-between border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <ZaraLogo size="sm" showText={false} />
            {isExpanded && (
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

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>

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

            {isExpanded && (
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
                title={!isExpanded ? item.label : undefined}
              >
                <Icon
                  style={isActive && !item.highlight ? { color: 'var(--theme-accent)' } : undefined}
                  className={`w-4 h-4 shrink-0 ${
                    isActive && !item.highlight ? '' : item.color
                  }`}
                />
                {isExpanded && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {isExpanded && item.badge && (
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

          {/* Control Box (Moved from Header: Auto-Sync Live, Drive Sync, Get App, Notifications, Theme) */}
          <div className="pt-2">
            <div className="rounded-2xl bg-slate-950/75 border border-white/10 p-2 space-y-1.5 shadow-inner">
              {/* 1. Auto-Sync Live + Refresh */}
              {isExpanded ? (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="font-semibold text-emerald-400 text-[11px] truncate">
                      {isBn ? 'ক্লাউড সিঙ্ক লাইভ' : 'Auto-Sync Live'}
                    </span>
                  </div>
                  {onManualSync && (
                    <button
                      type="button"
                      onClick={onManualSync}
                      disabled={isSyncing}
                      title={
                        lastSyncedAt
                          ? `Last synced: ${lastSyncedAt.toLocaleTimeString()} • Click to sync now`
                          : 'Click to sync all app data now'
                      }
                      className="p-1 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer text-slate-400 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#D4AF37]' : ''}`} />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onManualSync}
                  disabled={isSyncing || !onManualSync}
                  title={isBn ? 'ক্লাউড সিঙ্ক লাইভ' : 'Auto-Sync Live'}
                  className="w-full flex items-center justify-center py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#D4AF37]' : ''}`} />
                </button>
              )}

              {/* 2. Drive Sync */}
              {onOpenGoogleDriveModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenGoogleDriveModal();
                    onCloseMobile();
                  }}
                  title={isBn ? 'গুগল ড্রাইভ ক্লাউড অটো-সিঙ্ক ও ব্যাকআপ' : 'Drive Sync'}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition cursor-pointer active:scale-[0.99] ${
                    !isExpanded ? 'justify-center px-0' : ''
                  }`}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  {isExpanded && <span className="font-semibold text-[11px] truncate">Drive Sync</span>}
                </button>
              )}

              {/* 3. Get App (iOS / Android PWA Install) */}
              <PWAInstallButton
                isBn={isBn}
                variant="sidebar"
                collapsed={!isExpanded}
                onTriggered={onCloseMobile}
              />

              {/* 4. Notifications */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isExpanded) onToggleCollapse();
                    setNotificationsOpen((prev) => !prev);
                  }}
                  title={isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition cursor-pointer ${
                    !isExpanded ? 'justify-center px-0' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative shrink-0">
                      <Bell className="w-3.5 h-3.5 text-slate-300" />
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    </span>
                    {isExpanded && (
                      <span className="font-semibold text-[11px] truncate">
                        {isBn ? 'সিস্টেম বিজ্ঞপ্তি' : 'Notifications'}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                        notificationsOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                {isExpanded && notificationsOpen && (
                  <div className="mt-1.5 space-y-1.5 p-2 rounded-xl bg-slate-900/95 border border-slate-700/80 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-200 block truncate">
                          {isBn ? 'ক্লাউড অটো-সেভ সক্রিয়' : 'Cloud Auto-Save Active'}
                        </span>
                        <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                          {isBn
                            ? 'প্রতিটি লেনদেন রিয়েল-টাইমে সুরক্ষিত ক্লাউডে সংরক্ষিত হচ্ছে।'
                            : 'Every transaction is continuously synced with cloud storage.'}
                        </p>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-200 block truncate">
                          {isBn ? 'ওয়ার্কস্পেস সুরক্ষা নিশ্চিত' : 'Isolated Workspace'}
                        </span>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {currentUser.workspaceName} ({currentUser.role})
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Theme Selector */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isExpanded) onToggleCollapse();
                    setThemesOpen((prev) => !prev);
                  }}
                  title={isBn ? 'থিম নির্বাচন করুন' : 'Select Theme'}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition cursor-pointer ${
                    !isExpanded ? 'justify-center px-0' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-accent)' }} />
                    {isExpanded && (
                      <span className="font-semibold text-[11px] truncate">
                        {isBn ? activeThemeMeta.nameBn : activeThemeMeta.nameEn}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                        themesOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                {isExpanded && themesOpen && (
                  <div className="mt-1.5 space-y-1 p-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-[11px]">
                    {LUXURY_THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => {
                          onApplyTheme?.(th.id);
                          setThemesOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                          currentTheme === th.id
                            ? 'bg-white/15 text-white font-bold'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {th.secondaryColor ? (
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                              style={{
                                background: `linear-gradient(135deg, ${th.color} 50%, ${th.secondaryColor} 50%)`,
                              }}
                            />
                          ) : (
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                              style={{ backgroundColor: th.color }}
                            />
                          )}
                          <span className="truncate">{isBn ? th.nameBn : th.nameEn}</span>
                        </div>
                        {currentTheme === th.id && (
                          <span className="font-bold shrink-0" style={{ color: 'var(--theme-accent)' }}>
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-[#1E293B] safe-area-bottom">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenAuthModal}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer ${
                !isExpanded ? 'px-0' : ''
              }`}
              title={isBn ? 'ইউজার পরিবর্তন' : 'Switch User'}
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {isExpanded && <span>{isBn ? 'সুইচ ইউজার' : 'Switch'}</span>}
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

