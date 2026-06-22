import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import {
  fetchAnnouncements,
  fetchTodayDuty,
  filterAnnouncementsForDisplay,
} from '@/services/announcements.service'
import { createLeaveRequest, fetchStudentLeaves } from '@/services/leaves.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function StudentHomePage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)

  const announcementsQuery = useAsync(async () => {
    const [announcements, duty] = await Promise.all([
      fetchAnnouncements(),
      fetchTodayDuty(),
    ])
    return filterAnnouncementsForDisplay(announcements, duty, true)
  }, [])

  const leavesQuery = useAsync(
    () => (profile ? fetchStudentLeaves(profile.adSoyad) : Promise.resolve([])),
    [profile?.adSoyad],
  )

  const [slide, setSlide] = useState(0)
  const [gidis, setGidis] = useState('')
  const [donus, setDonus] = useState('')
  const [sebep, setSebep] = useState('')
  const [sending, setSending] = useState(false)
  const [hiddenNotice, setHiddenNotice] = useState<string | null>(null)

  const slides = announcementsQuery.data || []

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => {
      setSlide((s) => (s + 1) % slides.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  const latestLeave = leavesQuery.data?.[0]
  const showLeaveNotice =
    latestLeave &&
    latestLeave.durum !== 'Beklemede' &&
    hiddenNotice !== latestLeave.tarih

  const submitLeave = async () => {
    if (!profile || !gidis || !donus || !sebep) {
      showToast('error', 'Tüm alanları doldurun')
      return
    }
    setSending(true)
    try {
      await createLeaveRequest({
        ogrenciAd: profile.adSoyad,
        gidisTarihi: gidis,
        donusTarihi: donus,
        sebep,
      })
      showToast('success', 'İzin talebi gönderildi')
      setGidis('')
      setDonus('')
      setSebep('')
      await leavesQuery.reload()
    } catch (err) {
      showToast('error', 'Gönderilemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setSending(false)
    }
  }

  if (announcementsQuery.loading) return <Spinner />

  return (
    <div className="page-container">
      {showLeaveNotice ? (
        <Card
          className={`mb-6 ${latestLeave.durum === 'Onaylandı' ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-bold">Talep {latestLeave.durum}</p>
              <p className="text-sm text-slate-600">{latestLeave.gidisTarihi} tarihli talebiniz sonuçlandı.</p>
            </div>
            <button
              type="button"
              onClick={() => setHiddenNotice(latestLeave.tarih || 'hidden')}
              className="text-slate-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </Card>
      ) : null}

      {slides.length > 0 ? (
        <Card accent="primary" className="relative mb-6 overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <div className="min-h-[120px] pr-12">
            <Badge tone="primary" className="mb-2 bg-white/20 text-white">
              {slides[slide].type === 'duty' ? 'Görev' : 'Duyuru'}
            </Badge>
            <p className="font-bold">{slides[slide].title}</p>
            <p
              className="mt-2 text-sm text-primary-100"
              dangerouslySetInnerHTML={{ __html: slides[slide].content }}
            />
          </div>
          {slides.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl bg-white/15 p-2"
                onClick={() => setSlide((s) => (s - 1 + slides.length) % slides.length)}
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-white/15 p-2"
                onClick={() => setSlide((s) => (s + 1) % slides.length)}
              >
                <ChevronRight />
              </button>
              <div className="mt-3 flex justify-center gap-2">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 rounded-full transition-all ${i === slide ? 'w-4 bg-white' : 'w-2 bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </Card>
      ) : null}

      <Card accent="warning">
        <CardTitle>Evci İzni Talep Formu</CardTitle>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-primary-700 dark:text-primary-300">Gidiş</label>
              <input
                type="date"
                value={gidis}
                onChange={(e) => setGidis(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-primary-700 dark:text-primary-300">Dönüş</label>
              <input
                type="date"
                value={donus}
                onChange={(e) => setDonus(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <Textarea
            id="sebep"
            label="Adres ve sebep"
            value={sebep}
            onChange={(e) => setSebep(e.target.value)}
          />
          <Button variant="accent" fullWidth onClick={submitLeave} disabled={sending}>
            {sending ? 'Gönderiliyor...' : 'İzin Talebi Gönder'}
          </Button>
        </div>
      </Card>

      {leavesQuery.data && leavesQuery.data.length > 0 ? (
        <Card className="mt-6">
          <CardTitle>İzin Geçmişim</CardTitle>
          <div className="mt-4 space-y-3">
            {leavesQuery.data.map((leave) => (
              <div
                key={leave.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {leave.gidisTarihi} → {leave.donusTarihi}
                  </p>
                  <Badge
                    tone={
                      leave.durum === 'Onaylandı'
                        ? 'success'
                        : leave.durum === 'Reddedildi'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {leave.durum}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{leave.sebep}</p>
                {leave.islemTarihi ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Sonuç: {new Date(leave.islemTarihi).toLocaleDateString('tr-TR')}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
