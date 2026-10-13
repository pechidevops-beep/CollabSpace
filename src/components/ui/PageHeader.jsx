import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  children,
  className = '',
}) {
  return (
    <header className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 ${className}`}>
      <div className="space-y-1">
        <h1 className="text-[28px] sm:text-[32px] font-semibold text-text-main tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-text-sub leading-normal">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5 sm:self-center shrink-0">
          {children}
        </div>
      )}
    </header>
  );
}
