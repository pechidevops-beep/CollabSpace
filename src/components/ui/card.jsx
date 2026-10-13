import React, { forwardRef } from 'react';

export const Card = forwardRef(function Card(
  {
    children,
    className = '',
    interactive = false,
    hoverLift = false,
    ...props
  },
  ref
) {
  const liftClasses = hoverLift || interactive
    ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated hover:border-border-strong cursor-pointer'
    : '';

  return (
    <div
      ref={ref}
      className={`rounded-lg bg-surface border border-border-dim shadow-card overflow-hidden text-text-main ${liftClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardHeader = forwardRef(function CardHeader(
  { children, className = '', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`flex flex-col space-y-1 p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardTitle = forwardRef(function CardTitle(
  { children, className = '', ...props },
  ref
) {
  return (
    <h3
      ref={ref}
      className={`text-base font-semibold text-text-main tracking-tight leading-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
});

export const CardDescription = forwardRef(function CardDescription(
  { children, className = '', ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={`text-xs text-text-sub leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
});

export const CardContent = forwardRef(function CardContent(
  { children, className = '', ...props },
  ref
) {
  return (
    <div ref={ref} className={`p-5 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
});

export const CardFooter = forwardRef(function CardFooter(
  { children, className = '', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`flex items-center p-5 pt-0 border-t border-border-dim/50 mt-4 text-xs text-text-sub ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

export default Card;
