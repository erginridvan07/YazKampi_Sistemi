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
        <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-primary-700">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800',
          'placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100',
          error && 'border-rose-300',
          className,
        )}
        {...props}
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  ),
)

Textarea.displayName = 'Textarea'
