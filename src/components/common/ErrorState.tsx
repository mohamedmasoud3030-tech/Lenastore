import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'عذرًا، حدث خطأ أثناء تحميل البيانات',
  message = 'يرجى التحقق من الاتصال بالشبكة وإعادة المحاولة.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
      <div className="p-3 bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300 rounded-2xl mb-3">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-rose-950 dark:text-rose-100">{title}</h3>
      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </button>
      )}
    </div>
  );
};
