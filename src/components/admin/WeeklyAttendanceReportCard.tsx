import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { VakitAttendanceCounts, WeeklyAttendanceReport } from '@/types'

function CountCell({
  value,
  tone,
  empty,
}: {
  value: number
  tone: 'success' | 'danger' | 'warning'
  empty?: boolean
}) {
  if (empty) {
    return <span className="text-slate-300 dark:text-slate-600">—</span>
  }

  const toneClass = {
    success: 'text-emerald-700 dark:text-emerald-400',
    danger: 'text-rose-700 dark:text-rose-400',
    warning: 'text-amber-700 dark:text-amber-400',
  }[tone]

  return <span className={cn('font-bold tabular-nums', toneClass)}>{value}</span>
}

function VakitBlock({
  title,
  counts,
}: {
  title: string
  counts: VakitAttendanceCounts
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      {counts.kayitYok ? (
        <p className="text-xs italic text-slate-400">Kayıt yok</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">Geldi</p>
            <CountCell value={counts.geldi} tone="success" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">Gelmedi</p>
            <CountCell value={counts.gelmedi} tone="danger" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">İzinli</p>
            <CountCell value={counts.izinli} tone="warning" />
          </div>
        </div>
      )}
    </div>
  )
}

interface WeeklyAttendanceReportCardProps {
  data: WeeklyAttendanceReport
}

export function WeeklyAttendanceReportCard({ data }: WeeklyAttendanceReportCardProps) {
  return (
    <Card accent="primary">
      <CardTitle>Haftalık Rapor Analizi</CardTitle>
      <CardDescription>
        Bu hafta ({data.haftaLabel}) — gün gün Sabah ve Yatsı yoklama özeti
      </CardDescription>

      <div className="mt-6 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="px-3 py-2">Gün</th>
              <th className="px-3 py-2">Tarih</th>
              <th className="px-3 py-2 text-center text-emerald-700 dark:text-emerald-400">Sabah Geldi</th>
              <th className="px-3 py-2 text-center text-rose-700 dark:text-rose-400">Sabah Gelmedi</th>
              <th className="px-3 py-2 text-center text-amber-700 dark:text-amber-400">Sabah İzinli</th>
              <th className="px-3 py-2 text-center text-emerald-700 dark:text-emerald-400">Yatsı Geldi</th>
              <th className="px-3 py-2 text-center text-rose-700 dark:text-rose-400">Yatsı Gelmedi</th>
              <th className="px-3 py-2 text-center text-amber-700 dark:text-amber-400">Yatsı İzinli</th>
            </tr>
          </thead>
          <tbody>
            {data.gunler.map((gun) => (
              <tr
                key={gun.tarih}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800"
              >
                <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                  {gun.gunLabel}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{gun.tarihLabel}</td>
                <td className="px-3 py-3 text-center">
                  <CountCell value={gun.sabah.geldi} tone="success" empty={gun.sabah.kayitYok} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountCell value={gun.sabah.gelmedi} tone="danger" empty={gun.sabah.kayitYok} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountCell value={gun.sabah.izinli} tone="warning" empty={gun.sabah.kayitYok} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountCell value={gun.yatsi.geldi} tone="success" empty={gun.yatsi.kayitYok} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountCell value={gun.yatsi.gelmedi} tone="danger" empty={gun.yatsi.kayitYok} />
                </td>
                <td className="px-3 py-3 text-center">
                  <CountCell value={gun.yatsi.izinli} tone="warning" empty={gun.yatsi.kayitYok} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-3 lg:hidden">
        {data.gunler.map((gun) => (
          <div
            key={gun.tarih}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold text-slate-900 dark:text-slate-100">{gun.gunLabel}</p>
              <p className="text-sm text-slate-500">{gun.tarihLabel}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <VakitBlock title="Sabah" counts={gun.sabah} />
              <VakitBlock title="Yatsı" counts={gun.yatsi} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
