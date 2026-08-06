import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  success: () => {},
  error: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((message: string, title?: string) => {
    showToast(message, 'success', title || 'تم بنجاح');
  }, [showToast]);

  const error = useCallback((message: string, title?: string) => {
    showToast(message, 'error', title || 'خطأ');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start p-4 rounded-xl shadow-lg border transition-all duration-300 transform translate-y-0 ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100 backdrop-blur-md'
                : toast.type === 'error'
                ? 'bg-rose-900/90 border-rose-700 text-rose-100 backdrop-blur-md'
                : 'bg-slate-900/90 border-slate-700 text-slate-100 backdrop-blur-md'
            }`}
          >
            <div className="me-3 flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-400" />}
              {toast.type === 'info' && <Info className="h-5 w-5 text-sky-400" />}
            </div>
            <div className="flex-1 text-sm">
              {toast.title && <h4 className="font-semibold mb-0.5">{toast.title}</h4>}
              <p className="leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ms-2 text-slate-300 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
