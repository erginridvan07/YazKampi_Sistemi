import { useState } from 'react'
import { FileDown, FileUp } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { GradeEditor } from '@/components/grades/GradeEditor'
import { TranscriptImportModal } from '@/components/grades/TranscriptImportModal'
import { useAsync } from '@/hooks/useAsync'
import { downloadGradesPdf } from '@/lib/pdf/gradesPdf'
import {
  fetchOwnStudentRecord,
  getLatestPeriod,
  saveOwnStudentGrades,
  saveOwnStudentTranscriptGrades,
} from '@/services/grades.service'
import type { TranscriptImportPlan } from '@/lib/transcriptHelpers'
import type { DersNotu, Student } from '@/types'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function StudentGradesPage() {
  const profile = useAuthStore((s) => s.profile)
  const { data: student, loading, reload } = useAsync(
    () => fetchOwnStudentRecord(profile),
    [profile?.uid, profile?.legacyDocId, profile?.legacyCollection],
  )

  if (loading) return <Spinner />

  if (!student) {
    return (
      <div className="page-container">
        <Card>
          Öğrenci kaydı bulunamadı. Hesabınızın öğrenci belgesine bağlı olduğundan emin olun
          (users profilinde legacyDocId).
        </Card>
      </div>
    )
  }

  return (
    <StudentGradesEditor
      key={`${student.id}-${student.lastUpdate ?? 'initial'}`}
      student={student}
      onReload={reload}
    />
  )
}

function StudentGradesEditor({
  student,
  onReload,
}: {
  student: Student
  onReload: () => Promise<void>
}) {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const [period, setPeriod] = useState(() => getLatestPeriod(student.akademikNotlar))
  const [akademikNotlar, setAkademikNotlar] = useState<Record<string, DersNotu[]>>(
    () => student.akademikNotlar || {},
  )
  const [donemOrtalamalari, setDonemOrtalamalari] = useState<Record<string, string>>(
    () => student.donemOrtalamalari || {},
  )
  const [dersler, setDersler] = useState<DersNotu[]>(() => student.akademikNotlar?.[period] || [])
  const [donemOrt, setDonemOrt] = useState(() => student.donemOrtalamalari?.[period] || '')
  const [genelOrt, setGenelOrt] = useState(() => student.genelOrt || '')
  const [lastUpdate, setLastUpdate] = useState<string | null>(student.lastUpdate ?? null)
  const [saving, setSaving] = useState(false)
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false)

  const handlePeriodChange = (nextPeriod: string) => {
    setPeriod(nextPeriod)
    setDersler(akademikNotlar[nextPeriod] || [])
    setDonemOrt(donemOrtalamalari[nextPeriod] || '')
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const result = await saveOwnStudentGrades(
        profile,
        period,
        dersler,
        donemOrt,
        genelOrt,
        lastUpdate,
      )
      setAkademikNotlar(result.akademikNotlar)
      setDonemOrtalamalari(result.donemOrtalamalari)
      setDersler(result.dersler)
      setDonemOrt(result.donemOrt)
      setGenelOrt(result.genelOrt)
      setLastUpdate(result.lastUpdate)
      showToast('success', 'Notlar kaydedildi')
      await onReload()
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const handleTranscriptImport = async (plan: TranscriptImportPlan) => {
    if (!profile) return
    setSaving(true)
    try {
      const result = await saveOwnStudentTranscriptGrades(profile, plan, lastUpdate)
      setAkademikNotlar(result.akademikNotlar)
      setDonemOrtalamalari(result.donemOrtalamalari)
      setDersler(result.akademikNotlar[period] || [])
      setDonemOrt(result.donemOrtalamalari[period] || '')
      setGenelOrt(result.genelOrt)
      setLastUpdate(result.lastUpdate)
      showToast('success', 'Transkript notları kaydedildi')
      await onReload()
    } catch (err) {
      showToast('error', 'Transkript aktarımı başarısız', err instanceof Error ? err.message : undefined)
      throw err
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Notlarım"
        description={`${student.bolum} · ${student.sinif}. Sınıf`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => setTranscriptModalOpen(true)}>
              <FileUp className="h-4 w-4" /> Transkript İçe Aktar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void downloadGradesPdf(student, 'all', period)}
            >
              <FileDown className="h-4 w-4" /> PDF İndir
            </Button>
          </div>
        }
      />
      <Card>
        <GradeEditor
          period={period}
          onPeriodChange={handlePeriodChange}
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
      {transcriptModalOpen ? (
        <TranscriptImportModal
          open={transcriptModalOpen}
          onClose={() => setTranscriptModalOpen(false)}
          existingNotes={{ ...akademikNotlar, [period]: dersler }}
          existingAverages={{ ...donemOrtalamalari, [period]: donemOrt }}
          existingGeneralAverage={genelOrt}
          onImport={handleTranscriptImport}
        />
      ) : null}
    </div>
  )
}
