import React from 'react';

interface ZaraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const ZaraLogo: React.FC<ZaraLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-18 h-18',
    xl: 'w-24 h-24',
  };

  const roundedMap = {
    sm: 'rounded-xl',
    md: 'rounded-2xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  };

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      <div
        className={`relative ${sizeMap[size]} shrink-0 ${roundedMap[size]} overflow-hidden bg-white p-0.5 shadow-lg shadow-black/30 transition-transform duration-200 hover:scale-[1.03] border border-slate-200/40 dark:border-white/20`}
      >
        <img
          src="/assets/aistudio/WhatsApp_Image_2026-11-06_at_9.38.17_AM_2058b80b.jpeg"
          alt="ZARA Brand Logo"
          className="w-full h-full object-cover object-center rounded-[inherit]"
          loading="eager"
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white text-xl tracking-tight font-heading">
              ZARA
            </span>
            <span className="text-[10px] font-bold tracking-widest text-[#D4AF37] bg-white/5 border border-[#D4AF37]/30 px-2 py-0.5 rounded uppercase">
              Corporate
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Financial Management System
          </span>
        </div>
      )}
    </div>
  );
};

