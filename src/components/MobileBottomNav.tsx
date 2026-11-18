import React from 'react';
import { LayoutDashboard, PlusCircle, FileSpreadsheet, ShoppingBag, Users, Menu } from 'lucide-react';
import { NavTabId } from './Sidebar';
import { Language } from '../utils/translations';
import { UserAccount } from '../types/accounting';
import { getUserPagePermissions } from '../utils/permissions';

interface MobileBottomNavProps {
  activeTab: NavTabId;
  setActiveTab: (tab: NavTabId) => void;
  onOpenMobileMenu: () => void;
  currentLang: Language;
  currentUser: UserAccount;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  currentLang,
  currentUser,
}) => {
  const isBn = currentLang === 'bn';
  const perms = getUserPagePermissions(currentUser);
  const isBazarExclusiveEntry = perms.canAccessBazar && !perms.canAccessInvoices && !perms.canAccessQuickCash;

  const items: Array<{ id: NavTabId; label: string; icon: any; isPrimary?: boolean }> = [];

  if (perms.canAccessDashboard) {
    items.push({
      id: 'dashboard',
      label: isBn ? 'ড্যাশবোর্ড' : 'Dashboard',
      icon: LayoutDashboard,
    });
  }

  if (perms.canAccessCommission && !perms.canAccessDashboard) {
    items.push({
      id: 'commission',
      label: isBn ? 'কমিশন' : 'Commission',
      icon: FileSpreadsheet,
      isPrimary: !perms.canAccessEntry,
    });
  }

  if (perms.canAccessEntry) {
    items.push({
      id: 'entry',
      label: isBazarExclusiveEntry ? (isBn ? 'বাজার' : 'Bazar') : (isBn ? 'এন্ট্রি' : 'Entry'),
      icon: isBazarExclusiveEntry ? ShoppingBag : PlusCircle,
      isPrimary: true,
    });
  }

  if (perms.canAccessCustomers) {
    items.push({
      id: 'customers',
      label: isBn ? 'গ্রাহক' : 'Customers',
      icon: Users,
    });
  }

  return (
    <nav
      style={{
        backgroundColor: 'var(--theme-primary)',
        borderColor: 'var(--theme-accent-border)',
      }}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t shadow-2xl safe-area-bottom safe-area-x"
    >
      <div className="flex items-center justify-around px-1.5 py-1.5 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center -mt-4 cursor-pointer focus:outline-none min-w-[56px]"
              >
                <div
                  style={{ backgroundColor: 'var(--theme-accent)' }}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 text-slate-950 ${
                    isActive
                      ? 'ring-4 ring-black/40'
                      : 'ring-2 ring-white/30'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-bold mt-1 leading-none" style={{ color: 'var(--theme-accent)' }}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={isActive ? { color: 'var(--theme-accent)' } : undefined}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 px-2.5 rounded-xl transition-colors cursor-pointer active:scale-95 ${
                isActive ? '' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Hamburger Menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center min-h-[44px] py-1 px-2.5 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium leading-none">{isBn ? 'মেনু' : 'Menu'}</span>
        </button>
      </div>
    </nav>
  );
};
