import { useEffect, useState } from 'react'
import { ExternalLink, Plus, Save, Trash2 } from 'lucide-react'
import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { PageHeader } from '@/components/admin/PageHeader'
import { KURUCU_IMAGE_OPTS } from '@/lib/avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { DEFAULT_LANDING_CONTENT, type GalleryItem, type LandingContent } from '@/config/landing'
import {
  createGalleryId,
  fetchLandingContent,
  saveLandingContent,
  setLandingPreviewDraft,
} from '@/services/landing.service'
import { logAudit } from '@/services/audit.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

function ParagraphEditor({
  items,
  onChange,
  labelPrefix = 'Paragraf',
}: {
  items: string[]
  onChange: (items: string[]) => void
  labelPrefix?: string
}) {
  return (
    <div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Textarea
              id={`paragraph-${labelPrefix}-${i}`}
              label={`${labelPrefix} ${i + 1}`}
              value={item}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
            />
            <Button
              variant="danger"
              size="icon"
              className="mt-6 shrink-0"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" className="mt-2" onClick={() => onChange([...items, ''])}>
        <Plus className="h-4 w-4" /> Paragraf Ekle
      </Button>
    </div>
  )
}

function BulletEditor({
  items,
  onChange,
  label,
}: {
  items: string[]
  onChange: (items: string[]) => void
  label: string
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              id={`bullet-${label}-${i}`}
              value={item}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
            />
            <Button variant="danger" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" className="mt-2" onClick={() => onChange([...items, ''])}>
        <Plus className="h-4 w-4" /> Madde Ekle
      </Button>
    </div>
  )
}

export function AdminSitePage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const [content, setContent] = useState<LandingContent>(DEFAULT_LANDING_CONTENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchLandingContent()
      .then(setContent)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveLandingContent(content, profile?.adSoyad || 'Yönetici')
      await logAudit({
        islem: 'Site İçeriği Güncelleme',
        detay: 'Ana sayfa (landing) düzenlendi',
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      const refreshed = await fetchLandingContent()
      setContent(refreshed)
      showToast('success', 'Site içeriği kaydedildi', 'Önizle ile kontrol edebilirsiniz')
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    setLandingPreviewDraft(content)
    const previewUrl = `${window.location.origin}/?onizle=1`
    window.open(previewUrl, '_blank')
  }

  const updateGaleri = (index: number, patch: Partial<GalleryItem>) => {
    const next = [...content.galeri]
    next[index] = { ...next[index], ...patch }
    setContent({ ...content, galeri: next })
  }

  if (loading) return <Spinner />

  return (
    <div className="page-container">
      <PageHeader
        title="Site Düzenleme"
        description="Giriş yapmadan önce görünen ana sayfa içeriğini buradan düzenleyin."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handlePreview}>
              <ExternalLink className="h-4 w-4" /> Önizle
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/30">
          <CardTitle className="text-primary-800 dark:text-primary-200">Fotoğraflar</CardTitle>
          <CardDescription className="mt-2 text-primary-700 dark:text-primary-300">
            Galeri ve kurucu bölümünde <strong>Fotoğraf Yükle</strong> ile bilgisayarınızdan görsel
            seçebilirsiniz. Firebase Storage veya ücret gerekmez; kayıt için <strong>Kaydet</strong>{' '}
            yeterli. Çok sayıda büyük fotoğraf eklemeyin (en fazla 6–8 önerilir).
          </CardDescription>
        </Card>

        <Card accent="primary">
          <CardTitle>Üst Banner (Hero)</CardTitle>
          <div className="mt-4 space-y-4">
            <Input id="hero-eyebrow" label="Üst etiket" value={content.hero.eyebrow}
              onChange={(e) => setContent({ ...content, hero: { ...content.hero, eyebrow: e.target.value } })} />
            <Textarea id="hero-title" label="Ana başlık" value={content.hero.title}
              onChange={(e) => setContent({ ...content, hero: { ...content.hero, title: e.target.value } })} />
            <Textarea id="hero-desc" label="Açıklama" value={content.hero.description}
              onChange={(e) => setContent({ ...content, hero: { ...content.hero, description: e.target.value } })} />
            <Input id="hero-tags" label="Etiketler (virgülle ayırın)"
              value={content.hero.tags.join(', ')}
              onChange={(e) => setContent({
                ...content,
                hero: { ...content.hero, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) },
              })} />
          </div>
        </Card>

        <Card>
          <CardTitle>Hakkımızda</CardTitle>
          <CardDescription>Kurucumuz bölümünden önce görünür</CardDescription>
          <div className="mt-4 space-y-4">
            <Input id="hakk-label" label="Bölüm etiketi" value={content.hakkimizda.label}
              onChange={(e) => setContent({ ...content, hakkimizda: { ...content.hakkimizda, label: e.target.value } })} />
            <Input id="hakk-title" label="Başlık" value={content.hakkimizda.title}
              onChange={(e) => setContent({ ...content, hakkimizda: { ...content.hakkimizda, title: e.target.value } })} />
            {content.hakkimizda.paragraphs.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Textarea
                  id={`hakk-p-${i}`}
                  label={`Paragraf ${i + 1}`}
                  value={p}
                  onChange={(e) => {
                    const paragraphs = [...content.hakkimizda.paragraphs]
                    paragraphs[i] = e.target.value
                    setContent({ ...content, hakkimizda: { ...content.hakkimizda, paragraphs } })
                  }}
                />
                <Button
                  variant="danger"
                  size="icon"
                  className="mt-6 shrink-0"
                  onClick={() => setContent({
                    ...content,
                    hakkimizda: {
                      ...content.hakkimizda,
                      paragraphs: content.hakkimizda.paragraphs.filter((_, j) => j !== i),
                    },
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setContent({
              ...content,
              hakkimizda: { ...content.hakkimizda, paragraphs: [...content.hakkimizda.paragraphs, ''] },
            })}>
              <Plus className="h-4 w-4" /> Paragraf Ekle
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Kurucumuz</CardTitle>
          <div className="mt-4 space-y-4">
            <Input id="kurucu-label" label="Bölüm etiketi" value={content.kurucu.label}
              onChange={(e) => setContent({ ...content, kurucu: { ...content.kurucu, label: e.target.value } })} />
            <Input id="kurucu-title" label="Başlık" value={content.kurucu.title}
              onChange={(e) => setContent({ ...content, kurucu: { ...content.kurucu, title: e.target.value } })} />
            <Textarea id="kurucu-intro" label="Giriş metni" value={content.kurucu.intro}
              onChange={(e) => setContent({ ...content, kurucu: { ...content.kurucu, intro: e.target.value } })} />
            <Input id="kurucu-name" label="İsim" value={content.kurucu.name}
              onChange={(e) => setContent({ ...content, kurucu: { ...content.kurucu, name: e.target.value } })} />
            <ImageUploadField
              id="kurucu-image"
              label="Kurucu fotoğrafı"
              value={content.kurucu.imageUrl}
              compressOptions={KURUCU_IMAGE_OPTS}
              previewClassName="h-32 w-full max-w-sm"
              onChange={(imageUrl) =>
                setContent({ ...content, kurucu: { ...content.kurucu, imageUrl } })
              }
              onClear={() =>
                setContent({ ...content, kurucu: { ...content.kurucu, imageUrl: '' } })
              }
            />
            <BulletEditor
              label="Öne çıkan maddeler"
              items={content.kurucu.bullets}
              onChange={(bullets) => setContent({ ...content, kurucu: { ...content.kurucu, bullets } })}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Misyon & Vizyon</CardTitle>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Input id="misyon-title" label="Misyon başlığı" value={content.misyon.title}
                onChange={(e) => setContent({ ...content, misyon: { ...content.misyon, title: e.target.value } })} />
              <ParagraphEditor
                labelPrefix="Misyon paragrafı"
                items={content.misyon.paragraphs}
                onChange={(paragraphs) => setContent({ ...content, misyon: { ...content.misyon, paragraphs } })}
              />
            </div>
            <div className="space-y-4">
              <Input id="vizyon-title" label="Vizyon başlığı" value={content.vizyon.title}
                onChange={(e) => setContent({ ...content, vizyon: { ...content.vizyon, title: e.target.value } })} />
              <ParagraphEditor
                labelPrefix="Vizyon paragrafı"
                items={content.vizyon.paragraphs}
                onChange={(paragraphs) => setContent({ ...content, vizyon: { ...content.vizyon, paragraphs } })}
              />
              <BulletEditor
                label="Vizyon maddeleri"
                items={content.vizyon.bullets}
                onChange={(bullets) => setContent({ ...content, vizyon: { ...content.vizyon, bullets } })}
              />
            </div>
          </div>
        </Card>

        <Card accent="warning">
          <CardTitle>Galeri (Yurt Hayatı)</CardTitle>
          <CardDescription>Üstte fotoğraflar döner, altta kartlar halinde görünür</CardDescription>
          <div className="mt-4 space-y-4">
            {content.galeri.map((item, index) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap gap-4">
                  {item.src ? (
                    <img src={item.src} alt="" className="h-24 w-32 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className={`flex h-24 w-32 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} text-xs text-white`}>
                      Önizleme
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <Input id={`gal-label-${item.id}`} label="Alan adı" value={item.label}
                      onChange={(e) => updateGaleri(index, { label: e.target.value })} />
                    <ImageUploadField
                      id={`gal-image-${item.id}`}
                      value={item.src}
                      showUrlInput={false}
                      previewClassName="hidden"
                      onChange={(src) => updateGaleri(index, { src })}
                      onClear={() => updateGaleri(index, { src: '' })}
                    />
                    <Button variant="danger" size="sm" onClick={() => setContent({
                      ...content,
                      galeri: content.galeri.filter((_, i) => i !== index),
                    })}>
                      <Trash2 className="h-4 w-4" /> Alanı Kaldır
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setContent({
              ...content,
              galeri: [...content.galeri, {
                id: createGalleryId(),
                label: 'Yeni Alan',
                gradient: 'from-slate-500 to-slate-700',
              }],
            })}>
              <Plus className="h-4 w-4" /> Galeri Alanı Ekle
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>İletişim</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Textarea id="iletisim-adres" label="Adres" value={content.iletisim.address}
              onChange={(e) => setContent({ ...content, iletisim: { ...content.iletisim, address: e.target.value } })} />
            <Input id="iletisim-tel" label="Telefon" value={content.iletisim.phone}
              onChange={(e) => setContent({ ...content, iletisim: { ...content.iletisim, phone: e.target.value } })} />
            <Input id="iletisim-email" label="E-posta" value={content.iletisim.email}
              onChange={(e) => setContent({ ...content, iletisim: { ...content.iletisim, email: e.target.value } })} />
          </div>
        </Card>

        <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
          <Save className="h-5 w-5" /> Tüm Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  )
}
