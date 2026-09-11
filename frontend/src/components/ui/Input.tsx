import { useId, forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from './cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { 'aria-describedby': ariaDescribedBy, className, error, hint, id, label, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="ui-input-field">
      {label ? (
        <label className="ui-input-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn('ui-input', error && 'ui-input--error', className)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : props['aria-invalid']}
        {...props}
      />
      {hint ? (
        <span className="ui-input-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="ui-input-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
})
