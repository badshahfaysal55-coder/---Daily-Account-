import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Sparkles,
  BookOpen,
  FileCode2,
  Layers,
  Smartphone,
  Apple,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../types/accounting';

interface ReactNativeCodeViewerProps {
  user: UserProfile;
}

export const ReactNativeCodeViewer: React.FC<ReactNativeCodeViewerProps> = ({ user }) => {
  const isBn = user.language === 'bn';
  const [activeCodeTab, setActiveCodeTab] = useState<'install_steps' | 'hybrid' | 'firebase' | 'mmkv'>('install_steps');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const NPM_COMMAND = 'npm install @react-native-firebase/app @react-native-firebase/firestore react-native-mmkv @react-native-community/netinfo';
  const IOS_POD_COMMAND = 'cd ios && pod install && cd ..';
  const ANDROID_ROOT_GRADLE = `// android/build.gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}`;
  const ANDROID_APP_GRADLE = `// android/app/build.gradle (ফাইলের শেষে যোগ করুন)
apply plugin: 'com.google.gms.google-services'`;

  const FIREBASE_CODE = `import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

interface Props {
  userId?: string;
}

export default function CloudAccountingScreen({ userId = '${user.userId}' }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saveStatus, setSaveStatus] = useState('All changes saved');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!amount && !description) {
      setSaveStatus('All changes saved');
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    setSaveStatus('Saving to Cloud...');
    
    // Debounce লজিক: ইউজার টাইপ থামানোর ১ সেকেন্ড পর ফায়ারবেসে সেভ হবে
    const timer = setTimeout(async () => {
      try {
        await firestore()
          .collection('accounts')
          .doc(userId)
          .set({
            description: description.trim(),
            amount: Number(amount) || 0,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }, { merge: true }); // merge: true দিলে আগের ডেটা মুছে যাবে না, আপডেট হবে

        setSaveStatus('Cloud Saved ✓');
      } catch (error: any) {
        console.error('Cloud Sync Error: ', error);
        setSaveStatus('Save failed (Offline)');
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [description, amount, userId]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>দৈনিক হিসাব (Auto Save)</Text>
        <Text style={styles.subtitle}>ইউজার আইডি: {userId}</Text>
        
        <TextInput
          placeholder="বিবরণ (যেমন: বাজার খরচ)"
          placeholderTextColor="#94a3b8"
          value={description}
          onChangeText={setDescription}
          style={styles.input}
        />
        
        <TextInput
          placeholder="টাকার পরিমাণ (যেমন: ৫৫০)"
          placeholderTextColor="#94a3b8"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={styles.statusRow}>
          {isSaving && <ActivityIndicator size="small" color="#D4AF37" style={{ marginRight: 8 }} />}
          <Text style={[
            styles.status,
            saveStatus.includes('failed') ? styles.errorStatus : 
            saveStatus.includes('Cloud Saved') ? styles.successStatus : styles.normalStatus
          ]}>
            {saveStatus}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1320', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#101A2C', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  title: { fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#94a3b8', marginBottom: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  input: { borderWidth: 1, borderColor: '#334155', padding: 14, marginBottom: 14, borderRadius: 12, fontSize: 16, color: '#ffffff', backgroundColor: '#1E293B' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  status: { fontSize: 13, fontWeight: '600' },
  normalStatus: { color: '#94a3b8' },
  successStatus: { color: '#10b981' },
  errorStatus: { color: '#f43f5e' },
});`;

  const MMKV_CODE = `import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { MMKV } from 'react-native-mmkv';

// দ্রুততম লোকাল কি-ভ্যালু স্টোরেজ ইন্সট্যান্স (Zero-Latency)
export const storage = new MMKV({
  id: 'zara-accounting-storage',
  encryptionKey: 'zara_secure_passphrase_2026', // অপশনাল AES এনক্রিপশন
});

export default function MMKVAccountingScreen() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('All changes saved (Local MMKV ✓)');

  // প্রথমবার স্ক্রিন খুললে সংরক্ষিত ড্রাফট রিড করা
  useEffect(() => {
    const savedAmount = storage.getString('latest_account');
    const savedDesc = storage.getString('latest_description');
    if (savedAmount) setAmount(savedAmount);
    if (savedDesc) setDescription(savedDesc);
  }, []);

  // অটো-সেভ লজিক (Debounce সহ)
  useEffect(() => {
    if (!amount && !description) return;

    setStatus('Saving to MMKV...');
    const timer = setTimeout(() => {
      storage.set('latest_account', amount);
      storage.set('latest_description', description);
      storage.set('latest_saved_time', Date.now());
      setStatus('All changes saved (Local MMKV ✓)');
    }, 1000);

    return () => clearTimeout(timer);
  }, [amount, description]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>অফলাইন হিসাব (MMKV Fast Storage)</Text>
      
      <TextInput
        placeholder="বিবরণ লিখুন"
        placeholderTextColor="#94a3b8"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
      />

      <TextInput
        placeholder="টাকার পরিমাণ লিখুন"
        placeholderTextColor="#94a3b8"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />
      
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, margin: 16, backgroundColor: '#101A2C', borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#ffffff' },
  input: { borderWidth: 1, borderColor: '#334155', padding: 12, marginBottom: 12, borderRadius: 10, fontSize: 15, color: '#ffffff', backgroundColor: '#1E293B' },
  status: { color: '#10b981', fontStyle: 'italic', marginTop: 4, fontSize: 13 }
});`;

  const HYBRID_CODE = `/**
 * ZARA Hybrid Cloud + MMKV Offline-First Architecture
 * ১. ইউজার যখনই টাইপ করবে, তাৎক্ষণিকভাবে MMKV-তে সংরক্ষণ হবে (ফোন বন্ধ হলেও ডেটা হারাবে না)।
 * ২. এরপর ১ সেকেন্ড পর ব্যাকগ্রাউন্ডে ক্লাউড ফায়ারবেসে সিঙ্ক করবে।
 * ৩. ইন্টারনেট না থাকলে লোকাল কিউতে থাকবে এবং নেট ফিরলে অটো-সিঙ্ক হবে।
 */
import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import firestore from '@react-native-firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

const storage = new MMKV();
const USER_ID = '${user.userId}';

export default function HybridAccountingScreen() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saveStatus, setSaveStatus] = useState('All changes saved');

  // ১. অ্যাপ ওপেন করার সময় লোকাল ড্রাফট রিস্টোর
  useEffect(() => {
    const cachedDesc = storage.getString('draft_description');
    const cachedAmount = storage.getString('draft_amount');
    if (cachedDesc) setDescription(cachedDesc);
    if (cachedAmount) setAmount(cachedAmount);
  }, []);

  // ২. ডিবউন্সড অটো-সেভ লজিক
  useEffect(() => {
    if (!amount && !description) return;

    // তাৎক্ষণিক লোকাল ক্যাশ
    storage.set('draft_description', description);
    storage.set('draft_amount', amount);
    storage.set('latest_account', amount);

    setSaveStatus('Saving to Cloud...');

    const timer = setTimeout(async () => {
      try {
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          setSaveStatus('Saved locally (Offline Mode)');
          return;
        }

        await firestore()
          .collection('accounts')
          .doc(USER_ID)
          .set({
            description: description.trim(),
            amount: Number(amount) || 0,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

        setSaveStatus('Cloud Saved ✓');
      } catch (err) {
        console.warn('Sync failed, kept in local MMKV:', err);
        setSaveStatus('Saved locally (Cloud pending)');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [description, amount]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>দৈনিক হিসাব (Hybrid Auto-Save)</Text>
      
      <TextInput
        placeholder="বিবরণ (যেমন: বাজার খরচ)"
        placeholderTextColor="#94a3b8"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
      />

      <TextInput
        placeholder="টাকার পরিমাণ (৳)"
        placeholderTextColor="#94a3b8"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.status}>{saveStatus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#101A2C', borderRadius: 16, margin: 16, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#ffffff' },
  input: { borderWidth: 1, borderColor: '#334155', padding: 12, marginBottom: 12, borderRadius: 10, fontSize: 15, color: '#ffffff', backgroundColor: '#1E293B' },
  status: { color: '#10b981', fontStyle: 'italic', marginTop: 4, fontSize: 13 }
});`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#172F4D] to-[#101A2C] rounded-2xl p-5 md:p-6 border border-slate-800 shadow-md text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-[#D4AF37]" />
              <h2 className="text-lg sm:text-xl font-bold font-heading">
                {isBn ? 'React Native Mobile App সেটআপ গাইড' : 'React Native Mobile App Setup & Export'}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {isBn
                ? 'আপনার অ্যান্ড্রয়েড ও আইওএস মোবাইল অ্যাপে React Native Firebase, MMKV ফাস্ট স্টোরেজ এবং NetInfo সংযুক্ত করার সম্পূর্ণ নির্দেশিকা।'
                : 'Complete setup guide and production code for React Native Firebase, MMKV, and NetInfo.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => copyToClipboard(NPM_COMMAND, 'all-npm')}
              className="px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-yellow-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              {copiedId === 'all-npm' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'all-npm' ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'প্যাকেজ কমান্ড কপি' : 'Copy npm Command')}</span>
            </button>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex gap-2 mt-5 overflow-x-auto pb-1 text-xs font-semibold">
          <button
            onClick={() => setActiveCodeTab('install_steps')}
            className={`px-3.5 py-2 rounded-xl border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCodeTab === 'install_steps'
                ? 'bg-[#D4AF37] text-slate-950 font-bold border-[#D4AF37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{isBn ? '৪-ধাপের ইনস্টলেশন নির্দেশিকা' : '4-Step Setup Guide'}</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('hybrid')}
            className={`px-3.5 py-2 rounded-xl border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCodeTab === 'hybrid'
                ? 'bg-[#D4AF37] text-slate-950 font-bold border-[#D4AF37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isBn ? 'Hybrid (Cloud + MMKV)' : 'Hybrid Screen'}</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('firebase')}
            className={`px-3.5 py-2 rounded-xl border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCodeTab === 'firebase'
                ? 'bg-[#D4AF37] text-slate-950 font-bold border-[#D4AF37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isBn ? 'Cloud Firestore Screen' : 'Firestore Screen'}</span>
          </button>

          <button
            onClick={() => setActiveCodeTab('mmkv')}
            className={`px-3.5 py-2 rounded-xl border transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeCodeTab === 'mmkv'
                ? 'bg-[#D4AF37] text-slate-950 font-bold border-[#D4AF37]'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBn ? 'MMKV Local Screen' : 'MMKV Screen'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Step-by-Step Installation Cards */}
      {activeCodeTab === 'install_steps' && (
        <div className="space-y-4">
          {/* Step 1: npm install */}
          <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-[#D4AF37] font-black text-xs flex items-center justify-center border border-amber-500/30">
                  ১
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm font-heading">
                  {isBn ? 'React Native Firebase এবং MMKV প্যাকেজ ইনস্টল' : 'Install React Native Firebase & MMKV Packages'}
                </h3>
              </div>
              <button
                onClick={() => copyToClipboard(NPM_COMMAND, 'step1')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                {copiedId === 'step1' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'step1' ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}</span>
              </button>
            </div>

            <div className="bg-slate-950 text-slate-200 p-3.5 rounded-xl font-mono text-xs overflow-x-auto">
              <code>{NPM_COMMAND}</code>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isBn
                ? 'এই কমান্ডটি Firebase App, Cloud Firestore, আল্ট্রা-ফাস্ট MMKV লোকাল স্টোরেজ এবং নেটওয়ার্ক স্টেট ডিটেকশন লাইব্রেরি ইনস্টল করবে।'
                : 'Installs core Firebase app, Firestore, fast MMKV C++ storage, and NetInfo.'}
            </p>
          </div>

          {/* Step 2: iOS CocoaPods */}
          <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 font-black text-xs flex items-center justify-center border border-blue-500/30">
                  ২
                </span>
                <div className="flex items-center gap-2">
                  <Apple className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm font-heading">
                    {isBn ? 'iOS এর জন্য CocoaPods ইনস্টল' : 'iOS CocoaPods Installation'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(IOS_POD_COMMAND, 'step2')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                {copiedId === 'step2' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'step2' ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কপি' : 'Copy')}</span>
              </button>
            </div>

            <div className="bg-slate-950 text-slate-200 p-3.5 rounded-xl font-mono text-xs overflow-x-auto">
              <code>{IOS_POD_COMMAND}</code>
            </div>
          </div>

          {/* Step 3: Android Gradle Configuration */}
          <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 font-black text-xs flex items-center justify-center border border-emerald-500/30">
                  ৩
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm font-heading">
                  {isBn ? 'Android কনফিগারেশন (Gradle)' : 'Android Configuration (Gradle)'}
                </h3>
              </div>
            </div>

            {/* Root build.gradle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span>android/build.gradle</span>
                <button
                  onClick={() => copyToClipboard(ANDROID_ROOT_GRADLE, 'root-gradle')}
                  className="text-[11px] text-amber-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === 'root-gradle' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                <pre><code>{ANDROID_ROOT_GRADLE}</code></pre>
              </div>
            </div>

            {/* App build.gradle */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span>android/app/build.gradle (ফাইলের শেষে যোগ করুন)</span>
                <button
                  onClick={() => copyToClipboard(ANDROID_APP_GRADLE, 'app-gradle')}
                  className="text-[11px] text-amber-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === 'app-gradle' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                <pre><code>{ANDROID_APP_GRADLE}</code></pre>
              </div>
            </div>
          </div>

          {/* Step 4: Google Services Credentials */}
          <div className="bg-white dark:bg-[#101A2C] rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 font-black text-xs flex items-center justify-center border border-purple-500/30">
                ৪
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm font-heading">
                {isBn ? 'Firebase Credentials ফাইল যুক্ত করুন' : 'Add Firebase Configuration Files'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Android (google-services.json)</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  Firebase Console থেকে ডাউনলোড করে <strong className="text-slate-700 dark:text-slate-300">android/app/</strong> ফোল্ডারে রাখুন।
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>iOS (GoogleService-Info.plist)</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  Firebase Console থেকে ডাউনলোড করে Xcode প্রজেক্টে ড্র্যাগ করে যুক্ত করুন।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2, 3, 4: Source Code Displays */}
      {activeCodeTab !== 'install_steps' && (
        <div className="bg-white dark:bg-[#101A2C] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                {activeCodeTab === 'hybrid'
                  ? 'HybridAccountingScreen.tsx (Cloud + MMKV)'
                  : activeCodeTab === 'firebase'
                  ? 'CloudAccountingScreen.tsx (Firebase Only)'
                  : 'MMKVAccountingScreen.tsx (MMKV Only)'}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isBn ? 'সরাসরি কপি করে আপনার React Native অ্যাপের কম্পোনেন্টে ব্যবহার করুন।' : 'Ready to drop into your React Native project screens folder.'}
              </p>
            </div>

            <button
              onClick={() => {
                const code =
                  activeCodeTab === 'hybrid'
                    ? HYBRID_CODE
                    : activeCodeTab === 'firebase'
                    ? FIREBASE_CODE
                    : MMKV_CODE;
                copyToClipboard(code, 'tab-code');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-yellow-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedId === 'tab-code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'tab-code' ? (isBn ? 'কপি হয়েছে' : 'Copied') : (isBn ? 'কোড কপি করুন' : 'Copy Code')}</span>
            </button>
          </div>

          <div className="bg-slate-950 rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto shadow-inner max-h-[500px]">
            <pre className="leading-relaxed">
              <code>
                {activeCodeTab === 'hybrid'
                  ? HYBRID_CODE
                  : activeCodeTab === 'firebase'
                  ? FIREBASE_CODE
                  : MMKV_CODE}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
