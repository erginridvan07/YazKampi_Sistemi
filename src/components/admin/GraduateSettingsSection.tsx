import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { PROFILE_IMAGE_OPTS } from '@/lib/avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { logAudit } from '@/services/audit.service'
import {
  createGraduate,
  deleteGraduate,
  EMPTY_GRADUATE_FORM,
  fetchGraduateLoginSettings,
  fetchGraduates,
  graduateToForm,
  groupGraduatesByYear,
  saveGraduateLoginSettings,
  updateGraduate,
} from '@/services/graduates.service'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import type { EvlilikDurumu, Graduate, GraduateFormData, GraduateLoginSettings } from '@/types'

const EVLILIK_OPTIONS: EvlilikDurumu[] = ['Belirtilmemiş', 'Bekar', 'Evli']

export function GraduateSettingsSection() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)

  const [loading, setLoading] = useState(true)
  const [savingLogin, setSavingLogin] = useState(false)
  const [graduates, setGraduates] = useState<Graduate[]>([])
  const [storedPassword, setStoredPassword] = useState<string | undefined>()

  const [loginForm, setLoginForm] = useState<GraduateLoginSettings>({
    username: '',
    password: '',
    enabled: true,
    welcomeTitle: 'Mezun Ağı',
    welcomeMessage: 'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Graduate | null>(null)
  const [graduateForm, setGraduateForm] = useState<GraduateFormData>(EMPTY_GRADUATE_FORM)
  const [savingGraduate, setSavingGraduate] = useState(false)

  const groups = useMemo(() => groupGraduatesByYear(graduates), [graduates])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [settings, list] = await Promise.all([fetchGraduateLoginSettings(), fetchGraduates()])
      if (settings) {
        setLoginForm({
          username: settings.username || '',
          password: settings.password || '',
          enabled: settings.enabled !== false,
          welcomeTitle: settings.welcomeTitle || 'Mezun Ağı',
          welcomeMessage:
            settings.welcomeMessage ||
            'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
        })
        setStoredPassword(settings.password)
      }
      setGraduates(list)
    } catch (err) {
      showToast('error', 'Mezun verileri yüklenemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setGraduateForm(EMPTY_GRADUATE_FORM)
    setModalOpen(true)
  }

  const openEdit = (graduate: Graduate) => {
    setEditing(graduate)
    setGraduateForm(graduateToForm(graduate))
    setModalOpen(true)
  }

  const saveLoginSettings = async () => {
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      showToast('error', 'Kullanıcı adı ve şifre zorunludur')
      return
    }
    if (loginForm.password.length < 6) {
      showToast('error', 'Şifre en az 6 karakter olmalıdır')
      return
    }

    setSavingLogin(true)
    try {
      const result = await saveGraduateLoginSettings(loginForm, storedPassword)
      setStoredPassword(loginForm.password)

      await logAudit({
        islem: 'Mezun Giriş Ayarları',
        detay: `Kullanıcı: ${loginForm.username}`,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })

      if (result === 'created' || result === 'updated') {
        showToast(
          'success',
          'Mezun girişi kaydedildi',
          'Oturumunuz kapanmış olabilir; tekrar yönetici olarak giriş yapın.',
        )
      } else {
        showToast('success', 'Mezun giriş ayarları güncellendi')
      }
    } catch (err) {
      showToast('error', 'Kaydedilemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setSavingLogin(false)
    }
  }

  const saveGraduateRecord = async () => {
    if (!graduateForm.adSoyad.trim() || !graduateForm.girisYili.trim()) {
      showToast('error', 'Ad soyad ve giriş yılı zorunludur')
      return
    }

    setSavingGraduate(true)
    try {
      if (editing) {
        await updateGraduate(editing.id, graduateForm)
        showToast('success', 'Mezun güncellendi')
      } else {
        await createGraduate(graduateForm)
        showToast('success', 'Mezun eklendi')
      }
      setModalOpen(false)
      await loadAll()
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSavingGraduate(false)
    }
  }

  const removeGraduate = async (graduate: Graduate) => {
    const confirmed = await askConfirm({
      title: 'Mezunu Sil',
      description: `${graduate.adSoyad} kaydı kalıcı olarak silinecek.`,
      confirmLabel: 'Sil',
      cancelLabel: 'Vazgeç',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteGraduate(graduate.id)
      await logAudit({
        islem: 'Mezun Silme',
        detay: graduate.adSoyad,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      showToast('success', 'Mezun silindi')
      await loadAll()
    } catch (err) {
      showToast('error', 'Silinemedi', err instanceof Error ? err.message : undefined)
    }
  }

  if (loading) {
    return <Spinner label="Mezun ayarları yükleniyor..." />
  }

  return (
    <div className="space-y-6">
      <Card accent="primary" className="lg:col-span-2">
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-1 h-6 w-6 text-primary-600" />
          <div className="flex-1">
            <CardTitle>Mezun Girişi</CardTitle>
            <CardDescription>
              Tüm mezunlar bu ortak kullanıcı adı ve şifre ile giriş yapar. İlk kayıtta veya şifre
              değişiminde oturumunuz kapanabilir.
            </CardDescription>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Input
                id="mezun-username"
                label="Ortak Kullanıcı Adı"
                value={loginForm.username}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
              />
              <Input
                id="mezun-password"
                label="Ortak Şifre"
                type="text"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
              />
              <Input
                id="mezun-welcome-title"
                label="Karşılama Başlığı"
                value={loginForm.welcomeTitle || ''}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, welcomeTitle: event.target.value }))}
              />
              <div className="flex items-end">
                <Switch
                  id="mezun-enabled"
                  label="Mezun girişi açık"
                  checked={loginForm.enabled !== false}
                  onChange={(checked) => setLoginForm((prev) => ({ ...prev, enabled: checked }))}
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  id="mezun-welcome-message"
                  label="Karşılama Mesajı"
                  rows={3}
                  value={loginForm.welcomeMessage || ''}
                  onChange={(event) =>
                    setLoginForm((prev) => ({ ...prev, welcomeMessage: event.target.value }))
                  }
                />
              </div>
            </div>

            <Button className="mt-4" onClick={saveLoginSettings} disabled={savingLogin}>
              {savingLogin ? 'Kaydediliyor...' : 'Giriş Bilgilerini Kaydet'}
            </Button>
          </div>
        </div>
      </Card>

      <Card accent="primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Users className="mt-1 h-6 w-6 text-primary-600" />
            <div>
              <CardTitle>Mezun Kayıtları</CardTitle>
              <CardDescription>Giriş yılına göre gruplanan mezun bilgileri</CardDescription>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Yeni Mezun
          </Button>
        </div>

        {graduates.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="Henüz mezun eklenmedi"
            description="Mezunları giriş yılına göre ekleyerek mezun ağını oluşturun."
          />
        ) : (
          <div className="mt-6 space-y-6">
            {[...groups.entries()].map(([year, list]) => (
              <div key={year}>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {year} Girişli Mezunlar
                  </h3>
                  <Badge tone="primary">{list.length}</Badge>
                </div>
                <div className="space-y-2">
                  {list.map((graduate) => (
                    <div
                      key={graduate.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{graduate.adSoyad}</p>
                        <p className="text-sm text-slate-500">
                          {[graduate.gorev, graduate.calistigiYer, graduate.sehir]
                            .filter(Boolean)
                            .join(' · ') || 'Bilgi girilmemiş'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(graduate)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeGraduate(graduate)}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Mezun Düzenle' : 'Yeni Mezun'}
        description="Mezunların portalda göreceği bilgileri girin."
        className="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="graduate-name"
            label="Ad Soyad"
            value={graduateForm.adSoyad}
            onChange={(event) => setGraduateForm((prev) => ({ ...prev, adSoyad: event.target.value }))}
          />
          <Input
            id="graduate-year"
            label="Giriş Yılı"
            type="number"
            value={graduateForm.girisYili}
            onChange={(event) => setGraduateForm((prev) => ({ ...prev, girisYili: event.target.value }))}
          />
          <Input
            id="graduate-bolum"
            label="Bölüm / Alan"
            value={graduateForm.bolum}
            onChange={(event) => setGraduateForm((prev) => ({ ...prev, bolum: event.target.value }))}
          />
          <Input
            id="graduate-mezuniyet"
            label="Mezuniyet Yılı"
            type="number"
            value={graduateForm.mezuniyetYili}
            onChange={(event) =>
              setGraduateForm((prev) => ({ ...prev, mezuniyetYili: event.target.value }))
            }
          />
          <Select
            id="graduate-evlilik"
            label="Evlilik Durumu"
            value={graduateForm.evlilikDurumu}
            onChange={(event) =>
              setGraduateForm((prev) => ({
                ...prev,
                evlilikDurumu: event.target.value as EvlilikDurumu,
              }))
            }
          >
            {EVLILIK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input
            id="graduate-cocuk"
            label="Çocuk Sayısı"
            type="number"
            min={0}
            value={graduateForm.cocukSayisi}
            onChange={(event) =>
              setGraduateForm((prev) => ({ ...prev, cocukSayisi: event.target.value }))
            }
          />
          <Input
            id="graduate-gorev"
            label="Görev / Meslek"
            value={graduateForm.gorev}
            onChange={(event) => setGraduateForm((prev) => ({ ...prev, gorev: event.target.value }))}
          />
          <Input
            id="graduate-workplace"
            label="Çalıştığı Yer"
            value={graduateForm.calistigiYer}
            onChange={(event) =>
              setGraduateForm((prev) => ({ ...prev, calistigiYer: event.target.value }))
            }
          />
          <Input
            id="graduate-city"
            label="Şehir"
            value={graduateForm.sehir}
            onChange={(event) => setGraduateForm((prev) => ({ ...prev, sehir: event.target.value }))}
          />
          <Input
            id="graduate-contact"
            label="İletişim (isteğe bağlı)"
            value={graduateForm.iletisim}
            onChange={(event) =>
              setGraduateForm((prev) => ({ ...prev, iletisim: event.target.value }))
            }
          />
          <Input
            id="graduate-social"
            label="Sosyal medya / bağlantı"
            value={graduateForm.sosyalMedya}
            onChange={(event) =>
              setGraduateForm((prev) => ({ ...prev, sosyalMedya: event.target.value }))
            }
          />
          <div className="sm:col-span-2">
            <ImageUploadField
              id="graduate-photo"
              label="Fotoğraf (isteğe bağlı)"
              value={graduateForm.photoUrl}
              compressOptions={PROFILE_IMAGE_OPTS}
              showUrlInput={false}
              previewClassName="h-28 w-28 rounded-2xl"
              helperText="JPG, PNG veya WebP · Kaydet/Güncelle ile yayınlanır"
              onChange={(photoUrl) => setGraduateForm((prev) => ({ ...prev, photoUrl }))}
              onClear={() => setGraduateForm((prev) => ({ ...prev, photoUrl: '' }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              id="graduate-notes"
              label="Kısa not / güncel durum"
              rows={3}
              value={graduateForm.notlar}
              onChange={(event) => setGraduateForm((prev) => ({ ...prev, notlar: event.target.value }))}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Vazgeç
          </Button>
          <Button onClick={saveGraduateRecord} disabled={savingGraduate}>
            {savingGraduate ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
