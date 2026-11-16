import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          let Icon = Info;
          let borderStyle = 'border-[#1c1c1e]/15 dark:border-white/15';
          let iconColor = 'text-[#1c1c1e] dark:text-[#f5f5f7]';

          if (t.type === 'success') {
            Icon = CheckCircle2;
            borderStyle = 'border-emerald-500/30';
            iconColor = 'text-emerald-600 dark:text-emerald-400';
          } else if (t.type === 'error') {
            Icon = AlertCircle;
            borderStyle = 'border-red-500/30';
            iconColor = 'text-red-600 dark:text-red-400';
          } else if (t.type === 'warning') {
            Icon = AlertTriangle;
            borderStyle = 'border-amber-500/30';
            iconColor = 'text-amber-600 dark:text-amber-400';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl bg-[#fcfcfb] dark:bg-[#1c1c1e] text-[#1c1c1e] dark:text-[#f5f5f7] border ${borderStyle} shadow-lg shadow-black/10 dark:shadow-black/40 text-xs transition-all`}
            >
              <div className="flex items-center space-x-2.5 pr-2">
                <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                <span className="font-medium leading-relaxed">{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-md text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] hover:bg-[#1c1c1e]/5 dark:hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      success: (msg) => console.log('[Toast success]', msg),
      error: (msg) => console.error('[Toast error]', msg),
      info: (msg) => console.info('[Toast info]', msg),
      warning: (msg) => console.warn('[Toast warning]', msg),
    };
  }
  return context;
}
