import { Building2, Boxes3 } from 'lucide-react';
import clsx from 'clsx';

interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export default function BrandMark({ compact = false, inverse = false, className }: BrandMarkProps) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div
        className={clsx(
          'relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-sm',
          inverse
            ? 'border-white/15 bg-white/10 text-amber-300'
            : 'border-slate-200 bg-slate-950 text-amber-300'
        )}
      >
        <Building2 size={22} strokeWidth={1.9} />
        <span className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-md bg-amber-400 text-slate-950 ring-2 ring-white">
          <Boxes3 size={11} strokeWidth={2.5} />
        </span>
      </div>

      {!compact && (
        <div className="min-w-0">
          <p className={clsx('text-base font-extrabold tracking-tight', inverse ? 'text-white' : 'text-slate-950')}>
            مشروعي
          </p>
          <p className={clsx('text-[11px] font-semibold', inverse ? 'text-slate-300' : 'text-slate-500')}>
            إدارة المواد والمشتريات
          </p>
        </div>
      )}
    </div>
  );
}
