import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  FolderGit2,
  Settings,
  Sun,
  Moon,
  LogOut,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const actions = [
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      label: 'Go to Dashboard',
      icon: LayoutDashboard,
      shortcut: 'G D',
      perform: () => navigate('/app/dashboard'),
    },
    {
      id: 'nav-workspaces',
      category: 'Navigation',
      label: 'Browse Workspaces',
      icon: FolderGit2,
      shortcut: 'G W',
      perform: () => navigate('/app/workspaces'),
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      label: 'Open Settings',
      icon: Settings,
      shortcut: 'G S',
      perform: () => navigate('/app/settings'),
    },
    {
      id: 'action-theme',
      category: 'Preferences',
      label: `Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`,
      icon: resolvedTheme === 'dark' ? Sun : Moon,
      shortcut: 'T',
      perform: () => toggleTheme(),
    },
    {
      id: 'action-logout',
      category: 'Account',
      label: 'Sign Out',
      icon: LogOut,
      shortcut: '⇧ ⌥ Q',
      perform: async () => {
        try {
          await signOut();
          navigate('/');
        } catch {
          // ignore
        }
      },
    },
  ];

  const filtered = actions.filter((action) =>
    action.label.toLowerCase().includes(query.toLowerCase()) ||
    action.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].perform();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Palette Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-xl rounded-lg bg-surface border border-border-dim shadow-elevated overflow-hidden z-10 text-text-main"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-dim bg-subtle/40">
              <Search size={16} className="text-text-dim shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="w-full bg-transparent text-sm text-text-main placeholder:text-text-dim outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-text-dim bg-subtle border border-border-dim rounded">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-dim">
                  No commands found matching "{query}"
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filtered.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          item.perform();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs transition-colors text-left
                          ${isSelected ? 'bg-brand text-brand-fg' : 'text-text-main hover:bg-subtle'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={15} className={isSelected ? 'text-brand-fg' : 'text-text-dim'} />
                          <span className="font-medium">{item.label}</span>
                          <span className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-brand-fg/70' : 'text-text-dim'}`}>
                            {item.category}
                          </span>
                        </div>
                        {item.shortcut && (
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-brand-fg/80' : 'text-text-dim'}`}>
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Help */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border-dim bg-subtle/50 text-[11px] text-text-dim">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border-dim font-mono">↑</kbd>
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border-dim font-mono">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border-dim font-mono">↵</kbd>
                  to select
                </span>
              </div>
              <span>CollabSpace</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Prevent opening when focus is inside Monaco Editor
        const isMonaco =
          e.target &&
          (e.target.closest?.('.monaco-editor') ||
            e.target.closest?.('.monaco-mouse-cursor-text') ||
            e.target.classList?.contains('inputarea'));

        if (isMonaco) {
          return;
        }

        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

export function CommandPaletteTrigger({ onClick, className = '' }) {
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-between h-9 px-3 rounded-[10px] bg-subtle border border-border-dim text-text-sub hover:text-text-main hover:border-border-strong text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      aria-label="Open command palette"
    >
      <span className="flex items-center gap-2">
        <Search size={14} className="text-text-dim" />
        <span>Search or command...</span>
      </span>
      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-text-dim bg-surface border border-border-dim rounded">
        {isMac ? '⌘K' : 'Ctrl+K'}
      </kbd>
    </button>
  );
}

export default CommandPalette;
