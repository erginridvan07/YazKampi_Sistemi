import { useEffect, useState } from 'react'
import { Database, ShieldAlert } from 'lucide-react'
import { GraduateSettingsSection } from '@/components/admin/GraduateSettingsSection'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { logAudit } from '@/services/audit.service'
import {
  migrateAttendanceDatesToISO,
  previewAttendanceDateMigration,
  type MigrationPreview,
} from '@/services/migration.service'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function AdminSettingsPage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)

  const loadPreview = async () => {
    setLoading(true)
    try {
      setPreview(await previewAttendanceDateMigration())
    } catch (err) {
      showToast('error', 'Önizleme yüklenemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPreview()
  }, [])

  const handleMigrate = async () => {
    if (!preview || preview.legacyCount === 0) {
      showToast('info', 'Dönüştürülecek kayıt yok')
      return
    }

    const confirmed = await askConfirm({
      title: 'Tarih Formatını Dönüştür',
      description: `${preview.legacyCount} yoklama kaydı DD.MM.YYYY → YYYY-MM-DD formatına çevrilecek. Bu işlem geri alınamaz.`,
      confirmLabel: 'Evet, Dönüştür',
      cancelLabel: 'Vazgeç',
      variant: 'warning',
    })

    if (!confirmed) return

    setMigrating(true)
    try {
      const result = await migrateAttendanceDatesToISO()
      await logAudit({
        islem: 'Tarih Migrasyonu',
        detay: `${result.updated} kayıt güncellendi, ${result.skipped} atlandı`,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      showToast('success', 'Migrasyon tamamlandı', `${result.updated} kayıt güncellendi`)
      await loadPreview()
    } catch (err) {
      showToast('error', 'Migrasyon başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Sistem Ayarları"
        description="Mezun ağı, veri migrasyonu ve güvenlik yapılandırması"
      />

      <GraduateSettingsSection />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card accent="primary">
          <div className="flex items-start gap-3">
            <Database className="mt-1 h-6 w-6 text-primary-600" />
            <div className="flex-1">
              <CardTitle>Yoklama Tarih Migrasyonu</CardTitle>
              <CardDescription>
                Eski kayıtları standart YYYY-MM-DD formatına çevirir. Yeni kayıtlar zaten bu formatta
                saklanır.
              </CardDescription>

              {loading ? (
                <Spinner label="Analiz ediliyor..." />
              ) : preview ? (
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <dt className="text-slate-500">Toplam kayıt</dt>
                    <dd className="font-bold">{preview.total}</dd>
                  </div>
                  <div className="flex justify-between rounded-xl bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
                    <dt className="text-amber-800 dark:text-amber-200">Eski format (DD.MM.YYYY)</dt>
                    <dd className="font-bold text-amber-900 dark:text-amber-100">{preview.legacyCount}</dd>
                  </div>
                  <div className="flex justify-between rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
                    <dt className="text-emerald-800 dark:text-emerald-200">Yeni format (YYYY-MM-DD)</dt>
                    <dd className="font-bold text-emerald-900 dark:text-emerald-100">{preview.isoCount}</dd>
                  </div>
                </dl>
              ) : null}

              <Button
                className="mt-4"
                variant="accent"
                onClick={handleMigrate}
                disabled={migrating || !preview?.legacyCount}
              >
                {migrating ? 'Dönüştürülüyor...' : 'Migrasyonu Başlat'}
              </Button>
            </div>
          </div>
        </Card>

        <Card accent="warning">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-6 w-6 text-amber-600" />
            <div>
              <CardTitle>Kurulum Adımları</CardTitle>
              <CardDescription className="mt-2">
                Proje klasöründe terminal açıp sırayla çalıştırın. Detaylı rehber:{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">KURULUM_SIRASI.md</code>
              </CardDescription>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-400">
                <li>
                  <span className="font-semibold">Firestore kuralları:</span>{' '}
                  <code className="text-xs">npm run deploy:firestore</code> (Storage gerekmez)
                </li>
                <li>
                  <span className="font-semibold">Fotoğraflar:</span>{' '}
                  <code className="text-xs">public/gallery/</code> klasörü + Site sayfasında adres
                </li>
                <li>
                  <span className="font-semibold">Site içeriği:</span> Admin → Site menüsünden kaydedin
                </li>
                <li>
                  <span className="font-semibold">Push fonksiyonları:</span>{' '}
                  <code className="text-xs">npm run deploy:functions</code>
                </li>
                <li>
                  <span className="font-semibold">İnternete aç:</span>{' '}
                  <code className="text-xs">npm run deploy:hosting</code>
                </li>
              </ol>
            </div>
          </div>
        </Card>

        <Card accent="warning">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 h-6 w-6 text-amber-600" />
            <div>
              <CardTitle>Sıkı Güvenlik Kuralları</CardTitle>
              <CardDescription className="mt-2">
                Tüm kullanıcılar Firebase Auth&apos;a taşındıktan sonra{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">firestore.rules.strict</code>{' '}
                dosyasını Firebase Console&apos;a yükleyin.
              </CardDescription>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>• Legacy koleksiyonlarda herkese açık okuma kaldırılır</li>
                <li>• Yönetici / öğrenci ayrımı kurallara eklenir</li>
                <li>• İşlem günlüğü sadece yöneticiler tarafından okunur</li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Migrasyon tamamlanmadan sıkı kuralları yayınlamayın — giriş bozulabilir.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
