import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { VAKITLER } from '@/config/constants'
import { formatDateTR, todayISO } from '@/lib/dates'
import { fetchStudents } from '@/services/students.service'
import { saveAttendance } from '@/services/attendance.service'
import { logAudit } from '@/services/audit.service'
import type { AttendanceStatus, Student } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function AttendancePage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tarih, setTarih] = useState(todayISO())
  const [vakit, setVakit] = useState<string>(VAKITLER[0])
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})

  useEffect(() => {
    fetchStudents()
      .then((list) => {
        setStudents(list)
        const initial: Record<string, AttendanceStatus> = {}
        list.forEach((s) => {
          initial[s.adSoyad] = 'Geldi'
        })
        setStatuses(initial)
      })
      .finally(() => setLoading(false))
  }, [])

  const setAll = (status: AttendanceStatus) => {
    const next = { ...statuses }
    students.forEach((s) => {
      next[s.adSoyad] = status
    })
    setStatuses(next)
  }

  const gelen = Object.values(statuses).filter((s) => s === 'Geldi').length
  const gelmeyen = Object.values(statuses).filter((s) => s === 'Gelmedi').length
  const izinli = Object.values(statuses).filter((s) => s === 'İzinli').length

  const handleSaveClick = async () => {
    const confirmed = await askConfirm({
      title: 'Yoklamayı Kaydet',
      description: 'Bu yoklama kaydı sisteme işlenecek. Devam etmek istiyor musunuz?',
      confirmLabel: 'Evet, Kaydet',
      cancelLabel: 'Vazgeç',
      variant: 'warning',
      children: (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-bold text-slate-900">
            {formatDateTR(tarih)} · {vakit}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 px-2 py-2">
              <p className="text-lg font-black text-emerald-700">{gelen}</p>
              <p className="text-xs text-emerald-600">Geldi</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-2 py-2">
              <p className="text-lg font-black text-rose-700">{gelmeyen}</p>
              <p className="text-xs text-rose-600">Gelmedi</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-2 py-2">
              <p className="text-lg font-black text-amber-700">{izinli}</p>
              <p className="text-xs text-amber-600">İzinli</p>
            </div>
          </div>
        </div>
      ),
    })

    if (!confirmed) return

    setSaving(true)
    try {
      await saveAttendance({
        tarihISO: tarih,
        vakit,
        statuses,
        kaydeden: profile?.adSoyad || 'Yetkili',
      })
      await logAudit({
        islem: 'Yoklama Kaydı',
        detay: `${formatDateTR(tarih)} · ${vakit} · ${gelen} geldi, ${gelmeyen} gelmedi`,
        yapan: profile?.adSoyad || 'Yetkili',
        rol: profile?.role || 'student',
      })
      showToast('success', 'Yoklama kaydedildi', `${formatDateTR(tarih)} · ${vakit}`)
      const initial: Record<string, AttendanceStatus> = {}
      students.forEach((s) => {
        initial[s.adSoyad] = 'Geldi'
      })
      setStatuses(initial)
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="page-container">
      <PageHeader title="Namaz Yoklaması" description="Tarih ve vakit seçerek yoklamayı kaydedin." />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-primary-700">Tarih</label>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm"
            />
          </div>
          <Select id="vakit" label="Vakit" value={vakit} onChange={(e) => setVakit(e.target.value)}>
            {VAKITLER.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAll('Geldi')}>
            Hepsi Geldi
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAll('Gelmedi')}>
            Hepsi Gelmedi
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-3">Oda / Öğrenci</th>
                <th className="px-3 py-3 text-right">Durum</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-slate-100">
                  <td className="px-3 py-3">
                    <span className="mr-2 rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-white">
                      {student.odaNo}. ODA
                    </span>
                    <span className="font-semibold text-slate-800">{student.adSoyad}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <select
                      value={statuses[student.adSoyad] || 'Geldi'}
                      onChange={(e) =>
                        setStatuses({
                          ...statuses,
                          [student.adSoyad]: e.target.value as AttendanceStatus,
                        })
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Geldi">Geldi ✅</option>
                      <option value="Gelmedi">Gelmedi ❌</option>
                      <option value="İzinli">İzinli 🏠</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button className="mt-6" fullWidth size="lg" onClick={handleSaveClick} disabled={saving}>
          <Save className="h-5 w-5" />
          {saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
        </Button>
      </Card>
    </div>
  )
}
