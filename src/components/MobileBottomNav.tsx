import React from 'react';
import { LayoutDashboard, PlusCircle, BookOpen, Users, Menu } from 'lucide-react';
import { NavTabId } from './Sidebar';
import { Language } from '../utils/translations';

interface MobileBottomNavProps {
  activeTab: NavTabId;
  setActiveTab: (tab: NavTabId) => void;
  onOpenMobileMenu: () => void;
  currentLang: Language;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu,
  currentLang,
}) => {
  const isBn = currentLang === 'bn';

  const items = [
    {
      id: 'dashboard' as NavTabId,
      label: isBn ? 'ড্যাশবোর্ড' : 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'entry' as NavTabId,
      label: isBn ? 'এন্ট্রি' : 'Entry',
      icon: PlusCircle,
      isPrimary: true,
    },
    {
      id: 'customers' as NavTabId,
      label: isBn ? 'গ্রাহক' : 'Customers',
      icon: Users,
    },
  ];

  return (
    <nav
      style={{
        backgroundColor: 'var(--theme-primary)',
        borderColor: 'var(--theme-accent-border)',
      }}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t shadow-2xl safe-area-bottom"
    >
      <div className="flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center -mt-5 cursor-pointer focus:outline-none"
              >
                <div
                  style={{ backgroundColor: 'var(--theme-accent)' }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 text-slate-950 ${
                    isActive
                      ? 'ring-4 ring-black/40'
                      : 'ring-2 ring-white/30'
                  }`}
                >
                  <Icon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-bold mt-1" style={{ color: 'var(--theme-accent)' }}>
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
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                isActive ? '' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Hamburger Menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center py-1 px-3 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{isBn ? 'মেনু' : 'Menu'}</span>
        </button>
      </div>
    </nav>
  );
};
