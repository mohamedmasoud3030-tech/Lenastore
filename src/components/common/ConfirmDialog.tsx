import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const confirmBtnStyles = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200">
          <div className="bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 rounded-xl text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 ${confirmBtnStyles[variant]}`}
            >
              {loading ? 'جاري التنفيذ...' : confirmLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
