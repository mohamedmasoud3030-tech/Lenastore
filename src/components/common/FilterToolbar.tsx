import React from 'react';
import { Search, X, LayoutGrid, List, Table } from 'lucide-react';

export type ViewMode = 'grid' | 'list' | 'table';

export interface FilterToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  availableModes?: ViewMode[];
  className?: string;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  filters,
  actions,
  viewMode,
  onViewModeChange,
  availableModes = ['grid', 'list'],
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-colors ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pr-10 pl-9 py-2 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {filters && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {filters}
          </div>
        )}
      </div>

      {(actions || (viewMode && onViewModeChange)) && (
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
          {actions && <div className="flex items-center gap-2">{actions}</div>}

          {viewMode && onViewModeChange && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/50">
              {availableModes.includes('grid') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="عرض شبكي"
                  aria-label="عرض شبكي"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              )}
              {availableModes.includes('list') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('list')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="عرض قائمة"
                  aria-label="عرض قائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              )}
              {availableModes.includes('table') && (
                <button
                  type="button"
                  onClick={() => onViewModeChange('table')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="عرض جدول"
                  aria-label="عرض جدول"
                >
                  <Table className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
