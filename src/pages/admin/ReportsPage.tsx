import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, FileDown, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { DEVAMSIZLIK_RISK_ESIGI } from '@/config/constants'
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
import { fetchStudents } from '@/services/students.service'
import { exportDevamsizlikExcel } from '@/lib/excel/studentsExcel'
import type { AttendanceRecord, AttendanceStatus, Student } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

const dotColor = {
  geldi: 'bg-emerald-500',
  gelmedi: 'bg-rose-500',
  izinli: 'bg-amber-500',
  bos: 'bg-slate-200',
}

export function AdminReportsPage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)

  const studentsQuery = useAsync(fetchStudents, [])
  const recordsQuery = useAsync(fetchAttendanceRecords, [])
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
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-900">
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

  if (studentsQuery.loading || recordsQuery.loading) return <Spinner />

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
            onClick={() => void exportDevamsizlikExcel(devamsizlikList)}
            disabled={devamsizlikList.length === 0}
          >
            <FileDown className="h-4 w-4" /> Excel İndir
          </Button>
        }
      />

      <Card className="mb-6 overflow-x-auto">
        <CardTitle>Bu Ay Devamsızlık</CardTitle>
        <table className="mt-4 w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-500">
              <th className="py-3">Öğrenci</th>
              <th className="py-3">Devamsızlık</th>
              <th className="py-3 text-center">Takvim</th>
            </tr>
          </thead>
          <tbody>
            {devamsizlikList.map((item) => (
              <tr key={item.adSoyad} className="border-b border-slate-100">
                <td className="py-3">
                  <Badge className="mr-2">{item.odaNo}. ODA</Badge>
                  <span className="font-semibold">{item.adSoyad}</span>
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
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card accent="danger">
          <CardTitle>Son Yoklama Kayıtları</CardTitle>
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
            {(recentQuery.data || []).map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>
                  <b>{record.tarih}</b> — {record.vakit}
                </span>
                <div className="flex gap-1">
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
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-900">
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

        <Card accent="warning">
          <CardTitle>Onaylı Evci İzinleri (15 gün)</CardTitle>
          <div className="mt-4 space-y-2">
            {(leavesQuery.data || []).map((leave, i) => (
              <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="font-bold">{leave.ogrenciAd}</p>
                <p className="text-slate-500">
                  {leave.gidisTarihi} → {leave.donusTarihi}
                </p>
              </div>
            ))}
            {!leavesQuery.data?.length ? (
              <p className="text-sm text-slate-500">Kayıt bulunamadı.</p>
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
                  <span key={i} className={`h-2 w-2 rounded-full ${dotColor[d]}`} />
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
      </Modal>

      <Modal
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        title={editRecord ? `${editRecord.tarih} - ${editRecord.vakit}` : 'Düzenle'}
        className="max-w-lg"
      >
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {Object.entries(editStatuses).map(([name, status]) => (
            <div key={name} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{name}</span>
              <select
                value={status}
                onChange={(e) =>
                  setEditStatuses({ ...editStatuses, [name]: e.target.value as AttendanceStatus })
                }
                className="rounded-lg border border-slate-200 px-2 py-1"
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
