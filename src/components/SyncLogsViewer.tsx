import React, { useState, useEffect } from 'react';
import { StorageService, StorageLogEntry } from '../services/storageService';
import { UserProfile } from '../types/accounting';
import { Terminal, RefreshCw, Trash2, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatDateBangla, formatDateEn } from '../utils/formatters';

interface SyncLogsViewerProps {
  user: UserProfile;
}

export const SyncLogsViewer: React.FC<SyncLogsViewerProps> = ({ user }) => {
  const isBn = user.language === 'bn';
  const [logs, setLogs] = useState<StorageLogEntry[]>([]);

  const loadLogs = () => {
    setLogs(StorageService.getLogs());
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleClear = () => {
    StorageService.clearLogs();
    setLogs([]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-slate-700" />
            <span>{isBn ? 'সিঙ্ক অডিট ও ডিবউন্স ট্র্যাকিং লগ' : 'Sync Audit & Debounce Tracking Logs'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn 
              ? 'টাইপ করার পর ডিবউন্স টাইমার, ফায়ারবেস সেট এবং অফলাইন হ্যান্ডলিং এর লাইভ হিস্ট্রি' 
              : 'Real-time timeline of debounce calls, Firestore writes, and network fallbacks'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isBn ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isBn ? 'লগ মুছুন' : 'Clear Logs'}</span>
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 font-medium text-xs">
          {isBn 
            ? 'এখনো কোনো লগ এন্ট্রি নেই। ইনপুট স্ক্রিনে বিবরণ ও টাকার পরিমাণ লিখলে স্বয়ংক্রিয়ভাবে লগ তৈরি হবে।'
            : 'No sync logs yet. Start typing in the input box to observe live debounce operations.'}
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {logs.map((log) => {
            const isError = log.type === 'offline_error';
            return (
              <div
                key={log.id}
                className={`p-3 rounded-xl border text-xs font-mono transition ${
                  isError 
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {isError ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-white/70 border border-slate-200">
                      {log.type}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <div className="font-semibold text-xs mb-1 text-slate-800">
                  {log.message}
                </div>

                {log.payload && (
                  <pre className="bg-white/80 p-2 rounded-lg text-[11px] overflow-x-auto text-slate-700 border border-slate-200/80">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
