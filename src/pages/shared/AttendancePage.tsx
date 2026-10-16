import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { VAKITLER } from '@/config/constants'
import { formatDateTR, todayISO } from '@/lib/dates'
import { fetchAttendanceRoster } from '@/services/attendanceRoster.service'
import { saveAttendance } from '@/services/attendance.service'
import { logAudit } from '@/services/audit.service'
import type { AttendanceRosterEntry, AttendanceStatus } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function AttendancePage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const [roster, setRoster] = useState<AttendanceRosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tarih, setTarih] = useState(todayISO())
  const [vakit, setVakit] = useState<string>(VAKITLER[0])
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({})

  useEffect(() => {
    let cancelled = false
    fetchAttendanceRoster()
      .then((list) => {
        if (cancelled) return
        setRoster(list)
        const initial: Record<string, AttendanceStatus> = {}
        list.forEach((entry) => {
          initial[entry.adSoyad] = 'Geldi'
        })
        setStatuses(initial)
      })
      .catch((err) => {
        if (cancelled) return
        setRoster([])
        setStatuses({})
        showToast(
          'error',
          'Yoklama listesi yüklenemedi',
          err instanceof Error ? err.message : undefined,
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const setAll = (status: AttendanceStatus) => {
    const next = { ...statuses }
    roster.forEach((entry) => {
      next[entry.adSoyad] = status
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
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {formatDateTR(tarih)} · {vakit}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 px-2 py-2 dark:bg-emerald-950/60">
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{gelen}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Geldi</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-2 py-2 dark:bg-rose-950/60">
              <p className="text-lg font-black text-rose-700 dark:text-rose-300">{gelmeyen}</p>
              <p className="text-xs text-rose-600 dark:text-rose-400">Gelmedi</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-2 py-2 dark:bg-amber-950/60">
              <p className="text-lg font-black text-amber-700 dark:text-amber-300">{izinli}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">İzinli</p>
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
      })
      showToast('success', 'Yoklama kaydedildi', `${formatDateTR(tarih)} · ${vakit}`)
      const initial: Record<string, AttendanceStatus> = {}
      roster.forEach((entry) => {
        initial[entry.adSoyad] = 'Geldi'
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

      <Card className="mb-6 overflow-hidden">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-bold uppercase text-primary-700 dark:text-primary-300">Tarih</label>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="box-border h-11 w-full max-w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 sm:px-4 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30 dark:[color-scheme:dark]"
            />
          </div>
          <div className="min-w-0">
            <Select id="vakit" label="Vakit" value={vakit} onChange={(e) => setVakit(e.target.value)}>
              {VAKITLER.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setAll('Geldi')}
            disabled={roster.length === 0}
          >
            Hepsi Geldi
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setAll('Gelmedi')}
            disabled={roster.length === 0}
          >
            Hepsi Gelmedi
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {roster.length === 0 ? (
          <EmptyState
            title="Yoklama listesi boş"
            description="Kayıtlı öğrenci roster belgesi bulunamadı."
          />
        ) : (
          <>
            {/* Mobile: stacked rows that fit the viewport */}
            <ul className="space-y-2 sm:hidden">
              {roster.map((entry) => (
                <li
                  key={entry.studentId}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-white dark:bg-slate-700">
                        {entry.odaNo}. ODA
                      </span>
                      <span className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                        {entry.adSoyad}
                      </span>
                    </div>
                  </div>
                  <select
                    value={statuses[entry.adSoyad] || 'Geldi'}
                    onChange={(e) =>
                      setStatuses({
                        ...statuses,
                        [entry.adSoyad]: e.target.value as AttendanceStatus,
                      })
                    }
                    aria-label={`${entry.adSoyad} durumu`}
                    className="h-10 w-[7.25rem] shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30 dark:[color-scheme:dark]"
                  >
                    <option value="Geldi">Geldi ✅</option>
                    <option value="Gelmedi">Gelmedi ❌</option>
                    <option value="İzinli">İzinli 🏠</option>
                  </select>
                </li>
              ))}
            </ul>

            {/* Desktop / tablet: original table layout */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-3 py-3">Oda / Öğrenci</th>
                    <th className="px-3 py-3 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((entry) => (
                    <tr key={entry.studentId} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-3">
                        <span className="mr-2 rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-white dark:bg-slate-700">
                          {entry.odaNo}. ODA
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {entry.adSoyad}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <select
                          value={statuses[entry.adSoyad] || 'Geldi'}
                          onChange={(e) =>
                            setStatuses({
                              ...statuses,
                              [entry.adSoyad]: e.target.value as AttendanceStatus,
                            })
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30 dark:[color-scheme:dark]"
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
          </>
        )}
        <Button
          className="mt-6"
          fullWidth
          size="lg"
          onClick={handleSaveClick}
          disabled={saving || roster.length === 0}
        >
          <Save className="h-5 w-5" />
          {saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
        </Button>
      </Card>
    </div>
  )
}
