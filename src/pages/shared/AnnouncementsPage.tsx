import { useEffect, useState } from 'react'
import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { DutyScheduleImportModal } from '@/components/admin/DutyScheduleImportModal'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { todayISO } from '@/lib/dates'
import { useAsync } from '@/hooks/useAsync'
import {
  createAnnouncement,
  deleteAnnouncement,
  deleteDailyDuty,
  fetchAnnouncements,
  fetchDailyDuties,
  importDailyDuties,
  saveDailyDuty,
  updateAnnouncement,
} from '@/services/announcements.service'
import type { DailyDutyImportItem } from '@/services/announcements.service'
import { fetchAttendanceRoster } from '@/services/attendanceRoster.service'
import type { Announcement } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useToastStore } from '@/stores/toast.store'

export function AnnouncementsPage() {
  const showToast = useToastStore((s) => s.showToast)
  const announcementsQuery = useAsync(fetchAnnouncements, [])
  const dutiesQuery = useAsync(fetchDailyDuties, [])
  const reloadDuties = dutiesQuery.reload
  const rosterQuery = useAsync(fetchAttendanceRoster, [])

  useEffect(() => {
    let refreshTimer: number | undefined

    const scheduleMidnightRefresh = () => {
      const now = new Date()
      const nextRefresh = new Date(now)
      nextRefresh.setHours(24, 0, 5, 0)

      refreshTimer = window.setTimeout(() => {
        void reloadDuties()
        scheduleMidnightRefresh()
      }, nextRefresh.getTime() - now.getTime())
    }

    scheduleMidnightRefresh()
    return () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer)
    }
  }, [reloadDuties])

  const [dutyDate, setDutyDate] = useState(todayISO())
  const [imam, setImam] = useState('')
  const [muezzin, setMuezzin] = useState('')
  const [isDutyImportOpen, setIsDutyImportOpen] = useState(false)

  const [baslik, setBaslik] = useState('')
  const [icerik, setIcerik] = useState('')
  const [etkinlikTarihi, setEtkinlikTarihi] = useState('')
  const [hatirlatmaGun, setHatirlatmaGun] = useState('0')
  const [editing, setEditing] = useState<Announcement | null>(null)

  const saveDuty = async () => {
    if (!dutyDate || !imam || !muezzin) {
      showToast('error', 'Tarih, imam ve müezzin zorunlu')
      return
    }
    try {
      await saveDailyDuty(dutyDate, imam, muezzin)
      showToast('success', 'Görev kaydedildi')
      setImam('')
      setMuezzin('')
      await dutiesQuery.reload()
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    }
  }

  const importDutySchedule = async (
    items: DailyDutyImportItem[],
    summary: { newCount: number; updateCount: number; unchangedCount: number },
  ): Promise<boolean> => {
    if (summary.updateCount > 0) {
      const confirmed = await askConfirm({
        title: 'Mevcut Görevleri Güncelle',
        description: `${summary.updateCount} tarihteki mevcut görev, PDF’deki listeyle güncellenecek.`,
        confirmLabel: 'Evet, İçe Aktar',
        cancelLabel: 'Vazgeç',
        variant: 'warning',
        children: (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-bold text-amber-900 dark:text-amber-100">
              {summary.newCount} yeni görev eklenecek
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-200">
              {summary.updateCount} mevcut görev güncellenecek.
            </p>
          </div>
        ),
      })
      if (!confirmed) return false
    }

    const result = await importDailyDuties(items)
    const details = [
      result.created > 0 ? `${result.created} yeni görev` : '',
      result.updated > 0 ? `${result.updated} görev güncellendi` : '',
      result.unchanged > 0 ? `${result.unchanged} görev değişmedi` : '',
    ].filter(Boolean).join(' · ')
    showToast('success', 'Görev çizelgesi aktarıldı', details)
    await dutiesQuery.reload()
    return true
  }

  const saveAnnouncementForm = async () => {
    if (!baslik || !icerik) {
      showToast('error', 'Başlık ve içerik zorunlu')
      return
    }
    try {
      const payload = {
        baslik,
        icerik,
        etkinlikTarihi: etkinlikTarihi || undefined,
        hatirlatmaGun: Number(hatirlatmaGun) || 0,
      }
      if (editing) {
        await updateAnnouncement(editing.id, payload)
        showToast('success', 'Duyuru güncellendi')
      } else {
        await createAnnouncement(payload)
        showToast('success', 'Duyuru eklendi')
      }
      setBaslik('')
      setIcerik('')
      setEtkinlikTarihi('')
      setHatirlatmaGun('0')
      setEditing(null)
      await announcementsQuery.reload()
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    }
  }

  const startEdit = (item: Announcement) => {
    setEditing(item)
    setBaslik(item.baslik)
    setIcerik(item.icerik)
    setEtkinlikTarihi(item.etkinlikTarihi || '')
    setHatirlatmaGun(String(item.hatirlatmaGun ?? 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (announcementsQuery.loading || dutiesQuery.loading || rosterQuery.loading) return <Spinner />

  const studentOptions = rosterQuery.data || []

  return (
    <div className="page-container">
      <PageHeader title="Duyuru & Nöbet Yönetimi" description="Duyurular ve günlük imam/müezzin görevlerini yönetin." />

      <Card accent="success" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Günlük Görev Çizelgesi</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Geçmiş görevler otomatik olarak listeden gizlenir.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => setIsDutyImportOpen(true)}
          >
            <FileUp className="h-4 w-4" /> PDF’den aktar
          </Button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-primary-700 dark:text-primary-300">
              Tarih
            </label>
            <input
              type="date"
              value={dutyDate}
              onChange={(e) => setDutyDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30 dark:[color-scheme:dark]"
            />
          </div>
          <Select id="imam" label="İmam" value={imam} onChange={(e) => setImam(e.target.value)}>
            <option value="">Seçiniz</option>
            {studentOptions.map((s) => (
              <option key={s.studentId} value={s.adSoyad}>
                {s.adSoyad}
              </option>
            ))}
          </Select>
          <Select id="muezzin" label="Müezzin" value={muezzin} onChange={(e) => setMuezzin(e.target.value)}>
            <option value="">Seçiniz</option>
            {studentOptions.map((s) => (
              <option key={s.studentId} value={s.adSoyad}>
                {s.adSoyad}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button fullWidth onClick={saveDuty}>
              Kaydet
            </Button>
          </div>
        </div>
        <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
          {(dutiesQuery.data || []).map((duty) => (
            <div
              key={duty.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-100"
            >
              <span>
                <b className="text-slate-900 dark:text-slate-100">{duty.id}</b>
                <span className="text-slate-600 dark:text-slate-400">
                  {' '}
                  — İmam: {duty.imam} | Müezzin: {duty.muezzin}
                </span>
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  const confirmed = await askConfirm({
                    title: 'Nöbet Kaydını Sil',
                    description: 'Bu günlük görev kaydı silinecek.',
                    confirmLabel: 'Evet, Sil',
                    cancelLabel: 'Vazgeç',
                    variant: 'danger',
                    children: (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                        📅 {duty.id}
                      </div>
                    ),
                  })
                  if (!confirmed) return
                  await deleteDailyDuty(duty.id)
                  await dutiesQuery.reload()
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <DutyScheduleImportModal
        open={isDutyImportOpen}
        onClose={() => setIsDutyImportOpen(false)}
        rosterNames={studentOptions.map((student) => student.adSoyad)}
        existingDuties={dutiesQuery.data || []}
        onImport={importDutySchedule}
      />

      <Card accent="primary" className="mb-6">
        <CardTitle>{editing ? 'Duyuru Düzenle' : 'Yeni Duyuru / Etkinlik'}</CardTitle>
        <div className="mt-4 space-y-4">
          <Input id="baslik" label="Başlık" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
          <Textarea id="icerik" label="İçerik" value={icerik} onChange={(e) => setIcerik(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-primary-700 dark:text-primary-300">
                Etkinlik Tarihi
              </label>
              <input
                type="date"
                value={etkinlikTarihi}
                onChange={(e) => setEtkinlikTarihi(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30 dark:[color-scheme:dark]"
              />
            </div>
            <Input
              id="hatirlatma"
              label="Kaç gün önce hatırlat"
              type="number"
              min={0}
              value={hatirlatmaGun}
              onChange={(e) => setHatirlatmaGun(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveAnnouncementForm}>
              <Plus className="h-4 w-4" /> {editing ? 'Güncelle' : 'Yayınla'}
            </Button>
            {editing ? (
              <Button variant="secondary" onClick={() => { setEditing(null); setBaslik(''); setIcerik('') }}>
                Vazgeç
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Yayındaki Duyurular</CardTitle>
        <div className="mt-4 space-y-3">
          {(announcementsQuery.data || []).map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{item.baslik}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
                    {item.icerik}
                  </p>
                  {item.etkinlikTarihi ? (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      Etkinlik: {item.etkinlikTarihi} ({item.hatirlatmaGun} gün önce hatırlat)
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const confirmed = await askConfirm({
                        title: 'Duyuruyu Sil',
                        description: 'Bu duyuru kalıcı olarak silinecek. Emin misiniz?',
                        confirmLabel: 'Evet, Sil',
                        cancelLabel: 'Vazgeç',
                        variant: 'danger',
                        children: (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{item.baslik}</p>
                          </div>
                        ),
                      })
                      if (!confirmed) return
                      await deleteAnnouncement(item.id)
                      await announcementsQuery.reload()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
