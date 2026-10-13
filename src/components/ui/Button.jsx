import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary:
    'bg-brand text-brand-fg hover:bg-brand-hover shadow-subtle border border-transparent focus-visible:ring-brand',
  secondary:
    'bg-subtle text-text-main hover:bg-surface border border-border-dim hover:border-border-strong focus-visible:ring-brand',
  outline:
    'bg-transparent text-text-main border border-border-strong hover:bg-subtle focus-visible:ring-brand',
  ghost:
    'bg-transparent text-text-sub hover:text-text-main hover:bg-subtle border border-transparent focus-visible:ring-brand',
  danger:
    'bg-semantic-danger text-white hover:opacity-90 border border-transparent focus-visible:ring-semantic-danger',
};

const sizeClasses = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-[8px]',
  md: 'h-10 px-4 text-xs font-medium gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-sm font-medium gap-2.5 rounded-[12px]',
  icon: 'h-10 w-10 p-0 rounded-[10px] justify-center',
  'icon-sm': 'h-8 w-8 p-0 rounded-[8px] justify-center',
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
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-150 select-none
        active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
        ${variantClasses[variant] || variantClasses.primary}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin text-current" size={size === 'sm' ? 13 : 15} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />
      ) : null}

      {children && <span>{children}</span>}

      {!loading && IconRight && (
        <IconRight size={size === 'sm' ? 14 : 16} className="shrink-0" />
      )}
    </button>
  );
});

export default Button;
