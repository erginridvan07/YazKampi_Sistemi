import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { PROFILE_IMAGE_OPTS } from '@/lib/avatar'
import { Button } from '@/components/ui/Button'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { logAudit } from '@/services/audit.service'
import {
  createGraduate,
  DEFAULT_GRADUATE_WELCOME,
  deleteGraduate,
  EMPTY_GRADUATE_FORM,
  fetchGraduateWelcomeSettings,
  fetchGraduates,
  graduateToForm,
  groupGraduatesByYear,
  saveGraduateWelcomeSettings,
  updateGraduate,
} from '@/services/graduates.service'
import { askConfirm } from '@/stores/confirm.store'
import { useToastStore } from '@/stores/toast.store'
import type { EvlilikDurumu, Graduate, GraduateFormData, GraduateWelcomeSettings } from '@/types'

const EVLILIK_OPTIONS: EvlilikDurumu[] = ['Belirtilmemiş', 'Bekar', 'Evli']

export function GraduateSettingsSection() {
  const showToast = useToastStore((s) => s.showToast)

  const [loading, setLoading] = useState(true)
  const [savingLogin, setSavingLogin] = useState(false)
  const [graduates, setGraduates] = useState<Graduate[]>([])

  const [loginForm, setLoginForm] = useState<GraduateWelcomeSettings>({
    welcomeTitle: DEFAULT_GRADUATE_WELCOME.welcomeTitle,
    welcomeMessage: DEFAULT_GRADUATE_WELCOME.welcomeMessage,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Graduate | null>(null)
  const [graduateForm, setGraduateForm] = useState<GraduateFormData>(EMPTY_GRADUATE_FORM)
  const [savingGraduate, setSavingGraduate] = useState(false)

  const groups = useMemo(() => groupGraduatesByYear(graduates), [graduates])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [settings, list] = await Promise.all([
        fetchGraduateWelcomeSettings(),
        fetchGraduates(),
      ])
      setLoginForm({
        welcomeTitle: settings.welcomeTitle,
        welcomeMessage: settings.welcomeMessage,
      })
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
    setSavingLogin(true)
    try {
      await saveGraduateWelcomeSettings(loginForm)

      await logAudit({
        islem: 'Mezun Giriş Ayarları',
        detay: 'Karşılama metinleri güncellendi',
      })

      showToast('success', 'Mezun karşılama ayarları güncellendi')
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
      <CollapsibleSection
        storageKey="gv-settings-mezun-girisi-open"
        accent="primary"
        icon={<GraduationCap className="h-6 w-6 text-primary-600 dark:text-primary-400" />}
        title="Mezun Girişi"
        description="Karşılama metinlerini yönetin. Ortak mezun hesabı kimliği sabittir (mezun.portal)."
      >
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Mezun giriş parolası güvenli yönetim aracıyla değiştirilir. Web panelinden şifre
          görüntülenmez, yazılmaz veya Auth üzerinden güncellenmez. Portalı kapatmak için
          shared Auth hesabı local Admin SDK ile disable edilir; Firestore `enabled` alanı
          güvenlik sınırı değildir.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            id="mezun-welcome-title"
            label="Karşılama Başlığı"
            value={loginForm.welcomeTitle || ''}
            onChange={(event) =>
              setLoginForm((prev) => ({ ...prev, welcomeTitle: event.target.value }))
            }
          />
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
          {savingLogin ? 'Kaydediliyor...' : 'Karşılama Ayarlarını Kaydet'}
        </Button>
      </CollapsibleSection>

      <CollapsibleSection
        storageKey="gv-settings-mezun-kayitlari-open"
        accent="primary"
        icon={<Users className="h-6 w-6 text-primary-600 dark:text-primary-400" />}
        title="Mezun Kayıtları"
        description={`Giriş yılına göre gruplanan mezun bilgileri${graduates.length > 0 ? ` · ${graduates.length} mezun` : ''}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Yeni Mezun
          </Button>
        }
      >
        {graduates.length === 0 ? (
          <EmptyState
            title="Henüz mezun eklenmedi"
            description="Mezunları giriş yılına göre ekleyerek mezun ağını oluşturun."
          />
        ) : (
          <div className="space-y-6">
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
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {graduate.adSoyad}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {[graduate.gorev, graduate.calistigiYer, graduate.sehir]
                            .filter(Boolean)
                            .join(' · ') || 'Bilgi girilmemiş'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(graduate)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGraduate(graduate)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

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
