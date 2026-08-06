import React from 'react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'لا توجد بيانات مسجلة',
  description = 'لم نجد أي سجلات مطابقة للطلب الحالي.',
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
      <div className="p-4 bg-slate-100 rounded-2xl text-slate-500 mb-4">
        {icon || <PackageOpen className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};
