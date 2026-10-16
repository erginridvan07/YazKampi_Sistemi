import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-2">
      {label ? (
        <label
          htmlFor={id}
          className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300"
        >
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800',
          'placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500',
          'dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30',
          error &&
            'border-rose-300 focus:border-rose-400 focus:ring-rose-100 dark:border-rose-500/50 dark:focus:border-rose-400 dark:focus:ring-rose-500/25',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  ),
)

Textarea.displayName = 'Textarea'
