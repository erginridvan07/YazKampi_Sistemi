import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import type { MonthlyAbsenceTrend } from '@/types'

interface AttendanceTrendChartProps {
  data: MonthlyAbsenceTrend[]
}

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
  const max = Math.max(...data.map((d) => d.toplamDevamsizlik), 1)

  return (
    <Card accent="primary">
      <CardTitle>Aylık Devamsızlık Trendi</CardTitle>
      <CardDescription>Son 6 ay — tüm öğrencilerin toplam devamsızlık sayısı</CardDescription>
      <div className="mt-6 flex items-end justify-between gap-2 sm:gap-4">
        {data.map((item) => {
          const height = Math.max(8, Math.round((item.toplamDevamsizlik / max) * 120))
          return (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {item.toplamDevamsizlik}
              </span>
              <div
                className="w-full max-w-12 rounded-t-xl bg-gradient-to-t from-primary-700 to-primary-500 transition-all"
                style={{ height }}
                title={`${item.label}: ${item.toplamDevamsizlik} devamsızlık`}
              />
              <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
