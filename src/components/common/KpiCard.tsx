import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
    success: 'border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100',
    warning: 'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100',
    danger: 'border-rose-200/80 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100',
    info: 'border-sky-200/80 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/30 text-sky-950 dark:text-sky-100',
  };

  const iconStyles = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    success: 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300',
    danger: 'bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300',
    info: 'bg-sky-100 dark:bg-sky-900/80 text-sky-700 dark:text-sky-300',
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs transition-all ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{title}</span>
        {icon && <div className={`p-2 rounded-xl shrink-0 ${iconStyles[variant]}`}>{icon}</div>}
      </div>
      <div className="mt-2 text-xl sm:text-2xl font-black tracking-tight">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
    </div>
  );
};
