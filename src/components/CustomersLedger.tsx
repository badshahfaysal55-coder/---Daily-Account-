import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  ArrowUpRight, 
  ArrowDownRight, 
  Building, 
  Check, 
  Plus, 
  DollarSign,
  MessageCircle,
  Camera,
  Image as ImageIcon,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  Mail,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  Contact,
  Globe,
  Eye,
  Crop,
  Receipt,
  Printer,
  Sparkles,
  CreditCard,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Customer, UserAccount, Invoice, InvoicePayment, GlobalAppSettings, CurrencyCode } from '../types/accounting';
import { t, Language } from '../utils/translations';
import { formatCurrency, formatDateBangla, formatDateEn } from '../utils/formatters';
import { ApiService, isAppUnloading, isTransientFetchError } from '../services/api';
import { ImageCropModal } from './ImageCropModal';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { CustomerStatementModal } from './CustomerStatementModal';
import { PrintInvoiceModal } from './PrintInvoiceModal';
import { 
  normalizePhoneNumber, 
  formatDisplayPhone, 
  getWhatsAppUrl, 
  compressImageClientSide 
} from '../utils/phoneUtils';

interface CustomersLedgerProps {
  currentUser: UserAccount;
  globalSettings?: GlobalAppSettings;
  currentLang: Language;
  currency: CurrencyCode;
  useBanglaNumerals: boolean;
  customers?: Customer[];
  onCustomersUpdated?: () => void;
}

export const CustomersLedger: React.FC<CustomersLedgerProps> = ({
  currentUser,
  globalSettings = {
    appName: 'ZF Accounting',
    companyName: 'ZARA Group & Holdings Ltd.',
    version: '2.5.0-gold',
    currency: 'SAR',
    broadcastMessage: '',
    broadcastType: 'info',
    broadcastActive: true,
    updatedAt: Date.now(),
    lastUpdatedBy: 'Owner',
  },
  currentLang,
  currency,
  useBanglaNumerals,
  customers: initialCustomers = [],
  onCustomersUpdated,
}) => {
  const isBn = currentLang === 'bn';
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor'>('all');

  // Invoices & Billing State
  const [activeTabMode, setActiveTabMode] = useState<'directory' | 'invoices'>('directory');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'overpaid'>('all');

  // Modals for Invoices, Partial Payments, Statements & Print
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [invoicingCustomer, setInvoicingCustomer] = useState<Customer | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<Invoice | null>(null);

  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  const [showPrintInvoiceModal, setShowPrintInvoiceModal] = useState(false);
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<Invoice | null>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmCust, setDeleteConfirmCust] = useState<Customer | null>(null);

  // Form States (used for both Add & Edit)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<'customer' | 'vendor'>('customer');
  const [balance, setBalance] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  // Interactive Cropper Modal
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropModalInitialImage, setCropModalInitialImage] = useState<string | null>(null);

  // Form Submitting & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Contact Picker Support
  const [contactPickerSupported, setContactPickerSupported] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Check Contact Picker API on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setContactPickerSupported(true);
    }
  }, []);

  // Sync with prop when passed from App
  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      setCustomers(initialCustomers);
    } else {
      loadCustomers();
    }
  }, [initialCustomers]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const list = await ApiService.getCustomers();
      setCustomers(list);
    } catch (err: any) {
      if (!isAppUnloading() && !isTransientFetchError(err)) {
        console.error('Failed to load customers:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const data = await ApiService.getInvoices();
      setInvoices(data);
    } catch (err) {
      if (!isAppUnloading() && !isTransientFetchError(err)) {
        console.error('Failed to load invoices:', err);
      }
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();

    const unsubscribe = ApiService.subscribeToEvents((event, data) => {
      if (
        (event === 'connected' && !data?.reused) ||
        event.startsWith('customer_') ||
        event.startsWith('invoice_') ||
        event === 'transaction_deleted' ||
        event === 'user_updated' ||
        event === 'user_created' ||
        event === 'user_deleted' ||
        event === 'global_settings_updated' ||
        event === 'database_restored'
      ) {
        loadCustomers();
        loadInvoices();
      }
    });

    const handleFocusOrRecovery = () => {
      loadCustomers();
      loadInvoices();
    };
    window.addEventListener('focus', handleFocusOrRecovery);
    window.addEventListener('online', handleFocusOrRecovery);
    window.addEventListener('zara-vault-recovered', handleFocusOrRecovery);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocusOrRecovery);
      window.removeEventListener('online', handleFocusOrRecovery);
      window.removeEventListener('zara-vault-recovered', handleFocusOrRecovery);
    };
  }, []);

  const handleInvoiceCreated = (newInv: Invoice, updatedCust?: Customer) => {
    setInvoices((prev) => [newInv, ...prev]);
    if (updatedCust) {
      setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
      if (viewingCustomer && viewingCustomer.id === updatedCust.id) {
        setViewingCustomer(updatedCust);
      }
    }
    setToastMessage({
      text: isBn
        ? `ইনভয়েস #${newInv.invoiceNumber} সফলভাবে তৈরি ও সংরক্ষিত হয়েছে!`
        : `Invoice #${newInv.invoiceNumber} created and saved successfully!`,
      type: 'success',
    });
    if (onCustomersUpdated) onCustomersUpdated();
  };

  const handlePaymentRecorded = (res: {
    invoice: Invoice;
    payment: InvoicePayment;
    customer: Customer;
    isExcessCredit: boolean;
    creditAmount: number;
  }) => {
    setInvoices((prev) => prev.map((i) => (i.id === res.invoice.id ? res.invoice : i)));
    setCustomers((prev) => prev.map((c) => (c.id === res.customer.id ? res.customer : c)));
    if (viewingCustomer && viewingCustomer.id === res.customer.id) {
      setViewingCustomer(res.customer);
    }
    if (statementCustomer && statementCustomer.id === res.customer.id) {
      setStatementCustomer(res.customer);
    }

    const msg = res.isExcessCredit
      ? (isBn
          ? `পেমেন্ট সম্পন্ন! অতিরিক্ত ${formatCurrency(res.creditAmount, currency, useBanglaNumerals)} কাস্টমার ক্রেডিট (-${formatCurrency(res.creditAmount, currency, useBanglaNumerals)}) হিসেবে জমা হয়েছে।`
          : `Payment recorded! Excess ${formatCurrency(res.creditAmount, currency, useBanglaNumerals)} credited as advance balance (-${formatCurrency(res.creditAmount, currency, useBanglaNumerals)}).`)
      : (isBn
          ? `পেমেন্ট সফলভাবে জমা হয়েছে। অবশিষ্ট বকেয়া: ${formatCurrency(res.invoice.balanceDue, currency, useBanglaNumerals)}`
          : `Payment recorded successfully. Remaining balance: ${formatCurrency(res.invoice.balanceDue, currency, useBanglaNumerals)}`);

    setToastMessage({ text: msg, type: 'success' });
    if (onCustomersUpdated) onCustomersUpdated();
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm(isBn ? 'এই ইনভয়েস মুছে ফেলতে চান?' : 'Are you sure you want to delete this invoice?')) return;
    try {
      await ApiService.deleteInvoice(invoiceId);
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
      loadCustomers();
      setToastMessage({
        text: isBn ? 'ইনভয়েস সফলভাবে মুছে ফেলা হয়েছে' : 'Invoice deleted successfully',
        type: 'success',
      });
      if (onCustomersUpdated) onCustomersUpdated();
    } catch (err: any) {
      console.error('Failed to delete invoice:', err);
      setToastMessage({ text: err.message || 'Error deleting invoice', type: 'error' });
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setAddress('');
    setBusinessName('');
    setNotes('');
    setType('customer');
    setBalance('');
    setPhotoPreview(null);
    setPhotoBase64(null);
    setRemovePhoto(false);
    setFormError(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (c: Customer) => {
    resetForm();
    setEditingCustomer(c);
    setName(c.name || '');
    setPhone(c.phone || '');
    setWhatsapp(c.whatsapp || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setBusinessName(c.businessName || '');
    setNotes(c.notes || '');
    setType(c.type || 'customer');
    setBalance(c.balance !== undefined ? String(c.balance) : '0');
    setPhotoPreview(c.photoUrl || null);
  };

  // Handle Photo selection & interactive crop
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|gif|heic|heif|bmp|svg)$/i)) {
      setFormError('Please select a valid image file (JPG, PNG, WebP, GIF, or HEIC).');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setFormError('Failed to read image file. Please try another image.');
    };
    reader.onload = () => {
      setCropModalInitialImage(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImageCropped = (dataUrl: string) => {
    setPhotoPreview(dataUrl);
    setPhotoBase64(dataUrl);
    setRemovePhoto(false);
    setShowCropModal(false);
  };

  const openCropForExisting = () => {
    if (photoPreview) {
      setCropModalInitialImage(photoPreview);
      setShowCropModal(true);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setRemovePhoto(true);
  };

  // Native Contact Picker
  const handlePickContact = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts && contacts.length > 0) {
          const selected = contacts[0];
          const contactName = (selected.name && selected.name[0]) || '';
          let contactTel = (selected.tel && selected.tel[0]) || '';

          if (contactName && !name.trim()) {
            setName(contactName);
          }
          if (contactTel) {
            setPhone(contactTel.trim());
            if (!whatsapp.trim()) {
              setWhatsapp(contactTel.trim());
            }
          }
          setToastMessage({ text: 'Contact imported from phone successfully!', type: 'success' });
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Contact picker permission or error:', err);
          setToastMessage({
            text: 'Unable to access phone contacts. Please enter phone number manually.',
            type: 'error',
          });
        }
      }
    } else {
      // Fallback message for unsupported browsers (desktop, Safari)
      setToastMessage({
        text: 'Native phone contact picker is supported on Android Chrome. Please enter phone manually on this device.',
        type: 'error',
      });
    }
  };

  // Quick prefix toggles (+880 for BD, +966 for KSA)
  const applyPrefix = (prefix: '+880 ' | '+966 ') => {
    if (!phone.startsWith(prefix.trim())) {
      const digitsOnly = phone.replace(/[^0-9]/g, '');
      const stripped = digitsOnly.startsWith('880') 
        ? digitsOnly.slice(3) 
        : digitsOnly.startsWith('966') 
        ? digitsOnly.slice(3) 
        : digitsOnly;
      setPhone(`${prefix}${stripped}`);
    }
  };

  // Form Submission: Add Customer
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Customer or vendor name is required.');
      return;
    }

    // Client-side duplicate phone check
    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    if (cleanPhoneDigits && cleanPhoneDigits.length >= 7) {
      const duplicate = customers.find(
        (c) => c.phone.replace(/[^0-9]/g, '') === cleanPhoneDigits
      );
      if (duplicate) {
        setFormError(`Duplicate phone number! A record already exists with this phone: "${duplicate.name}".`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const newCustomer = await ApiService.createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: (whatsapp.trim() || phone.trim()) || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        businessName: businessName.trim() || undefined,
        notes: notes.trim() || undefined,
        type,
        balance: parseFloat(balance) || 0,
        photoBase64: photoBase64 || undefined,
      });

      // Update local state immediately
      setCustomers((prev) => [newCustomer, ...prev]);
      setShowAddModal(false);
      resetForm();
      setToastMessage({ 
        text: `Customer "${newCustomer.name}" added successfully!`, 
        type: 'success' 
      });

      // Notify parent to refresh Dashboard counts & global metrics
      if (onCustomersUpdated) onCustomersUpdated();
    } catch (err: any) {
      console.error('Error adding customer:', err);
      const msg = err.message || 'Failed to save customer. Please check database permissions or duplicate phone.';
      setFormError(msg);
      setToastMessage({ text: msg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Form Submission: Edit Customer
  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setFormError(null);

    if (!name.trim()) {
      setFormError('Customer or vendor name is required.');
      return;
    }

    // Client-side duplicate phone check against other customers
    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    if (cleanPhoneDigits && cleanPhoneDigits.length >= 7) {
      const duplicate = customers.find(
        (c) => c.id !== editingCustomer.id && c.phone.replace(/[^0-9]/g, '') === cleanPhoneDigits
      );
      if (duplicate) {
        setFormError(`Duplicate phone number! Another record already has this phone: "${duplicate.name}".`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const updated = await ApiService.updateCustomer(editingCustomer.id, {
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: (whatsapp.trim() || phone.trim()) || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        businessName: businessName.trim() || undefined,
        notes: notes.trim() || undefined,
        type,
        balance: parseFloat(balance) || 0,
        photoBase64: photoBase64 || undefined,
        removePhoto,
      });

      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (viewingCustomer && viewingCustomer.id === updated.id) {
        setViewingCustomer(updated);
      }
      setEditingCustomer(null);
      resetForm();
      setToastMessage({ 
        text: `Record for "${updated.name}" updated successfully!`, 
        type: 'success' 
      });

      if (onCustomersUpdated) onCustomersUpdated();
    } catch (err: any) {
      console.error('Error updating customer:', err);
      const msg = err.message || 'Failed to update customer record.';
      setFormError(msg);
      setToastMessage({ text: msg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!deleteConfirmCust) return;
    setIsSaving(true);
    try {
      await ApiService.deleteCustomer(deleteConfirmCust.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteConfirmCust.id));
      if (viewingCustomer?.id === deleteConfirmCust.id) {
        setViewingCustomer(null);
      }
      setToastMessage({ 
        text: `Customer "${deleteConfirmCust.name}" removed successfully.`, 
        type: 'success' 
      });
      setDeleteConfirmCust(null);
      if (onCustomersUpdated) onCustomersUpdated();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to delete customer.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered customer list
  const filtered = customers.filter((c) => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.whatsapp && c.whatsapp.includes(q)) ||
      (c.businessName && c.businessName.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  // Filtered invoices list
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerPhone && inv.customerPhone.includes(q))
    );
  });

  // Calculate customer totals
  const totalReceivables = customers
    .filter((c) => c.type === 'customer' && c.balance > 0)
    .reduce((sum, c) => sum + c.balance, 0);

  const totalPayables = customers
    .filter((c) => c.type === 'vendor' || c.balance < 0)
    .reduce((sum, c) => sum + Math.abs(c.balance), 0);

  // Calculate invoice totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalInvoicePaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalInvoiceDue = invoices
    .filter((inv) => inv.balanceDue > 0)
    .reduce((sum, inv) => sum + inv.balanceDue, 0);
  const totalInvoiceCredits = invoices
    .filter((inv) => inv.balanceDue < 0)
    .reduce((sum, inv) => sum + Math.abs(inv.balanceDue), 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-5 left-3 right-3 sm:left-5 sm:right-auto sm:max-w-md z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold transition-all transform animate-bounce-in border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-[#D4AF37] flex items-center justify-center shrink-0 border border-amber-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">
                  {isBn ? 'গ্রাহক ও ভেন্ডর লেজার' : 'Customers & Vendors CRM'}
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {customers.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isBn 
                  ? 'স্মার্ট যোগাযোগ, প্রোফাইল ফটো এবং সরাসরি হোয়াটসঅ্যাপ ইন্টিগ্রেশন' 
                  : 'Manage client accounts, contact picker, profile photos & instant WhatsApp'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => {
                setInvoicingCustomer(null);
                setShowCreateInvoiceModal(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md hover:scale-[1.02]"
            >
              <Receipt className="w-4 h-4 text-slate-950" />
              <span>{isBn ? '+ ইনভয়েস তৈরি' : '+ New Invoice'}</span>
            </button>
            <button
              onClick={openAddModal}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md hover:scale-[1.02]"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>{isBn ? 'নতুন গ্রাহক যোগ' : 'Add Customer'}</span>
            </button>
          </div>
        </div>

        {/* View Mode Switcher: Customers Directory vs Invoices & Billing */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTabMode('directory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTabMode === 'directory'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isBn ? `গ্রাহক ও খাতা (${customers.length})` : `Customers Directory (${customers.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTabMode('invoices')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTabMode === 'invoices'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{isBn ? `ইনভয়েস ও চালান (${invoices.length})` : `Invoices & Billing (${invoices.length})`}</span>
          </button>
        </div>

        {/* Financial Stat Cards */}
        {activeTabMode === 'directory' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {isBn ? 'মোট হিসাব সংখ্যা' : 'Total Accounts'}
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {customers.length}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({customers.filter((c) => c.type === 'customer').length} C / {customers.filter((c) => c.type === 'vendor').length} V)
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                  {isBn ? 'পাওনা বাকি (Receivable)' : 'Total Receivables'}
                </span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600 hidden sm:block" />
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatCurrency(totalReceivables, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 sm:p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold text-rose-800 dark:text-rose-400 uppercase tracking-wider block">
                  {isBn ? 'দেনা বাকি (Payable)' : 'Total Payables'}
                </span>
                <ArrowDownRight className="w-4 h-4 text-rose-600 hidden sm:block" />
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-xl font-black text-rose-700 dark:text-rose-400 font-mono">
                  {formatCurrency(totalPayables, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {isBn ? 'মোট ইনভয়েস মূল্য' : 'Total Invoiced'}
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                  {formatCurrency(totalInvoiced, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                {isBn ? 'আদায়কৃত পেমেন্ট' : 'Payments Collected'}
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatCurrency(totalInvoicePaid, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
              <span className="text-[10px] sm:text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
                {isBn ? 'অবশিষ্ট বকেয়া' : 'Remaining Due'}
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatCurrency(totalInvoiceDue, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40">
              <span className="text-[10px] sm:text-xs font-semibold text-cyan-800 dark:text-cyan-400 uppercase tracking-wider block">
                {isBn ? 'অতিরিক্ত ক্রেডিট' : 'Excess Credit'}
              </span>
              <div className="mt-1">
                <span className="text-base sm:text-xl font-black text-cyan-700 dark:text-cyan-400 font-mono">
                  -{formatCurrency(totalInvoiceCredits, currency, useBanglaNumerals)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTabMode === 'directory'
                  ? (isBn ? 'নাম, মোবাইল, হোয়াটসঅ্যাপ বা ব্যবসা দিয়ে খুঁজুন...' : 'Search by name, phone, WhatsApp, or business...')
                  : (isBn ? 'ইনভয়েস নম্বর, গ্রাহকের নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...' : 'Search by invoice #, customer name or phone...')
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {activeTabMode === 'directory' ? (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                {isBn ? 'সকল' : 'All'}
              </button>
              <button
                onClick={() => setFilterType('customer')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterType === 'customer'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                {isBn ? 'গ্রাহক' : 'Customers'}
              </button>
              <button
                onClick={() => setFilterType('vendor')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterType === 'vendor'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                {isBn ? 'ভেন্ডর' : 'Vendors'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold overflow-x-auto max-w-full">
              {(['all', 'unpaid', 'partial', 'paid', 'overpaid'] as const).map((st) => {
                const count = st === 'all' ? invoices.length : invoices.filter((i) => i.status === st).length;
                const labels: Record<string, { bn: string; en: string }> = {
                  all: { bn: 'সকল', en: 'All' },
                  unpaid: { bn: 'অপরিশোধিত', en: 'Unpaid' },
                  partial: { bn: 'আংশিক', en: 'Partial' },
                  paid: { bn: 'পরিশোধিত', en: 'Paid' },
                  overpaid: { bn: 'ক্রেডিট', en: 'Credit' },
                };
                return (
                  <button
                    key={st}
                    onClick={() => setInvoiceStatusFilter(st)}
                    className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap text-[11px] ${
                      invoiceStatusFilter === st
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    <span>{isBn ? labels[st].bn : labels[st].en}</span>
                    <span className="ml-1 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Customer List Container (Directory View) */}
      {activeTabMode === 'directory' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs">{isBn ? 'লোড হচ্ছে...' : 'Loading customer ledger...'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isBn ? 'কোনো গ্রাহক পাওয়া যায়নি' : 'No records found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {search 
                ? (isBn ? 'আপনার অনুসন্ধানের সাথে মিলছে এমন কোনো রেকর্ড নেই।' : 'No records matched your search query.')
                : (isBn ? 'নতুন কাস্টমার বা সরবরাহকারী যোগ করতে উপরের বোতামে চাপুন।' : 'Click "Add Customer" above to add your first client account.')}
            </p>
            {!search && (
              <button
                onClick={openAddModal}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'প্রথম গ্রাহক যোগ করুন' : 'Add First Customer'}</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View (sm and up) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">{isBn ? 'গ্রাহক / প্রতিষ্ঠান' : 'Customer / Business'}</th>
                    <th className="py-3 px-4">{isBn ? 'ধরন' : 'Type'}</th>
                    <th className="py-3 px-4">{isBn ? 'ফোন / যোগাযোগ' : 'Phone / Contact'}</th>
                    <th className="py-3 px-4 text-center">{isBn ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}</th>
                    <th className="py-3 px-4 text-right">{isBn ? 'বর্তমান ব্যালেন্স' : 'Current Balance'}</th>
                    <th className="py-3 px-4 text-right">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filtered.map((c) => {
                    const waUrl = getWhatsAppUrl(c.whatsapp || c.phone);
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* Name & Photo */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shadow-xs">
                              {c.photoUrl ? (
                                <img
                                  src={c.photoUrl}
                                  alt={c.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{c.name.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="truncate max-w-[200px]">
                              <button
                                onClick={() => setViewingCustomer(c)}
                                className="font-bold text-slate-900 dark:text-white text-xs hover:text-amber-600 dark:hover:text-amber-400 text-left truncate block cursor-pointer"
                              >
                                {c.name}
                              </button>
                              {c.businessName && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                                  <Building className="w-3 h-3 shrink-0" />
                                  {c.businessName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              c.type === 'customer'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300/40'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border border-blue-300/40'
                            }`}
                          >
                            {c.type === 'customer' ? 'Customer' : 'Vendor'}
                          </span>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4">
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone}`}
                              className="font-mono text-xs text-slate-700 dark:text-slate-300 hover:text-amber-600 flex items-center gap-1.5"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{formatDisplayPhone(c.phone)}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* WhatsApp Button */}
                        <td className="py-3.5 px-4 text-center">
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 hover:text-white transition cursor-pointer shadow-xs"
                              title={`Chat on WhatsApp with ${c.name}`}
                            >
                              <MessageCircle className="w-4 h-4 fill-current" />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Balance with negative credit support */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-mono font-bold text-xs ${
                              c.balance > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : c.balance < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {c.balance < 0
                              ? `Credit: -${formatCurrency(Math.abs(c.balance), currency, useBanglaNumerals)}`
                              : formatCurrency(c.balance, currency, useBanglaNumerals)}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-semibold">
                            {c.balance > 0
                              ? (isBn ? 'বকেয়া পাওনা' : 'Receivable')
                              : c.balance < 0
                              ? (isBn ? 'অগ্রিম ক্রেডিট' : 'Advance Credit')
                              : (isBn ? 'পরিশোধিত' : 'Settled')}
                          </span>
                        </td>

                        {/* Action buttons with Statement & Invoice creation */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => {
                                setStatementCustomer(c);
                                setShowStatementModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                              title="View Customer Statement"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              <span className="hidden xl:inline">{isBn ? 'স্টেটমেন্ট' : 'Statement'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setInvoicingCustomer(c);
                                setShowCreateInvoiceModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-slate-950 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                              title="Create Invoice for Customer"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">{isBn ? '+ চালান' : '+ Invoice'}</span>
                            </button>

                            <button
                              onClick={() => setViewingCustomer(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="View Customer Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                              title="Edit Customer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmCust(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (xs / under 640px) */}
            <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((c) => {
                const waUrl = getWhatsAppUrl(c.whatsapp || c.phone);
                return (
                  <div
                    key={c.id}
                    className="p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      {/* Photo & Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shadow-xs">
                          {c.photoUrl ? (
                            <img
                              src={c.photoUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{c.name.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => setViewingCustomer(c)}
                              className="font-bold text-slate-900 dark:text-white text-xs truncate text-left cursor-pointer"
                            >
                              {c.name}
                            </button>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                c.type === 'customer'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                              }`}
                            >
                              {c.type}
                            </span>
                          </div>
                          {c.businessName && (
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                              {c.businessName}
                            </span>
                          )}
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              <span>{formatDisplayPhone(c.phone)}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Balance on Mobile */}
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono font-bold text-xs ${
                            c.balance > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : c.balance < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {c.balance < 0
                            ? `Credit: -${formatCurrency(Math.abs(c.balance), currency, useBanglaNumerals)}`
                            : formatCurrency(c.balance, currency, useBanglaNumerals)}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-semibold">
                          {c.balance > 0
                            ? (isBn ? 'বকেয়া' : 'Receivable')
                            : c.balance < 0
                            ? (isBn ? 'অগ্রিম ক্রেডিট' : 'Advance Credit')
                            : (isBn ? 'পরিশোধিত' : 'Settled')}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar for Mobile: WhatsApp, Call, Statement, Invoice, Details */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white text-[11px] font-bold flex items-center gap-1 transition"
                          >
                            <MessageCircle className="w-3 h-3 fill-current" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setStatementCustomer(c);
                            setShowStatementModal(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1"
                          title="View Statement"
                        >
                          <FileText className="w-3 h-3 text-blue-500" />
                          <span>{isBn ? 'স্টেটমেন্ট' : 'Statement'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setInvoicingCustomer(c);
                            setShowCreateInvoiceModal(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-bold flex items-center gap-1"
                          title="Create Invoice"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>{isBn ? '+ চালান' : '+ Inv'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-slate-400 hover:text-amber-600"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmCust(c)}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Invoices & Billing Container */}
      {activeTabMode === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {invoicesLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-xs">{isBn ? 'ইনভয়েস লোড হচ্ছে...' : 'Loading invoices...'}</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
                <Receipt className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isBn ? 'কোনো ইনভয়েস পাওয়া যায়নি' : 'No invoices found'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {search
                  ? (isBn ? 'অনুসন্ধানের সাথে মিলছে এমন কোনো ইনভয়েস নেই।' : 'No invoices matched your search filter.')
                  : (isBn ? 'গ্রাহকদের জন্য নতুন চালান তৈরি করতে নিচের বোতাম চাপুন।' : 'Create an individual invoice with custom line items for your customer.')}
              </p>
              <button
                onClick={() => {
                  setInvoicingCustomer(null);
                  setShowCreateInvoiceModal(true);
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'নতুন ইনভয়েস তৈরি করুন' : 'Create New Invoice'}</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Desktop Invoices Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">{isBn ? 'ইনভয়েস নম্বর / তারিখ' : 'Invoice # / Date'}</th>
                      <th className="py-3 px-4">{isBn ? 'গ্রাহক' : 'Customer'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'মোট মূল্য' : 'Total Amount'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'পরিশোধিত' : 'Paid'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'বকেয়া / ক্রেডিট' : 'Balance Due / Credit'}</th>
                      <th className="py-3 px-4 text-center">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredInvoices.map((inv) => {
                      const matchedCust = customers.find((c) => c.id === inv.customerId);
                      const isOverpaid = inv.balanceDue < 0;
                      const isPaid = inv.balanceDue === 0;

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                <Receipt className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-mono font-bold text-slate-900 dark:text-white block">
                                  #{inv.invoiceNumber}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {isBn ? formatDateBangla(inv.date) : formatDateEn(inv.date)}
                                  {inv.dueDate ? ` · Due: ${isBn ? formatDateBangla(inv.dueDate) : formatDateEn(inv.dueDate)}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden">
                                {matchedCust?.photoUrl ? (
                                  <img src={matchedCust.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  inv.customerName.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <button
                                  onClick={() => {
                                    if (matchedCust) {
                                      setStatementCustomer(matchedCust);
                                      setShowStatementModal(true);
                                    }
                                  }}
                                  className="font-bold text-slate-800 dark:text-slate-200 hover:text-amber-500 text-left block cursor-pointer"
                                >
                                  {inv.customerName}
                                </button>
                                {inv.customerPhone && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {formatDisplayPhone(inv.customerPhone)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(inv.totalAmount, currency, useBanglaNumerals)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(inv.paidAmount, currency, useBanglaNumerals)}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isOverpaid ? (
                              <div>
                                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs">
                                  -{formatCurrency(Math.abs(inv.balanceDue), currency, useBanglaNumerals)}
                                </span>
                                <span className="text-[10px] text-cyan-600/80 block font-semibold">
                                  {isBn ? 'অগ্রিম ক্রেডিট' : 'Advance Credit'}
                                </span>
                              </div>
                            ) : isPaid ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                {formatCurrency(0, currency, useBanglaNumerals)}
                              </span>
                            ) : (
                              <div>
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                                  {formatCurrency(inv.balanceDue, currency, useBanglaNumerals)}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-semibold">
                                  {isBn ? 'বকেয়া' : 'Due'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : inv.status === 'partial'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : inv.status === 'overpaid'
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {inv.status === 'overpaid'
                                ? (isBn ? 'অতিরিক্ত ক্রেডিট' : 'Overpaid / Credit')
                                : inv.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Partial Payment button */}
                              <button
                                onClick={() => {
                                  setSelectedPaymentInvoice(inv);
                                  setShowPaymentModal(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-400 hover:text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                                title="Record Partial or Full Payment"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>{isBn ? '+ পেমেন্ট' : '+ Pay'}</span>
                              </button>

                              {/* Customer Statement */}
                              <button
                                onClick={() => {
                                  const c = customers.find((cust) => cust.id === inv.customerId);
                                  if (c) {
                                    setStatementCustomer(c);
                                    setShowStatementModal(true);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                                title="View Customer Statement"
                              >
                                <FileText className="w-3 h-3 text-blue-500" />
                                <span className="hidden xl:inline">{isBn ? 'স্টেটমেন্ট' : 'Statement'}</span>
                              </button>

                              {/* Print / PDF Graphic Invoice */}
                              <button
                                onClick={() => {
                                  setSelectedPrintInvoice(inv);
                                  setShowPrintInvoiceModal(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                                title="Print / Download PDF"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete invoice */}
                              <button
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Delete Invoice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Invoices Card View */}
              <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.map((inv) => {
                  const matchedCust = customers.find((c) => c.id === inv.customerId);
                  const isOverpaid = inv.balanceDue < 0;

                  return (
                    <div key={inv.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                              #{inv.invoiceNumber}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                                inv.status === 'paid'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : inv.status === 'partial'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : inv.status === 'overpaid'
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {isBn ? formatDateBangla(inv.date) : formatDateEn(inv.date)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs block">
                            {formatCurrency(inv.totalAmount, currency, useBanglaNumerals)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Total</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {inv.customerName}
                          </span>
                        </div>
                        <div className="text-right">
                          {isOverpaid ? (
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              Credit: -{formatCurrency(Math.abs(inv.balanceDue), currency, useBanglaNumerals)}
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                              Due: {formatCurrency(inv.balanceDue, currency, useBanglaNumerals)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedPaymentInvoice(inv);
                              setShowPaymentModal(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>+ Payment</span>
                          </button>
                          <button
                            onClick={() => {
                              const c = customers.find((cust) => cust.id === inv.customerId);
                              if (c) {
                                setStatementCustomer(c);
                                setShowStatementModal(true);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                          >
                            Statement
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedPrintInvoice(inv);
                              setShowPrintInvoiceModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-500 cursor-pointer"
                            title="Print"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file inputs for photo selection */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*,.heic,.heif"
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* ============================================================== */}
      {/* MODAL 1: ADD CUSTOMER MODAL                                    */}
      {/* ============================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative my-auto border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#D4AF37] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base font-heading">
                    {isBn ? 'নতুন কাস্টমার / ভেন্ডর যোগ করুন' : 'Add New Customer / Vendor'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isBn ? 'সঠিক তথ্য ও ছবি দিয়ে হিসাব সংরক্ষণ করুন' : 'Enter client contact details, photo & opening balance'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message inside form */}
            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewCustomer} className="mt-4 space-y-3.5 text-xs">
              {/* Photo Upload Section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-amber-400/60 flex items-center justify-center shrink-0 shadow-md">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Customer Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-1 -right-1 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700"
                      title="Remove Photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                    {isBn ? 'গ্রাহকের প্রোফাইল ছবি' : 'Customer Profile Photo'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 hover:border-amber-500 shadow-xs cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isBn ? 'গ্যালারি / ফাইল' : 'Gallery & Files'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 hover:border-amber-500 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isBn ? 'ক্যামেরা' : 'Take Photo'}</span>
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={openCropForExisting}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-semibold text-[11px] flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>{isBn ? 'ক্রপ ও জুম' : 'Crop & Zoom'}</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    JPG, PNG, WebP (auto-compressed)
                  </span>
                </div>
              </div>

              {/* Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'নাম *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. Rahim Ahmed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ধরন' : 'Account Type'}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="customer">Customer (গ্রাহক)</option>
                    <option value="vendor">Vendor (সরবরাহকারী)</option>
                  </select>
                </div>
              </div>

              {/* Phone with Native Contact Picker & Country Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    {isBn ? 'মোবাইল নম্বর' : 'Mobile Phone Number'}
                  </label>
                  {/* Country Presets */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => applyPrefix('+880 ')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 hover:text-amber-800 font-mono font-semibold"
                    >
                      BD (+880)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPrefix('+966 ')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 hover:text-amber-800 font-mono font-semibold"
                    >
                      KSA (+966)
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (!whatsapp.trim()) setWhatsapp(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="+880 1711-000000 / +966 50 123 4567"
                  />
                  <button
                    type="button"
                    onClick={handlePickContact}
                    className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    title="Select from phone contacts"
                  >
                    <Contact className="w-4 h-4" />
                    <span className="hidden sm:inline">{isBn ? 'কন্টাক্ট থেকে আনুন' : 'Select Contact'}</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Number */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                  <span>{isBn ? 'হোয়াটসঅ্যাপ নম্বর (ঐচ্ছিক)' : 'WhatsApp Number (Optional)'}</span>
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Defaults to phone number"
                />
              </div>

              {/* Business Name & Initial Balance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'প্রতিষ্ঠানের নাম' : 'Business / Company Name'}
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    placeholder="e.g. Zara Trading Ltd."
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'প্রারম্ভিক ব্যালেন্স' : 'Opening Balance'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                    placeholder="0.00 (+ for receivable, - for payable)"
                  />
                </div>
              </div>

              {/* Email & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ইমেইল' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    placeholder="client@example.com"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ঠিকানা' : 'Address / City'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    placeholder="Dhaka, Bangladesh / Riyadh, KSA"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নোট / বিবরণ' : 'Notes / Remarks'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white resize-none"
                  placeholder="Terms, delivery instructions, reference IDs..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving to Database...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Customer'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-200"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT CUSTOMER MODAL                                   */}
      {/* ============================================================== */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative my-auto border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#D4AF37] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base font-heading">
                    {isBn ? 'গ্রাহক তথ্য পরিবর্তন' : 'Edit Customer Record'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ID: {editingCustomer.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditCustomer} className="mt-4 space-y-3.5 text-xs">
              {/* Photo section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-amber-400/60 flex items-center justify-center shrink-0 shadow-md">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Customer Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Users className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-1 -right-1 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700"
                      title="Remove Photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                    {isBn ? 'প্রোফাইল ছবি পরিবর্তন' : 'Change Profile Photo'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 hover:border-amber-500 shadow-xs cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isBn ? 'গ্যালারি' : 'Choose Photo'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 hover:border-amber-500 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isBn ? 'ক্যামেরা' : 'Take Photo'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'নাম *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ধরন' : 'Account Type'}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ফোন নম্বর' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'হোয়াটসঅ্যাপ নম্বর' : 'WhatsApp'}
                  </label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Business Name & Balance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ব্যবসার নাম' : 'Business Name'}
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ব্যালেন্স' : 'Balance'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Email & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ইমেইল' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isBn ? 'ঠিকানা' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নোট' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isBn ? 'আপডেট হচ্ছে...' : 'Updating...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isBn ? 'আপডেট সম্পন্ন করুন' : 'Update Record'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-200"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: VIEW CUSTOMER PROFILE                                 */}
      {/* ============================================================== */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setViewingCustomer(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Avatar & Title */}
            <div className="text-center pt-2">
              <div className="w-24 h-24 rounded-full overflow-hidden mx-auto bg-slate-100 dark:bg-slate-800 border-4 border-amber-400 shadow-xl flex items-center justify-center text-2xl font-black text-slate-700 dark:text-slate-200">
                {viewingCustomer.photoUrl ? (
                  <img
                    src={viewingCustomer.photoUrl}
                    alt={viewingCustomer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{viewingCustomer.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-3 font-heading">
                {viewingCustomer.name}
              </h2>
              {viewingCustomer.businessName && (
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {viewingCustomer.businessName}
                </p>
              )}
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    viewingCustomer.type === 'customer'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {viewingCustomer.type === 'customer' ? 'Customer' : 'Vendor'}
                </span>
                <span
                  className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-full ${
                    viewingCustomer.balance > 0
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                      : viewingCustomer.balance < 0
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {viewingCustomer.balance < 0
                    ? `Credit: -${formatCurrency(Math.abs(viewingCustomer.balance), currency, useBanglaNumerals)} (Advance)`
                    : `${formatCurrency(viewingCustomer.balance, currency, useBanglaNumerals)} (${viewingCustomer.balance > 0 ? 'Due' : 'Settled'})`}
                </span>
              </div>
            </div>

            {/* Direct Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {getWhatsAppUrl(viewingCustomer.whatsapp || viewingCustomer.phone) ? (
                <a
                  href={getWhatsAppUrl(viewingCustomer.whatsapp || viewingCustomer.phone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>WhatsApp Chat</span>
                </a>
              ) : (
                <button
                  disabled
                  className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 opacity-60"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>No WhatsApp</span>
                </button>
              )}

              {viewingCustomer.phone ? (
                <a
                  href={`tel:${viewingCustomer.phone}`}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <Phone className="w-4 h-4" />
                  <span>Phone Call</span>
                </a>
              ) : (
                <button
                  disabled
                  className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 opacity-60"
                >
                  <Phone className="w-4 h-4" />
                  <span>No Phone</span>
                </button>
              )}
            </div>

            {/* Direct Invoicing & Statement Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <button
                onClick={() => {
                  setStatementCustomer(viewingCustomer);
                  setShowStatementModal(true);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span>{isBn ? 'সম্পূর্ণ স্টেটমেন্ট' : 'Account Statement'}</span>
              </button>

              <button
                onClick={() => {
                  setInvoicingCustomer(viewingCustomer);
                  setShowCreateInvoiceModal(true);
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-slate-950" />
                <span>{isBn ? '+ নতুন চালান তৈরি' : '+ Create Invoice'}</span>
              </button>
            </div>

            {/* Detailed Info List */}
            <div className="mt-5 space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              {viewingCustomer.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Phone:</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatDisplayPhone(viewingCustomer.phone)}
                  </span>
                </div>
              )}

              {viewingCustomer.whatsapp && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>WhatsApp:</span>
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatDisplayPhone(viewingCustomer.whatsapp)}
                  </span>
                </div>
              )}

              {viewingCustomer.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email:</span>
                  </span>
                  <a
                    href={`mailto:${viewingCustomer.email}`}
                    className="text-amber-600 hover:underline truncate max-w-[200px]"
                  >
                    {viewingCustomer.email}
                  </a>
                </div>
              )}

              {viewingCustomer.address && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Address:</span>
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 text-right">
                    {viewingCustomer.address}
                  </span>
                </div>
              )}

              {viewingCustomer.notes && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-400 block mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Notes:</span>
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 italic">
                    {viewingCustomer.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  openEditModal(viewingCustomer);
                  setViewingCustomer(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmCust(viewingCustomer);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: DELETE CONFIRMATION                                   */}
      {/* ============================================================== */}
      {deleteConfirmCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              {isBn ? 'গ্রাহক মুছে ফেলতে চান?' : 'Delete Customer Record?'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to remove <strong>"{deleteConfirmCust.name}"</strong>? This will also clean up associated profile photos.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteCustomer}
                disabled={isSaving}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Yes, Delete</span>
              </button>
              <button
                onClick={() => setDeleteConfirmCust(null)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Universal Image Cropper */}
      {showCropModal && (
        <ImageCropModal
          isOpen={showCropModal}
          onClose={() => setShowCropModal(false)}
          onImageCropped={handleImageCropped}
          initialImage={cropModalInitialImage}
          title={isBn ? 'গ্রাহকের ছবি এডিট ও ক্রপ করুন' : 'Crop & Position Customer Photo'}
          cropShape="round"
          aspectRatioPreset="1:1"
        />
      )}

      {/* 1. Create Individual Invoice Modal */}
      {showCreateInvoiceModal && (
        <CreateInvoiceModal
          isOpen={showCreateInvoiceModal}
          onClose={() => {
            setShowCreateInvoiceModal(false);
            setInvoicingCustomer(null);
          }}
          customers={customers}
          selectedCustomer={invoicingCustomer}
          currency={currency}
          useBanglaNumerals={useBanglaNumerals}
          isBn={isBn}
          onInvoiceCreated={handleInvoiceCreated}
        />
      )}

      {/* 2. Record Partial / Full Payment Modal with Excess Credit tracking */}
      {showPaymentModal && selectedPaymentInvoice && (
        <RecordPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPaymentInvoice(null);
          }}
          invoice={selectedPaymentInvoice}
          currency={currency}
          useBanglaNumerals={useBanglaNumerals}
          isBn={isBn}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}

      {/* 3. Complete Customer Account Statement Modal */}
      {showStatementModal && statementCustomer && (
        <CustomerStatementModal
          isOpen={showStatementModal}
          onClose={() => {
            setShowStatementModal(false);
            setStatementCustomer(null);
          }}
          customer={statementCustomer}
          globalSettings={globalSettings}
          currency={currency}
          useBanglaNumerals={useBanglaNumerals}
          isBn={isBn}
          onOpenCreateInvoice={(c) => {
            setShowStatementModal(false);
            setInvoicingCustomer(c);
            setShowCreateInvoiceModal(true);
          }}
          onOpenRecordPayment={(inv) => {
            setShowStatementModal(false);
            setSelectedPaymentInvoice(inv);
            setShowPaymentModal(true);
          }}
          onOpenPrintInvoice={(inv) => {
            setShowStatementModal(false);
            setSelectedPrintInvoice(inv);
            setShowPrintInvoiceModal(true);
          }}
        />
      )}

      {/* 4. Graphic Print / PDF Invoice Modal */}
      {showPrintInvoiceModal && selectedPrintInvoice && (
        <PrintInvoiceModal
          isOpen={showPrintInvoiceModal}
          onClose={() => {
            setShowPrintInvoiceModal(false);
            setSelectedPrintInvoice(null);
          }}
          invoice={selectedPrintInvoice}
          globalSettings={globalSettings}
          currency={currency}
          useBanglaNumerals={useBanglaNumerals}
          isBn={isBn}
        />
      )}
    </div>
  );
};
