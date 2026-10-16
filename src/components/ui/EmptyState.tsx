import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/40',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500 dark:shadow-none">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h4>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
