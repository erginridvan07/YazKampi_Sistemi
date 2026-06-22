import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-2">
      {label ? (
        <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-primary-700">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800',
          'placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100',
          error && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  ),
)

Input.displayName = 'Input'
