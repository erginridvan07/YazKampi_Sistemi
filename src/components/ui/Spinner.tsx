import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label = 'Yükleniyor...' }: SpinnerProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10 text-slate-500 dark:text-slate-400',
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}
