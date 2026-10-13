import React from 'react';

const badgeVariants = {
  default: 'bg-black/5 dark:bg-white/6 text-text-sub border-border-subtle',
  accent: 'bg-accent/10 text-accent border-accent/20 font-semibold',
  success: 'bg-semantic-success/10 text-semantic-success border-semantic-success/20',
  danger: 'bg-semantic-danger/10 text-semantic-danger border-semantic-danger/20',
  warning: 'bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20',
  info: 'bg-semantic-info/10 text-semantic-info border-semantic-info/20',
  outline: 'bg-transparent text-text-sub border-border-subtle',
};

const badgeSizes = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border leading-none select-none ${badgeVariants[variant] || badgeVariants.default} ${badgeSizes[size] || badgeSizes.md} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            variant === 'accent'
              ? 'bg-accent'
              : variant === 'success'
              ? 'bg-semantic-success'
              : variant === 'danger'
              ? 'bg-semantic-danger'
              : variant === 'warning'
              ? 'bg-semantic-warning'
              : variant === 'info'
              ? 'bg-semantic-info'
              : 'bg-text-dim'
          }`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
