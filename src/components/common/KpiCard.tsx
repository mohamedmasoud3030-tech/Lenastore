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
    default: 'border-slate-200 bg-white text-slate-900',
    success: 'border-emerald-200 bg-emerald-50/50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50/50 text-amber-950',
    danger: 'border-rose-200 bg-rose-50/50 text-rose-950',
    info: 'border-sky-200 bg-sky-50/50 text-sky-950',
  };

  const iconStyles = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-sky-100 text-sky-700',
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-xs transition-all ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</span>
        {icon && <div className={`p-2 rounded-xl ${iconStyles[variant]}`}>{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
};
