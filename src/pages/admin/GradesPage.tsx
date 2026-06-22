import { useEffect, useState } from 'react'
import { FileDown, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { GradeEditor } from '@/components/grades/GradeEditor'
import { CACHE_KEYS, getCachedQuery } from '@/lib/queryCache'
import { useAsync } from '@/hooks/useAsync'
import { fetchStudentById, getLatestPeriod, saveStudentGrades } from '@/services/grades.service'
import { logAudit } from '@/services/audit.service'
import { downloadGradesPdf } from '@/lib/pdf/gradesPdf'
import { fetchStudentsList, getSinifLabel, groupStudentsByBolum } from '@/services/students.service'
import type { DersNotu, Student } from '@/types'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function AdminGradesPage() {
  const profile = useAuthStore((s) => s.profile)
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

  const openStudent = async (student: Student) => {
    const fresh = await fetchStudentById(student.id)
    if (!fresh) return
    setSelected(fresh)
    const p = getLatestPeriod(fresh.akademikNotlar)
    setPeriod(p)
    loadPeriodData(fresh, p)
    setModalOpen(true)
  }

  const loadPeriodData = (student: Student, p: string) => {
    setDersler(student.akademikNotlar?.[p] || [])
    setDonemOrt(student.donemOrtalamalari?.[p] || '')
    setGenelOrt(student.genelOrt || '')
  }

  useEffect(() => {
    if (selected) loadPeriodData(selected, period)
  }, [period])

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await saveStudentGrades(selected.id, period, dersler, donemOrt, genelOrt)
      await logAudit({
        islem: 'Not Güncelleme',
        detay: `${selected.adSoyad} · ${period}`,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      showToast('success', 'Notlar kaydedildi')
      await reload()
      const fresh = await fetchStudentById(selected.id)
      if (fresh) setSelected(fresh)
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
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
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-bold text-slate-900">{student.adSoyad}</p>
                    <p className="text-xs text-slate-500">
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
        onClose={() => setModalOpen(false)}
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
            </div>
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
          </>
        ) : null}
      </Modal>
    </div>
  )
}
