import React from 'react';

export function Skeleton({ className = '', variant = 'rect', ...props }) {
  const variantStyles = {
    rect: 'rounded-md',
    circle: 'rounded-full',
    text: 'h-4 rounded-sm w-3/4',
  };

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-subtle border border-border-subtle ${variantStyles[variant] || variantStyles.rect} ${className}`}
      {...props}
    />
  );
}

export default Skeleton;
