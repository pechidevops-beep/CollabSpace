import React from 'react';

const badgeVariants = {
  default: 'bg-subtle text-text-sub border-border-dim',
  accent: 'bg-accent/15 text-accent border-accent/25 font-semibold',
  success: 'bg-semantic-success/15 text-semantic-success border-semantic-success/25',
  danger: 'bg-semantic-danger/15 text-semantic-danger border-semantic-danger/25',
  warning: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/25',
  info: 'bg-semantic-info/15 text-semantic-info border-semantic-info/25',
  outline: 'bg-transparent text-text-sub border-border-dim',
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
