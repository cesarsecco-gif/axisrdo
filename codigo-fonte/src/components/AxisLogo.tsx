import React from 'react';

export const AxisLogo: React.FC<{ className?: string; variant?: 'full' | 'icon' | 'report' }> = ({
  className = 'h-8',
  variant = 'full'
}) => {
  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg viewBox="0 0 40 40" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="#0f172a" />
          <path d="M20 7L31 29H24.5L20 19L15.5 29H9L20 7Z" fill="url(#axis-icon-grad)" />
          <path d="M14 24H26L27.5 27H12.5L14 24Z" fill="#38bdf8" />
          <circle cx="20" cy="19" r="2.5" fill="#38bdf8" />
          <defs>
            <linearGradient id="axis-icon-grad" x1="9" y1="7" x2="31" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  if (variant === 'report') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-9 h-9 shrink-0">
          <svg viewBox="0 0 40 40" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="6" fill="#0f172a" />
            <path d="M20 7L31 29H24.5L20 19L15.5 29H9L20 7Z" fill="url(#axis-rep-grad)" />
            <path d="M14 24H26L27.5 27H12.5L14 24Z" fill="#38bdf8" />
            <circle cx="20" cy="19" r="2.5" fill="#38bdf8" />
            <defs>
              <linearGradient id="axis-rep-grad" x1="9" y1="7" x2="31" y2="29" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="1" stopColor="#0284c7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1">
            <span className="text-sm font-black tracking-tight text-slate-900">AXIS</span>
            <span className="text-[10px] font-bold bg-sky-700 text-white px-1 py-0.5 rounded-xs tracking-wider">RDO</span>
          </div>
          <span className="text-[6.5px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            Consultoria e Planejamento
          </span>
        </div>
      </div>
    );
  }

  // default 'full' (dark sidebar / header)
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="w-8 h-8 shrink-0">
        <svg viewBox="0 0 40 40" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="#0f172a" />
          <path d="M20 7L31 29H24.5L20 19L15.5 29H9L20 7Z" fill="url(#axis-full-grad)" />
          <path d="M14 24H26L27.5 27H12.5L14 24Z" fill="#38bdf8" />
          <circle cx="20" cy="19" r="2.5" fill="#38bdf8" />
          <defs>
            <linearGradient id="axis-full-grad" x1="9" y1="7" x2="31" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-black tracking-tight text-white">AXIS</span>
          <span className="text-[11px] font-extrabold bg-sky-500 text-slate-950 px-1.5 py-0.5 rounded tracking-wider">RDO</span>
        </div>
        <span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
          Consultoria e Planejamento
        </span>
      </div>
    </div>
  );
};
