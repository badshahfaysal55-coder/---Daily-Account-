import React, { useId } from 'react';

interface ZaraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const ZaraLogo: React.FC<ZaraLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const zGradId = `zf-z-grad-${uid}`;
  const fGradId = `zf-f-grad-${uid}`;
  const slashGradId = `zf-slash-grad-${uid}`;
  const frameGradId = `zf-frame-grad-${uid}`;
  const tileBgId = `zf-tile-bg-${uid}`;
  const depthShadowId = `zf-depth-${uid}`;

  const sizeMap = {
    xs: 'w-9 h-9',
    sm: 'w-9 h-9 sm:w-11 sm:h-11',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-22 h-22',
  };

  const roundedMap = {
    xs: 'rounded-xl',
    sm: 'rounded-2xl',
    md: 'rounded-2xl',
    lg: 'rounded-[20px]',
    xl: 'rounded-3xl',
  };

  const displayClass = className.includes('hidden') ? '' : 'inline-flex ';

  return (
    <div className={`${displayClass}items-center gap-3.5 select-none ${className}`}>
      <div className={`relative ${sizeMap[size]} shrink-0 group`}>
        {/* Soft 3D Ambient Multi-Tone Glow Halo */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1 ${roundedMap[size]} bg-gradient-to-tr from-rose-500/45 via-amber-400/45 to-emerald-400/45 blur-md opacity-85 group-hover:opacity-100 transition-opacity duration-300`}
        />

        {/* Raised 3D Ceramic & Glass Tile */}
        <div
          className={`relative w-full h-full ${roundedMap[size]} overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-200 p-[2px] shadow-[0_10px_24px_-4px_rgba(0,0,0,0.65),0_0_16px_rgba(212,175,55,0.34),inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-3px_6px_rgba(15,23,42,0.18)] ring-1 ring-white/75 transition-transform duration-200 group-hover:scale-[1.04]`}
        >
          {/* Crisp Vector 3D ZF Emblem */}
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full block rounded-[inherit]"
            role="img"
            aria-label="ZARA ZF Brand Logo"
          >
            <defs>
              <linearGradient id={tileBgId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="60%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </linearGradient>

              <linearGradient id={frameGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>

              <linearGradient id={zGradId} x1="15%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="45%" stopColor="#B91C1C" />
                <stop offset="100%" stopColor="#7F1D1D" />
              </linearGradient>

              <linearGradient id={fGradId} x1="15%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#27272A" />
                <stop offset="100%" stopColor="#09090B" />
              </linearGradient>

              <linearGradient id={slashGradId} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#991B1B" />
                <stop offset="50%" stopColor="#DC2626" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>

              <filter id={depthShadowId} x="-15%" y="-15%" width="135%" height="135%">
                <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.32" />
              </filter>
            </defs>

            {/* Clean Pearlescent Background */}
            <rect x="0" y="0" width="120" height="120" rx="26" fill={`url(#${tileBgId})`} />

            {/* Subtle Inner Bevel Frame */}
            <rect
              x="7"
              y="7"
              width="106"
              height="106"
              rx="22"
              fill="none"
              stroke={`url(#${frameGradId})`}
              strokeWidth="4.5"
              opacity="0.92"
            />

            {/* 3D Embossed Z Letter (Left-Top) */}
            <g filter={`url(#${depthShadowId})`}>
              <path
                d="M27 28 H64 C68.5 28 70.5 33 67.2 36.8 L41.5 64 H53 L43.5 74 H27.5 C22.5 74 20.5 68.5 24 64.5 L49.5 37.5 H27 C24.2 37.5 22 35.4 22 32.75 C22 30.1 24.2 28 27 28 Z"
                fill={`url(#${zGradId})`}
              />
              {/* Top Specular Edge on Z */}
              <path
                d="M27 29.2 H63.5"
                stroke="#FCA5A5"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.65"
              />
            </g>

            {/* Precision 3D Diagonal Razor Slash */}
            <g filter={`url(#${depthShadowId})`}>
              <polygon
                points="28,93 90,26 93,29 33,95"
                fill={`url(#${slashGradId})`}
              />
              <polygon
                points="35,96 92,33 94,35 41,97"
                fill="#1E293B"
                opacity="0.9"
              />
            </g>

            {/* 3D Embossed F Letter (Right-Bottom) */}
            <g filter={`url(#${depthShadowId})`}>
              <path
                d="M71 48 H94 C96.8 48 99 50.1 99 52.8 C99 55.5 96.8 57.6 94 57.6 H72.5 V65.5 H90.5 C93.2 65.5 95.4 67.6 95.4 70.2 C95.4 72.8 93.2 74.9 90.5 74.9 H72.5 V88.5 C72.5 91.5 70.1 93.8 67.1 93.8 C64.1 93.8 61.7 91.5 61.7 88.5 V58.5 L71 48 Z"
                fill={`url(#${fGradId})`}
              />
              {/* Highlight Rim on F */}
              <path
                d="M71.5 49.3 H93.5"
                stroke="#94A3B8"
                strokeWidth="1.1"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            {/* Subtle Top Gloss Sheen */}
            <path
              d="M8 28 C8 16 16 8 28 8 H92 C104 8 112 16 112 28 V42 C86 30 36 32 8 46 Z"
              fill="#FFFFFF"
              opacity="0.28"
            />
          </svg>
        </div>
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
