import React from 'react';
import { AxisLogo } from './AxisLogo';

export { AxisLogo };

/**
 * Compatibility alias redirecting to Axis Logo
 */
export const DERParanaLogo: React.FC<{ className?: string }> = ({ className = 'h-8' }) => (
  <AxisLogo className={className} variant="report" />
);

/**
 * Axis Consulting secondary brand signature
 */
export const ConsortiumLogos: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col items-end leading-none text-right ${className}`}>
    <span className="text-[9px] font-extrabold text-slate-800 tracking-tight">AXIS CONSULTORIA</span>
    <span className="text-[6.5px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Gestão e Supervisão de Obras</span>
  </div>
);
