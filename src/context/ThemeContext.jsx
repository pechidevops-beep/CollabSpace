import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  resolvedTheme: 'dark',
  accent: 'theme-blue',
  setTheme: () => {},
  toggleTheme: () => {},
  setAccent: () => {},
});

const STORAGE_KEY_THEME = 'collabspace-theme';
const STORAGE_KEY_ACCENT = 'collabspace-accent';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_THEME);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [accent, setAccentState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACCENT);
      if (stored === 'theme-blue' || stored === 'theme-mint' || stored === 'theme-amber') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'theme-blue';
  });

  const [resolvedTheme, setResolvedTheme] = useState('dark');

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      let active = theme;
      if (theme === 'system') {
        active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      setResolvedTheme(active);

      if (active === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }

      root.classList.remove('theme-blue', 'theme-mint', 'theme-amber');
      root.classList.add(accent);
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, accent]);

  const setTheme = (newTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, newTheme);
    } catch {
      // ignore
    }
    setThemeState(newTheme);
  };

  const setAccent = (newAccent) => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, newAccent);
    } catch {
      // ignore
    }
    setAccentState(newAccent);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, accent, setTheme, toggleTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
