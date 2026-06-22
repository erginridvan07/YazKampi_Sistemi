import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { GradeEditor } from '@/components/grades/GradeEditor'
import { useAsync } from '@/hooks/useAsync'
import { fetchStudentByUsername, getLatestPeriod, saveStudentGrades } from '@/services/grades.service'
import { downloadGradesPdf } from '@/lib/pdf/gradesPdf'
import type { DersNotu } from '@/types'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function StudentGradesPage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const { data: student, loading, reload } = useAsync(
    () => fetchStudentByUsername(profile?.username || ''),
    [profile?.username],
  )

  const [period, setPeriod] = useState('1_Guz')
  const [dersler, setDersler] = useState<DersNotu[]>([])
  const [donemOrt, setDonemOrt] = useState('')
  const [genelOrt, setGenelOrt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!student) return
    const p = getLatestPeriod(student.akademikNotlar)
    setPeriod(p)
    setDersler(student.akademikNotlar?.[p] || [])
    setDonemOrt(student.donemOrtalamalari?.[p] || '')
    setGenelOrt(student.genelOrt || '')
  }, [student])

  useEffect(() => {
    if (!student) return
    setDersler(student.akademikNotlar?.[period] || [])
    setDonemOrt(student.donemOrtalamalari?.[period] || '')
  }, [period, student])

  const handleSave = async () => {
    if (!student) return
    setSaving(true)
    try {
      await saveStudentGrades(student.id, period, dersler, donemOrt, genelOrt)
      showToast('success', 'Notlar kaydedildi')
      await reload()
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  if (!student) {
    return (
      <div className="page-container">
        <Card>Öğrenci kaydı bulunamadı.</Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Notlarım"
        description={`${student.bolum} · ${student.sinif}. Sınıf`}
        action={
          <Button variant="secondary" size="sm" onClick={() => void downloadGradesPdf(student, 'all', period)}>
            <FileDown className="h-4 w-4" /> PDF İndir
          </Button>
        }
      />
      <Card>
        <GradeEditor
          period={period}
          onPeriodChange={setPeriod}
          dersler={dersler}
          onDerslerChange={setDersler}
          donemOrt={donemOrt}
          genelOrt={genelOrt}
          onDonemOrtChange={setDonemOrt}
          onGenelOrtChange={setGenelOrt}
          onSave={handleSave}
          saving={saving}
        />
      </Card>
    </div>
  )
}
