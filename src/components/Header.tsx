import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Menu,
  ChevronDown,
  Camera,
  LogOut,
  Users,
  Smartphone,
} from 'lucide-react';
import { UserProfile, UserAccount, GlobalAppSettings, AppTheme, DisplayMode } from '../types/accounting';
import { Language } from '../utils/translations';
import { formatDateBangla, formatDateEn } from '../utils/formatters';
import { openPWAInstallGuide } from './PWAInstallButton';
import { ZaraLogo } from './ZaraLogo';

interface HeaderProps {
  user: UserProfile;
  currentUserAccount: UserAccount | null;
  globalSettings: GlobalAppSettings;
  currentTheme?: AppTheme;
  currentMode: DisplayMode;
  currentLang: Language;
  onApplyTheme?: (theme: AppTheme) => void;
  onToggleMode: () => void;
  onOpenAuthModal: () => void;
  onOpenPhotoModal: () => void;
  onLogout: () => void;
  onToggleSidebarMobile: () => void;
  headerBgColor?: string;
  isSyncing?: boolean;
  lastSyncedAt?: Date;
  onManualSync?: () => void;
  onOpenGoogleDriveModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  currentUserAccount,
  globalSettings,
  currentMode,
  currentLang,
  onToggleMode,
  onOpenAuthModal,
  onOpenPhotoModal,
  onLogout,
  onToggleSidebarMobile,
  headerBgColor,
}) => {
  const isBn = currentLang === 'bn';

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentDateFormatted = isBn
    ? formatDateBangla(Date.now())
    : formatDateEn(Date.now());

  return (
    <header
      style={{
        backgroundColor: headerBgColor || 'var(--theme-primary)',
        borderColor: 'var(--theme-accent-border)',
      }}
      className="sticky top-0 z-30 w-full border-b shadow-md transition-colors safe-area-top"
    >
      {/* Main Top Header Bar: Shadowed Logo + App Name + Mode + Profile Avatar */}
      <div className="w-full px-2.5 sm:px-6 lg:px-8 xl:px-10 min-h-[58px] sm:min-h-[60px] py-1.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Shadowed Brand Logo & App Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 ml-0.5 sm:ml-4">
            {/* ZARA Brand Logo — Clean 3D Glowing Emblem */}
            <ZaraLogo size="xs" showText={false} className="sm:hidden shrink-0" />
            <ZaraLogo size="sm" showText={false} className="hidden sm:inline-flex shrink-0" />

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-white text-[13px] sm:text-base tracking-tight font-heading leading-tight truncate drop-shadow-xs">
                  {globalSettings.appName || 'ZF Accounting'}
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-300/85 sm:text-slate-400 font-medium block truncate -mt-0.5">
                {isBn ? 'প্রিমিয়াম ক্লাউড প্ল্যাটফর্ম' : 'Enterprise Cloud Accounting'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Zone: Dark/Light + Profile Avatar + Mobile Right-Drawer Menu Trigger */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Display Mode Toggle (Sun/Moon) */}
          <button
            onClick={onToggleMode}
            className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title={currentMode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {currentMode === 'light' ? (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
            ) : (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF37]" />
            )}
          </button>

          {/* User Profile Avatar with dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 pl-1 sm:pl-1.5 pr-1.5 sm:pr-2 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 border border-slate-700/80 transition cursor-pointer group"
            >
              {/* Profile Photo Avatar */}
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] to-amber-200 shrink-0">
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
                    <span className="text-[10px] sm:text-xs font-black text-amber-400">
                      {(currentUserAccount?.name || user.name).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-white truncate max-w-[54px] sm:max-w-[100px]">
                  {currentUserAccount?.name?.split(' ')[0] || user.name}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate max-w-[54px] sm:max-w-[100px]">
                  {currentUserAccount?.role || 'user'}
                </span>
              </div>

              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#172338] border border-slate-700 rounded-2xl shadow-2xl p-3 text-xs text-white z-50 animate-in fade-in slide-in-from-top-2">
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
                  {/* Install / Download App guide */}
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      openPWAInstallGuide();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-900/40 transition cursor-pointer font-semibold"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>{isBn ? 'ফোনে অ্যাপ ডাউনলোড (iPhone / Android)' : 'Install / Download App'}</span>
                  </button>

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

          {/* Mobile Menu Trigger (opens right-side navigation & option bar) */}
          <button
            onClick={onToggleSidebarMobile}
            className="lg:hidden min-w-[40px] min-h-[40px] p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0 flex items-center justify-center"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sub-Bar: Welcome Message + Current Date */}
      <div
        style={{
          backgroundColor: headerBgColor ? undefined : 'var(--theme-secondary, var(--theme-primary))',
          borderColor: 'var(--theme-accent-border)',
        }}
        className="border-t px-2.5 sm:px-6 lg:px-8 xl:px-10 py-1.5 sm:py-2 transition-colors"
      >
        <div className="w-full flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="truncate block">
              {isBn ? 'স্বাগতম' : 'Welcome'},{' '}
              <strong className="text-white font-semibold">
                {currentUserAccount?.name || user.name}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
            <span className="font-mono text-slate-300 sm:text-slate-400">{currentDateFormatted}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

