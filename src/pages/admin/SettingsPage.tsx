import { GraduateSettingsSection } from '@/components/admin/GraduateSettingsSection'
import { PageHeader } from '@/components/admin/PageHeader'

export function AdminSettingsPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Sistem Ayarları"
        description="Mezun ağı karşılama metinleri ve mezun kayıt yönetimi"
      />

      <GraduateSettingsSection />
    </div>
  )
}
