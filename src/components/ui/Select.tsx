import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => (
    <div className="space-y-2">
      {label ? (
        <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-primary-700">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={id}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800',
          'focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100',
          error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  ),
)

Select.displayName = 'Select'
