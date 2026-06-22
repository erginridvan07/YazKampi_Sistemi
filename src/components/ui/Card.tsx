import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'none'
}

const accentClasses = {
  primary: 'border-t-4 border-t-primary-600',
  success: 'border-t-4 border-t-emerald-500',
  warning: 'border-t-4 border-t-amber-500',
  danger: 'border-t-4 border-t-rose-500',
  none: '',
}

export function Card({ className, accent = 'none', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/40',
        accentClasses[accent],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-bold text-slate-900 dark:text-slate-100', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-slate-500 dark:text-slate-400', className)} {...props}>
      {children}
    </p>
  )
}
