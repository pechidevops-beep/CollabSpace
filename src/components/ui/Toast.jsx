import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, RotateCw } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  danger: AlertCircle,
  info: Info,
};

const badgeStyles = {
  success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  danger: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  info: 'text-semantic-info bg-semantic-info/10 border-semantic-info/20',
};

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-4"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info;
          const style = badgeStyles[toast.type] || badgeStyles.info;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border border-border-subtle bg-surface text-text-main shadow-card backdrop-blur-md"
              role="alert"
            >
              <div className={`p-1.5 rounded-md border flex-shrink-0 ${style}`}>
                <Icon size={16} />
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-xs font-semibold tracking-tight text-text-main">
                  {toast.title}
                </div>
                {toast.message && (
                  <p className="text-xs text-text-sub mt-0.5 leading-relaxed">
                    {toast.message}
                  </p>
                )}
                {toast.action && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        toast.action.onClick?.();
                        onDismiss(toast.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover active:scale-95 transition-transform"
                    >
                      <RotateCw size={12} />
                      {toast.action.label || 'Retry'}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-text-dim hover:text-text-main p-1 rounded-md transition-colors"
                aria-label="Close notification"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
