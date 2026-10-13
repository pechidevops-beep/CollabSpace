import React, { forwardRef, useId } from 'react';

export const Input = forwardRef(function Input(
  {
    label,
    helperText,
    error,
    id: customId,
    className = '',
    inputClassName = '',
    type = 'text',
    required = false,
    icon: Icon,
    rightElement,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = customId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-text-main flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-semantic-danger ml-0.5">*</span>}
          </span>
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-text-dim pointer-events-none flex items-center">
            <Icon size={15} />
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          required={required}
          className={`w-full h-10 rounded-[10px] bg-black/[.03] dark:bg-white/5 border text-text-main text-xs px-3 transition-colors
            placeholder:text-text-dim
            hover:border-border-strong
            focus:bg-surface focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${Icon ? 'pl-9' : ''}
            ${rightElement ? 'pr-9' : ''}
            ${error ? 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20' : 'border-border-subtle'}
            ${inputClassName}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p id={errorId} className="text-[11px] text-semantic-danger font-medium animate-fadeIn">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[11px] text-text-dim">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  {
    label,
    helperText,
    error,
    id: customId,
    className = '',
    textareaClassName = '',
    required = false,
    rows = 3,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = customId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-text-main flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-semantic-danger ml-0.5">*</span>}
          </span>
        </label>
      )}

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        required={required}
        className={`w-full rounded-[10px] bg-black/[.03] dark:bg-white/5 border text-text-main text-xs p-3 transition-colors resize-y
          placeholder:text-text-dim
          hover:border-border-strong
          focus:bg-surface focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20' : 'border-border-subtle'}
          ${textareaClassName}`}
        {...props}
      />

      {error ? (
        <p id={errorId} className="text-[11px] text-semantic-danger font-medium animate-fadeIn">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[11px] text-text-dim">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export const Select = forwardRef(function Select(
  {
    label,
    helperText,
    error,
    id: customId,
    className = '',
    selectClassName = '',
    children,
    required = false,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = customId || generatedId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-text-main flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-semantic-danger ml-0.5">*</span>}
          </span>
        </label>
      )}

      <select
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        required={required}
        className={`w-full h-10 rounded-[10px] bg-black/[.03] dark:bg-white/5 border text-text-main text-xs px-3 transition-colors
          hover:border-border-strong
          focus:bg-surface focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20' : 'border-border-subtle'}
          ${selectClassName}`}
        {...props}
      >
        {children}
      </select>

      {error ? (
        <p id={errorId} className="text-[11px] text-semantic-danger font-medium animate-fadeIn">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[11px] text-text-dim">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
