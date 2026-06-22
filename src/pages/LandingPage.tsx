import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  BookOpen,
  GraduationCap,
  ExternalLink,
  Heart,
  Mail,
  MapPin,
  Phone,
  Shield,
  Smartphone,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { GalleryCarousel } from '@/components/landing/GalleryCarousel'
import { GalleryImage } from '@/components/landing/GalleryImage'
import { DEFAULT_LANDING_CONTENT, type LandingContent } from '@/config/landing'
import { fetchLandingContent, readLandingPreviewDraft } from '@/services/landing.service'
import { useAuthStore } from '@/stores/auth.store'

const features = [
  { icon: Users, title: 'Öğrenci Takibi', description: 'Kayıt, oda, bölüm ve izin süreçlerini tek panelden yönetin.' },
  { icon: GraduationCap, title: 'Akademik Notlar', description: 'Dönem bazlı not girişi, raporlama ve PDF dışa aktarma.' },
  { icon: BarChart3, title: 'Yoklama & Rapor', description: 'Namaz yoklaması, devamsızlık takvimi ve riskli öğrenci uyarıları.' },
  { icon: Bell, title: 'Duyuru & Nöbet', description: 'Etkinlik duyuruları ve günlük görev çizelgesi.' },
  { icon: Shield, title: 'Güvenli Erişim', description: 'Rol bazlı yetkilendirme ve güvenli giriş.' },
  { icon: Smartphone, title: 'Mobil & PWA', description: 'Her cihazda akıcı deneyim; ana ekrana eklenebilir.' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
      {children}
    </p>
  )
}

export function LandingPage() {
  const profile = useAuthStore((s) => s.profile)
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('onizle') === '1'
  const [content, setContent] = useState<LandingContent>(DEFAULT_LANDING_CONTENT)
  const [loading, setLoading] = useState(true)
  const [previewDraftMissing, setPreviewDraftMissing] = useState(false)

  useEffect(() => {
    if (isPreview) {
      const draft = readLandingPreviewDraft()
      if (draft) {
        setContent(draft)
        setPreviewDraftMissing(false)
        setLoading(false)
        return
      }
      setPreviewDraftMissing(true)
    } else {
      setPreviewDraftMissing(false)
    }

    fetchLandingContent()
      .then(setContent)
      .finally(() => setLoading(false))
  }, [isPreview])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Sayfa yükleniyor..." />
      </div>
    )
  }

  const contact = [
    { icon: MapPin, title: 'Adres', value: content.iletisim.address },
    { icon: Phone, title: 'Telefon', value: content.iletisim.phone },
    { icon: Mail, title: 'E-posta', value: content.iletisim.email },
  ]

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      {isPreview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {previewDraftMissing
            ? 'Önizleme taslağı bulunamadı — kayıtlı site içeriği gösteriliyor. Site düzenleme sayfasından tekrar Önizle\'ye basın.'
            : 'Önizleme modu — kaydedilmemiş değişiklikler gösteriliyor. Beğenirseniz Site sayfasında Kaydet\'e basın.'}
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-lg font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
              G
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">Gaye Vakfı</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Yurt Yönetim Portalı</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300 md:flex">
            <a href="#hakkimizda" className="hover:text-primary-600">Hakkımızda</a>
            <a href="#kurucu" className="hover:text-primary-600">Kurucumuz</a>
            <a href="#misyon" className="hover:text-primary-600">Misyon</a>
            <a href="#galeri" className="hover:text-primary-600">Galeri</a>
            <a href="#iletisim" className="hover:text-primary-600">İletişim</a>
          </nav>
          <div className="flex items-center gap-2">
            {profile?.role === 'admin' ? (
              <Link to="/admin/site">
                <Button variant="accent" size="sm">
                  <ExternalLink className="h-4 w-4" /> Siteyi Düzenle
                </Button>
              </Link>
            ) : null}
            <Link to="/giris">
              <Button variant="secondary">Giriş Yap</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-[2rem] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-8 py-14 text-white shadow-2xl shadow-primary-900/20">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-100">{content.hero.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">{content.hero.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-primary-100">{content.hero.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {content.hero.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{tag}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/giris"><Button variant="accent" size="lg">Portala Giriş Yap</Button></Link>
            <a href="#hakkimizda">
              <Button variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                Daha Fazla
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* HAKKIMIZDA */}
      <section id="hakkimizda" className="border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <SectionLabel>{content.hakkimizda.label}</SectionLabel>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{content.hakkimizda.title}</h2>
          <div className="mt-6 max-w-3xl space-y-4">
            {content.hakkimizda.paragraphs.map((p, i) => (
              <p key={i} className="leading-7 text-slate-600 dark:text-slate-400">{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* KURUCU */}
      <section id="kurucu" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionLabel>{content.kurucu.label}</SectionLabel>
            <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{content.kurucu.title}</h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">{content.kurucu.intro}</p>
          </div>
          <Card className="overflow-hidden p-0">
            {content.kurucu.imageUrl ? (
              <img src={content.kurucu.imageUrl} alt={content.kurucu.name} className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-950 dark:to-primary-900">
                <Heart className="h-16 w-16 text-primary-600 dark:text-primary-300" />
              </div>
            )}
            <div className="p-6">
              <CardTitle>{content.kurucu.name}</CardTitle>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {content.kurucu.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </section>

      {/* MİSYON & VİZYON */}
      <section id="misyon" className="border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <SectionLabel>Misyon & Vizyon</SectionLabel>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">{content.misyon.title}</h2>
              <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">{content.misyon.content}</p>
            </div>
            <Card accent="primary">
              <CardTitle>{content.vizyon.title}</CardTitle>
              <CardDescription className="mt-2 leading-7">{content.vizyon.content}</CardDescription>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {content.vizyon.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ÖZELLİKLER */}
      <section id="ozellikler" className="mx-auto max-w-6xl px-4 py-20">
        <SectionLabel>Portal Özellikleri</SectionLabel>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">Neler sunuyoruz?</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="mt-2">{feature.description}</CardDescription>
              </Card>
            )
          })}
        </div>
      </section>

      {/* YURT HAYATI - Galeri */}
      <section id="galeri" className="border-t border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <SectionLabel>Yurt Hayatı</SectionLabel>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">Yurdumuzdan kareler</h2>
          <div className="mt-8">
            <GalleryCarousel items={content.galeri} />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.galeri.map((item) => (
              <GalleryImage key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* İLETİŞİM */}
      <section id="iletisim" className="mx-auto max-w-6xl px-4 py-20">
        <SectionLabel>İletişim</SectionLabel>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">Bize ulaşın</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {contact.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title}>
                <Icon className="mb-3 h-6 w-6 text-primary-600 dark:text-primary-400" />
                <CardTitle>{item.title}</CardTitle>
                <CardDescription className="mt-2">{item.value}</CardDescription>
              </Card>
            )
          })}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">Öğrenci veya yönetici misiniz?</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hesabınızla portala giriş yapın.</p>
            </div>
          </div>
          <Link to="/giris"><Button size="lg">Giriş Yap</Button></Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Gaye Vakfı · Yurt Yönetim Portalı V2
        </p>
      </footer>
    </div>
  )
}
