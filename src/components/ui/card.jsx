import React, { forwardRef, useRef } from 'react';

export const Card = forwardRef(function Card(
  {
    children,
    className = '',
    interactive = false,
    spotlight = false,
    hoverLift = false,
    ...props
  },
  forwardedRef
) {
  const innerRef = useRef(null);
  const ref = forwardedRef || innerRef;

  const handleMouseMove = (e) => {
    if (!spotlight && !interactive) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const card = ref.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);
  };

  const liftClasses = (hoverLift || interactive)
    ? 'transition-all duration-150 hover:-translate-y-[1px] hover:border-border-strong cursor-pointer'
    : '';

  const spotlightClasses = (spotlight || interactive) ? 'spotlight-card' : '';

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`card-signature text-text-main relative ${spotlightClasses} ${liftClasses} ${className}`}
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

export const CardRow = forwardRef(function CardRow(
  { children, className = '', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`card-row flex items-center justify-between p-3 text-xs text-text-main transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

export default Card;
