import React from 'react';

export interface CardContainerProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'muted' | 'accent' | 'danger';
  hoverable?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CardContainer: React.FC<CardContainerProps> = ({
  children,
  title,
  subtitle,
  headerActions,
  icon,
  footer,
  padding = 'md',
  variant = 'default',
  hoverable = false,
  className = '',
  onClick,
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
  };

  const variantStyles = {
    default:
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100',
    muted:
      'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200',
    accent:
      'bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/80 dark:border-sky-800/50 text-slate-900 dark:text-slate-100',
    danger:
      'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/50 text-slate-900 dark:text-slate-100',
  };

  const hoverStyle = hoverable
    ? 'hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-xs transition-all cursor-pointer'
    : '';

  const hasHeader = Boolean(title || subtitle || icon || headerActions);

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border shadow-2xs transition-colors ${variantStyles[variant]} ${hoverStyle} ${className}`}
    >
      {hasHeader && (
        <div
          className={`flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 ${
            padding === 'none' ? 'p-4 sm:p-5' : paddingStyles[padding]
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerActions && <div className="shrink-0">{headerActions}</div>}
        </div>
      )}

      <div className={padding === 'none' ? '' : paddingStyles[padding]}>
        {children}
      </div>

      {footer && (
        <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
};
