import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, FileDown, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { DEVAMSIZLIK_RISK_ESIGI } from '@/config/constants'
import { CACHE_KEYS, getCachedQuery } from '@/lib/queryCache'
import { CALENDAR_WEEKDAY_LABELS } from '@/lib/calendarGrid'
import { useAsync } from '@/hooks/useAsync'
import {
  buildCalendarMonth,
  buildDevamsizlikList,
  deleteAttendance,
  fetchAttendanceRecords,
  fetchRecentAttendance,
  getStudentStatusForRecord,
  updateAttendance,
} from '@/services/attendance.service'
import { fetchApprovedLeavesRecent } from '@/services/leaves.service'
import { fetchStudentsList } from '@/services/students.service'
import { exportDevamsizlikExcel } from '@/lib/excel/studentsExcel'
import type { AttendanceRecord, AttendanceStatus, Student } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

const dotColor = {
  geldi: 'bg-emerald-500',
  gelmedi: 'bg-rose-500',
  izinli: 'bg-amber-500',
  bos: 'bg-slate-200 dark:bg-slate-600',
}

export function AdminReportsPage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)

  const studentsQuery = useAsync(
    fetchStudentsList,
    [],
    () => getCachedQuery(CACHE_KEYS.studentsList),
  )
  const recordsQuery = useAsync(
    fetchAttendanceRecords,
    [],
    () => getCachedQuery(CACHE_KEYS.attendanceAll),
  )
  const recentQuery = useAsync(() => fetchRecentAttendance(20), [])
  const leavesQuery = useAsync(() => fetchApprovedLeavesRecent(15), [])

  const [calendarStudent, setCalendarStudent] = useState<Student | null>(null)
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editStatuses, setEditStatuses] = useState<Record<string, AttendanceStatus>>({})

  const devamsizlikList = useMemo(() => {
    if (!studentsQuery.data || !recordsQuery.data) return []
    return buildDevamsizlikList(studentsQuery.data, recordsQuery.data)
  }, [studentsQuery.data, recordsQuery.data])

  const openCalendar = (name: string) => {
    const student = studentsQuery.data?.find((s) => s.adSoyad === name)
    if (student) {
      setCalendarStudent(student)
      setMonth(new Date().getMonth())
      setYear(new Date().getFullYear())
    }
  }

  const calendarDays = useMemo(() => {
    if (!calendarStudent || !recordsQuery.data) return []
    const leaves = (leavesQuery.data || [])
      .filter((l) => l.ogrenciAd === calendarStudent.adSoyad)
      .map((l) => ({ gidisTarihi: l.gidisTarihi, donusTarihi: l.donusTarihi }))
    return buildCalendarMonth(recordsQuery.data, calendarStudent.adSoyad, year, month, leaves)
  }, [calendarStudent, recordsQuery.data, leavesQuery.data, year, month])

  const openEdit = async (record: AttendanceRecord) => {
    if (!studentsQuery.data) return
    const statuses: Record<string, AttendanceStatus> = {}
    studentsQuery.data.forEach((s) => {
      const st = getStudentStatusForRecord(record, s.adSoyad)
      statuses[s.adSoyad] = st === 'geldi' ? 'Geldi' : st === 'izinli' ? 'İzinli' : 'Gelmedi'
    })
    setEditStatuses(statuses)
    setEditRecord(record)
  }

  const saveEdit = async () => {
    if (!editRecord) return
    const confirmed = await askConfirm({
      title: 'Yoklamayı Güncelle',
      description: 'Yoklama kaydındaki değişiklikler kaydedilecek.',
      confirmLabel: 'Evet, Kaydet',
      cancelLabel: 'Vazgeç',
      variant: 'warning',
      children: (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
          {editRecord.tarih} · {editRecord.vakit}
        </div>
      ),
    })
    if (!confirmed) return
    try {
      await updateAttendance(editRecord.id, editStatuses, profile?.adSoyad || 'Yönetici')
      showToast('success', 'Yoklama güncellendi')
      setEditRecord(null)
      await recordsQuery.reload()
      await recentQuery.reload()
    } catch (err) {
      showToast('error', 'Güncelleme başarısız', err instanceof Error ? err.message : undefined)
    }
  }

  if ((studentsQuery.loading && !studentsQuery.data) || (recordsQuery.loading && !recordsQuery.data)) {
    return <Spinner />
  }

  const monthLabel = new Date(year, month).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })

  return (
    <div className="page-container">
      <PageHeader
        title="Devamsızlık Raporları"
        description="Aylık devamsızlık ve yoklama geçmişi."
        action={
          <Button
            variant="secondary"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void exportDevamsizlikExcel(devamsizlikList)}
            disabled={devamsizlikList.length === 0}
          >
            <FileDown className="h-4 w-4" /> Excel İndir
          </Button>
        }
      />

      <Card className="mb-6 overflow-hidden">
        <CardTitle>Bu Ay Devamsızlık</CardTitle>

        {/* Mobile cards */}
        <ul className="mt-4 space-y-2 sm:hidden">
          {devamsizlikList.map((item) => (
            <li
              key={item.adSoyad}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="shrink-0">{item.odaNo}. ODA</Badge>
                <span className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.adSoyad}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge tone={item.devamsizlik >= DEVAMSIZLIK_RISK_ESIGI ? 'danger' : 'primary'}>
                  {item.devamsizlik} vakit
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => openCalendar(item.adSoyad)}>
                  <Calendar className="h-4 w-4" /> Arşiv
                </Button>
              </div>
            </li>
          ))}
          {!devamsizlikList.length ? (
            <li className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Kayıt bulunamadı.</li>
          ) : null}
        </ul>

        {/* Desktop table */}
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-3">Öğrenci</th>
                <th className="py-3">Devamsızlık</th>
                <th className="py-3 text-center">Takvim</th>
              </tr>
            </thead>
            <tbody>
              {devamsizlikList.map((item) => (
                <tr key={item.adSoyad} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3">
                    <Badge className="mr-2">{item.odaNo}. ODA</Badge>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{item.adSoyad}</span>
                  </td>
                  <td className="py-3">
                    <Badge tone={item.devamsizlik >= DEVAMSIZLIK_RISK_ESIGI ? 'danger' : 'primary'}>
                      {item.devamsizlik} vakit
                    </Badge>
                  </td>
                  <td className="py-3 text-center">
                    <Button variant="secondary" size="sm" onClick={() => openCalendar(item.adSoyad)}>
                      <Calendar className="h-4 w-4" /> Arşiv
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card accent="danger" className="min-w-0 overflow-hidden">
          <CardTitle>Son Yoklama Kayıtları</CardTitle>
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {(recentQuery.data || []).map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 break-words text-slate-800 dark:text-slate-100">
                  <b>{record.tarih}</b> — {record.vakit}
                </span>
                <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(record)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const confirmed = await askConfirm({
                        title: 'Yoklamayı Sil',
                        description: 'Bu yoklama kaydı kalıcı olarak silinecek. Emin misiniz?',
                        confirmLabel: 'Evet, Sil',
                        cancelLabel: 'Vazgeç',
                        variant: 'danger',
                        children: (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                            {record.tarih} · {record.vakit}
                          </div>
                        ),
                      })
                      if (!confirmed) return
                      await deleteAttendance(record.id)
                      await recentQuery.reload()
                      await recordsQuery.reload()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card accent="warning" className="min-w-0 overflow-hidden">
          <CardTitle>Onaylı Evci İzinleri (15 gün)</CardTitle>
          <div className="mt-4 space-y-2">
            {(leavesQuery.data || []).map((leave, i) => (
              <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                <p className="break-words font-bold text-slate-800 dark:text-slate-100">{leave.ogrenciAd}</p>
                <p className="text-slate-500 dark:text-slate-400">
                  {leave.gidisTarihi} → {leave.donusTarihi}
                </p>
              </div>
            ))}
            {!leavesQuery.data?.length ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Kayıt bulunamadı.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Modal
        open={!!calendarStudent}
        onClose={() => setCalendarStudent(null)}
        title={calendarStudent?.adSoyad || ''}
        description="Namaz takvimi"
        className="max-w-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800/60 sm:px-4">
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
          <span className="min-w-0 truncate text-center text-sm font-bold capitalize text-slate-800 dark:text-slate-100 sm:text-base">{monthLabel}</span>
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
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 sm:gap-2 sm:text-xs">
          {CALENDAR_WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map(({ key, day, dots }) =>
            day === null ? (
              <div key={key} aria-hidden="true" className="min-h-[46px] sm:min-h-[54px]" />
            ) : (
              <div key={key} className="min-h-[46px] min-w-0 rounded-lg border border-slate-100 p-1 text-center dark:border-slate-700 sm:min-h-[54px] sm:rounded-xl sm:p-2">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">{day}</p>
                <div className="mt-1 flex justify-center gap-0.5 sm:gap-1">
                  {dots.map((d, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${dotColor[d]}`} />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 sm:gap-4">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Geldi</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" /> Gelmedi</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> İzinli</span>
        </div>
      </Modal>

      <Modal
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        title={editRecord ? `${editRecord.tarih} - ${editRecord.vakit}` : 'Düzenle'}
        className="max-w-lg"
      >
        <div className="max-h-96 space-y-2 overflow-y-auto overflow-x-hidden">
          {Object.entries(editStatuses).map(([name, status]) => (
            <div key={name} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 break-words font-medium text-slate-800 dark:text-slate-100">{name}</span>
              <select
                value={status}
                onChange={(e) =>
                  setEditStatuses({ ...editStatuses, [name]: e.target.value as AttendanceStatus })
                }
                className="h-9 w-[6.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30 dark:[color-scheme:dark]"
              >
                <option value="Geldi">Geldi</option>
                <option value="Gelmedi">Gelmedi</option>
                <option value="İzinli">İzinli</option>
              </select>
            </div>
          ))}
        </div>
        <Button className="mt-4" fullWidth onClick={saveEdit}>
          Kaydet
        </Button>
      </Modal>
    </div>
  )
}
