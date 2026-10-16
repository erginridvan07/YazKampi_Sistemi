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
        <label
          htmlFor={id}
          className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300"
        >
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={id}
        className={cn(
          'h-11 w-full max-w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800',
          'focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:[color-scheme:dark]',
          'dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30',
          error &&
            'border-rose-300 focus:border-rose-400 focus:ring-rose-100 dark:border-rose-500/50 dark:focus:border-rose-400 dark:focus:ring-rose-500/25',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  ),
)

Select.displayName = 'Select'
