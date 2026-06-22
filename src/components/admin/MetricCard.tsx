import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: 'emerald' | 'indigo' | 'amber' | 'rose' | 'sky'
}

const toneMap = {
  emerald: 'from-emerald-500 to-emerald-600',
  indigo: 'from-primary-500 to-primary-700',
  amber: 'from-amber-500 to-amber-600',
  rose: 'from-rose-500 to-rose-600',
  sky: 'from-sky-500 to-sky-600',
}

export function MetricCard({ label, value, icon: Icon, tone = 'indigo' }: MetricCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg',
        toneMap[tone],
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-90">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
      <Icon className="absolute -right-2 -bottom-2 h-20 w-20 opacity-15" />
    </div>
  )
}
