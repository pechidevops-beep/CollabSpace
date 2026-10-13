import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/ui/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, type = 'info', duration = 4500, action = null }) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, title, message, type, duration, action };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (message, options = {}) =>
      addToast({ type: 'success', message, title: options.title || 'Success', ...options }),
    error: (message, options = {}) =>
      addToast({
        type: 'danger',
        message: typeof message === 'string' && message.includes('Failed to fetch')
          ? 'Unable to connect to the network. Please verify your connection.'
          : message,
        title: options.title || 'Something went wrong',
        duration: options.duration || 6000,
        ...options,
      }),
    info: (message, options = {}) =>
      addToast({ type: 'info', message, title: options.title || 'Notice', ...options }),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
