import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus,
  Printer,
  Download,
  Search,
  CheckCircle2,
  DollarSign,
  Phone,
  MessageCircle,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  Upload,
  FileUp,
  FileText,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  FolderOpen,
  Users,
  Table as TableIcon,
  LayoutGrid,
  Sparkles,
  Wallet,
  Calendar,
  Building,
  AlertCircle,
  Camera,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  CommissionEntry,
  CommissionPersonAccount,
  UserAccount,
  GlobalAppSettings,
  CurrencyCode,
} from '../types/accounting';
import { ApiService } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { getWhatsAppUrl, formatDisplayPhone } from '../utils/phoneUtils';

interface CommissionSheetProps {
  currentUser: UserAccount;
  globalSettings: GlobalAppSettings;
  currentLang: 'bn' | 'en';
  useBanglaNumerals: boolean;
}

type PersonAccountSummary = CommissionPersonAccount & {
  invoicesCount: number;
  toPayNow: number;
  alreadyPaid: number;
  notYetEligible: number;
  totalCommission: number;
};

type FontMode = 'serif' | 'sans' | 'mono';
type ViewMode = 'table' | 'cards';
type SheetSection = 'all' | 'eligible' | 'paid' | 'not_eligible' | 'clawback' | 'summary' | 'accounts';

const DEFAULT_OFFICES = [
  'JUB5 - Jubail - Al Madrasa',
  'RUH1 - Riyadh - Main',
  'DMM2 - Dammam - Corniche',
  'JED1 - Jeddah - Al Hamra',
];

const DEFAULT_SERVICES = [
  '6-month visa',
  '9-month visa',
  'Sponsorship transfer',
  'Iqama renewal - 6m',
  'Iqama renewal - 9m',
  'Domestic worker visa',
  'General Service',
];

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(ym: string): string {
  if (!ym || ym === 'all') return 'All Months';
  const match = ym.match(/^(\d{4})-(\d{2})$/);
  if (!match) return ym;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const date = new Date(year, monthIdx, 1);
  if (isNaN(date.getTime())) return ym;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatMonthPeriodRange(ym: string): string {
  if (!ym || ym === 'all') return 'All Periods';
  const match = ym.match(/^(\d{4})-(\d{2})$/);
  if (!match) return ym;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return `${ym}-01 — ${ym}-${String(lastDay).padStart(2, '0')}`;
}

function getInitials(name: string): string {
  if (!name || name === 'all') return 'ALL';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const CommissionSheet: React.FC<CommissionSheetProps> = ({
  currentUser,
  globalSettings,
  currentLang,
  useBanglaNumerals,
}) => {
  const isBn = currentLang === 'bn';
  const isOwner = currentUser.role === 'owner';
  const currentYm = useMemo(() => getCurrentYearMonth(), []);

  // Core Data
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [persons, setPersons] = useState<CommissionPersonAccount[]>([]);
  const [personAccounts, setPersonAccounts] = useState<PersonAccountSummary[]>([]);
  const [months, setMonths] = useState<string[]>([currentYm]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Currency (default Saudi Riyal SAR from globalSettings)
  const [currency, setCurrency] = useState<CurrencyCode>(
    (globalSettings?.currency as CurrencyCode) || 'SAR'
  );
  useEffect(() => {
    if (globalSettings?.currency) {
      setCurrency(globalSettings.currency as CurrencyCode);
    }
  }, [globalSettings?.currency]);

  // Worksheet Display Controls (matching reference Excel screenshot)
  const [isWideFitMode, setIsWideFitMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('zara_comm_fit_screen');
    return saved !== null ? saved === 'true' : true;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [fontMode, setFontMode] = useState<FontMode>(() => {
    const saved = localStorage.getItem('zara_comm_font') as FontMode | null;
    return saved || 'serif';
  });
  const [directEditActive, setDirectEditActive] = useState<boolean>(true);
  const [showAccountsStrip, setShowAccountsStrip] = useState<boolean>(true);

  // Filters
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentYm);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<SheetSection>('all');

  // Inline Quick-Entry Row State (ZERO auto amount — always starts empty / 0)
  const [showQuickRow, setShowQuickRow] = useState<boolean>(false);
  const [quickDate, setQuickDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [quickOffice, setQuickOffice] = useState<string>(DEFAULT_OFFICES[0]);
  const [quickInvoiceNo, setQuickInvoiceNo] = useState<string>('');
  const [quickAgent, setQuickAgent] = useState<string>(currentUser.name || 'FAYSAL');
  const [quickClient, setQuickClient] = useState<string>('');
  const [quickWorker, setQuickWorker] = useState<string>('');
  const [quickMobile, setQuickMobile] = useState<string>('');
  const [quickService, setQuickService] = useState<string>(DEFAULT_SERVICES[0]);
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickRate, setQuickRate] = useState<string>('');
  const [quickCommission, setQuickCommission] = useState<string>('');
  const [quickRemaining, setQuickRemaining] = useState<string>('');
  const [quickStatusType, setQuickStatusType] = useState<'eligible' | 'waiting' | 'paid' | 'clawback'>('eligible');
  const [isQuickSaving, setIsQuickSaving] = useState<boolean>(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CommissionEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<CommissionEntry | null>(null);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Person Add / Edit Modal (Photo add/change/remove is Owner-only)
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<CommissionPersonAccount | null>(null);
  const [personNameInput, setPersonNameInput] = useState('');
  const [personIqamaInput, setPersonIqamaInput] = useState('');
  const [personPhoneInput, setPersonPhoneInput] = useState('');
  const [personOfficeInput, setPersonOfficeInput] = useState(DEFAULT_OFFICES[0]);
  const [personPhotoPreview, setPersonPhotoPreview] = useState<string | null>(null);
  const [personPhotoBase64, setPersonPhotoBase64] = useState<string | null>(null);
  const [personPhotoRemoved, setPersonPhotoRemoved] = useState(false);
  const [isSavingPerson, setIsSavingPerson] = useState(false);
  const personPhotoFileRef = useRef<HTMLInputElement>(null);
  const personPhotoCameraRef = useRef<HTMLInputElement>(null);

  // Month Files Modal
  const [showMonthsModal, setShowMonthsModal] = useState(false);
  const [newMonthInput, setNewMonthInput] = useState<string>(currentYm);
  const [isSavingMonth, setIsSavingMonth] = useState(false);

  // Import Modal (Excel .xlsx / .xls / .csv OR AI Photo/PDF scan)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'excel' | 'scan'>('excel');
  const [scanFile, setScanFile] = useState<{ base64: string; mimeType: string; fileName: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [selectedImportIndices, setSelectedImportIndices] = useState<number[]>([]);
  const [isImportingRows, setIsImportingRows] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Add / Edit Record Form State (ZERO auto amounts)
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formOffice, setFormOffice] = useState(DEFAULT_OFFICES[0]);
  const [formInvoiceNo, setFormInvoiceNo] = useState('');
  const [formAgent, setFormAgent] = useState(currentUser.name || 'FAYSAL');
  const [formClient, setFormClient] = useState('');
  const [formWorker, setFormWorker] = useState('');
  const [formClientMobile, setFormClientMobile] = useState('');
  const [formService, setFormService] = useState(DEFAULT_SERVICES[0]);
  const [formQty, setFormQty] = useState<number>(1);
  const [formRate, setFormRate] = useState<string>('');
  const [formCommissionAmount, setFormCommissionAmount] = useState<string>('');
  const [formInvoiceTotal, setFormInvoiceTotal] = useState<string>('');
  const [formRemaining, setFormRemaining] = useState<string>('');
  const [formEligible, setFormEligible] = useState<boolean>(true);
  const [formPayoutStatus, setFormPayoutStatus] = useState<'To pay' | 'Paid' | 'Not eligible' | 'Carried over'>('To pay');
  const [formReason, setFormReason] = useState<string>('');
  const [formIsClawback, setFormIsClawback] = useState<boolean>(false);
  const [formClawbackAmount, setFormClawbackAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle Helpers
  const toggleWideFitMode = () => {
    setIsWideFitMode((prev) => {
      const next = !prev;
      localStorage.setItem('zara_comm_fit_screen', String(next));
      return next;
    });
  };

  const handleFontChange = (mode: FontMode) => {
    setFontMode(mode);
    localStorage.setItem('zara_comm_font', mode);
  };

  const fontClass =
    fontMode === 'serif'
      ? 'font-serif'
      : fontMode === 'mono'
      ? 'font-mono'
      : 'font-sans';

  // Load Commissions, Person Accounts & Months
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setIsSyncing(true);
    try {
      const [commRes, personsRes] = await Promise.all([
        ApiService.getCommissions(),
        ApiService.getCommissionPersons().catch(() => ({ persons: [], accounts: [] })),
      ]);

      const fetchedEntries = commRes.entries || [];
      setEntries(fetchedEntries);

      const serverPersons = personsRes.persons?.length ? personsRes.persons : commRes.persons || [];
      setPersons(serverPersons);

      if (personsRes.accounts && personsRes.accounts.length > 0) {
        setPersonAccounts(personsRes.accounts);
      } else {
        // Compute client fallback if personsRes wasn't populated
        const accMap = new Map<string, PersonAccountSummary>();
        serverPersons.forEach((p) => {
          accMap.set(p.name.trim().toLowerCase(), {
            ...p,
            invoicesCount: 0,
            toPayNow: 0,
            alreadyPaid: 0,
            notYetEligible: 0,
            totalCommission: 0,
          });
        });
        fetchedEntries.forEach((e) => {
          const key = (e.agent || 'UNASSIGNED').trim().toLowerCase();
          if (!accMap.has(key)) {
            accMap.set(key, {
              id: 'person_' + key.replace(/[^a-z0-9]+/g, '_'),
              name: e.agent || 'UNASSIGNED',
              iqamaNo: '',
              phone: '',
              office: e.office || '',
              createdAt: e.createdAt || Date.now(),
              updatedAt: e.updatedAt || Date.now(),
              invoicesCount: 0,
              toPayNow: 0,
              alreadyPaid: 0,
              notYetEligible: 0,
              totalCommission: 0,
            });
          }
          const acc = accMap.get(key)!;
          acc.invoicesCount += 1;
          const amt = e.isClawback || e.invoiceStatus === 'Cancelled' ? 0 : Number(e.commissionAmount) || 0;
          if (e.payoutStatus === 'Paid' && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
            acc.alreadyPaid += amt;
          } else if (e.eligible && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
            acc.toPayNow += amt;
          } else if (!e.eligible && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
            acc.notYetEligible += amt;
          }
          acc.totalCommission = acc.toPayNow + acc.alreadyPaid + acc.notYetEligible;
        });
        setPersonAccounts(Array.from(accMap.values()));
      }

      // Collect all YYYY-MM sheets from server + entries + current month
      const monthSet = new Set<string>([currentYm, ...(commRes.months || [])]);
      fetchedEntries.forEach((e) => {
        if (e.date && /^\d{4}-\d{2}/.test(e.date)) {
          monthSet.add(e.date.slice(0, 7));
        } else if (e.period && /^\d{4}-\d{2}$/.test(e.period)) {
          monthSet.add(e.period);
        }
      });
      setMonths(Array.from(monthSet).sort());
    } catch (err: any) {
      if (!isSilent) {
        setToastMessage({ text: err.message || 'Failed to load commission statement', type: 'error' });
      }
    } finally {
      if (!isSilent) setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData(false);

    const unsubscribe = ApiService.subscribeToEvents((event) => {
      if (
        event.startsWith('commission_') ||
        event.startsWith('commissions_') ||
        event.startsWith('invoice_') ||
        event === 'user_updated' ||
        event === 'global_settings_updated' ||
        event === 'database_restored'
      ) {
        loadData(true);
      }
    });

    const handleVaultRecovered = () => {
      loadData(true);
    };
    window.addEventListener('zara-vault-recovered', handleVaultRecovered);

    const interval = setInterval(() => loadData(true), 12000);
    return () => {
      unsubscribe();
      window.removeEventListener('zara-vault-recovered', handleVaultRecovered);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Dynamic Dropdown Options (only real saved persons & entries — NO fake agents)
  const availablePersons = useMemo(() => {
    const map = new Map<string, CommissionPersonAccount>();
    persons.forEach((p) => {
      if (p.name) map.set(p.name.trim().toLowerCase(), p);
    });
    entries.forEach((e) => {
      if (e.agent && !map.has(e.agent.trim().toLowerCase())) {
        map.set(e.agent.trim().toLowerCase(), {
          id: 'person_' + e.agent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          name: e.agent.trim(),
          office: e.office || '',
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, entries]);

  const activePersonProfile = useMemo(() => {
    if (selectedAgent === 'all') {
      return availablePersons[0] || null;
    }
    return (
      availablePersons.find((p) => p.name.trim().toLowerCase() === selectedAgent.trim().toLowerCase()) ||
      null
    );
  }, [selectedAgent, availablePersons]);

  const availableOffices = useMemo(() => {
    const set = new Set<string>(DEFAULT_OFFICES);
    entries.forEach((e) => {
      if (e.office?.trim()) set.add(e.office.trim());
    });
    return Array.from(set);
  }, [entries]);

  const availableServices = useMemo(() => {
    const set = new Set<string>(DEFAULT_SERVICES);
    entries.forEach((e) => {
      if (e.service?.trim()) set.add(e.service.trim());
    });
    return Array.from(set);
  }, [entries]);

  // Month count helper
  const getMonthEntryCount = (ym: string): number => {
    return entries.filter((e) => {
      const matchAgent =
        selectedAgent === 'all' || e.agent.trim().toLowerCase() === selectedAgent.trim().toLowerCase();
      if (!matchAgent) return false;
      return e.period === ym || (e.date && e.date.startsWith(ym));
    }).length;
  };

  // Filtered Entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (selectedAgent !== 'all' && e.agent.trim().toLowerCase() !== selectedAgent.trim().toLowerCase()) {
        return false;
      }
      if (selectedPeriod !== 'all') {
        const matchesMonth = e.period === selectedPeriod || (e.date && e.date.startsWith(selectedPeriod));
        if (!matchesMonth) return false;
      }
      if (selectedOffice !== 'all' && e.office !== selectedOffice) return false;
      if (selectedServiceFilter !== 'all' && e.service !== selectedServiceFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const digits = q.replace(/[^0-9]/g, '');

      const invClean = (e.invoiceNo || '').toLowerCase().replace(/[^0-9]/g, '');
      const mobClean = (e.clientMobile || '').replace(/[^0-9]/g, '');
      return (
        e.invoiceNo.toLowerCase().includes(q) ||
        (digits.length >= 3 && invClean.includes(digits)) ||
        (e.clientMobile && e.clientMobile.includes(q)) ||
        (digits.length >= 3 && mobClean.includes(digits)) ||
        e.client.toLowerCase().includes(q) ||
        (e.workerName && e.workerName.toLowerCase().includes(q)) ||
        e.agent.toLowerCase().includes(q) ||
        e.service.toLowerCase().includes(q) ||
        e.office.toLowerCase().includes(q)
      );
    });
  }, [entries, selectedAgent, selectedPeriod, selectedOffice, selectedServiceFilter, searchQuery]);

  // Row Calculation Helpers (NO auto-invented fallback amounts)
  const getRowCommission = (e: CommissionEntry): number => {
    if (e.isClawback || e.invoiceStatus === 'Cancelled') return 0;
    if (e.commissionAmount !== undefined && e.commissionAmount !== null) {
      return Number(e.commissionAmount) || 0;
    }
    return (Number(e.qty) || 1) * (Number(e.ratePerUnit) || 0);
  };

  const getRowClawback = (e: CommissionEntry): number => {
    if (e.clawbackAmount !== undefined && e.clawbackAmount !== null) {
      return -Math.abs(Number(e.clawbackAmount) || 0);
    }
    return 0;
  };

  // Breakdowns
  const eligibleEntries = useMemo(
    () =>
      filtered.filter(
        (e) =>
          e.eligible &&
          !e.isClawback &&
          e.invoiceStatus !== 'Cancelled' &&
          e.payoutStatus !== 'Paid'
      ),
    [filtered]
  );

  const paidEntries = useMemo(
    () =>
      filtered.filter(
        (e) => e.payoutStatus === 'Paid' && !e.isClawback && e.invoiceStatus !== 'Cancelled'
      ),
    [filtered]
  );

  const notEligibleEntries = useMemo(
    () =>
      filtered.filter(
        (e) =>
          !e.eligible &&
          !e.isClawback &&
          e.invoiceStatus !== 'Cancelled' &&
          e.payoutStatus !== 'Paid'
      ),
    [filtered]
  );

  const clawbackEntries = useMemo(
    () => filtered.filter((e) => e.isClawback || e.invoiceStatus === 'Cancelled'),
    [filtered]
  );

  // 3 KPI Summary Card Totals (matching reference screenshot)
  const toPayNow = useMemo(
    () => eligibleEntries.reduce((sum, e) => sum + getRowCommission(e), 0),
    [eligibleEntries]
  );
  const alreadyPaid = useMemo(
    () => paidEntries.reduce((sum, e) => sum + getRowCommission(e), 0),
    [paidEntries]
  );
  const notYetEligibleAmount = useMemo(
    () => notEligibleEntries.reduce((sum, e) => sum + getRowCommission(e), 0),
    [notEligibleEntries]
  );
  const totalCommission = toPayNow + alreadyPaid + notYetEligibleAmount;

  // Table 1: Commission per Service
  const serviceSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        service: string;
        invoices: number;
        ratePerUnit: number;
        eligibleInvoices: number;
        units: number;
        toPay: number;
        paid: number;
        notYetEligible: number;
      }
    >();

    filtered.forEach((e) => {
      const current = map.get(e.service) || {
        service: e.service,
        invoices: 0,
        ratePerUnit: Number(e.ratePerUnit) || 0,
        eligibleInvoices: 0,
        units: 0,
        toPay: 0,
        paid: 0,
        notYetEligible: 0,
      };

      current.invoices += 1;
      if (Number(e.ratePerUnit) > 0) {
        current.ratePerUnit = Number(e.ratePerUnit);
      }

      const rowComm = getRowCommission(e);
      if (e.payoutStatus === 'Paid' && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
        current.eligibleInvoices += 1;
        current.units += Number(e.qty) || 1;
        current.paid += rowComm;
      } else if (e.eligible && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
        current.eligibleInvoices += 1;
        current.units += Number(e.qty) || 1;
        current.toPay += rowComm;
      } else if (!e.eligible && !e.isClawback && e.invoiceStatus !== 'Cancelled') {
        current.notYetEligible += rowComm;
      }

      map.set(e.service, current);
    });

    return Array.from(map.values());
  }, [filtered]);

  // Visible Table 2 Records according to active pill tab
  const displayedRecords = useMemo(() => {
    switch (activeSection) {
      case 'eligible':
        return eligibleEntries;
      case 'paid':
        return paidEntries;
      case 'not_eligible':
        return notEligibleEntries;
      case 'clawback':
        return clawbackEntries;
      default:
        return filtered;
    }
  }, [activeSection, filtered, eligibleEntries, paidEntries, notEligibleEntries, clawbackEntries]);

  // Active Month Label
  const activeMonthLabel = useMemo(
    () => (selectedPeriod === 'all' ? 'ALL MONTHS' : formatMonthLabel(selectedPeriod).toUpperCase()),
    [selectedPeriod]
  );

  // Format numbers with currency
  const fmtMoney = (val: number) => {
    return `${formatCurrency(val, currency, useBanglaNumerals)}`;
  };

  const getPersonPhotoSrc = (person?: { id?: string; photoUrl?: string; photoData?: string } | null): string | null => {
    if (!person) return null;
    return person.photoUrl || person.photoData || (person.id ? ApiService.getPhotoBackup(person.id) : null) || null;
  };

  const compressImageFileToSquare = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        const img = new Image();
        img.onerror = () => resolve(rawDataUrl);
        img.onload = () => {
          try {
            const size = 500;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(rawDataUrl);
              return;
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);
            const minSide = Math.min(img.naturalWidth || size, img.naturalHeight || size);
            const sx = ((img.naturalWidth || size) - minSide) / 2;
            const sy = ((img.naturalHeight || size) - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          } catch {
            resolve(rawDataUrl);
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePersonPhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isOwner) return;
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|gif|heic|heif|bmp|svg)$/i)) {
      setToastMessage({ text: 'Please select a valid image file (JPG, PNG, WebP, HEIC).', type: 'error' });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setToastMessage({ text: 'Photo size must be under 25MB.', type: 'error' });
      return;
    }
    try {
      const compressed = await compressImageFileToSquare(file);
      setPersonPhotoPreview(compressed);
      setPersonPhotoBase64(compressed);
      setPersonPhotoRemoved(false);
    } catch (err: any) {
      setToastMessage({ text: err?.message || 'Could not process image', type: 'error' });
    }
  };

  // --- PERSON ACCOUNT HANDLERS ---
  const openAddPersonModal = () => {
    setEditingPerson(null);
    setPersonNameInput('');
    setPersonIqamaInput('');
    setPersonPhoneInput('');
    setPersonOfficeInput(DEFAULT_OFFICES[0]);
    setPersonPhotoPreview(null);
    setPersonPhotoBase64(null);
    setPersonPhotoRemoved(false);
    setShowPersonModal(true);
  };

  const openEditSpecificPersonModal = (person: CommissionPersonAccount) => {
    setEditingPerson(person);
    setPersonNameInput(person.name);
    setPersonIqamaInput(person.iqamaNo || '');
    setPersonPhoneInput(person.phone || '');
    setPersonOfficeInput(person.office || DEFAULT_OFFICES[0]);
    setPersonPhotoPreview(getPersonPhotoSrc(person));
    setPersonPhotoBase64(null);
    setPersonPhotoRemoved(false);
    setShowPersonModal(true);
  };

  const openEditPersonModal = () => {
    if (activePersonProfile) {
      openEditSpecificPersonModal(activePersonProfile);
    } else {
      setEditingPerson(null);
      setPersonNameInput(selectedAgent !== 'all' ? selectedAgent : currentUser.name || '');
      setPersonIqamaInput('');
      setPersonPhoneInput('');
      setPersonOfficeInput(DEFAULT_OFFICES[0]);
      setPersonPhotoPreview(null);
      setPersonPhotoBase64(null);
      setPersonPhotoRemoved(false);
      setShowPersonModal(true);
    }
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = personNameInput.trim();
    if (!cleanName) return;
    setIsSavingPerson(true);
    try {
      let saved: CommissionPersonAccount;
      const photoPayload = isOwner
        ? {
            ...(personPhotoBase64 ? { photoBase64: personPhotoBase64 } : {}),
            ...(personPhotoRemoved ? { removePhoto: true } : {}),
          }
        : {};

      if (editingPerson && !editingPerson.id.startsWith('person_temp')) {
        try {
          saved = await ApiService.updateCommissionPerson(editingPerson.id, {
            name: cleanName,
            iqamaNo: personIqamaInput.trim(),
            phone: personPhoneInput.trim(),
            office: personOfficeInput.trim(),
            ...photoPayload,
          });
        } catch {
          saved = await ApiService.upsertCommissionPerson({
            name: cleanName,
            iqamaNo: personIqamaInput.trim(),
            phone: personPhoneInput.trim(),
            office: personOfficeInput.trim(),
            ...(isOwner && personPhotoBase64 ? { photoBase64: personPhotoBase64 } : {}),
          });
        }
      } else {
        saved = await ApiService.upsertCommissionPerson({
          name: cleanName,
          iqamaNo: personIqamaInput.trim(),
          phone: personPhoneInput.trim(),
          office: personOfficeInput.trim(),
          ...(isOwner && personPhotoBase64 ? { photoBase64: personPhotoBase64 } : {}),
        });
      }
      setSelectedAgent(saved.name);
      setFormAgent(saved.name);
      setQuickAgent(saved.name);
      setShowPersonModal(false);
      await loadData(true);
      setToastMessage({
        text: `Person account "${saved.name}" saved & synced!`,
        type: 'success',
      });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to save person account', type: 'error' });
    } finally {
      setIsSavingPerson(false);
    }
  };

  // --- MONTHLY SHEET HANDLERS ---
  const handleAddMonth = async (e?: React.FormEvent, explicitYm?: string) => {
    if (e) e.preventDefault();
    const targetYm = (explicitYm || newMonthInput || '').trim();
    if (!/^\d{4}-\d{2}$/.test(targetYm)) {
      setToastMessage({ text: 'Please select a valid month (YYYY-MM)', type: 'error' });
      return;
    }
    setIsSavingMonth(true);
    try {
      const updated = await ApiService.addCommissionMonth(targetYm);
      setMonths(updated);
      setSelectedPeriod(targetYm);
      setShowMonthsModal(false);
      setToastMessage({ text: `Sheet "${formatMonthLabel(targetYm)}" opened`, type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to add monthly sheet', type: 'error' });
    } finally {
      setIsSavingMonth(false);
    }
  };

  const handleDeleteMonth = async (ym: string) => {
    const count = entries.filter((e) => e.period === ym || (e.date && e.date.startsWith(ym))).length;
    if (count > 0) {
      setToastMessage({
        text: `Cannot delete "${formatMonthLabel(ym)}" while it still contains ${count} record(s).`,
        type: 'error',
      });
      return;
    }
    try {
      const updated = await ApiService.deleteCommissionMonth(ym);
      setMonths(updated);
      if (selectedPeriod === ym) {
        setSelectedPeriod(updated[updated.length - 1] || 'all');
      }
      setToastMessage({ text: `Removed empty sheet "${formatMonthLabel(ym)}"`, type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to remove month', type: 'error' });
    }
  };

  // --- QUICK INLINE ENTRY (NO AUTO AMOUNT) ---
  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInvoiceNo.trim() || !quickClient.trim()) {
      setToastMessage({ text: 'Invoice # and Client name are required', type: 'error' });
      return;
    }
    setIsQuickSaving(true);
    try {
      const parsedQty = Math.max(1, Number(quickQty) || 1);
      const parsedRate = Math.max(0, Number(quickRate) || 0);
      const parsedComm =
        quickCommission !== ''
          ? Math.max(0, Number(quickCommission) || 0)
          : parsedQty * parsedRate;
      const parsedRem = Math.max(0, Number(quickRemaining) || 0);
      const isClaw = quickStatusType === 'clawback';
      const isPaid = quickStatusType === 'paid';
      const isElig = quickStatusType === 'eligible' || isPaid;
      const targetDate =
        selectedPeriod !== 'all' && /^\d{4}-\d{2}$/.test(selectedPeriod)
          ? `${selectedPeriod}-${new Date().toISOString().slice(8, 10)}`
          : quickDate;

      const created = await ApiService.createCommission({
        date: targetDate,
        office: quickOffice,
        invoiceNo: quickInvoiceNo.trim(),
        invoiceStatus: isClaw ? 'Cancelled' : isElig ? 'Active' : 'Pending',
        agent: (quickAgent || (selectedAgent !== 'all' ? selectedAgent : currentUser.name)).trim(),
        client: quickClient.trim(),
        workerName: quickWorker.trim() || undefined,
        clientMobile: quickMobile.trim() || undefined,
        service: quickService.trim() || 'General Service',
        qty: parsedQty,
        ratePerUnit: parsedRate,
        invoiceTotal: 0,
        remainingAmount: parsedRem,
        eligible: isElig,
        isClawback: isClaw,
        clawbackAmount: isClaw ? parsedComm : undefined,
        commissionAmount: isClaw ? 0 : parsedComm,
        payoutStatus: isClaw
          ? 'Carried over'
          : isPaid
          ? 'Paid'
          : isElig
          ? 'To pay'
          : 'Not eligible',
        period: selectedPeriod !== 'all' ? selectedPeriod : targetDate.slice(0, 7),
      });

      setEntries((prev) => [created, ...prev]);
      setQuickInvoiceNo('');
      setQuickClient('');
      setQuickWorker('');
      setQuickMobile('');
      setQuickQty(1);
      setQuickRate('');
      setQuickCommission('');
      setQuickRemaining('');
      setShowQuickRow(false);
      await loadData(true);
      setToastMessage({
        text: `Added #${created.invoiceNo} & synced account for ${created.agent}`,
        type: 'success',
      });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to add record', type: 'error' });
    } finally {
      setIsQuickSaving(false);
    }
  };

  // --- ADD / EDIT MODAL ---
  const openAddModal = () => {
    setEditingEntry(null);
    const defaultDate =
      selectedPeriod !== 'all' && /^\d{4}-\d{2}$/.test(selectedPeriod)
        ? `${selectedPeriod}-${new Date().toISOString().slice(8, 10)}`
        : new Date().toISOString().slice(0, 10);
    setFormDate(defaultDate);
    setFormOffice(
      selectedOffice !== 'all'
        ? selectedOffice
        : activePersonProfile?.office || DEFAULT_OFFICES[0]
    );
    setFormInvoiceNo('');
    setFormAgent(
      selectedAgent !== 'all'
        ? selectedAgent
        : activePersonProfile?.name || currentUser.name || 'FAYSAL'
    );
    setFormClient('');
    setFormWorker('');
    setFormClientMobile('');
    setFormService(selectedServiceFilter !== 'all' ? selectedServiceFilter : DEFAULT_SERVICES[0]);
    setFormQty(1);
    setFormRate('');
    setFormCommissionAmount('');
    setFormInvoiceTotal('');
    setFormRemaining('');
    setFormEligible(true);
    setFormPayoutStatus('To pay');
    setFormReason('');
    setFormIsClawback(false);
    setFormClawbackAmount('');
    setShowAddModal(true);
  };

  const openEditModal = (entry: CommissionEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormOffice(entry.office || DEFAULT_OFFICES[0]);
    setFormInvoiceNo(entry.invoiceNo);
    setFormAgent(entry.agent);
    setFormClient(entry.client);
    setFormWorker(entry.workerName || '');
    setFormClientMobile(entry.clientMobile || '');
    setFormService(entry.service);
    setFormQty(entry.qty || 1);
    setFormRate(entry.ratePerUnit ? String(entry.ratePerUnit) : '');
    setFormCommissionAmount(entry.commissionAmount ? String(entry.commissionAmount) : '');
    setFormInvoiceTotal(entry.invoiceTotal ? String(entry.invoiceTotal) : '');
    setFormRemaining(entry.remainingAmount ? String(entry.remainingAmount) : '');
    setFormEligible(Boolean(entry.eligible));
    setFormPayoutStatus(entry.payoutStatus || (entry.eligible ? 'To pay' : 'Not eligible'));
    setFormReason(entry.reasonNotEligible || '');
    setFormIsClawback(Boolean(entry.isClawback));
    setFormClawbackAmount(entry.clawbackAmount ? String(Math.abs(entry.clawbackAmount)) : '');
    setShowAddModal(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInvoiceNo.trim() || !formClient.trim() || !formService.trim()) {
      setToastMessage({ text: 'Invoice #, Client Name, and Service are required', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const unitQty = Math.max(1, Number(formQty) || 1);
      const unitRate = Math.max(0, Number(formRate) || 0);
      const calcComm =
        formCommissionAmount !== ''
          ? Math.max(0, Number(formCommissionAmount) || 0)
          : unitQty * unitRate;

      const payload: Partial<CommissionEntry> = {
        date: formDate,
        office: formOffice.trim(),
        invoiceNo: formInvoiceNo.trim(),
        agent: (formAgent || currentUser.name).trim(),
        client: formClient.trim(),
        workerName: formWorker.trim() || undefined,
        clientMobile: formClientMobile.trim() || undefined,
        service: formService.trim(),
        qty: unitQty,
        ratePerUnit: unitRate,
        invoiceTotal: Number(formInvoiceTotal) || 0,
        remainingAmount: Number(formRemaining) || 0,
        eligible: formIsClawback ? false : formEligible,
        reasonNotEligible: formEligible ? undefined : formReason.trim() || undefined,
        isClawback: formIsClawback,
        clawbackAmount: formIsClawback ? Math.abs(Number(formClawbackAmount) || 0) : undefined,
        commissionAmount: formIsClawback ? 0 : calcComm,
        invoiceStatus: formIsClawback ? 'Cancelled' : formEligible ? 'Active' : 'Pending',
        payoutStatus: formIsClawback
          ? 'Carried over'
          : formPayoutStatus || (formEligible ? 'To pay' : 'Not eligible'),
        period: formDate.slice(0, 7),
      };

      if (editingEntry) {
        const updated = await ApiService.updateCommission(editingEntry.id, payload);
        setEntries((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        setToastMessage({ text: `Record #${updated.invoiceNo} updated & synced`, type: 'success' });
      } else {
        const created = await ApiService.createCommission(payload);
        setEntries((prev) => [created, ...prev]);
        setToastMessage({
          text: `Record #${created.invoiceNo} saved & auto-account synced for ${created.agent}`,
          type: 'success',
        });
      }

      setShowAddModal(false);
      await loadData(true);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to save commission record', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- INLINE DIRECT CELL UPDATE ---
  const handleDirectCellUpdate = async (entry: CommissionEntry, patch: Partial<CommissionEntry>) => {
    try {
      const updated = await ApiService.updateCommission(entry.id, patch);
      setEntries((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      await loadData(true);
      setToastMessage({ text: `Saved #${updated.invoiceNo}`, type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Cell update failed', type: 'error' });
    }
  };

  // --- DELETE ENTRY ---
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeletingEntry(true);
    try {
      await ApiService.deleteCommission(entryToDelete.id);
      setEntries((prev) => prev.filter((e) => e.id !== entryToDelete.id));
      setEntryToDelete(null);
      await loadData(true);
      setToastMessage({ text: 'Record deleted and synced', type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to delete record', type: 'error' });
    } finally {
      setIsDeletingEntry(false);
    }
  };

  // --- SETTLE PAYOUT (AUTO-POSTS TO ACCOUNTING LEDGER) ---
  const handleSettlePayout = async (targetPerson?: string) => {
    try {
      const personToPay = targetPerson || (selectedAgent !== 'all' ? selectedAgent : undefined);
      const ids =
        targetPerson
          ? entries
              .filter(
                (e) =>
                  e.agent.trim().toLowerCase() === targetPerson.trim().toLowerCase() &&
                  e.eligible &&
                  !e.isClawback &&
                  e.payoutStatus === 'To pay'
              )
              .map((e) => e.id)
          : eligibleEntries.map((e) => e.id);

      if (ids.length === 0) {
        setToastMessage({ text: 'No eligible invoices ready to pay', type: 'error' });
        return;
      }

      const res = await ApiService.settleCommissionPayout({
        agent: personToPay,
        entryIds: ids,
      });
      setShowPayoutModal(false);
      await loadData(true);
      setToastMessage({
        text: `Marked ${res.count} invoice(s) as Paid & auto-posted to Accounting Ledger!`,
        type: 'success',
      });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to settle payout', type: 'error' });
    }
  };

  // --- REAL .XLSX EXPORT ---
  const handleExportXlsx = () => {
    try {
      const wb = XLSX.utils.book_new();

      const summarySheetRows = serviceSummary.map((s, i) => ({
        '#': i + 1,
        Service: s.service,
        Invoices: s.invoices,
        [`Rate (${currency})`]: s.ratePerUnit,
        'Eligible Invoices': s.eligibleInvoices,
        Units: s.units,
        [`To Pay (${currency})`]: s.toPay,
        [`Paid (${currency})`]: s.paid,
        [`Not Yet Eligible (${currency})`]: s.notYetEligible,
      }));
      summarySheetRows.push({
        '#': '' as any,
        Service: 'TOTAL',
        Invoices: serviceSummary.reduce((a, b) => a + b.invoices, 0),
        [`Rate (${currency})`]: '' as any,
        'Eligible Invoices': serviceSummary.reduce((a, b) => a + b.eligibleInvoices, 0),
        Units: serviceSummary.reduce((a, b) => a + b.units, 0),
        [`To Pay (${currency})`]: serviceSummary.reduce((a, b) => a + b.toPay, 0),
        [`Paid (${currency})`]: serviceSummary.reduce((a, b) => a + b.paid, 0),
        [`Not Yet Eligible (${currency})`]: serviceSummary.reduce((a, b) => a + b.notYetEligible, 0),
      });

      const recordsSheetRows = filtered.map((e, i) => ({
        '#': i + 1,
        Date: e.date,
        Office: e.office,
        'Invoice #': e.invoiceNo,
        Person: e.agent,
        Client: e.client,
        Worker: e.workerName || '',
        Mobile: e.clientMobile || '',
        Service: e.service,
        Qty: e.qty,
        [`Rate (${currency})`]: e.ratePerUnit,
        [`Commission (${currency})`]: getRowCommission(e),
        [`Remaining (${currency})`]: e.remainingAmount || 0,
        Status: e.payoutStatus,
        Notes: e.reasonNotEligible || e.notes || '',
      }));

      const ws1 = XLSX.utils.json_to_sheet(summarySheetRows);
      const ws2 = XLSX.utils.json_to_sheet(recordsSheetRows);
      XLSX.utils.book_append_sheet(wb, ws1, 'Service Summary');
      XLSX.utils.book_append_sheet(wb, ws2, 'Commission Records');

      const fileAgent = selectedAgent === 'all' ? 'All_Persons' : selectedAgent.replace(/\s+/g, '_');
      const filePeriod = selectedPeriod === 'all' ? 'All_Months' : selectedPeriod;
      XLSX.writeFile(wb, `Agent_Commission_Statement_${fileAgent}_${filePeriod}.xlsx`);
      setToastMessage({ text: 'Excel (.xlsx) worksheet downloaded!', type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Excel export failed', type: 'error' });
    }
  };

  const resolveImageAsJpegDataUrl = (src: string | null): Promise<string | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  const formatPlainMoney = (val: number): string => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('en-US')} ${currency}`;
  };

  const formatPrintMoney = (val: number): string => {
    return formatCurrency(val, currency, useBanglaNumerals);
  };

  const handleDownloadStatementPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 36;
      let startY = 38;

      const personPhotoSrc =
        selectedAgent !== 'all'
          ? getPersonPhotoSrc(activePersonProfile) || activePersonProfile?.photoData || null
          : null;
      const jpegPhoto = await resolveImageAsJpegDataUrl(personPhotoSrc);

      let headerTextX = marginX;
      if (jpegPhoto) {
        doc.addImage(jpegPhoto, 'JPEG', marginX, startY - 4, 44, 44);
        doc.setDrawColor(203, 213, 225);
        doc.rect(marginX, startY - 4, 44, 44);
        headerTextX = marginX + 56;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(globalSettings.companyName || 'ZARA Accounting', headerTextX, startY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Agent Commission Statement (${activeMonthLabel})`, headerTextX, startY + 26);

      const personLabel = selectedAgent === 'all' ? 'All Persons' : selectedAgent;
      const iqamaPart =
        selectedAgent !== 'all' && activePersonProfile?.iqamaNo
          ? `  |  Iqama: ${activePersonProfile.iqamaNo}`
          : '';
      const phonePart =
        selectedAgent !== 'all' && activePersonProfile?.phone
          ? `  |  Phone: ${activePersonProfile.phone}`
          : '';
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Person: ${personLabel}${iqamaPart}${phonePart}  |  Period: ${formatMonthPeriodRange(selectedPeriod)}`,
        headerTextX,
        startY + 41
      );

      // Right-aligned summary totals
      doc.setFontSize(9.5);
      doc.setTextColor(4, 120, 87);
      doc.setFont('helvetica', 'bold');
      doc.text(`To Pay Now: ${formatPlainMoney(toPayNow)}`, pageWidth - marginX, startY + 10, { align: 'right' });

      doc.setTextColor(29, 78, 216);
      doc.text(`Already Paid: ${formatPlainMoney(alreadyPaid)}`, pageWidth - marginX, startY + 25, { align: 'right' });

      doc.setTextColor(15, 23, 42);
      doc.text(`Total Commission: ${formatPlainMoney(totalCommission)}`, pageWidth - marginX, startY + 40, { align: 'right' });

      const dividerY = startY + 54;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1);
      doc.line(marginX, dividerY, pageWidth - marginX, dividerY);

      const tableRows = filtered.map((e, idx) => [
        String(idx + 1),
        e.date || '',
        e.invoiceNo || '',
        e.agent || '',
        e.client || '',
        e.service || '',
        `${e.qty} x ${(Number(e.ratePerUnit) || 0).toLocaleString('en-US')} ${currency}`,
        formatPlainMoney(getRowCommission(e)),
        e.payoutStatus || '',
      ]);

      autoTable(doc, {
        startY: dividerY + 14,
        margin: { left: marginX, right: marginX },
        head: [['#', 'Date', 'Invoice #', 'Person', 'Client', 'Service', 'Qty x Rate', 'Commission', 'Status']],
        body: tableRows,
        foot: [
          [
            '',
            'TOTAL',
            `${filtered.length} invoices`,
            '',
            '',
            '',
            '',
            formatPlainMoney(totalCommission),
            '',
          ],
        ],
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: 5,
          textColor: [15, 23, 42],
          lineColor: [203, 213, 225],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
        },
        footStyles: {
          fillColor: [236, 253, 245],
          textColor: [6, 95, 70],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 26 },
          1: { cellWidth: 64 },
          2: { fontStyle: 'bold', cellWidth: 74 },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'center' },
        },
      });

      const fileAgent = selectedAgent === 'all' ? 'All_Persons' : selectedAgent.replace(/\s+/g, '_');
      const filePeriod = selectedPeriod === 'all' ? 'All_Months' : selectedPeriod;
      doc.save(`Agent_Commission_Statement_${fileAgent}_${filePeriod}.pdf`);
      setToastMessage({ text: 'PDF statement downloaded!', type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: err?.message || 'Failed to generate PDF', type: 'error' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintStatement = async () => {
    try {
      const escapeHtml = (str: string) =>
        String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      const rawPhoto =
        selectedAgent !== 'all'
          ? getPersonPhotoSrc(activePersonProfile) || activePersonProfile?.photoData || null
          : null;
      const resolvedPhoto = await resolveImageAsJpegDataUrl(rawPhoto);
      const photoHtml = resolvedPhoto || rawPhoto
        ? `<img src="${resolvedPhoto || rawPhoto}" alt="Person" style="width:52px;height:52px;border-radius:8px;object-fit:cover;border:1px solid #cbd5e1;" />`
        : '';

      const rowsHtml = filtered
        .map(
          (e) => `
          <tr>
            <td>${escapeHtml(e.date)}</td>
            <td style="font-weight:700;">${escapeHtml(e.invoiceNo)}</td>
            <td>${escapeHtml(e.agent)}</td>
            <td>${escapeHtml(e.client)}</td>
            <td>${escapeHtml(e.service)}</td>
            <td style="text-align:right;">${e.qty} &times; ${escapeHtml(formatPrintMoney(Number(e.ratePerUnit || 0)))}</td>
            <td style="text-align:right;font-weight:700;">${escapeHtml(formatPrintMoney(getRowCommission(e)))}</td>
            <td style="text-align:center;">${escapeHtml(e.payoutStatus)}</td>
          </tr>`
        )
        .join('');

      const htmlDoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Agent Commission Statement</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; margin: 0; padding: 16px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    h2 { margin: 0; font-size: 20px; }
    .sub { margin: 2px 0 0; font-size: 13px; color: #475569; }
    .meta { margin: 4px 0 0; font-size: 11.5px; color: #64748b; }
    .totals { text-align: right; font-size: 12px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    tfoot td { background: #ecfdf5; font-weight: 700; color: #065f46; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${photoHtml}
      <div>
        <h2>${escapeHtml(globalSettings.companyName || 'ZARA Accounting')}</h2>
        <p class="sub">Agent Commission Statement (${escapeHtml(activeMonthLabel)})</p>
        <p class="meta">Person: <strong>${escapeHtml(selectedAgent === 'all' ? 'All Persons' : selectedAgent)}</strong> &bull; Period: ${escapeHtml(formatMonthPeriodRange(selectedPeriod))}</p>
      </div>
    </div>
    <div class="totals">
      <div>To Pay Now: <strong style="color:#047857;">${escapeHtml(formatPrintMoney(toPayNow))}</strong></div>
      <div>Already Paid: <strong style="color:#1d4ed8;">${escapeHtml(formatPrintMoney(alreadyPaid))}</strong></div>
      <div>Total Commission: <strong>${escapeHtml(formatPrintMoney(totalCommission))}</strong></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Invoice #</th>
        <th>Person</th>
        <th>Client</th>
        <th>Service</th>
        <th style="text-align:right;">Qty &times; Rate</th>
        <th style="text-align:right;">Commission</th>
        <th style="text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">No records found</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="6">TOTAL (${filtered.length} invoices)</td>
        <td style="text-align:right;">${escapeHtml(formatPlainMoney(totalCommission))}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

      const existingFrame = document.getElementById('zara-commission-print-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'zara-commission-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }
      doc.open();
      doc.write(htmlDoc);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setTimeout(() => {
          iframe.remove();
        }, 2000);
      }, 250);
    } catch {
      window.print();
    }
  };

  // --- EXCEL / CSV / AI FILE IMPORT ---
  const handleFileUploadForImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      setImportMode('excel');
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

          const mapped = rawRows
            .map((row) => {
              const lowerMap: Record<string, any> = {};
              Object.keys(row).forEach((k) => {
                lowerMap[k.trim().toLowerCase()] = row[k];
              });

              const pick = (...keys: string[]) => {
                for (const k of keys) {
                  if (lowerMap[k] !== undefined && String(lowerMap[k]).trim() !== '') {
                    return String(lowerMap[k]).trim();
                  }
                }
                return '';
              };

              const invNo = pick('invoice #', 'invoice no', 'invoice no.', 'invoiceno', 'invoice', 'inv');
              const client = pick('client', 'client name', 'customer', 'customer name');
              if (!invNo && !client) return null;

              const qtyVal = Math.max(1, Number(pick('qty', 'quantity', 'units')) || 1);
              const rateVal = Math.max(0, Number(pick('rate', 'rate per unit', 'rate (sar)', 'unit rate')) || 0);
              const commRaw = pick('commission', 'commission amount', 'commission (sar)', 'amount', 'to pay');
              const commVal = commRaw !== '' ? Math.max(0, Number(commRaw) || 0) : qtyVal * rateVal;
              const remVal = Math.max(0, Number(pick('remaining', 'remaining (sar)', 'balance')) || 0);
              const statusStr = pick('status', 'payout status', 'payoutstatus', 'eligible').toLowerCase();
              const isPaid = statusStr === 'paid';
              const isNotElig = statusStr.includes('not') || statusStr === 'no' || statusStr === 'pending';
              const isClaw = statusStr.includes('cancel') || statusStr.includes('claw') || statusStr.includes('carried');

              return {
                date: pick('date') || new Date().toISOString().slice(0, 10),
                office: pick('office', 'branch') || DEFAULT_OFFICES[0],
                invoiceNo: invNo || `IMP-${Date.now().toString().slice(-6)}`,
                agent:
                  pick('person', 'agent', 'person / agent', 'staff') ||
                  (selectedAgent !== 'all' ? selectedAgent : currentUser.name),
                client: client || 'Imported Client',
                workerName: pick('worker', 'worker name'),
                clientMobile: pick('mobile', 'client mobile', 'phone'),
                service: pick('service', 'service name') || 'General Service',
                qty: qtyVal,
                ratePerUnit: rateVal,
                commissionAmount: isClaw ? 0 : commVal,
                remainingAmount: remVal,
                eligible: !isClaw && !isNotElig,
                isClawback: isClaw,
                payoutStatus: isClaw ? 'Carried over' : isPaid ? 'Paid' : isNotElig ? 'Not eligible' : 'To pay',
              };
            })
            .filter(Boolean);

          setImportedRows(mapped);
          setSelectedImportIndices(mapped.map((_, idx) => idx));
          if (mapped.length === 0) {
            setToastMessage({ text: 'No valid rows found in spreadsheet', type: 'error' });
          }
        } catch (err: any) {
          setToastMessage({ text: err.message || 'Could not read Excel/CSV file', type: 'error' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Image or PDF -> prepare for AI extraction if user wants
      setImportMode('scan');
      const reader = new FileReader();
      reader.onloadend = () => {
        setScanFile({
          base64: reader.result as string,
          mimeType: file.type || 'image/png',
          fileName: file.name,
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRunScan = async () => {
    if (!scanFile) return;
    setIsScanning(true);
    try {
      const res = await ApiService.extractCommissionWithAi(scanFile.base64, scanFile.mimeType);
      const list = (res.entries || []).map((row: any) => ({
        ...row,
        agent: row.agent || (selectedAgent !== 'all' ? selectedAgent : currentUser.name),
        ratePerUnit: Number(row.ratePerUnit) || 0,
        commissionAmount: Number(row.commissionAmount) || 0,
      }));
      setImportedRows(list);
      setSelectedImportIndices(list.map((_: any, i: number) => i));
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Document scan failed', type: 'error' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmImport = async () => {
    const toImport = importedRows.filter((_, i) => selectedImportIndices.includes(i));
    if (toImport.length === 0) return;
    setIsImportingRows(true);
    try {
      const res = await ApiService.importCommissionsBatch(toImport);
      setShowImportModal(false);
      setImportedRows([]);
      setScanFile(null);
      await loadData(true);
      setToastMessage({
        text: `Imported ${res.count} record(s) & auto-updated person accounts!`,
        type: 'success',
      });
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to import rows', type: 'error' });
    } finally {
      setIsImportingRows(false);
    }
  };

  // Excel Column Letters Helper
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

  return (
    <div
      className={`space-y-4 transition-all ${
        isWideFitMode ? 'w-full max-w-none' : 'max-w-7xl mx-auto'
      }`}
    >
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-50 border-emerald-600'
              : 'bg-rose-900 text-rose-50 border-rose-600'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-75 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP EXCEL WORKSHEET HEADER CARD (Matching Screenshot) */}
      <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Left: Excel X Mark + Title + Person Selector */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                <span className="font-serif font-black text-xl text-emerald-700 dark:text-emerald-400">
                  X
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-serif tracking-tight">
                    {isBn ? 'এজেন্ট কমিশন স্টেটমেন্ট' : 'Agent Commission Statement'}
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                    WORKSHEET
                  </span>
                  <button
                    onClick={toggleWideFitMode}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                      isWideFitMode
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isWideFitMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    <span>Fit to Display</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Separate monthly sheets, official Excel gridlines & auto-synced person accounts
                </p>
              </div>
            </div>

            {/* Person Selector Bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              {(() => {
                const activePhoto = selectedAgent !== 'all' ? getPersonPhotoSrc(activePersonProfile) : null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (isOwner && selectedAgent !== 'all' && activePersonProfile) {
                        openEditSpecificPersonModal(activePersonProfile);
                      }
                    }}
                    title={
                      isOwner && selectedAgent !== 'all'
                        ? 'Owner: Click to add or change person photo'
                        : 'Person Avatar'
                    }
                    className={`relative w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-[11px] shrink-0 overflow-hidden border border-emerald-200 dark:border-emerald-700 ${
                      isOwner && selectedAgent !== 'all' ? 'cursor-pointer hover:ring-2 hover:ring-emerald-500 group' : 'cursor-default'
                    }`}
                  >
                    {activePhoto ? (
                      <img
                        src={activePhoto}
                        alt={selectedAgent}
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (activePersonProfile?.photoData && img.src !== activePersonProfile.photoData) {
                            img.src = activePersonProfile.photoData;
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{getInitials(selectedAgent === 'all' ? 'ALL' : selectedAgent)}</span>
                    )}
                    {isOwner && selectedAgent !== 'all' && (
                      <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })()}
              <span className="text-slate-500 dark:text-slate-400 font-medium">Person:</span>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Persons ({availablePersons.length})</option>
                {availablePersons.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={openAddPersonModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>

              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Iqama:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {activePersonProfile?.iqamaNo || 'Not set'}
                </strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600" />
                <strong>{activePersonProfile?.phone || 'Not set'}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Period:{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  {formatMonthPeriodRange(selectedPeriod)}
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold">
                Invoices: {filtered.length}
              </span>
              <button
                onClick={openEditPersonModal}
                className="text-emerald-700 dark:text-emerald-400 underline font-medium hover:text-emerald-800"
              >
                (Edit info)
              </button>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setImportedRows([]);
                setScanFile(null);
                setShowImportModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Excel / PDF</span>
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Record</span>
            </button>
            <button
              onClick={() => setShowMonthsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Month File</span>
            </button>
            <button
              onClick={() => {
                setViewMode('table');
                setActiveSection('all');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-800 text-white text-xs font-semibold shadow-sm"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Excel Worksheet</span>
            </button>
            <button
              onClick={handleExportXlsx}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .XLSX</span>
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Preview PDF</span>
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={() => loadData(false)}
              title="Refresh worksheet"
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* MONTHLY SHEETS TAB BAR */}
        <div className="px-4 sm:px-5 py-2.5 bg-emerald-50/50 dark:bg-slate-950/60 border-t border-emerald-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowMonthsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-300"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Month Files ({months.length})</span>
          </button>

          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1">
            SHEETS:
          </span>

          <button
            onClick={() => setSelectedPeriod('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
              selectedPeriod === 'all'
                ? 'bg-white dark:bg-slate-800 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/60'
            }`}
          >
            <span>All Months</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-700 text-[10px]">
              {entries.filter((e) => selectedAgent === 'all' || e.agent.toLowerCase() === selectedAgent.toLowerCase()).length}
            </span>
          </button>

          {months.map((ym) => {
            const count = getMonthEntryCount(ym);
            const active = selectedPeriod === ym;
            return (
              <div key={ym} className="inline-flex items-center">
                <button
                  onClick={() => setSelectedPeriod(ym)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-white dark:bg-slate-800 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{formatMonthLabel(ym)}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              </div>
            );
          })}

          <button
            onClick={() => setShowMonthsModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 bg-white/70 dark:bg-slate-800/50"
          >
            <Plus className="w-3 h-3" />
            <span>New Month</span>
          </button>
        </div>
      </div>

      {/* 3 KPI SUMMARY CARDS (Matching Screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: To pay now */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 border-l-4 border-l-emerald-500 p-4 shadow-xs flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-serif">
              To pay now
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-serif mt-1">
              {fmtMoney(toPayNow)}
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{eligibleEntries.length} invoices ready</span>
            </p>
          </div>
          {eligibleEntries.length > 0 && (
            <button
              onClick={() => setShowPayoutModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs shrink-0"
            >
              Pay Eligible
            </button>
          )}
        </div>

        {/* Card 2: Already paid */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/60 border-l-4 border-l-blue-500 p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-serif">
            Already paid
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 font-serif mt-1">
            {fmtMoney(alreadyPaid)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Cleared payouts • Synced to ledger
          </p>
        </div>

        {/* Card 3: Total Commission */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 border-l-4 border-l-teal-500 p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-serif">
            Total Commission
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-serif mt-1">
            {fmtMoney(totalCommission)}
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Total monthly commission earned</span>
          </p>
        </div>
      </div>

      {/* AUTO PERSON ACCOUNTS STRIP (Created automatically whenever any person has entry data) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              Auto Person Accounts ({personAccounts.length})
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Any person with entry data automatically gets an account & ledger sync
            </span>
          </div>
          <button
            onClick={() => setShowAccountsStrip((p) => !p)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            {showAccountsStrip ? 'Hide Accounts' : 'Show Accounts'}
          </button>
        </div>

        {showAccountsStrip && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {personAccounts.map((acc) => {
              const isSelected =
                selectedAgent !== 'all' &&
                selectedAgent.trim().toLowerCase() === acc.name.trim().toLowerCase();
              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAgent(isSelected ? 'all' : acc.name)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative w-8 h-8 rounded-lg bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0 overflow-hidden border border-emerald-500/30">
                        {getPersonPhotoSrc(acc) ? (
                          <img
                            src={getPersonPhotoSrc(acc)!}
                            alt={acc.name}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (acc.photoData && img.src !== acc.photoData) {
                                img.src = acc.photoData;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getInitials(acc.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {acc.invoicesCount} invoice(s) • {acc.office || 'No office'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditSpecificPersonModal(acc);
                          }}
                          title="Owner Only: Add or change person photo & info"
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-400 transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {fmtMoney(acc.totalCommission)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Due: {fmtMoney(acc.toPayNow)}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      Paid: {fmtMoney(acc.alreadyPaid)}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Wait: {fmtMoney(acc.notYetEligible)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEARCH, DROPDOWN FILTERS & WORKSHEET CONTROLS BAR */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice # (e.g. 1575165976), Client, Worker, Mobile (05...), Service, Office..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Offices</option>
            {availableOffices.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={selectedServiceFilter}
            onChange={(e) => setSelectedServiceFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Services</option>
            {availableServices.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Left Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveSection('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'all'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Records ({filtered.length})
            </button>

            <button
              onClick={() => setActiveSection('eligible')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'eligible'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40 hover:bg-rose-50'
              }`}
            >
              <span>Eligible Invoices</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {eligibleEntries.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'paid'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Paid ({paidEntries.length})
            </button>

            <button
              onClick={() => setActiveSection('not_eligible')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'not_eligible'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Waiting ({notEligibleEntries.length})
            </button>

            {clawbackEntries.length > 0 && (
              <button
                onClick={() => setActiveSection('clawback')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeSection === 'clawback'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                Cancelled ({clawbackEntries.length})
              </button>
            )}

            <button
              onClick={() => setActiveSection('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'summary'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Service Summary
            </button>

            <button
              onClick={() => setActiveSection('accounts')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'accounts'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Auto Accounts ({personAccounts.length})</span>
            </button>
          </div>

          {/* Right Worksheet Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={toggleWideFitMode}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-medium ${
                isWideFitMode
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              {isWideFitMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>Fit to Display</span>
            </button>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold ${
                  viewMode === 'table'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold ${
                  viewMode === 'cards'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-serif italic">T</span>
              <span className="text-slate-500 dark:text-slate-400">Font:</span>
              <select
                value={fontMode}
                onChange={(e) => handleFontChange(e.target.value as FontMode)}
                className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
              >
                <option value="serif">Times New Roman (Active)</option>
                <option value="sans">Modern Sans-Serif</option>
                <option value="mono">Spreadsheet Monospace</option>
              </select>
            </div>

            <button
              onClick={() => setDirectEditActive((p) => !p)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                directEditActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Edit2 className="w-3 h-3" />
              <span>Direct Edit: {directEditActive ? 'Active' : 'Off'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading && entries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
          <p className="text-sm font-medium">Loading Excel Worksheet & Person Accounts...</p>
        </div>
      ) : activeSection === 'accounts' ? (
        /* AUTO PERSON ACCOUNTS LEDGER TABLE */
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden ${fontClass}`}>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                A
              </span>
              <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-800 dark:text-white">
                AUTO PERSON ACCOUNTS & LEDGER SYNC
              </h2>
            </div>
            <button
              onClick={openAddPersonModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Person Account</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                  <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-center w-10">FX</th>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((l) => (
                    <th key={l} className="border border-slate-200 dark:border-slate-700 px-3 py-1 text-center">
                      {l}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase">
                  <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center">#</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">PERSON NAME</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">IQAMA / ID</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">PHONE</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">OFFICE</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">INVOICES</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-emerald-700">TO PAY NOW</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-blue-600">ALREADY PAID</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">TOTAL EARNED</th>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {personAccounts.map((acc, idx) => (
                  <tr key={acc.id} className="hover:bg-emerald-50/40 dark:hover:bg-slate-800/60">
                    <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-slate-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold text-slate-900 dark:text-white">
                      <button
                        onClick={() => {
                          setSelectedAgent(acc.name);
                          setActiveSection('all');
                        }}
                        className="inline-flex items-center gap-2 hover:text-emerald-700 hover:underline text-left"
                      >
                        <span className="w-7 h-7 rounded-lg bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                          {getPersonPhotoSrc(acc) ? (
                            <img src={getPersonPhotoSrc(acc)!} alt={acc.name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(acc.name)
                          )}
                        </span>
                        <span>{acc.name}</span>
                      </button>
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-600 dark:text-slate-300">
                      {acc.iqamaNo || '—'}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-600 dark:text-slate-300">
                      {acc.phone || '—'}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-600 dark:text-slate-300">
                      {acc.office || '—'}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-semibold">
                      {acc.invoicesCount}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-bold text-emerald-700">
                      {fmtMoney(acc.toPayNow)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-bold text-blue-600">
                      {fmtMoney(acc.alreadyPaid)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                      {fmtMoney(acc.totalCommission)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedAgent(acc.name);
                            setActiveSection('all');
                          }}
                          className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 text-slate-700 dark:text-slate-200 font-semibold"
                        >
                          Open Sheet
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => openEditSpecificPersonModal(acc)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-semibold hover:bg-amber-100"
                            title="Owner Only: Edit Photo & Info"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Photo</span>
                          </button>
                        )}
                        {acc.toPayNow > 0 && (
                          <button
                            onClick={() => handleSettlePayout(acc.name)}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                          >
                            Pay Due
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* TABLE 1: COMMISSION PER SERVICE (EXCEL GRID matching screenshot) */}
          {(activeSection === 'all' || activeSection === 'summary') && (
            <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden ${fontClass}`}>
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-800 dark:text-white">
                    TABLE 1: COMMISSION PER SERVICE ({activeMonthLabel})
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  [Rates in {currency}] • Excel Grid Formula Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    {/* Excel Column Letters Row */}
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-center w-10">
                        FX
                      </th>
                      {colLetters.slice(0, 8).map((letter) => (
                        <th
                          key={letter}
                          className="border border-slate-200 dark:border-slate-700 px-3 py-1 text-center"
                        >
                          {letter}
                        </th>
                      ))}
                    </tr>
                    {/* Column Labels Row */}
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase">
                      <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center">
                        #
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">
                        SERVICE
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">
                        INVOICES
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">
                        RATE
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">
                        ELIGIBLE INVOICES
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right">
                        UNITS
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">
                        TO PAY
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                        PAID
                      </th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                        NOT YET ELIGIBLE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceSummary.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="border border-slate-200 dark:border-slate-700 px-4 py-6 text-center text-slate-400 italic"
                        >
                          No entries in {formatMonthLabel(selectedPeriod)} yet. Add a record to populate this worksheet (no auto amounts added).
                        </td>
                      </tr>
                    ) : (
                      serviceSummary.map((row, idx) => (
                        <tr
                          key={row.service}
                          className="hover:bg-emerald-50/40 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-slate-400 bg-slate-50/60 dark:bg-slate-900/40 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold text-slate-900 dark:text-white">
                            {row.service}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-medium text-slate-800 dark:text-slate-200">
                            {row.invoices}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {fmtMoney(row.ratePerUnit)}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                            {row.eligibleInvoices}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                            {row.units}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                            {fmtMoney(row.toPay)}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                            {fmtMoney(row.paid)}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right font-bold text-amber-600 dark:text-amber-400">
                            {fmtMoney(row.notYetEligible)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white">
                      <td className="border border-slate-200 dark:border-slate-700 px-2 py-2.5 text-center text-slate-500">
                        Σ
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 uppercase">
                        TOTAL
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right">
                        {serviceSummary.reduce((a, b) => a + b.invoices, 0)}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right text-slate-400">
                        —
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right">
                        {serviceSummary.reduce((a, b) => a + b.eligibleInvoices, 0)}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right">
                        {serviceSummary.reduce((a, b) => a + b.units, 0)}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-400">
                        {fmtMoney(serviceSummary.reduce((a, b) => a + b.toPay, 0))}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right text-blue-600 dark:text-blue-400">
                        {fmtMoney(serviceSummary.reduce((a, b) => a + b.paid, 0))}
                      </td>
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">
                        {fmtMoney(serviceSummary.reduce((a, b) => a + b.notYetEligible, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TABLE 2: COMMISSION RECORDS (EXCEL GRID OR CARDS VIEW) */}
          {activeSection !== 'summary' && (
            <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden ${fontClass}`}>
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-800 dark:text-white">
                    TABLE 2: COMMISSION RECORDS ({activeMonthLabel})
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {displayedRecords.length} rows
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setQuickAgent(selectedAgent !== 'all' ? selectedAgent : currentUser.name || 'FAYSAL');
                      setShowQuickRow((p) => !p);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showQuickRow ? 'Close Quick Row' : 'Quick Entry Row'}</span>
                  </button>
                </div>
              </div>

              {/* INLINE QUICK-ENTRY BAR (NO AUTO AMOUNT) */}
              {showQuickRow && (
                <form
                  onSubmit={handleQuickSave}
                  className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-end text-xs"
                >
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input
                      type="date"
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice # *</label>
                    <input
                      type="text"
                      required
                      value={quickInvoiceNo}
                      onChange={(e) => setQuickInvoiceNo(e.target.value)}
                      placeholder="157516..."
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Person</label>
                    <input
                      type="text"
                      list="person-datalist"
                      value={quickAgent}
                      onChange={(e) => setQuickAgent(e.target.value)}
                      placeholder="Person name"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client *</label>
                    <input
                      type="text"
                      required
                      value={quickClient}
                      onChange={(e) => setQuickClient(e.target.value)}
                      placeholder="Client name"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Worker</label>
                    <input
                      type="text"
                      value={quickWorker}
                      onChange={(e) => setQuickWorker(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Service</label>
                    <input
                      type="text"
                      list="service-datalist"
                      value={quickService}
                      onChange={(e) => setQuickService(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickRate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuickRate(val);
                        const num = Number(val) || 0;
                        setQuickCommission(val === '' ? '' : String(num * (Number(quickQty) || 1)));
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Commission</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quickCommission}
                      onChange={(e) => setQuickCommission(e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-emerald-700"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select
                      value={quickStatusType}
                      onChange={(e) => setQuickStatusType(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="eligible">To pay</option>
                      <option value="paid">Paid</option>
                      <option value="waiting">Not eligible</option>
                      <option value="clawback">Cancelled</option>
                    </select>
                  </div>
                  <div className="lg:col-span-1">
                    <button
                      type="submit"
                      disabled={isQuickSaving}
                      className="w-full py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {isQuickSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </form>
              )}

              {viewMode === 'cards' ? (
                /* CARDS VIEW */
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedRecords.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-xs text-slate-400 italic">
                      No commission records found for this filter.
                    </div>
                  ) : (
                    displayedRecords.map((entry) => {
                      const comm = getRowCommission(entry);
                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-slate-50/40 dark:bg-slate-800/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                #{entry.invoiceNo}
                              </span>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {entry.client}
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Person: <strong>{entry.agent}</strong> • {entry.date}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                entry.payoutStatus === 'Paid'
                                  ? 'bg-blue-100 text-blue-700'
                                  : entry.isClawback || entry.invoiceStatus === 'Cancelled'
                                  ? 'bg-rose-100 text-rose-700'
                                  : entry.eligible
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {entry.payoutStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                            <span>Service: <strong>{entry.service}</strong></span>
                            {entry.workerName && <span>Worker: {entry.workerName}</span>}
                            <span>Qty: {entry.qty} × {fmtMoney(entry.ratePerUnit)}</span>
                          </div>
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                              {fmtMoney(comm)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {entry.eligible && entry.payoutStatus === 'To pay' && !entry.isClawback && (
                                <button
                                  onClick={() => handleDirectCellUpdate(entry, { payoutStatus: 'Paid' })}
                                  className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold"
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button
                                onClick={() => openEditModal(entry)}
                                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-emerald-700"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEntryToDelete(entry)}
                                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* EXCEL TABLE VIEW */
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-center w-10">
                          FX
                        </th>
                        {colLetters.slice(0, 13).map((letter) => (
                          <th
                            key={letter}
                            className="border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-center"
                          >
                            {letter}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase">
                        <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center">#</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">DATE</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">OFFICE</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">INVOICE #</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">PERSON</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">CLIENT & MOBILE</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">WORKER</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left">SERVICE</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-right">QTY</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-right">RATE</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-right text-emerald-700">COMMISSION</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-right">REMAINING</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">STATUS</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRecords.length === 0 ? (
                        <tr>
                          <td
                            colSpan={14}
                            className="border border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-slate-400 italic"
                          >
                            No records in this sheet. Click "+ Add Record" or "Quick Entry Row" to enter data.
                          </td>
                        </tr>
                      ) : (
                        displayedRecords.map((entry, idx) => {
                          const rowComm = getRowCommission(entry);
                          const rowClaw = getRowClawback(entry);
                          const isCancelled = entry.isClawback || entry.invoiceStatus === 'Cancelled';
                          return (
                            <tr
                              key={entry.id}
                              className={`hover:bg-emerald-50/40 dark:hover:bg-slate-800/50 transition-colors ${
                                isCancelled ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                              }`}
                            >
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-900/40">
                                {idx + 1}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 whitespace-nowrap">
                                {directEditActive ? (
                                  <input
                                    type="date"
                                    defaultValue={entry.date}
                                    onBlur={(e) => {
                                      if (e.target.value && e.target.value !== entry.date) {
                                        handleDirectCellUpdate(entry, { date: e.target.value });
                                      }
                                    }}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5 text-xs w-28"
                                  />
                                ) : (
                                  entry.date
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 max-w-[140px] truncate">
                                {entry.office}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                {entry.invoiceNo}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                {entry.agent}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2.5 py-1.5">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {entry.client}
                                </div>
                                {entry.clientMobile && (() => {
                                  const waUrl = getWhatsAppUrl(entry.clientMobile);
                                  return (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                      <span>{formatDisplayPhone(entry.clientMobile)}</span>
                                      {waUrl && (
                                        <a
                                          href={waUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-emerald-600 hover:text-emerald-700"
                                          title="WhatsApp"
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                                {directEditActive ? (
                                  <input
                                    type="text"
                                    defaultValue={entry.workerName || ''}
                                    placeholder="—"
                                    onBlur={(e) => {
                                      if (e.target.value.trim() !== (entry.workerName || '')) {
                                        handleDirectCellUpdate(entry, { workerName: e.target.value.trim() });
                                      }
                                    }}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5 text-xs w-24"
                                  />
                                ) : (
                                  entry.workerName || '—'
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-medium">
                                {entry.service}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right">
                                {directEditActive ? (
                                  <input
                                    type="number"
                                    min="1"
                                    defaultValue={entry.qty}
                                    onBlur={(e) => {
                                      const v = Math.max(1, Number(e.target.value) || 1);
                                      if (v !== entry.qty) {
                                        handleDirectCellUpdate(entry, { qty: v });
                                      }
                                    }}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5 text-xs text-right w-12"
                                  />
                                ) : (
                                  entry.qty
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right">
                                {directEditActive ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    defaultValue={entry.ratePerUnit}
                                    onBlur={(e) => {
                                      const v = Math.max(0, Number(e.target.value) || 0);
                                      if (v !== entry.ratePerUnit) {
                                        handleDirectCellUpdate(entry, { ratePerUnit: v });
                                      }
                                    }}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5 text-xs text-right w-16"
                                  />
                                ) : (
                                  fmtMoney(entry.ratePerUnit)
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-bold">
                                {isCancelled ? (
                                  <span className="text-rose-600">{fmtMoney(rowClaw)}</span>
                                ) : directEditActive ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    defaultValue={rowComm}
                                    onBlur={(e) => {
                                      const v = Math.max(0, Number(e.target.value) || 0);
                                      if (v !== rowComm) {
                                        handleDirectCellUpdate(entry, { commissionAmount: v });
                                      }
                                    }}
                                    className="bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 rounded px-1 py-0.5 text-xs text-right font-bold text-emerald-700 w-20"
                                  />
                                ) : (
                                  <span className="text-emerald-700">{fmtMoney(rowComm)}</span>
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right text-slate-600 dark:text-slate-300">
                                {fmtMoney(entry.remainingAmount || 0)}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">
                                {directEditActive && !isCancelled ? (
                                  <select
                                    value={entry.payoutStatus}
                                    onChange={(e) => {
                                      const val = e.target.value as CommissionEntry['payoutStatus'];
                                      handleDirectCellUpdate(entry, {
                                        payoutStatus: val,
                                        eligible: val === 'Paid' || val === 'To pay',
                                      });
                                    }}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border-0 cursor-pointer ${
                                      entry.payoutStatus === 'Paid'
                                        ? 'bg-blue-100 text-blue-700'
                                        : entry.payoutStatus === 'To pay'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    <option value="To pay">To pay</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Not eligible">Not eligible</option>
                                  </select>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      entry.payoutStatus === 'Paid'
                                        ? 'bg-blue-100 text-blue-700'
                                        : isCancelled
                                        ? 'bg-rose-100 text-rose-700'
                                        : entry.eligible
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {entry.payoutStatus}
                                  </span>
                                )}
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {entry.eligible && entry.payoutStatus === 'To pay' && !isCancelled && (
                                    <button
                                      onClick={() => handleDirectCellUpdate(entry, { payoutStatus: 'Paid' })}
                                      title="Mark Paid & Post to Ledger"
                                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold"
                                    >
                                      Pay
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEditModal(entry)}
                                    title="Edit Record"
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-700"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEntryToDelete(entry)}
                                    title="Delete Record"
                                    className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-500 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white">
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-slate-500">
                          Σ
                        </td>
                        <td colSpan={7} className="border border-slate-200 dark:border-slate-700 px-3 py-2 uppercase">
                          TOTAL ({displayedRecords.length} RECORDS)
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right">
                          {displayedRecords.reduce((a, b) => a + (Number(b.qty) || 1), 0)}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-slate-400">
                          —
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-emerald-700 dark:text-emerald-400">
                          {fmtMoney(displayedRecords.reduce((a, b) => a + getRowCommission(b), 0))}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right">
                          {fmtMoney(displayedRecords.reduce((a, b) => a + (Number(b.remainingAmount) || 0), 0))}
                        </td>
                        <td colSpan={2} className="border border-slate-200 dark:border-slate-700 px-2 py-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Datalists for flexible input */}
      <datalist id="person-datalist">
        {availablePersons.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <datalist id="service-datalist">
        {availableServices.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* ADD / EDIT COMMISSION RECORD MODAL (ZERO AUTO AMOUNT) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingEntry ? 'Edit Commission Record' : 'Add Commission Record'}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter exact amounts manually (no automatic amount will be added). Person account updates automatically.
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Invoice # *</label>
                  <input
                    type="text"
                    required
                    value={formInvoiceNo}
                    onChange={(e) => setFormInvoiceNo(e.target.value)}
                    placeholder="e.g. 1575165976"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Person / Agent *</label>
                  <input
                    type="text"
                    list="person-datalist"
                    required
                    value={formAgent}
                    onChange={(e) => setFormAgent(e.target.value)}
                    placeholder="Person name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Office / Branch</label>
                  <input
                    type="text"
                    list="office-datalist"
                    value={formOffice}
                    onChange={(e) => setFormOffice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <datalist id="office-datalist">
                    {availableOffices.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Service *</label>
                  <input
                    type="text"
                    list="service-datalist"
                    required
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    placeholder="Client full name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Worker Name</label>
                  <input
                    type="text"
                    value={formWorker}
                    onChange={(e) => setFormWorker(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Client Mobile</label>
                  <input
                    type="text"
                    value={formClientMobile}
                    onChange={(e) => setFormClientMobile(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Manual Amount Fields — Zero auto amounts */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={formQty}
                    onChange={(e) => {
                      const q = Math.max(1, Number(e.target.value) || 1);
                      setFormQty(q);
                      if (formRate !== '') {
                        setFormCommissionAmount(String(q * (Number(formRate) || 0)));
                      }
                    }}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Rate ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formRate}
                    onChange={(e) => {
                      const r = e.target.value;
                      setFormRate(r);
                      setFormCommissionAmount(r === '' ? '' : String((Number(r) || 0) * formQty));
                    }}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">Commission ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formCommissionAmount}
                    onChange={(e) => setFormCommissionAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Invoice Total</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formInvoiceTotal}
                    onChange={(e) => setFormInvoiceTotal(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Remaining</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formRemaining}
                    onChange={(e) => setFormRemaining(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Payout Status</label>
                  <select
                    value={formIsClawback ? 'Carried over' : formPayoutStatus}
                    disabled={formIsClawback}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setFormPayoutStatus(val);
                      setFormEligible(val === 'Paid' || val === 'To pay');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="To pay">To pay (Eligible)</option>
                    <option value="Paid">Paid (Auto-post to Ledger)</option>
                    <option value="Not eligible">Not eligible (Waiting)</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-rose-600">
                    <input
                      type="checkbox"
                      checked={formIsClawback}
                      onChange={(e) => setFormIsClawback(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600"
                    />
                    <span>Cancelled / Clawback Invoice</span>
                  </label>
                </div>
              </div>

              {formIsClawback && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">Clawback Amount ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formClawbackAmount}
                      onChange={(e) => setFormClawbackAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-rose-700 mb-1">Reason</label>
                    <input
                      type="text"
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      placeholder="Optional cancellation note"
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingEntry ? 'Save Changes' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT PERSON PROFILE MODAL */}
      {showPersonModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-xl my-auto">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingPerson ? 'Edit Person Account Info' : 'Add Person Account'}
              </h3>
              <button onClick={() => setShowPersonModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePerson} className="p-5 space-y-3.5 text-xs">
              {/* Person Photo Section (Add / Change / Remove is Owner-Only) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border-2 border-emerald-500/60 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {personPhotoPreview ? (
                    <img
                      src={personPhotoPreview}
                      alt={personNameInput || 'Person'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                      {getInitials(personNameInput || 'P')}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-100">Person Photo</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                      {isOwner ? <ShieldCheck className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      Owner Only
                    </span>
                  </div>

                  {isOwner ? (
                    <>
                      <input
                        ref={personPhotoFileRef}
                        type="file"
                        accept="image/*,.heic,.heif"
                        onChange={handlePersonPhotoFileChange}
                        className="hidden"
                      />
                      <input
                        ref={personPhotoCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePersonPhotoFileChange}
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => personPhotoFileRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{personPhotoPreview ? 'Change Photo' : 'Add Photo'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => personPhotoCameraRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] hover:border-emerald-400 cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-blue-500" />
                          <span>Camera</span>
                        </button>
                        {personPhotoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setPersonPhotoPreview(null);
                              setPersonPhotoBase64(null);
                              setPersonPhotoRemoved(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-[11px] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>Only the Owner can add, change, or remove a person photo.</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Person Full Name *</label>
                <input
                  type="text"
                  required
                  value={personNameInput}
                  onChange={(e) => setPersonNameInput(e.target.value)}
                  placeholder="e.g. TAREK AHMED"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Iqama / ID Number</label>
                <input
                  type="text"
                  value={personIqamaInput}
                  onChange={(e) => setPersonIqamaInput(e.target.value)}
                  placeholder="e.g. 2578518975"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={personPhoneInput}
                  onChange={(e) => setPersonPhoneInput(e.target.value)}
                  placeholder="e.g. 0577139106"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Default Office</label>
                <input
                  type="text"
                  value={personOfficeInput}
                  onChange={(e) => setPersonOfficeInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPersonModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPerson}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                >
                  {isSavingPerson && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Person</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MONTH FILES MANAGER MODAL */}
      {showMonthsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Monthly Sheet Files ({months.length})
              </h3>
              <button onClick={() => setShowMonthsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <form onSubmit={(e) => handleAddMonth(e)} className="flex gap-2">
                <input
                  type="month"
                  required
                  value={newMonthInput}
                  onChange={(e) => setNewMonthInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="submit"
                  disabled={isSavingMonth}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {isSavingMonth ? 'Adding...' : '+ Add Sheet'}
                </button>
              </form>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {months.map((ym) => {
                  const count = entries.filter((e) => e.period === ym || e.date?.startsWith(ym)).length;
                  return (
                    <div
                      key={ym}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                    >
                      <button
                        onClick={() => {
                          setSelectedPeriod(ym);
                          setShowMonthsModal(false);
                        }}
                        className="font-bold text-slate-800 dark:text-white hover:text-emerald-700 text-left"
                      >
                        {formatMonthLabel(ym)} ({count} records)
                      </button>
                      {count === 0 && (
                        <button
                          onClick={() => handleDeleteMonth(ym)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Delete empty sheet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL / CSV / PDF MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Import Excel / CSV / Document Statement
                </h3>
                <p className="text-xs text-slate-500">
                  Upload .XLSX, .XLS, or .CSV spreadsheets directly, or scan a PDF/image statement.
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div
                onClick={() => importFileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 dark:border-emerald-800 rounded-xl p-6 text-center cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
              >
                <FileUp className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-bold text-slate-800 dark:text-white">
                  Click to choose .XLSX, .XLS, .CSV, PDF, or Screenshot
                </p>
                <p className="text-slate-500 mt-1">
                  Exact amounts from your file will be imported (zero auto-invented amounts)
                </p>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,image/*"
                  onChange={handleFileUploadForImport}
                  className="hidden"
                />
              </div>

              {importMode === 'scan' && scanFile && importedRows.length === 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-semibold">{scanFile.fileName}</span>
                  <button
                    onClick={handleRunScan}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold"
                  >
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isScanning ? 'Extracting...' : 'Extract Rows'}</span>
                  </button>
                </div>
              )}

              {importedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white">
                      Ready to Import ({selectedImportIndices.length} / {importedRows.length} selected)
                    </span>
                    <button
                      onClick={() =>
                        setSelectedImportIndices(
                          selectedImportIndices.length === importedRows.length
                            ? []
                            : importedRows.map((_, i) => i)
                        )
                      }
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      Toggle All
                    </button>
                  </div>

                  <div className="max-h-64 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                        <tr>
                          <th className="p-2 border-b text-center">Pick</th>
                          <th className="p-2 border-b text-left">Date</th>
                          <th className="p-2 border-b text-left">Invoice #</th>
                          <th className="p-2 border-b text-left">Person</th>
                          <th className="p-2 border-b text-left">Client</th>
                          <th className="p-2 border-b text-left">Service</th>
                          <th className="p-2 border-b text-right">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedRows.map((row, idx) => {
                          const checked = selectedImportIndices.includes(idx);
                          return (
                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedImportIndices((prev) =>
                                      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                                    )
                                  }
                                >
                                  {checked ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                              </td>
                              <td className="p-2">{row.date}</td>
                              <td className="p-2 font-semibold">{row.invoiceNo}</td>
                              <td className="p-2">{row.agent}</td>
                              <td className="p-2">{row.client}</td>
                              <td className="p-2">{row.service}</td>
                              <td className="p-2 text-right font-bold text-emerald-700">
                                {fmtMoney(Number(row.commissionAmount) || 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={isImportingRows || selectedImportIndices.length === 0}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                    >
                      {isImportingRows && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Import Selected ({selectedImportIndices.length})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYOUT CONFIRMATION MODAL */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Settle Eligible Commissions & Sync Accounting
            </h3>
            <p className="text-slate-600 dark:text-slate-300">
              Mark <strong>{eligibleEntries.length}</strong> eligible invoice(s) totaling{' '}
              <strong className="text-emerald-700">
                {fmtMoney(toPayNow)}
              </strong>{' '}
              as Paid? This will automatically record the payout transactions in the main Accounting Ledger.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSettlePayout()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirm Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Record?</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Delete invoice <strong>#{entryToDelete.invoiceNo}</strong> for{' '}
              <strong>{entryToDelete.client}</strong>? Any synced ledger payout entry will also be removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEntryToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeletingEntry}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {isDeletingEntry ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT / PDF PREVIEW MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl font-serif print:shadow-none print:max-h-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4 print:hidden">
              <h3 className="text-base font-bold">Agent Commission Statement — PDF / Print Preview</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadStatementPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex justify-between items-start border-b pb-4">
              <div className="flex items-center gap-3">
                {selectedAgent !== 'all' && getPersonPhotoSrc(activePersonProfile) && (
                  <img
                    src={getPersonPhotoSrc(activePersonProfile)!}
                    alt={selectedAgent}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-300"
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold">{globalSettings.companyName || 'ZARA Accounting'}</h2>
                  <p className="text-sm text-slate-600">Agent Commission Statement ({activeMonthLabel})</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Person: <strong>{selectedAgent === 'all' ? 'All Persons' : selectedAgent}</strong> • Period:{' '}
                    {formatMonthPeriodRange(selectedPeriod)}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs">
                <p>To Pay Now: <strong className="text-emerald-700">{formatPrintMoney(toPayNow)}</strong></p>
                <p>Already Paid: <strong className="text-blue-700">{formatPrintMoney(alreadyPaid)}</strong></p>
                <p>Total Commission: <strong>{formatPrintMoney(totalCommission)}</strong></p>
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">Date</th>
                  <th className="border border-slate-300 p-2 text-left">Invoice #</th>
                  <th className="border border-slate-300 p-2 text-left">Person</th>
                  <th className="border border-slate-300 p-2 text-left">Client</th>
                  <th className="border border-slate-300 p-2 text-left">Service</th>
                  <th className="border border-slate-300 p-2 text-right">Qty × Rate</th>
                  <th className="border border-slate-300 p-2 text-right">Commission</th>
                  <th className="border border-slate-300 p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="border border-slate-300 p-2">{e.date}</td>
                    <td className="border border-slate-300 p-2 font-semibold">{e.invoiceNo}</td>
                    <td className="border border-slate-300 p-2">{e.agent}</td>
                    <td className="border border-slate-300 p-2">{e.client}</td>
                    <td className="border border-slate-300 p-2">{e.service}</td>
                    <td className="border border-slate-300 p-2 text-right">
                      {e.qty} × {formatPrintMoney(Number(e.ratePerUnit || 0))}
                    </td>
                    <td className="border border-slate-300 p-2 text-right font-bold">
                      {formatPrintMoney(getRowCommission(e))}
                    </td>
                    <td className="border border-slate-300 p-2 text-center">{e.payoutStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
