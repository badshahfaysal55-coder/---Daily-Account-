import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  Copy,
  Check,
  X,
  WifiOff,
  QrCode,
  Share2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  isBn?: boolean;
  variant?: 'header' | 'sidebar';
  collapsed?: boolean;
  onTriggered?: () => void;
}

export const DEV_APP_URL =
  'https://ais-dev-otwyikgrhfjkomxcdz7g2q-73319294110.europe-west2.run.app';
export const SHARED_APP_URL =
  'https://ais-pre-otwyikgrhfjkomxcdz7g2q-73319294110.europe-west2.run.app';

export function openPWAInstallGuide() {
  window.dispatchEvent(new CustomEvent('zara-open-install-guide'));
}

export const PWAInstallModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isBn?: boolean;
}> = ({ isOpen, onClose, isBn = false }) => {
  const { isInstallable, isIOS, isInIframe, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const isDevPreview =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('ais-dev-') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1'));

  const isLiveSharedOrigin =
    typeof window !== 'undefined' &&
    window.location.hostname.includes('ais-pre-');

  const [linkMode, setLinkMode] = useState<'owner' | 'shared'>(
    isLiveSharedOrigin ? 'shared' : 'owner'
  );

  const appUrlToShare =
    typeof window !== 'undefined' && !isDevPreview && !isLiveSharedOrigin
      ? window.location.origin
      : linkMode === 'owner'
      ? DEV_APP_URL
      : SHARED_APP_URL;

  useEffect(() => {
    setActiveTab(isIOS ? 'ios' : 'android');
  }, [isIOS]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    QRCode.toDataURL(appUrlToShare, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, appUrlToShare]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrlToShare);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleShareLink = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'ZARA Accounting',
          text: isBn
            ? 'ZARA Accounting অ্যাপটি ফোনে ইনস্টল করতে এই লিংকটি ওপেন করুন:'
            : 'Open this link in Safari (iOS) or Chrome (Android) to install ZARA Accounting:',
          url: appUrlToShare,
        });
        return;
      } catch {
        // Fallback to copy if share cancelled
      }
    }
    await handleCopyUrl();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 safe-area-top safe-area-bottom overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#131F33] border border-slate-700/80 text-white shadow-2xl overflow-hidden my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-700/80 bg-slate-900/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold font-heading truncate">
                {isBn ? 'iOS ও Android ফোনে অ্যাপ ডাউনলোড' : 'Download & Install on iOS & Android'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isBn
                  ? 'ক্যামেরা দিয়ে QR কোড স্ক্যান করুন অথবা লিংক কপি করুন'
                  : 'Scan QR with phone camera or install directly'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Close install guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          {/* Native Android/Chrome 1-Tap Install CTA if ready */}
          {isInstallable && (
            <button
              type="button"
              onClick={async () => {
                const ok = await install();
                if (ok) onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>
                {isBn ? 'এখনই ফোনে সরাসরি ইনস্টল করুন' : 'Tap Here to Install App Directly'}
              </span>
            </button>
          )}

          {/* Link Type Switcher: Direct Owner Link vs Public Shared Link */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setLinkMode('owner');
                  setCopied(false);
                }}
                className={`py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  linkMode === 'owner'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isBn ? 'ডাইরেক্ট লিংক (এখনই চালু)' : 'Direct Link (Works Now)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkMode('shared');
                  setCopied(false);
                }}
                className={`py-2 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  linkMode === 'shared'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isBn ? 'শেয়ার করা পাবলিক লিংক' : 'Shared App Link'}
              </button>
            </div>

            {linkMode === 'owner' ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-[11px] text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <div className="font-bold text-emerald-300">
                    {isBn
                      ? 'আপনার ফোনে এখনই কাজ করবে (Google লগইন লাগবে):'
                      : 'Ready immediately on your phone:'}
                  </div>
                  <p>
                    {isBn
                      ? 'আপনার ফোনের Chrome বা Safari ব্রাউজারে Google অ্যাকাউন্ট (rh.faysal007@gmail.com) সাইন-ইন করা থাকলে এই লিংকটি সাথে সাথে ওপেন হবে।'
                      : 'Open this link in Safari (iOS) or Chrome (Android) while signed into your Google account (rh.faysal007@gmail.com).'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-3 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <div className="font-bold text-amber-300">
                    {isBn
                      ? '৪০৪ বা ৪০৩ এরর দেখালে:'
                      : 'Why 404 or 403 can appear on the Shared Link:'}
                  </div>
                  <p>
                    {isBn
                      ? '৪০৪ মানে উপরের ডানদিকে AI Studio-র "Share" বাটন থেকে অ্যাপটি এখনো পাবলিশ করা হয়নি। আর ৪০৩ মানে Share সেটিংসে অ্যাক্সেস চালু নেই অথবা ফোনে লগইন করা নেই।'
                      : '404 means the app has not been published yet via the top-right "Share" button in AI Studio. 403 means access permission in Share is not enabled. Use "Direct Link" above if you want to install right away.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Scannable QR Code + Direct Link Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-700/80 p-3.5 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2 rounded-xl shadow-md shrink-0 flex flex-col items-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan QR code to open ZARA Accounting on phone"
                  className="w-32 h-32 block"
                />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center text-slate-400">
                  <QrCode className="w-10 h-10" />
                </div>
              )}
              <span className="text-[10px] font-bold text-slate-800 mt-1">
                {isBn ? 'ফোন ক্যামেরায় স্ক্যান করুন' : 'Scan with Phone Camera'}
              </span>
            </div>

            <div className="flex-1 min-w-0 w-full space-y-2.5">
              <div>
                <p className="text-xs font-bold text-amber-400">
                  {isBn
                    ? '১. ফোনের ক্যামেরা দিয়ে QR কোড স্ক্যান করুন'
                    : '1. Point your iPhone or Android camera at the QR code'}
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  {isBn
                    ? 'অথবা নিচের লিংকটি কপি/শেয়ার করে ফোনের ব্রাউজারে (iOS-এ Safari, Android-এ Chrome) ওপেন করুন।'
                    : 'Or copy/send this link and open it in Safari (iPhone) or Chrome (Android).'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={appUrlToShare}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{isBn ? 'কপি' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>{isBn ? 'কপি' : 'Copy'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isInIframe && (
                  <a
                    href={appUrlToShare}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isBn ? 'নতুন ট্যাবে খুলুন' : 'Open App Link'}</span>
                  </a>
                )}

                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{isBn ? 'লিংক পাঠান' : 'Send to Phone'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Platform Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              iPhone / iPad (iOS)
            </button>
          </div>

          {/* Step-by-Step Guide */}
          {activeTab === 'android' ? (
            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-900/50 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  {isBn
                    ? 'Android ফোনের Google Chrome ব্রাউজারে লিংকটি ওপেন করুন।'
                    : 'Open the link above in Google Chrome on your Android phone.'}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p className="flex items-center gap-1 flex-wrap">
                  {isBn ? 'উপরে ডানদিকে থ্রি-ডট মেনু' : 'Tap the 3-dot menu'}
                  <MoreVertical className="w-3.5 h-3.5 inline text-slate-200 bg-slate-800 rounded p-0.5" />
                  {isBn ? 'ট্যাপ করুন (অথবা উপরের "Install App" বাটন চাপুন)।' : 'in the top-right corner.'}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  {isBn ? (
                    <>
                      <strong className="text-white">"Install app"</strong> বা{' '}
                      <strong className="text-white">"Add to Home screen"</strong> সিলেক্ট করে{' '}
                      <strong className="text-emerald-400">Install</strong> চাপুন।
                    </>
                  ) : (
                    <>
                      Tap <strong className="text-white">"Install app"</strong> or{' '}
                      <strong className="text-white">"Add to Home screen"</strong> and tap{' '}
                      <strong className="text-emerald-400">Install</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-900/50 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  {isBn
                    ? 'আপনার iPhone বা iPad-এ অবশ্যই Safari ব্রাউজারে লিংকটি ওপেন করুন।'
                    : 'Open the link above in Safari (not Chrome) on your iPhone or iPad.'}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p className="flex items-center gap-1 flex-wrap">
                  {isBn ? 'নিচে মাঝখানের Share বাটন' : 'Tap the Share button'}
                  <Share className="w-3.5 h-3.5 inline text-sky-400" />
                  {isBn ? 'ট্যাপ করুন।' : 'at the bottom of Safari.'}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p className="flex items-center gap-1 flex-wrap">
                  {isBn ? 'নিচে স্ক্রল করে' : 'Scroll down and tap'}
                  <PlusSquare className="w-3.5 h-3.5 inline text-slate-200" />
                  <strong className="text-white">"Add to Home Screen"</strong>{' '}
                  {isBn ? 'চাপুন এবং উপরে Add দিন।' : 'then tap Add.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-emerald-400/90 bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {isBn
                ? 'ইনস্টল হলে মোবাইল অ্যাপের মতো ফুল-স্ক্রিনে চলবে এবং সব হিসাব অটো-সিঙ্ক থাকবে।'
                : 'Runs full-screen on your Home Screen with automatic real-time cloud sync.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  isBn = false,
  variant = 'header',
  collapsed = false,
  onTriggered,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const handler = () => setShowGuide(true);
    window.addEventListener('zara-open-install-guide', handler);
    return () => window.removeEventListener('zara-open-install-guide', handler);
  }, []);

  const handleInstallClick = async () => {
    onTriggered?.();
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  // Hide trigger button when already running as an installed standalone PWA,
  // but keep PWAInstallModal mounted for manual triggers.
  if (isInstalled) {
    return <PWAInstallModal isOpen={showGuide} onClose={() => setShowGuide(false)} isBn={isBn} />;
  }

  if (variant === 'sidebar') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          title={isBn ? 'iOS এবং Android ফোনে অ্যাপ ডাউনলোড ও ইনস্টল করুন' : 'Get App (iOS & Android)'}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-xs font-bold text-white transition shadow-sm cursor-pointer active:scale-95 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <span className="truncate">
              {isInstallable
                ? isBn
                  ? 'অ্যাপ ইনস্টল'
                  : 'Install App'
                : isBn
                ? 'অ্যাপ ডাউনলোড (Get App)'
                : 'Get App'}
            </span>
          )}
        </button>

        <PWAInstallModal isOpen={showGuide} onClose={() => setShowGuide(false)} isBn={isBn} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title={isBn ? 'iOS এবং Android ফোনে অ্যাপ ডাউনলোড ও ইনস্টল করুন' : 'Install App on iOS & Android'}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 text-[10px] sm:text-[11px] font-bold text-white transition shadow-xs cursor-pointer active:scale-95 shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="sm:hidden">
          {isInstallable ? (isBn ? 'ইনস্টল' : 'Install') : (isBn ? 'অ্যাপ' : 'App')}
        </span>
        <span className="hidden sm:inline">
          {isInstallable
            ? isBn
              ? 'অ্যাপ ইনস্টল'
              : 'Install App'
            : isBn
            ? 'ডাউনলোড অ্যাপ'
            : 'Get App'}
        </span>
      </button>

      <PWAInstallModal isOpen={showGuide} onClose={() => setShowGuide(false)} isBn={isBn} />
    </>
  );
};

export const MobileInstallBanner: React.FC<{ isBn?: boolean }> = ({ isBn = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed || (!isIOS && !isAndroid && !isInstallable)) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3.5 shadow-lg border border-emerald-400/40 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold truncate">
            {isBn ? 'ফোনে ZARA Accounting অ্যাপ ইনস্টল করুন' : 'Install ZARA Accounting App'}
          </div>
          <div className="text-[11px] text-emerald-100 truncate">
            {isIOS
              ? isBn
                ? 'Safari Share → Add to Home Screen চাপুন'
                : 'Tap Safari Share → Add to Home Screen'
              : isBn
              ? 'হোম স্ক্রিনে ১ ক্লিকে অ্যাপ হিসেবে ব্যবহার করুন'
              : 'Add to your Home Screen for full-screen access'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={async () => {
            if (isInstallable) {
              const ok = await install();
              if (!ok) openPWAInstallGuide();
            } else {
              openPWAInstallGuide();
            }
          }}
          className="px-3 py-1.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-extrabold shadow-xs transition cursor-pointer"
        >
          {isBn ? 'ইনস্টল' : 'Install'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/15 transition cursor-pointer"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const OfflineIndicator: React.FC<{ isBn?: boolean }> = ({ isBn = false }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl border border-amber-300">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {isBn
          ? 'অফলাইন মোড — ক্যাশ করা ডেটা ব্যবহৃত হচ্ছে'
          : 'Offline Mode — Using cached data'}
      </span>
    </div>
  );
};
