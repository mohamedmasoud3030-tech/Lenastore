import React from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  level?: 'h2' | 'h3' | 'h4';
  className?: string;
  bordered?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  icon,
  actions,
  level = 'h3',
  className = '',
  bordered = true,
}) => {
  const borderStyle = bordered
    ? 'pb-3.5 border-b border-slate-100 dark:border-slate-800'
    : '';

  const HeadingTag = level;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${borderStyle} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <HeadingTag className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </HeadingTag>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
