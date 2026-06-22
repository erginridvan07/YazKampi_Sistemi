import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

const toneClasses = {
  default: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary-100 text-primary-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-800',
}

export function Badge({ className, tone = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
