import React, { useState } from 'react';
import { 
  Palette, 
  Check, 
  Sun, 
  Moon, 
  Languages, 
  Hash, 
  Sparkles, 
  Crown, 
  CheckCircle2, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { AppTheme, DisplayMode, UserAccount, GlobalAppSettings, CurrencyCode } from '../types/accounting';
import { t, Language } from '../utils/translations';
import { ApiService } from '../services/api';
import { getCurrencySymbol } from '../utils/formatters';

interface AppearanceSettingsProps {
  currentUser: UserAccount;
  currentTheme: AppTheme;
  currentMode: DisplayMode;
  currentLang: Language;
  useBanglaNumerals: boolean;
  globalSettings: GlobalAppSettings;
  currentCurrency?: CurrencyCode;
  currentHeaderColor?: string;
  currentSidebarColor?: string;
  onApplyTheme: (theme: AppTheme) => void;
  onApplyMode: (mode: DisplayMode) => void;
  onApplyLang: (lang: Language) => void;
  onApplyNumerals: (useBangla: boolean) => void;
  onApplyCurrency?: (curr: CurrencyCode) => void;
  onApplyHeaderColor?: (color: string) => void;
  onApplySidebarColor?: (color: string) => void;
  onUpdateGlobalSettings: (settings: GlobalAppSettings) => void;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  currentUser,
  currentTheme,
  currentMode,
  currentLang,
  useBanglaNumerals,
  globalSettings,
  currentCurrency = 'SAR',
  currentHeaderColor,
  currentSidebarColor,
  onApplyTheme,
  onApplyMode,
  onApplyLang,
  onApplyNumerals,
  onApplyCurrency,
  onApplyHeaderColor,
  onApplySidebarColor,
  onUpdateGlobalSettings,
}) => {
  const isBn = currentLang === 'bn';
  const isOwner = currentUser.role === 'owner';
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleSelectTheme = async (theme: AppTheme) => {
    onApplyTheme(theme);
    // Persist to user's cloud account
    try {
      await ApiService.updateUserPreferences(currentUser.id, { theme });
      showToast(isBn ? 'থিম সফলভাবে ক্লাউড প্রোফাইলে সংরক্ষিত হয়েছে!' : 'Theme applied and saved to your cloud profile!');
    } catch {
      showToast(isBn ? 'থিম সক্রিয় হয়েছে' : 'Theme applied');
    }
  };

  const handleSelectMode = async (mode: DisplayMode) => {
    onApplyMode(mode);
    try {
      await ApiService.updateUserPreferences(currentUser.id, { displayMode: mode });
      showToast(isBn ? 'ডিসপ্লে মোড সংরক্ষিত হয়েছে!' : 'Display mode updated!');
    } catch {
      showToast(isBn ? 'মোড পরিবর্তন হয়েছে' : 'Mode changed');
    }
  };

  const handleSelectLang = async (lang: Language) => {
    onApplyLang(lang);
    try {
      await ApiService.updateUserPreferences(currentUser.id, { language: lang });
      showToast(lang === 'bn' ? 'ভাষা বাংলা নির্বাচিত হয়েছে' : 'Language switched to English');
    } catch {
      // ignore
    }
  };

  const handleSetGlobalDefaultTheme = async (theme: AppTheme) => {
    if (!isOwner) return;
    try {
      const updated = await ApiService.updateGlobalSettings({ defaultTheme: theme });
      onUpdateGlobalSettings(updated);
      showToast(isBn ? `নতুন ইউজারদের জন্য ডিফল্ট থিম "${theme}" নির্ধারিত হয়েছে!` : `Default theme for new users set to "${theme}"!`);
    } catch {
      // ignore
    }
  };

  const THEMES: Array<{
    id: AppTheme;
    name: string;
    subtitle: string;
    primaryColor: string;
    secondaryColor?: string;
    accentColor: string;
    bgPreview: string;
    cardPreview: string;
    textPreview: string;
    badgeBgPreview?: string;
    isDefault?: boolean;
    isAllUsersFeatured?: boolean;
    descriptionBn: string;
    descriptionEn: string;
  }> = [
    {
      id: 'midnight-gold',
      name: 'Midnight Gold (মিডনাইট গোল্ড)',
      subtitle: 'Navy & Luxury Royal Gold',
      primaryColor: '#101A2C',
      accentColor: '#D4AF37',
      bgPreview: '#F8FAFC',
      cardPreview: '#101A2C',
      textPreview: '#D4AF37',
      isDefault: true,
      descriptionBn: 'রাজকীয় নেভি ব্লু (#101A2C), রয়েল গোল্ড (#D4AF37) এবং পিওর হোয়াইট — ZARA এর মূল এক্সিকিউটিভ থিম।',
      descriptionEn: 'Primary Navy (#101A2C), Royal Gold (#D4AF37), and Pure White. The signature ZARA luxury standard.',
    },
    {
      id: 'royal-blue',
      name: 'Royal Blue (রয়েল ব্লু)',
      subtitle: 'Corporate Banking Sapphire',
      primaryColor: '#1E3A8A',
      accentColor: '#2563EB',
      bgPreview: '#F0F4F8',
      cardPreview: '#1E3A8A',
      textPreview: '#93C5FD',
      descriptionBn: 'গভীর রয়্যাল ব্লু (#1E3A8A), সাফায়ার ব্লু ও ক্রিস্প হোয়াইট — আন্তর্জাতিক ব্যাংকিং ও ফিন্যান্সিয়াল লুক।',
      descriptionEn: 'Deep corporate royal blue (#1E3A8A), sapphire highlights, and crisp platinum white styling.',
    },
    {
      id: 'emerald-green',
      name: 'Emerald Green (এমারেল্ড গ্রিন)',
      subtitle: 'Wealth & Prosperity Emerald',
      primaryColor: '#064E3B',
      accentColor: '#059669',
      bgPreview: '#F2FBF7',
      cardPreview: '#064E3B',
      textPreview: '#6EE7B7',
      descriptionBn: 'মার্জিত সবুজ (#064E3B), গোল্ডেন মিন্ট ও হোয়াইট — সমৃদ্ধি, ব্যালেন্স ও স্থিতিশীল আর্থিক প্রবৃদ্ধির প্রতীক।',
      descriptionEn: 'Forest pine (#064E3B), emerald green, and golden mint accents. Symbol of financial prosperity.',
    },
    {
      id: 'graphite-black',
      name: 'Graphite Black (গ্রাফাইট ব্ল্যাক)',
      subtitle: 'Modern Charcoal & Silver',
      primaryColor: '#18181B',
      accentColor: '#71717A',
      bgPreview: '#F4F4F5',
      cardPreview: '#18181B',
      textPreview: '#E4E4E7',
      descriptionBn: 'আধুনিক অবসিডিয়ান ব্ল্যাক (#09090B), কাঠকয়লা চারকোল ও প্লাটিনাম সিলভার — মিনিমালিস্ট ও হাই-টেক।',
      descriptionEn: 'Sleek obsidian black (#09090B), charcoal grey, and brushed platinum silver for high-tech precision.',
    },
    {
      id: 'emerald-graphite',
      name: 'Emerald Graphite (এমারেল্ড গ্রাফাইট)',
      subtitle: 'Two-Color Fusion: Emerald Green & Graphite Black',
      primaryColor: '#064E3B',
      secondaryColor: '#18181B',
      accentColor: '#10B981',
      bgPreview: '#F2F7F5',
      cardPreview: 'linear-gradient(135deg, #064E3B 0%, #111614 55%, #18181B 100%)',
      textPreview: '#6EE7B7',
      badgeBgPreview: 'rgba(16, 185, 129, 0.18)',
      isAllUsersFeatured: true,
      descriptionBn: 'এমারেল্ড গ্রিন (#064E3B) ও গ্রাফাইট ব্ল্যাক (#18181B) — দুটি কালারের সমন্বয়ে তৈরি প্রিমিয়াম থিম, যেকোনো ইউজার ব্যবহার করতে পারবেন।',
      descriptionEn: 'Two-color fusion combining Deep Emerald Green (#064E3B) & Graphite Black (#18181B) with mint accents — available for every user.',
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-amber-500/40 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {t('appearanceTitle', currentLang)}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('appearanceSubtitle', currentLang)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
              User: @{currentUser.username}
            </span>
          </div>
        </div>

        {/* Global Controls Row: Light/Dark Mode + Language + Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {/* Display Mode */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>{t('displayMode', currentLang)}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectMode('light')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  currentMode === 'light'
                    ? 'bg-white border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('lightMode', currentLang)}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('dark')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  currentMode === 'dark'
                    ? 'bg-slate-900 border-amber-500 text-amber-400 shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('darkMode', currentLang)}</span>
              </button>
            </div>
          </div>

          {/* Language Preference */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-blue-500" />
              <span>{t('languageOptionTitle', currentLang)}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectLang('bn')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  currentLang === 'bn'
                    ? 'bg-white border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>🇧🇩 বাংলা</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectLang('en')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                  currentLang === 'en'
                    ? 'bg-white border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>🇺🇸 English</span>
              </button>
            </div>
          </div>

          {/* Numeral Digits Format */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-500" />
              <span>{t('numeralFormatTitle', currentLang)}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onApplyNumerals(true)}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                  useBanglaNumerals
                    ? 'bg-white border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>১২৩৪ ৳</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyNumerals(false)}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                  !useBanglaNumerals
                    ? 'bg-white border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>1234 ৳</span>
              </button>
            </div>
          </div>
        </div>

        {/* Currency Preference Section with Signs (BDT ৳ & SAR ⃁) */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span className="text-sm font-black text-amber-500 font-mono">৳/⃁</span>
                <span>{isBn ? 'মুদ্রা ও কারেন্সি সাইন (Currency & Symbol)' : 'Currency & Currency Symbol'}</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isBn 
                  ? 'বাংলাদেশি টাকা (৳ BDT) এবং সৌদি রিয়াল (⃁ SAR) সাইনসহ নির্বাচন করুন।' 
                  : 'Select active currency: Bangladeshi Taka (৳ BDT) or Saudi Riyal (⃁ SAR).'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-1 bg-amber-100 text-amber-900 rounded-lg">
              Active: {currentCurrency} ({getCurrencySymbol(currentCurrency)})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { code: 'BDT' as CurrencyCode, sign: '৳', labelBn: 'বাংলাদেশি টাকা', labelEn: 'Bangladeshi Taka', flag: '🇧🇩' },
              { code: 'SAR' as CurrencyCode, sign: '⃁', labelBn: 'সৌদি রিয়াল', labelEn: 'Saudi Riyal', flag: '🇸🇦' },
              { code: 'USD' as CurrencyCode, sign: '$', labelBn: 'মার্কিন ডলার', labelEn: 'US Dollar', flag: '🇺🇸' },
              { code: 'EUR' as CurrencyCode, sign: '€', labelBn: 'ইউরো', labelEn: 'Euro', flag: '🇪🇺' },
            ].map((cur) => {
              const isSelected = currentCurrency === cur.code;
              return (
                <button
                  key={cur.code}
                  type="button"
                  onClick={() => onApplyCurrency && onApplyCurrency(cur.code)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{cur.flag}</span>
                    <span className={`text-base font-black font-mono ${isSelected ? 'text-amber-600' : 'text-slate-700'}`}>
                      {cur.sign}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{cur.code}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate">
                    {isBn ? cur.labelBn : cur.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Header & Option Bar (Sidebar) Colors */}
        <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" />
                <span>{isBn ? 'হেডার এবং অপশন বার (সাইডবার) কালার পরিবর্তন' : 'Header & Option Bar (Sidebar) Custom Colors'}</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isBn 
                  ? 'আপনার পছন্দমতো ওপরের হেডার ও বামপাশের অপশন বারের ব্যাকগ্রাউন্ড কালার কাস্টমাইজ করুন।' 
                  : 'Customize the exact background colors for top Header and left Option Bar (Sidebar).'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Header Color Picker */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {isBn ? '১. টপ হেডার কালার' : '1. Top Header Color'}
                </span>
                <span className="text-[11px] font-mono text-slate-500 uppercase">
                  {currentHeaderColor || (isBn ? 'থিম ডিফল্ট' : 'Theme Default')}
                </span>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: 'Midnight', hex: '#101A2C' },
                  { name: 'Pitch Black', hex: '#0B0F17' },
                  { name: 'Deep Slate', hex: '#1E293B' },
                  { name: 'Dark Gold', hex: '#1A150A' },
                  { name: 'Emerald', hex: '#062319' },
                  { name: 'Deep Ruby', hex: '#230B10' },
                ].map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => onApplyHeaderColor && onApplyHeaderColor(color.hex)}
                    className="w-7 h-7 rounded-lg border border-slate-300 relative transition transform hover:scale-110 cursor-pointer shadow-xs"
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {currentHeaderColor === color.hex && (
                      <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="color"
                    value={currentHeaderColor || '#18181B'}
                    onChange={(e) => onApplyHeaderColor && onApplyHeaderColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                  />
                  <span>{isBn ? 'কাস্টম কালার নির্বাচন:' : 'Custom Hex Color:'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => onApplyHeaderColor && onApplyHeaderColor('')}
                  className="ml-auto text-[10px] text-amber-600 hover:underline font-bold cursor-pointer"
                >
                  {isBn ? 'রিসেট' : 'Reset'}
                </button>
              </div>
            </div>

            {/* Option Bar (Sidebar) Color Picker */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {isBn ? '২. বামপাশের অপশন বার (Sidebar) কালার' : '2. Left Option Bar (Sidebar) Color'}
                </span>
                <span className="text-[11px] font-mono text-slate-500 uppercase">
                  {currentSidebarColor || (isBn ? 'থিম ডিফল্ট' : 'Theme Default')}
                </span>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { name: 'Midnight', hex: '#101A2C' },
                  { name: 'Pure Black', hex: '#070B12' },
                  { name: 'Charcoal', hex: '#151E2E' },
                  { name: 'Espresso', hex: '#16110B' },
                  { name: 'Deep Forest', hex: '#071C14' },
                  { name: 'Plum Navy', hex: '#190F24' },
                ].map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => onApplySidebarColor && onApplySidebarColor(color.hex)}
                    className="w-7 h-7 rounded-lg border border-slate-300 relative transition transform hover:scale-110 cursor-pointer shadow-xs"
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {currentSidebarColor === color.hex && (
                      <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="color"
                    value={currentSidebarColor || '#18181B'}
                    onChange={(e) => onApplySidebarColor && onApplySidebarColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                  />
                  <span>{isBn ? 'কাস্টম কালার নির্বাচন:' : 'Custom Hex Color:'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => onApplySidebarColor && onApplySidebarColor('')}
                  className="ml-auto text-[10px] text-amber-600 hover:underline font-bold cursor-pointer"
                >
                  {isBn ? 'রিসেট' : 'Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Fully Functional Themes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{isBn ? '৫টি প্রিমিয়াম কর্পোরেট থিম নির্বাচন করুন' : 'Select From 5 Luxury Corporate Themes'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBn 
                ? 'যেকোনো থিমে ক্লিক করে সাথে সাথে পুরো অ্যাপের রূপ পরিবর্তন করুন। সকল ইউজার নিজস্ব থিম ব্যবহার করতে পারবেন।'
                : 'Instantly applies across Dashboard, Sidebar, Buttons, Cards, Reports, and Invoices for any user without reload.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {THEMES.map((theme) => {
            const isActive = currentTheme === theme.id;

            return (
              <div
                key={theme.id}
                className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-sm flex flex-col justify-between relative overflow-hidden ${
                  isActive 
                    ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md' 
                    : theme.isAllUsersFeatured
                      ? 'border-emerald-500/40 hover:border-emerald-500'
                      : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Active badge */}
                {isActive && (
                  <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>{t('themeAppliedBadge', currentLang)}</span>
                  </div>
                )}

                {!isActive && theme.isAllUsersFeatured && (
                  <div className="absolute top-3 right-3 bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {isBn ? 'সকল ইউজারের জন্য' : 'All Users'}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    {theme.secondaryColor && (
                      <div
                        className="w-4 h-4 rounded-full border border-white shadow-xs -ml-2"
                        style={{ backgroundColor: theme.secondaryColor }}
                      />
                    )}
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-xs -ml-2"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                    <h3 className="font-bold text-slate-900 text-sm">{theme.name}</h3>
                  </div>

                  <p className="text-xs text-slate-500 font-medium mb-3">
                    {theme.subtitle}
                  </p>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {isBn ? theme.descriptionBn : theme.descriptionEn}
                  </p>

                  {/* Visual Theme Mockup Preview Box */}
                  <div 
                    className="rounded-xl p-3 mb-4 border border-slate-200/80 shadow-inner flex flex-col gap-2"
                    style={{ backgroundColor: theme.bgPreview }}
                  >
                    {/* Simulated Mini App Header */}
                    <div 
                      className="rounded-lg p-2 flex items-center justify-between text-[11px] font-bold shadow-xs"
                      style={{ background: theme.cardPreview, color: theme.textPreview }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                        <span>ZARA Accounting</span>
                      </div>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: theme.badgeBgPreview || 'rgba(255,255,255,0.1)' }}
                      >
                        {getCurrencySymbol(currentCurrency)} 150,000
                      </span>
                    </div>

                    {/* Simulated Mini Cards */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 block text-[9px]">{t('income', currentLang)}</span>
                        <span className="font-bold text-emerald-600">+ {getCurrencySymbol(currentCurrency)} 45,000</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-400 block text-[9px]">{t('expense', currentLang)}</span>
                        <span className="font-bold text-rose-600">- {getCurrencySymbol(currentCurrency)} 12,500</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{isBn ? 'সক্রিয় রয়েছে' : 'Currently Active'}</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('applyThemeBtn', currentLang)}</span>
                      </>
                    )}
                  </button>

                  {/* Owner-only button to set as global default for new users */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleSetGlobalDefaultTheme(theme.id)}
                      className="px-2.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 text-[11px] font-semibold transition cursor-pointer"
                      title={isBn ? 'নতুন ইউজারদের জন্য গ্লোবাল ডিফল্ট হিসেবে সেট করুন' : 'Set as Global Default for new users'}
                    >
                      <Crown className="w-3 h-3 text-amber-500 inline mr-1" />
                      <span>{isBn ? 'ডিফল্ট করুন' : 'Make Default'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
