import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
  saveDailyDuty,
  updateAnnouncement,
} from '@/services/announcements.service'
import { fetchStudents as getStudents } from '@/services/students.service'
import type { Announcement } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useToastStore } from '@/stores/toast.store'

export function AnnouncementsPage() {
  const showToast = useToastStore((s) => s.showToast)
  const announcementsQuery = useAsync(fetchAnnouncements, [])
  const dutiesQuery = useAsync(fetchDailyDuties, [])
  const studentsQuery = useAsync(getStudents, [])

  const [dutyDate, setDutyDate] = useState(todayISO())
  const [imam, setImam] = useState('')
  const [muezzin, setMuezzin] = useState('')

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

  if (announcementsQuery.loading || dutiesQuery.loading) return <Spinner />

  const studentOptions = studentsQuery.data || []

  return (
    <div className="page-container">
      <PageHeader title="Duyuru & Nöbet Yönetimi" description="Duyurular ve günlük imam/müezzin görevlerini yönetin." />

      <Card accent="success" className="mb-6">
        <CardTitle>Günlük Görev Çizelgesi</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-primary-700">Tarih</label>
            <input
              type="date"
              value={dutyDate}
              onChange={(e) => setDutyDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
            />
          </div>
          <Select id="imam" label="İmam" value={imam} onChange={(e) => setImam(e.target.value)}>
            <option value="">Seçiniz</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.adSoyad}>
                {s.adSoyad}
              </option>
            ))}
          </Select>
          <Select id="muezzin" label="Müezzin" value={muezzin} onChange={(e) => setMuezzin(e.target.value)}>
            <option value="">Seçiniz</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.adSoyad}>
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
            <div key={duty.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>
                <b>{duty.id}</b> — İmam: {duty.imam} | Müezzin: {duty.muezzin}
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
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold">
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

      <Card accent="primary" className="mb-6">
        <CardTitle>{editing ? 'Duyuru Düzenle' : 'Yeni Duyuru / Etkinlik'}</CardTitle>
        <div className="mt-4 space-y-4">
          <Input id="baslik" label="Başlık" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
          <Textarea id="icerik" label="İçerik" value={icerik} onChange={(e) => setIcerik(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-primary-700">Etkinlik Tarihi</label>
              <input
                type="date"
                value={etkinlikTarihi}
                onChange={(e) => setEtkinlikTarihi(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
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
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{item.baslik}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.icerik}</p>
                  {item.etkinlikTarihi ? (
                    <p className="mt-2 text-xs text-slate-400">
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
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                            <p className="font-bold text-slate-900">{item.baslik}</p>
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
