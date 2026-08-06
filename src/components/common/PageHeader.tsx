import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  onBack?: () => void;
  backTo?: string;
  badge?: React.ReactNode;
  icon?: React.ElementType | React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  action,
  onBack,
  backTo,
  badge,
  icon,
}) => {
  const navigate = useNavigate();
  const pageActions = actions || action;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  const showBackButton = Boolean(onBack || backTo);

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/30">
          {icon}
        </span>
      );
    }
    const IconComp = icon as React.ElementType;
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/30">
        <IconComp size={20} />
      </span>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 print:hidden transition-colors">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        {showBackButton && (
          <button
            type="button"
            onClick={handleBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="رجوع"
            aria-label="رجوع"
          >
            <ArrowRight size={18} />
          </button>
        )}

        {renderIcon()}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {pageActions && <div className="flex items-center gap-2.5 flex-wrap shrink-0">{pageActions}</div>}
    </div>
  );
};

