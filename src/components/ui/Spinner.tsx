import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label = 'Yükleniyor...' }: SpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-slate-500', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}
