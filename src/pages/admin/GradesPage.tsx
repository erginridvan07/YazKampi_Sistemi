import { useEffect, useState } from 'react'
import { FileDown, FileUp, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { GradeEditor } from '@/components/grades/GradeEditor'
import { TranscriptImportModal } from '@/components/grades/TranscriptImportModal'
import { CACHE_KEYS, getCachedQuery } from '@/lib/queryCache'
import { useAsync } from '@/hooks/useAsync'
import {
  fetchStudentById,
  getLatestPeriod,
  saveStudentGrades,
  saveStudentTranscriptGrades,
} from '@/services/grades.service'
import type { TranscriptImportPlan } from '@/lib/transcriptHelpers'
import {
  fetchCourseSuggestions,
  invalidateCourseSuggestionsCache,
  type CourseSuggestion,
} from '@/services/courseSuggestions.service'
import { logAudit } from '@/services/audit.service'
import { downloadGradesPdf } from '@/lib/pdf/gradesPdf'
import { fetchStudentsList, getSinifLabel, groupStudentsByBolum } from '@/services/students.service'
import type { DersNotu, Student } from '@/types'
import { useToastStore } from '@/stores/toast.store'

export function AdminGradesPage() {
  const showToast = useToastStore((s) => s.showToast)
  const { data: students, loading, reload } = useAsync(
    fetchStudentsList,
    [],
    () => getCachedQuery(CACHE_KEYS.studentsList),
  )
  const [selected, setSelected] = useState<Student | null>(null)
  const [period, setPeriod] = useState('1_Guz')
  const [dersler, setDersler] = useState<DersNotu[]>([])
  const [donemOrt, setDonemOrt] = useState('')
  const [genelOrt, setGenelOrt] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false)
  const [courseSuggestions, setCourseSuggestions] = useState<CourseSuggestion[]>([])
  const [suggestionsScopeKey, setSuggestionsScopeKey] = useState('')
  const [baselineCourseNames, setBaselineCourseNames] = useState<string[]>([])

  const openStudent = async (student: Student) => {
    const fresh = await fetchStudentById(student.id)
    if (!fresh) return
    setSelected(fresh)
    const p = getLatestPeriod(fresh.akademikNotlar)
    setPeriod(p)
    loadPeriodData(fresh, p)
    setCourseSuggestions([])
    setSuggestionsScopeKey('')
    setModalOpen(true)
  }

  const loadPeriodData = (student: Student, p: string) => {
    const list = student.akademikNotlar?.[p] || []
    setDersler(list)
    setBaselineCourseNames(list.map((d) => d.ad || ''))
    setDonemOrt(student.donemOrtalamalari?.[p] || '')
    setGenelOrt(student.genelOrt || '')
  }

  useEffect(() => {
    if (!modalOpen || !selected) return

    let cancelled = false
    const { bolum, sinif } = selected
    const scopeKey = `${bolum}:${String(sinif).trim()}:${period}`

    void fetchCourseSuggestions(bolum, sinif, period)
      .then((list) => {
        if (!cancelled) {
          setCourseSuggestions(list)
          setSuggestionsScopeKey(scopeKey)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCourseSuggestions([])
          setSuggestionsScopeKey(scopeKey)
          showToast(
            'error',
            'Ders önerileri yüklenemedi',
            'Ders adını serbestçe yazmaya devam edebilirsiniz.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [modalOpen, selected, period, showToast])

  const closeModal = () => {
    setModalOpen(false)
    setTranscriptModalOpen(false)
    setCourseSuggestions([])
    setSuggestionsScopeKey('')
    setBaselineCourseNames([])
  }

  const handlePeriodChange = (nextPeriod: string) => {
    setCourseSuggestions([])
    setSuggestionsScopeKey('')
    setPeriod(nextPeriod)
    if (selected) loadPeriodData(selected, nextPeriod)
  }

  const activeSuggestionsScopeKey = selected
    ? `${selected.bolum}:${String(selected.sinif).trim()}:${period}`
    : ''
  const visibleCourseSuggestions =
    suggestionsScopeKey === activeSuggestionsScopeKey ? courseSuggestions : []

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await saveStudentGrades(selected.id, period, dersler, donemOrt, genelOrt)
      invalidateCourseSuggestionsCache(selected.bolum, selected.sinif, period)
      await logAudit({
        islem: 'Not Güncelleme',
        detay: `${selected.adSoyad} · ${period}`,
      })
      showToast('success', 'Notlar kaydedildi')
      await reload()
      const fresh = await fetchStudentById(selected.id)
      if (fresh) {
        setSelected(fresh)
        const saved = fresh.akademikNotlar?.[period] || []
        setDersler(saved)
        setBaselineCourseNames(saved.map((d) => d.ad || ''))
        setDonemOrt(fresh.donemOrtalamalari?.[period] || '')
        setGenelOrt(fresh.genelOrt || '')
      }
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const handleTranscriptImport = async (plan: TranscriptImportPlan) => {
    if (!selected) return
    setSaving(true)
    try {
      await saveStudentTranscriptGrades(selected.id, plan, selected.lastUpdate ?? null)
      await logAudit({
        islem: 'Not Güncelleme',
        detay: `${selected.adSoyad} · Transkript ile ${plan.targets.length} dönem aktarıldı`,
      })
      showToast('success', 'Transkript notları kaydedildi')
      await reload()
      const fresh = await fetchStudentById(selected.id)
      if (fresh) {
        setSelected(fresh)
        loadPeriodData(fresh, period)
      }
    } catch (err) {
      showToast('error', 'Transkript aktarımı başarısız', err instanceof Error ? err.message : undefined)
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (loading && !students) return <Spinner />
  const groups = groupStudentsByBolum(students || [])

  return (
    <div className="page-container">
      <PageHeader title="Akademik Not Yönetimi" description="Öğrenci bazlı dönem notlarını düzenleyin." />

      {Object.entries(groups).map(([bolum, list]) => (
          <Card key={bolum} className="mb-6">
            <CardTitle>{bolum}</CardTitle>
            <div className="mt-4 space-y-2">
              {list.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/40"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{student.adSoyad}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {getSinifLabel(student.sinif)} · Oda {student.odaNo}
                    </p>
                  </div>
                  <Button variant="accent" size="sm" onClick={() => openStudent(student)}>
                    <Pencil className="h-4 w-4" /> Dersleri Yönet
                  </Button>
                </div>
              ))}
            </div>
          </Card>
      ))}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={selected?.adSoyad || 'Öğrenci'}
        description={selected ? `${selected.bolum} · ${getSinifLabel(selected.sinif)}` : undefined}
        className="max-w-2xl"
      >
        {selected ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void downloadGradesPdf(selected, 'current', period)}
              >
                <FileDown className="h-4 w-4" /> Bu Dönem PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void downloadGradesPdf(selected, 'all', period)}
              >
                <FileDown className="h-4 w-4" /> Tüm Dönemler PDF
              </Button>
              <Button variant="primary" size="sm" onClick={() => setTranscriptModalOpen(true)}>
                <FileUp className="h-4 w-4" /> Transkript İçe Aktar
              </Button>
            </div>
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
              courseSuggestions={visibleCourseSuggestions}
              baselineCourseNames={baselineCourseNames}
            />
          </>
        ) : null}
      </Modal>
      {selected && transcriptModalOpen ? (
        <TranscriptImportModal
          open={transcriptModalOpen}
          onClose={() => setTranscriptModalOpen(false)}
          existingNotes={{ ...(selected.akademikNotlar || {}), [period]: dersler }}
          existingAverages={{ ...(selected.donemOrtalamalari || {}), [period]: donemOrt }}
          existingGeneralAverage={genelOrt}
          onImport={handleTranscriptImport}
        />
      ) : null}
    </div>
  )
}
