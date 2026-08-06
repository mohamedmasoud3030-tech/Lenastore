import { Boxes, Building2 } from 'lucide-react';
import clsx from 'clsx';
import BRAND from '../config/brand';

interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export default function BrandMark({ compact = false, inverse = false, className }: BrandMarkProps) {
  return (
    <div className={clsx('flex min-w-0 items-center gap-3', className)} aria-label={BRAND.fullName}>
      <div
        className={clsx(
          'relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-sm',
          inverse
            ? 'border-white/15 bg-white/10 text-amber-300'
            : 'border-slate-200 bg-slate-950 text-amber-300'
        )}
        aria-hidden="true"
      >
        <Building2 size={22} strokeWidth={1.9} />
        <span
          className={clsx(
            'absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-md bg-amber-400 text-slate-950 ring-2',
            inverse ? 'ring-slate-950' : 'ring-white'
          )}
        >
          <Boxes size={11} strokeWidth={2.5} />
        </span>
      </div>

      {!compact && (
        <div className="min-w-0 leading-tight">
          <p
            className={clsx(
              'truncate text-base font-black tracking-[0.08em]',
              inverse ? 'text-white' : 'text-slate-950'
            )}
          >
            {BRAND.masterName} <span className={inverse ? 'text-amber-300' : 'text-sky-700'}>{BRAND.productName}</span>
          </p>
          <p className={clsx('mt-1 truncate text-[11px] font-semibold', inverse ? 'text-slate-300' : 'text-slate-500')}>
            {BRAND.arabicName}
          </p>
        </div>
      )}
    </div>
  );
}
