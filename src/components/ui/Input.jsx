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
          className={`w-full h-9 rounded-md bg-subtle border text-text-main text-xs px-3 transition-colors
            placeholder:text-text-dim
            hover:border-border-strong
            focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${Icon ? 'pl-9' : ''}
            ${error ? 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20' : 'border-border-dim'}
            ${inputClassName}`}
          {...props}
        />
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
        className={`w-full rounded-md bg-subtle border text-text-main text-xs p-3 transition-colors resize-y
          placeholder:text-text-dim
          hover:border-border-strong
          focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-semantic-danger focus:border-semantic-danger focus:ring-semantic-danger/20' : 'border-border-dim'}
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

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-text-main">
          {label}
          {required && <span className="text-semantic-danger ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        required={required}
        className={`w-full h-9 rounded-md bg-subtle border border-border-dim text-text-main text-xs px-3 transition-colors
          hover:border-border-strong focus:bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20
          disabled:opacity-50 disabled:cursor-not-allowed ${selectClassName}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-[11px] text-semantic-danger font-medium">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
