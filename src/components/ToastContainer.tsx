import React from 'react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  const colorClasses: Record<ToastMessage['type'], string> = {
    success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200',
    error: 'bg-rose-950/95 border-rose-500/50 text-rose-200',
    info: 'bg-slate-900/95 border-slate-700 text-slate-200'
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold backdrop-blur-md transition-all duration-300 ${
            colorClasses[toast.type] || colorClasses.info
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};
