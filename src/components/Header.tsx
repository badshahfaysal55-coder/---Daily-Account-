import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Languages,
  Palette,
  Sun,
  Moon,
  Menu,
  ChevronDown,
  User,
  Camera,
  LogOut,
  Users,
  ShieldCheck,
  CheckCircle2,
  Crown,
  Wifi,
  WifiOff,
  Cloud,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { UserProfile, UserAccount, GlobalAppSettings, AppTheme, DisplayMode, CurrencyCode } from '../types/accounting';
import { ZaraLogo } from './ZaraLogo';
import { Language, t } from '../utils/translations';
import { formatDateBangla, formatDateEn, getCurrencySymbol } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  user: UserProfile;
  currentUserAccount: UserAccount | null;
  globalSettings: GlobalAppSettings;
  currentTheme: AppTheme;
  currentMode: DisplayMode;
  currentLang: Language;
  onApplyTheme: (theme: AppTheme) => void;
  onToggleMode: () => void;
  onToggleLang: () => void;
  onOpenAuthModal: () => void;
  onOpenPhotoModal: () => void;
  onLogout: () => void;
  onToggleSidebarMobile: () => void;
  headerBgColor?: string;
  onSelectCurrency?: (curr: CurrencyCode) => void;
  isSyncing?: boolean;
  lastSyncedAt?: Date;
  onManualSync?: () => void;
  onOpenGoogleDriveModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentUserAccount,
  globalSettings,
  currentTheme,
  currentMode,
  currentLang,
  onApplyTheme,
  onToggleMode,
  onToggleLang,
  onOpenAuthModal,
  onOpenPhotoModal,
  onLogout,
  onToggleSidebarMobile,
  headerBgColor,
  onSelectCurrency,
  isSyncing = false,
  lastSyncedAt,
  onManualSync,
  onOpenGoogleDriveModal,
}) => {
  const isBn = currentLang === 'bn';
  const isOwner = currentUserAccount?.role === 'owner';

  // Dropdown states
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const themes: Array<{ id: AppTheme; nameBn: string; nameEn: string; color: string; secondaryColor?: string }> = [
    { id: 'midnight-gold', nameBn: 'মিডনাইট গোল্ড', nameEn: 'Midnight Gold', color: '#D4AF37' },
    { id: 'royal-blue', nameBn: 'রয়েল ব্লু', nameEn: 'Royal Blue', color: '#3B82F6' },
    { id: 'emerald-green', nameBn: 'এমারেল্ড গ্রিন', nameEn: 'Emerald Green', color: '#10B981' },
    { id: 'graphite-black', nameBn: 'গ্রাফাইট ব্ল্যাক', nameEn: 'Graphite Black', color: '#94A3B8' },
    { id: 'emerald-graphite', nameBn: 'এমারেল্ড গ্রাফাইট', nameEn: 'Emerald Graphite', color: '#10B981', secondaryColor: '#18181B' },
  ];

  const currentDateFormatted = isBn
    ? formatDateBangla(Date.now())
    : formatDateEn(Date.now());

  return (
    <header
      style={{
        backgroundColor: headerBgColor || 'var(--theme-primary)',
        borderColor: 'var(--theme-accent-border)',
      }}
      className="sticky top-0 z-30 border-b shadow-md transition-colors"
    >
      {/* Main Top Header Bar (Compact, SaaS-Grade) */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-14 flex items-center justify-between gap-3">
        {/* Left: Hamburger (mobile) + Compact ZARA Brand Logo & Neat OWNER section */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            {/* Compact ZARA Brand Logo */}
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white p-0.5 shrink-0 shadow-md border border-white/20">
              <img
                src="/assets/aistudio/WhatsApp_Image_2026-11-06_at_9.38.17_AM_2058b80b.jpeg"
                alt="ZARA Logo"
                className="w-full h-full object-cover rounded-[inherit]"
              />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight font-heading leading-tight truncate">
                  {globalSettings.appName || 'ZARA Accounting'}
                </span>
                {isOwner && (
                  <span className="inline-flex items-center gap-1 bg-[#D4AF37] text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs shrink-0">
                    <Crown className="w-2.5 h-2.5 text-slate-950" />
                    Owner
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:block truncate -mt-0.5">
                {isBn ? 'প্রিমিয়াম ক্লাউড প্ল্যাটফর্ম' : 'Enterprise Cloud Accounting'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Zone: Notifications, Language, Theme, Display Mode & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Auto-Sync Live Badge & Manual Refresh */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] text-slate-300 shadow-xs">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-400 text-[10px]">
              {isBn ? 'ক্লাউড সিঙ্ক লাইভ' : 'Auto-Sync Live'}
            </span>
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
                className="p-1 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer text-slate-400"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#D4AF37]' : ''}`} />
              </button>
            )}
          </div>

          {/* Google Drive Auto-Sync Cloud Button */}
          {onOpenGoogleDriveModal && (
            <button
              type="button"
              onClick={onOpenGoogleDriveModal}
              title={isBn ? 'গুগল ড্রাইভ ক্লাউড অটো-সিঙ্ক ও ব্যাকআপ' : 'Google Drive Cloud Auto-Sync & Backup'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 transition shadow-xs cursor-pointer active:scale-95 group"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <span className="font-semibold text-slate-200 group-hover:text-white hidden md:inline">
                Drive Sync
              </span>
            </button>
          )}

          {/* Install PWA App (iOS & Android) */}
          <PWAInstallButton isBn={isBn} />

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
              title={isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AF37] ring-2 ring-[#101A2C]" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#172338] border border-slate-700 rounded-2xl shadow-2xl p-4 text-xs text-white z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="flex items-center gap-2 font-bold font-heading">
                    <Bell className="w-4 h-4 text-[#D4AF37]" />
                    <span>{isBn ? 'সিস্টেম বিজ্ঞপ্তি' : 'System Notifications'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Live</span>
                </div>

                <div className="py-3 space-y-2.5 max-h-64 overflow-y-auto">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200 block">
                        {isBn ? 'ক্লাউড অটো-সেভ সক্রিয়' : 'Cloud Auto-Save Active'}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isBn
                          ? 'প্রতিটি লেনদেন রিয়েল-টাইমে সুরক্ষিত ক্লাউড ডাটাবেজে সংরক্ষিত হচ্ছে।'
                          : 'Every transaction is continuously synced with the cloud database.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200 block">
                        {isBn ? 'ওয়ার্কস্পেস সুরক্ষা নিশ্চিত' : 'Isolated Workspace'}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {currentUserAccount?.workspaceName} ({currentUserAccount?.role})
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/80 text-center">
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {isBn ? 'বন্ধ করুন' : 'Dismiss'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme Quick Selector Dropdown */}
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
              title={isBn ? 'থিম নির্বাচন করুন' : 'Select Theme'}
            >
              <Palette className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
              <span className="hidden md:inline text-xs font-semibold capitalize">
                {currentTheme.replace('-', ' ')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
            </button>

            {themeDropdownOpen && (
              <div
                style={{
                  backgroundColor: 'var(--theme-primary)',
                  borderColor: 'var(--theme-accent-border)',
                }}
                className="absolute right-0 mt-2 w-60 border rounded-2xl shadow-2xl p-2 text-xs text-white z-50"
              >
                <div className="px-3 py-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider border-b border-white/10">
                  {isBn ? '৫টি প্রিমিয়াম থিম' : '5 Luxury Themes'}
                </div>
                <div className="py-1 space-y-1">
                  {themes.map((th) => (
                    <button
                      key={th.id}
                      onClick={() => {
                        onApplyTheme(th.id);
                        setThemeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer ${
                        currentTheme === th.id
                          ? 'bg-white/15 text-white font-bold'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {th.secondaryColor ? (
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow-xs border border-white/30"
                            style={{
                              background: `linear-gradient(135deg, ${th.color} 50%, ${th.secondaryColor} 50%)`,
                            }}
                          />
                        ) : (
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white/20"
                            style={{ backgroundColor: th.color }}
                          />
                        )}
                        <span>{isBn ? th.nameBn : th.nameEn}</span>
                      </div>
                      {currentTheme === th.id && (
                        <span className="font-bold" style={{ color: 'var(--theme-accent)' }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Display Mode Toggle (Sun/Moon) */}
          <button
            onClick={onToggleMode}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title={currentMode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {currentMode === 'light' ? (
              <Moon className="w-5 h-5 text-slate-300" />
            ) : (
              <Sun className="w-5 h-5 text-[#D4AF37]" />
            )}
          </button>

          {/* Quick Currency Switcher Toggle: ৳ BDT & ⃁ SAR */}
          <div className="flex items-center p-0.5 rounded-xl border border-slate-700 bg-slate-900/80 shadow-xs">
            <button
              type="button"
              onClick={() => onSelectCurrency && onSelectCurrency('BDT')}
              className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                user.currency === 'BDT'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Bangladeshi Taka (৳ BDT)"
            >
              <span>৳</span>
              <span className="hidden sm:inline text-[10px]">BDT</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectCurrency && onSelectCurrency('SAR')}
              className={`px-2 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                user.currency === 'SAR'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Saudi Riyal (⃁ SAR)"
            >
              <span>⃁</span>
              <span className="hidden sm:inline text-[10px]">SAR</span>
            </button>
          </div>

          {/* Language Switcher Button (বাংলা / EN) */}
          <button
            onClick={onToggleLang}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title={isBn ? 'Switch to English' : 'বাংলায় দেখুন'}
          >
            <Languages className="w-3.5 h-3.5 text-blue-400" />
            <span>{isBn ? 'EN' : 'বাং'}</span>
          </button>

          {/* User Profile Avatar with dropdown */}
          <div className="relative ml-1" ref={profileRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/80 transition cursor-pointer group"
            >
              {/* Profile Photo Avatar */}
              <div className="relative w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] to-amber-200 shrink-0">
                <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden flex items-center justify-center">
                  {currentUserAccount?.photoUrl || currentUserAccount?.photoData ? (
                    <img
                      src={currentUserAccount.photoUrl || currentUserAccount.photoData}
                      alt={currentUserAccount.name}
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (currentUserAccount?.photoData && img.src !== currentUserAccount.photoData) {
                          img.src = currentUserAccount.photoData;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-black text-amber-400">
                      {(currentUserAccount?.name || user.name).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  {currentUserAccount?.name?.split(' ')[0] || user.name}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {currentUserAccount?.role || 'user'}
                </span>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#172338] border border-slate-700 rounded-2xl shadow-2xl p-3 text-xs text-white z-50 animate-in fade-in slide-in-from-top-2">
                {/* Account details */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] to-amber-200 shrink-0">
                    <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden flex items-center justify-center">
                      {currentUserAccount?.photoUrl || currentUserAccount?.photoData ? (
                        <img
                          src={currentUserAccount.photoUrl || currentUserAccount.photoData}
                          alt={currentUserAccount.name}
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (currentUserAccount?.photoData && img.src !== currentUserAccount.photoData) {
                              img.src = currentUserAccount.photoData;
                            }
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-black text-amber-400">
                          {(currentUserAccount?.name || user.name).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-white block truncate">
                      {currentUserAccount?.name || user.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      @{currentUserAccount?.username}
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold block truncate mt-0.5">
                      {currentUserAccount?.workspaceName}
                    </span>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  {/* Photo Management button */}
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenPhotoModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>{isBn ? 'প্রোফাইল ছবি পরিবর্তন / ক্রপ' : 'Change Profile Photo'}</span>
                  </button>

                  {/* Switch Account */}
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onOpenAuthModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>{isBn ? 'অন্য অ্যাকাউন্টে লগইন' : 'Switch Account'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-700/80">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition cursor-pointer font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isBn ? 'লগআউট' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clean Welcome Message Sub-Bar below Header */}
      <div
        style={{
          backgroundColor: headerBgColor ? undefined : 'var(--theme-secondary, var(--theme-primary))',
          borderColor: 'var(--theme-accent-border)',
        }}
        className="border-t px-4 sm:px-6 py-2 transition-colors"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {isBn ? 'স্বাগতম' : 'Welcome back'},{' '}
              <strong className="text-white font-semibold">
                {currentUserAccount?.name || user.name}
              </strong>
            </span>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="truncate max-w-xs text-slate-300">
              {currentUserAccount?.workspaceName || 'Private Workspace'}
            </span>
            {isOwner && (
              <span className="inline-flex items-center gap-1 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-[10px] px-2 py-0.2 rounded-full uppercase">
                <Crown className="w-2.5 h-2.5" />
                Main Owner
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 self-end sm:self-auto">
            <span className="font-mono">{currentDateFormatted}</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {user.currency}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
