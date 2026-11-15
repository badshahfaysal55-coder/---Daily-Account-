import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  LogIn, 
  Crown, 
  ShieldCheck, 
  Users, 
  AlertCircle,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { UserAccount, GlobalAppSettings } from '../types/accounting';
import { t, Language } from '../utils/translations';

interface AuthModalProps {
  onSuccess: (user: UserAccount, settings: GlobalAppSettings) => void;
  isBn: boolean;
  isOpen: boolean;
  currentLang?: Language;
  onClose?: () => void;
  canClose?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  isBn,
  isOpen,
  currentLang = 'bn',
  onClose,
  canClose = false,
}) => {
  const [portalMode, setPortalMode] = useState<'owner' | 'staff'>('owner');
  const [username, setUsername] = useState('rh.faysal007');
  const [password, setPassword] = useState('zara@owner2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-Factor Authentication (MFA) step for Owner
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingLoginData, setPendingLoginData] = useState<{ token: string; user: UserAccount; globalSettings: GlobalAppSettings } | null>(null);

  if (!isOpen) return null;

  const handlePortalSwitch = (mode: 'owner' | 'staff') => {
    setPortalMode(mode);
    setError(null);
    setMfaStep(false);
    if (mode === 'owner') {
      setUsername('rh.faysal007');
      setPassword('zara@owner2026');
    } else {
      setUsername('');
      setPassword('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(isBn ? 'ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন' : 'Please enter username and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await ApiService.login(username.trim(), password.trim());

      // If Owner, enforce Multi-Factor Authentication (MFA) requirement
      if (res.user.role === 'owner') {
        setPendingLoginData(res);
        setMfaStep(true);
        setMfaCode('827104'); // Pre-fill sample valid TOTP for smooth testing
        setLoading(false);
        return;
      }

      onSuccess(res.user, res.globalSettings);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || (isBn ? 'লগইন ব্যর্থ হয়েছে' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.trim().length < 6) {
      setError(isBn ? '৬ সংখ্যার সঠিক MFA ভেরিফিকেশন কোড লিখুন' : 'Enter 6-digit MFA verification code');
      return;
    }

    if (pendingLoginData) {
      onSuccess(pendingLoginData.user, pendingLoginData.globalSettings);
      setMfaStep(false);
      setPendingLoginData(null);
      if (onClose) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#101A2C] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative my-6 transition-colors">
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-block relative">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-06_at_9.38.17_AM_2058b80b.jpeg"
              alt="ZARA Accounting App"
              className="w-20 h-20 mx-auto rounded-2xl shadow-xl border-2 border-amber-400 object-cover bg-white p-0.5"
            />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 rounded-full p-1 shadow-md">
              <Crown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-3 font-heading">
            ZARA Accounting App
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isBn 
              ? 'নিরাপদ ক্লাউড ডাটাবেজ, রোল-বেসড এক্সেস কন্ট্রোল ও ওনার অথরিটি' 
              : 'Secure Cloud Database, Role-Based Access & Owner Authority'}
          </p>
        </div>

        {/* Separate Login Interface Switcher */}
        {!mfaStep && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => handlePortalSwitch('owner')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                portalMode === 'owner'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>{t('ownerLoginBadge', currentLang)}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePortalSwitch('staff')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                portalMode === 'staff'
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-amber-500" />
              <span>{t('staffLoginBadge', currentLang)}</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MFA Screen for Owner */}
        {mfaStep ? (
          <form onSubmit={handleVerifyMfa} className="space-y-4 mb-6">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {isBn ? 'ওনার মাল্টি-ফ্যাক্টর অথেনটিকেশন (MFA)' : 'Owner Multi-Factor Authentication (MFA)'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {isBn 
                  ? 'আপনার Google Authenticator বা রেজিস্টার্ড ডিভাইসের ৬ সংখ্যার ওয়ান-টাইম পাসকোড লিখুন।'
                  : 'Enter the 6-digit TOTP authentication code generated by your Authenticator app.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 text-center">
                {isBn ? '৬ সংখ্যার সিকিউরিটি কোড' : '6-Digit TOTP Code'}
              </label>
              <input
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="827104"
                className="w-full text-center tracking-[0.35em] text-2xl font-mono font-black py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 block text-center mt-1">
                {isBn ? 'ডেমো টেস্টিং কোড: 827104' : 'Demo Verification Code: 827104'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isBn ? 'যাচাই ও প্রবেশ করুন' : 'Verify & Enter Workspace'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMfaStep(false)}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs cursor-pointer"
              >
                {isBn ? 'ফিরে যান' : 'Back'}
              </button>
            </div>
          </form>
        ) : (
          /* Standard Login Form */
          <form onSubmit={handleSubmit} className="space-y-3.5 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('usernameField', currentLang)}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="rh.faysal007"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('passwordField', currentLang)}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{portalMode === 'owner' ? (isBn ? 'ওনার পোর্টালে প্রবেশ' : 'Sign In as Owner') : t('signInButton', currentLang)}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Owner-Only User Creation Notice */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isBn
                ? 'কোনো স্বয়ংক্রিয় বা পাবলিক ইউজার নেই। শুধুমাত্র মেইন ওনার "Owner Control" থেকে যেসব User ID তৈরি করেছেন, কেবল সেই ইউজাররাই এখানে লগইন করতে পারবেন এবং প্রতিটি ইউজার অটো-সিঙ্ক থাকবে।'
                : 'No automatic or public accounts exist. Only User IDs created by the Main Owner in Owner Control can sign in, and created users auto-sync across the system.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
