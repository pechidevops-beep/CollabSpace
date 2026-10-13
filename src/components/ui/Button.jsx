import React, { forwardRef, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary:
    'bg-accent text-on-accent border border-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] hover:brightness-105 active:scale-[0.98]',
  secondary:
    'bg-black/5 hover:bg-black/8 dark:bg-white/6 dark:hover:bg-white/10 text-text-main border-0 active:scale-[0.98]',
  outline:
    'bg-black/5 hover:bg-black/8 dark:bg-white/6 dark:hover:bg-white/10 text-text-main border-0 active:scale-[0.98]',
  ghost:
    'bg-transparent text-text-sub hover:text-text-main hover:bg-black/5 dark:hover:bg-white/6 border-0 active:scale-[0.98]',
  danger:
    'bg-semantic-danger text-white hover:opacity-90 border border-transparent active:scale-[0.98]',
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-xs font-medium gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-sm font-medium gap-2.5 rounded-[12px]',
  icon: 'h-10 w-10 p-0 rounded-[10px]',
  'icon-sm': 'h-8 w-8 p-0 rounded-[10px]',
};

export const Button = forwardRef(function Button(
  {
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon: Icon,
    iconRight: IconRight,
    type = 'button',
    magnetic = false,
    ...props
  },
  forwardedRef
) {
  const innerRef = useRef(null);
  const ref = forwardedRef || innerRef;
  const isDisabled = disabled || loading;

  const handleMouseMove = (e) => {
    if (!magnetic || isDisabled || typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Max 6px magnetic pull
    const clampedX = Math.max(-6, Math.min(6, x * 0.15));
    const clampedY = Math.max(-6, Math.min(6, y * 0.15));
    btn.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
  };

  const handleMouseLeave = () => {
    if (!magnetic || typeof window === 'undefined') return;
    const btn = ref.current;
    if (btn) {
      btn.style.transform = '';
    }
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
        disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:hover:translate-y-0 disabled:hover:brightness-100
        ${variantClasses[variant] || variantClasses.primary}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin text-current shrink-0" size={size === 'sm' ? 13 : 15} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />
      ) : null}

      {children}

      {!loading && IconRight && (
        <IconRight size={size === 'sm' ? 14 : 16} className="shrink-0" />
      )}
    </button>
  );
});

export default Button;
