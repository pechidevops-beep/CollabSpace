import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  side = 'right',
  width = 'max-w-lg',
  className = '',
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const motionVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    },
  };

  const sidePlacement = {
    right: 'inset-y-0 right-0 h-full border-l',
    left: 'inset-y-0 left-0 h-full border-r',
    bottom: 'inset-x-0 bottom-0 max-h-[85vh] border-t rounded-t-2xl',
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Slide-over Panel */}
          <motion.div
            variants={motionVariants[side] || motionVariants.right}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'sheet-title' : undefined}
            className={`fixed ${sidePlacement[side] || sidePlacement.right} w-full ${width} bg-surface border-border-dim shadow-elevated flex flex-col z-10 ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-dim">
              <div>
                {title && (
                  <h3 id="sheet-title" className="text-base font-semibold text-text-main tracking-tight">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-text-sub mt-1 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-text-dim hover:text-text-main p-1.5 rounded-md hover:bg-subtle transition-colors"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default Sheet;
