import React from 'react';

type BadgeVariant =
  | 'draft'
  | 'requested'
  | 'purchasing'
  | 'purchased'
  | 'cancelled'
  | 'normal'
  | 'urgent'
  | 'unreceived'
  | 'partial'
  | 'full'
  | 'unpaid'
  | 'paid'
  | 'in'
  | 'out'
  | 'available'
  | 'low'
  | 'out_of_stock';

interface StatusBadgeProps {
  variant: BadgeVariant | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label, size = 'md' }) => {
  const v = variant.toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  let defaultText = label || variant;

  if (v === 'draft') {
    styles = 'bg-slate-100 text-slate-700 border-slate-300';
    defaultText = label || 'مسودة';
  } else if (v === 'requested') {
    styles = 'bg-sky-100 text-sky-800 border-sky-200';
    defaultText = label || 'مطلوب';
  } else if (v === 'purchasing') {
    styles = 'bg-purple-100 text-purple-800 border-purple-200';
    defaultText = label || 'قيد الشراء';
  } else if (v === 'purchased') {
    styles = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    defaultText = label || 'تم الشراء';
  } else if (v === 'cancelled') {
    styles = 'bg-rose-100 text-rose-800 border-rose-200';
    defaultText = label || 'ملغى';
  } else if (v === 'normal') {
    styles = 'bg-slate-100 text-slate-700 border-slate-200';
    defaultText = label || 'عادي';
  } else if (v === 'urgent') {
    styles = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    defaultText = label || 'عاجل';
  } else if (v === 'unreceived' || v === 'unpaid') {
    styles = 'bg-amber-100 text-amber-800 border-amber-200';
    defaultText = label || (v === 'unreceived' ? 'غير مستلم' : 'غير مدفوع');
  } else if (v === 'partial') {
    styles = 'bg-sky-100 text-sky-800 border-sky-200';
    defaultText = label || 'جزئي';
  } else if (v === 'full' || v === 'paid' || v === 'available') {
    styles = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    defaultText = label || (v === 'full' ? 'مستلم بالكامل' : v === 'paid' ? 'مدفوع' : 'متوفر');
  } else if (v === 'in') {
    styles = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold';
    defaultText = label || 'وارد (+)';
  } else if (v === 'out') {
    styles = 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
    defaultText = label || 'صرف (-)';
  } else if (v === 'low') {
    styles = 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
    defaultText = label || 'منخفض';
  } else if (v === 'out_of_stock') {
    styles = 'bg-rose-100 text-rose-800 border-rose-200 font-semibold';
    defaultText = label || 'نافد';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full border ${padding} font-medium ${styles}`}>
      {defaultText}
    </span>
  );
};
