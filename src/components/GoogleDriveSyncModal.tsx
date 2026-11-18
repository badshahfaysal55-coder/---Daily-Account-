import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  CloudCheck,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  LogOut,
  FolderSync,
  Layers,
  Sparkles,
  Database
} from 'lucide-react';
import { googleDriveService, GoogleDriveBackupStatus } from '../services/googleDriveService';
import { ApiService } from '../services/api';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBn: boolean;
  currency: string;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  isBn,
  currency,
}) => {
  const [status, setStatus] = useState<GoogleDriveBackupStatus>(googleDriveService.getStatus());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncingCommission, setIsSyncingCommission] = useState(false);
  const [lastResultLink, setLastResultLink] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const unsub = googleDriveService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    setFeedbackMessage(null);
    try {
      const res = await googleDriveService.connectGoogleDrive();
      if (res.cancelled) {
        if (res.reason === 'popup-blocked') {
          setFeedbackMessage({
            text: isBn
              ? 'ব্রাউজার পপআপ ব্লক করেছে। অনুগ্রহ করে এই সাইটের জন্য পপআপ Allow করুন অথবা অ্যাপটি নতুন ট্যাবে খুলে আবার চেষ্টা করুন।'
              : 'Your browser blocked the Google sign-in popup. Please allow popups for this site or open the app in a full browser tab and try again.',
            type: 'error',
          });
        } else {
          setFeedbackMessage({
            text: isBn
              ? 'গুগল সাইন-ইন পপআপ সম্পূর্ণ হওয়ার আগেই বন্ধ করা হয়েছে। সংযুক্ত করতে আবার "গুগল দিয়ে সাইন ইন করুন" বাটনে চাপ দিন।'
              : 'Google sign-in window was closed before completing. Click "Sign in with Google" again when ready to connect.',
            type: 'info',
          });
        }
        return;
      }

      setFeedbackMessage({
        text: isBn ? 'গুগল ড্রাইভ সফলভাবে সংযুক্ত হয়েছে!' : 'Google Drive connected successfully!',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({
        text: err?.message || (isBn ? 'গুগল সংযোগ ব্যর্থ হয়েছে' : 'Connection to Google Drive failed'),
        type: 'error',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await googleDriveService.disconnectGoogleDrive();
    setFeedbackMessage({
      text: isBn ? 'গুগল ড্রাইভ ডিসকানেক্ট করা হয়েছে' : 'Google Drive disconnected',
      type: 'success',
    });
  };

  const handleFullBackup = async () => {
    setIsBackingUp(true);
    setFeedbackMessage(null);
    try {
      // Gather all current app data
      const [invoices, bazarData, commData, transactions, customers, settings] = await Promise.all([
        ApiService.getInvoices().catch(() => []),
        ApiService.getHomeBazar().catch(() => ({ entries: [], monthlyBudget: 0, buyers: [] })),
        ApiService.getCommissions().catch(() => ({ entries: [], summary: null as any })),
        ApiService.getTransactions(undefined, true).catch(() => []),
        ApiService.getCustomers().catch(() => []),
        ApiService.getGlobalSettings().catch(() => null),
      ]);

      const result = await googleDriveService.backupAppDataToDrive({
        invoices,
        homeBazarEntries: bazarData.entries,
        monthlyBudget: bazarData.monthlyBudget,
        bazarBuyers: bazarData.buyers,
        commissionEntries: commData.entries,
        transactions,
        customers,
        globalSettings: settings,
      });

      if (result.webViewLink) setLastResultLink(result.webViewLink);

      setFeedbackMessage({
        text: isBn
          ? 'সম্পূর্ণ অ্যাপ ডাটা ও বাজার খতিয়ান গুগল ড্রাইভে সফলভাবে অটো-সিঙ্ক হয়েছে!'
          : 'Complete application & bazar ledger backed up to Google Drive successfully!',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({
        text: err.message || (isBn ? 'ব্যাকআপ তৈরিতে সমস্যা হয়েছে' : 'Backup failed'),
        type: 'error',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSyncCommission = async () => {
    setIsSyncingCommission(true);
    setFeedbackMessage(null);
    try {
      const commData = await ApiService.getCommissions().catch(() => ({ entries: [], summary: null as any }));

      const result = await googleDriveService.syncCommissionStatementToDrive(commData.entries, commData.summary);
      if (result.webViewLink) setLastResultLink(result.webViewLink);

      setFeedbackMessage({
        text: isBn
          ? 'কমিশন শিট গুগল ড্রাইভে সফলভাবে সিঙ্ক ও সংরক্ষিত হয়েছে!'
          : 'Commission statement synced to Google Drive successfully!',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMessage({
        text: err.message || (isBn ? 'কমিশন সিঙ্ক ব্যর্থ হয়েছে' : 'Commission sync failed'),
        type: 'error',
      });
    } finally {
      setIsSyncingCommission(false);
    }
  };

  const handleToggleAutoSync = () => {
    const nextVal = !status.autoSyncEnabled;
    googleDriveService.setAutoSync(nextVal);
    setFeedbackMessage({
      text: nextVal
        ? (isBn ? 'গুগল ড্রাইভ অটো-সিঙ্ক চালু করা হয়েছে (সব পরিবর্তন স্বয়ংক্রিয়ভাবে ক্লাউডে যাবে)' : 'Google Drive Auto-Sync ENABLED')
        : (isBn ? 'গুগল ড্রাইভ অটো-সিঙ্ক বন্ধ করা হয়েছে' : 'Google Drive Auto-Sync DISABLED'),
      type: 'success',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  {isBn ? 'গুগল ড্রাইভ ক্লাউড অটো-সিঙ্ক ও ব্যাকআপ' : 'Google Drive Cloud Auto-Sync & Backup'}
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isBn
                  ? 'আপনার সকল ভাউচার, বাজার খতিয়ান ও কমিশন স্টেটমেন্ট স্বয়ংক্রিয়ভাবে ড্রাইভে সংরক্ষিত থাকবে'
                  : 'Automated real-time cloud sync for accounting, daily bazar & commission sheet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Feedback banner */}
          {feedbackMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : feedbackMessage.type === 'info'
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-red-950/50 border-red-500/40 text-red-300'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle
                  className={`w-4 h-4 shrink-0 ${
                    feedbackMessage.type === 'info' ? 'text-amber-400' : 'text-red-400'
                  }`}
                />
              )}
              <span className="font-medium flex-1">{feedbackMessage.text}</span>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {status.isConnected && status.userPhoto ? (
                <img
                  src={status.userPhoto}
                  alt={status.userName || 'Google Account'}
                  className="w-10 h-10 rounded-full border border-amber-400/40 object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <HardDrive className={`w-5 h-5 ${status.isConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-xs truncate">
                    {status.isConnected ? status.userName || status.userEmail : (isBn ? 'গুগল ড্রাইভ এখনও সংযুক্ত নয়' : 'Google Drive Disconnected')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      status.isConnected
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${status.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {status.isConnected ? (isBn ? 'সংযুক্ত' : 'Connected') : (isBn ? 'অসংযুক্ত' : 'Not Connected')}
                  </span>
                </div>
                {status.userEmail && (
                  <p className="text-[11px] text-slate-400 truncate">{status.userEmail}</p>
                )}
                {status.lastBackupAt && (
                  <p className="text-[10px] text-amber-400/90 mt-0.5">
                    {isBn ? 'সর্বশেষ ক্লাউড ব্যাকআপ:' : 'Last Cloud Backup:'}{' '}
                    {new Date(status.lastBackupAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div>
              {status.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  {isBn ? 'ডিসকানেক্ট' : 'Sign Out'}
                </button>
              ) : (
                /* Official Styled Sign in with Google Button */
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                  )}
                  <span>{isBn ? 'গুগল দিয়ে সাইন ইন করুন' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Auto-Sync Toggle Control */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FolderSync className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-white text-xs">
                  {isBn ? 'স্বয়ংক্রিয় ক্লাউড সিঙ্ক (Real-Time Auto-Sync)' : 'Real-Time Auto-Sync to Drive'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isBn
                    ? 'কোনো নতুন বাজার কেনাকাটা বা ইনভয়েস এন্ট্রি হলেই স্বয়ংক্রিয়ভাবে ড্রাইভে আপডেট হবে'
                    : 'Automatically syncs changes when invoices, bazar entries, or commissions are updated'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoSync}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                status.autoSyncEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status.autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Action 1: Full App + Bazar Backup */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">
                    {isBn ? 'সম্পূর্ণ অ্যাপ ও বাজার ডাটা সিঙ্ক' : 'Full Accounting & Bazar Sync'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isBn
                    ? 'দৈনিক বাজার, ইনভয়েস, জেনারেল লেজার ও গ্রাহকদের খাতা ড্রাইভে এক ফাইলে ব্যাকআপ নিন।'
                    : 'Backup all invoices, grocery bazar entries, general ledger, and customer CRM records.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleFullBackup}
                disabled={!status.isConnected || isBackingUp}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
                {isBackingUp
                  ? (isBn ? 'ড্রাইভে সিঙ্ক হচ্ছে...' : 'Syncing to Drive...')
                  : (isBn ? 'সম্পূর্ণ ব্যাকআপ ড্রাইভে পাঠান' : 'Backup Everything to Drive')}
              </button>
            </div>

            {/* Action 2: Commission Sheet Direct Sync */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-teal-950/30 border border-slate-700/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-xs">
                    {isBn ? 'কমিশন স্টেটমেন্ট সিঙ্ক' : 'Commission Sheet Sync'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isBn
                    ? 'কমিশন হিসাব শিট, এজেন্ট কমিশন এবং ক্লেওব্যাক হিসাব গুগল ড্রাইভে আলাদা ফাইলে সংরক্ষণ করুন।'
                    : 'Sync and export the official commission statement & agent payout table to Drive.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncCommission}
                disabled={!status.isConnected || isSyncingCommission}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCommission ? 'animate-spin' : ''}`} />
                {isSyncingCommission
                  ? (isBn ? 'কমিশন ড্রাইভে যাচ্ছে...' : 'Syncing Commission...')
                  : (isBn ? 'কমিশন শিট ড্রাইভে সিঙ্ক করুন' : 'Sync Commission Statement')}
              </button>
            </div>
          </div>

          {/* Last Result Link */}
          {lastResultLink && (
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs text-blue-300">
              <span className="truncate">
                {isBn ? 'গুগল ড্রাইভে ব্যাকআপ প্রস্তুত:' : 'Backup saved on Google Drive:'}
              </span>
              <a
                href={lastResultLink}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1 shrink-0 ml-2"
              >
                <span>{isBn ? 'ড্রাইভে দেখুন' : 'Open in Drive'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Privacy & Safe Storage Footnote */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isBn
                ? 'গুগল ড্রাইভ অ্যাপ ডাটা এন্ড-টু-এন্ড সুরক্ষিত এবং আপনার নিজের গুগল একাউন্টে সরাসরি ব্যাকআপ হয়।'
                : 'Your financial & grocery data is backed up directly into your personal Google Drive.'}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition"
          >
            {isBn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
