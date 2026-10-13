/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core design tokens with RGB channel opacity support
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        subtle: 'rgb(var(--color-subtle) / <alpha-value>)',

        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          fg: 'rgb(var(--color-accent-fg) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          ring: 'rgb(var(--color-ring) / <alpha-value>)',
        },

        'text-main': 'rgb(var(--color-text) / <alpha-value>)',
        'text-sub': 'rgb(var(--color-text-sub) / <alpha-value>)',
        'text-dim': 'rgb(var(--color-text-dim) / <alpha-value>)',

        'border-dim': 'rgba(var(--color-border), var(--border-opacity, 0.08))',
        'border-strong': 'rgba(var(--color-border), 0.16)',

        semantic: {
          success: 'rgb(var(--color-success) / <alpha-value>)',
          danger: 'rgb(var(--color-danger) / <alpha-value>)',
          warning: 'rgb(var(--color-warning) / <alpha-value>)',
          info: 'rgb(var(--color-info) / <alpha-value>)',
        },

        // Legacy HSL mappings for unmigrated components
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Legacy Slate for compatibility
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#0b0b0c',
        },
        brand: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: 'rgb(var(--color-accent) / <alpha-value>)',
          600: 'rgb(var(--color-accent) / <alpha-value>)',
          700: '#0071e3',
          800: '#005bb5',
          900: '#004488',
          950: '#0b0b0c',
        },
      },
      borderRadius: {
        control: 'var(--radius-control, 10px)',
        panel: 'var(--radius-panel, 14px)',
        DEFAULT: '10px',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        full: '9999px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.15)',
        neon: '0 0 10px rgba(var(--color-accent), 0.4)',
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 4px 16px -2px rgba(0, 0, 0, 0.08)',
        elevated: '0 16px 36px -4px rgba(0, 0, 0, 0.16)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Consolas',
          'Monaco',
          'monospace',
        ],
      },
      animation: {
        blob: 'blob 7s infinite',
        'fade-in': 'fadeIn 0.18s ease-out forwards',
        'slide-up': 'slideUp 0.18s ease-out forwards',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
