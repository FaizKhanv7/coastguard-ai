import React from 'react';

export function Badge({ 
  children, 
  variant = 'default', 
  className = '' 
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'cyan'; 
  className?: string;
}) {
  const styles = {
    default: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
    danger: 'bg-rose-950/70 text-rose-300 border-rose-700/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
    warning: 'bg-amber-950/70 text-amber-300 border-amber-700/50',
    success: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ 
  children, 
  className = '', 
  glow = false 
}: { 
  children: React.ReactNode; 
  className?: string; 
  glow?: boolean;
}) {
  return (
    <div className={`hud-panel rounded-xl border border-cyan-500/20 shadow-xl ${glow ? 'hud-panel-glow' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  icon?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-mono font-semibold transition-all duration-200 rounded-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  
  const sizes = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-xs px-3.5 py-2',
    lg: 'text-sm px-5 py-2.5',
  };

  const variants = {
    primary: 'bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.35)] hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] border border-cyan-300/40',
    secondary: 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/40',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.3)] border border-rose-400/30',
    ghost: 'hover:bg-cyan-950/40 text-cyan-400 hover:text-cyan-300 border border-transparent hover:border-cyan-800/50',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {icon && <i className={`${icon}`} />}
      {children}
    </button>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  color = 'cyan',
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  color?: 'cyan' | 'rose' | 'amber' | 'emerald';
  icon?: string;
}) {
  const colorMap = {
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-950/20',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
  };

  return (
    <div className={`p-3 rounded-lg border backdrop-blur-md ${colorMap[color]} flex flex-col justify-between`}>
      <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase opacity-75">
        <span>{label}</span>
        {icon && <i className={icon} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl md:text-2xl font-bold font-mono tracking-tight text-white">{value}</span>
        {unit && <span className="text-xs font-mono text-slate-400">{unit}</span>}
      </div>
      {trend && (
        <div className="mt-1 text-[10px] font-mono text-slate-400">
          {trend}
        </div>
      )}
    </div>
  );
}
