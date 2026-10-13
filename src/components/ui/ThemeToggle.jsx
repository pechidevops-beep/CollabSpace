import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle({ className = '', size = 'md' }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`relative inline-flex items-center justify-center rounded-[10px] bg-black/5 dark:bg-white/6 hover:bg-black/8 dark:hover:bg-white/10 text-text-sub hover:text-text-main transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
      } ${className}`}
    >
      <motion.div
        key={resolvedTheme}
        initial={{ rotate: -40, opacity: 0, scale: 0.8 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 40, opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-center justify-center"
      >
        {isDark ? <Sun size={size === 'sm' ? 14 : 16} /> : <Moon size={size === 'sm' ? 14 : 16} />}
      </motion.div>
    </button>
  );
}

export default ThemeToggle;
