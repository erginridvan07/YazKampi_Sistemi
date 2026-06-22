import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import {
  buildCalendarMonth,
  calcAttendanceRate,
  fetchAttendanceRecords,
} from '@/services/attendance.service'
import { fetchStudentLeaves } from '@/services/leaves.service'
import { useAuthStore } from '@/stores/auth.store'

const dotColor = {
  geldi: 'bg-emerald-500',
  gelmedi: 'bg-rose-500',
  izinli: 'bg-amber-500',
  bos: 'bg-slate-200',
}

export function StudentReportsPage() {
  const profile = useAuthStore((s) => s.profile)
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())

  const recordsQuery = useAsync(fetchAttendanceRecords, [])
  const leavesQuery = useAsync(
    () => (profile ? fetchStudentLeaves(profile.adSoyad) : Promise.resolve([])),
    [profile?.adSoyad],
  )

  const rate = useMemo(() => {
    if (!profile || !recordsQuery.data) return { total: 0, attended: 0, percent: 0 }
    return calcAttendanceRate(recordsQuery.data, profile.adSoyad)
  }, [profile, recordsQuery.data])

  const calendarDays = useMemo(() => {
    if (!profile || !recordsQuery.data) return []
    const approved = (leavesQuery.data || [])
      .filter((l) => l.durum === 'Onaylandı')
      .map((l) => ({ gidisTarihi: l.gidisTarihi, donusTarihi: l.donusTarihi }))
    return buildCalendarMonth(recordsQuery.data, profile.adSoyad, year, month, approved)
  }, [profile, recordsQuery.data, leavesQuery.data, year, month])

  if (recordsQuery.loading) return <Spinner />

  const monthLabel = new Date(year, month).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })

  return (
    <div className="page-container">
      <PageHeader title="Devamsızlığım" description={`Hoş geldin, ${profile?.adSoyad}`} />

      <Card className="mb-6 bg-gradient-to-br from-primary-600 to-primary-800 text-center text-white">
        <p className="text-5xl font-black">%{rate.percent}</p>
        <p className="mt-2 text-sm text-primary-100">
          Toplam {rate.total} vakitten {rate.attended} tanesine katıldınız.
        </p>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (month === 0) { setMonth(11); setYear((y) => y - 1) }
              else setMonth((m) => m - 1)
            }}
          >
            <ChevronLeft />
          </Button>
          <span className="font-bold capitalize">{monthLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (month === 11) { setMonth(0); setYear((y) => y + 1) }
              else setMonth((m) => m + 1)
            }}
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map(({ day, dots }) => (
            <div key={day} className="rounded-xl border border-slate-100 p-2 text-center">
              <p className="text-xs font-bold text-slate-500">{day}</p>
              <div className="mt-1 flex justify-center gap-1">
                {dots.map((d, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${dotColor[d]}`} title={d} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Geldi</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" /> Gelmedi</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> İzinli</span>
        </div>
      </Card>
    </div>
  )
}
