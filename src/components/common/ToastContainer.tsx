import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-4 right-4 sm:left-auto sm:right-5 z-[80] flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isInfo = toast.type === 'info';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-xl ${
                isError
                  ? 'bg-rose-950/90 border-rose-800 text-rose-100 shadow-rose-950/40'
                  : isInfo
                  ? 'bg-surface/95 border-sky-500/40 text-sky-100 shadow-sky-950/30'
                  : 'bg-surface-2/95 border-emerald-500/40 text-white shadow-black/40'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isError ? (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                ) : isInfo ? (
                  <Info className="w-5 h-5 text-sky-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-relaxed">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
