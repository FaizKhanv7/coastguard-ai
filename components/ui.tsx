import React from "react";

export function Badge({
  children,
  variant = "cyan",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "cyan" | "emerald" | "amber" | "rose" | "slate";
  className?: string;
}) {
  const variantStyles = {
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    slate: "bg-slate-700/30 text-slate-300 border-slate-600/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border font-mono tracking-wide ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}) {
  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-1.5 text-sm",
    lg: "px-5 py-2.5 text-base font-semibold",
  };

  const variantStyles = {
    primary:
      "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 border border-cyan-400/40 active:scale-[0.98]",
    secondary:
      "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/40 active:scale-[0.98]",
    danger:
      "bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-400/40 active:scale-[0.98]",
    ghost:
      "bg-transparent hover:bg-slate-800/50 text-slate-300 active:scale-[0.98]",
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  color = "text-cyan-400",
}: {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">{label}</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-xl font-bold font-mono ${color}`}>{value}</span>
        {unit && <span className="text-xs text-slate-400 font-mono">{unit}</span>}
      </div>
      {trend && <span className="text-[10px] text-slate-400 mt-1 font-mono">{trend}</span>}
    </div>
  );
}
