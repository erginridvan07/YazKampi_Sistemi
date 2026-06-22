import { useMemo, useRef, useState } from 'react'
import { FileDown, FileSpreadsheet, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { ProfileAvatar } from '@/components/shared/ProfileAvatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { ListSkeleton } from '@/components/ui/ListSkeleton'
import { Switch } from '@/components/ui/Switch'
import { EmptyState } from '@/components/ui/EmptyState'
import { BOLUMLER, DONEMLER, ODALAR, SINIFLAR } from '@/config/constants'
import { CACHE_KEYS, getCachedQuery } from '@/lib/queryCache'
import { useAsync } from '@/hooks/useAsync'
import {
  createStudent,
  deleteStudent,
  fetchStudentsList,
  getSinifLabel,
  groupStudentsByBolum,
  importStudentsBatch,
  updateStudent,
} from '@/services/students.service'
import {
  exportStudentsExcel,
  exportStudentsTemplate,
  parseStudentsExcel,
  type ImportPreview,
} from '@/lib/excel/studentsExcel'
import { logAudit } from '@/services/audit.service'
import type { Student, StudentFormData } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

const emptyForm: StudentFormData = {
  adSoyad: '',
  username: '',
  password: '',
  bolum: 'İlahiyat',
  sinif: '1',
  odaNo: '1',
  donem: 'Güz',
  canManageAttendance: false,
}

export function AdminStudentsPage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const { data: students, loading, reload } = useAsync(
    fetchStudentsList,
    [],
    () => getCachedQuery(CACHE_KEYS.studentsList),
  )
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!students) return []
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.adSoyad.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        String(s.odaNo).includes(q),
    )
  }, [students, search])

  const groups = useMemo(() => groupStudentsByBolum(filtered), [filtered])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setForm({
      adSoyad: student.adSoyad,
      username: student.username,
      password: student.password || '',
      bolum: student.bolum,
      sinif: String(student.sinif),
      odaNo: String(student.odaNo),
      donem: student.donem || 'Güz',
      canManageAttendance: student.canManageAttendance || false,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.adSoyad || !form.username || !form.password || !form.bolum || !form.odaNo) {
      showToast('error', 'Lütfen zorunlu alanları doldurun')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateStudent(editing.id, form)
        showToast('success', 'Öğrenci güncellendi')
      } else {
        await createStudent(form)
        showToast('success', 'Öğrenci kaydedildi')
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      showToast('error', 'Kayıt başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const preview = await parseStudentsExcel(file)
      if (preview.valid.length === 0 && preview.invalid.length === 0) {
        showToast('error', 'Excel dosyası boş veya okunamadı')
        return
      }
      setImportPreview(preview)
    } catch (err) {
      showToast('error', 'Dosya okunamadı', err instanceof Error ? err.message : undefined)
    }
  }

  const handleImportConfirm = async () => {
    if (!importPreview || !students) return

    const confirmed = await askConfirm({
      title: 'Excel İçe Aktarma',
      description: `${importPreview.valid.length} geçerli kayıt eklenecek. Devam edilsin mi?`,
      confirmLabel: 'Evet, Aktar',
      cancelLabel: 'Vazgeç',
      variant: 'warning',
    })
    if (!confirmed) return

    setImporting(true)
    try {
      const usernames = new Set(students.map((s) => s.username.toLowerCase()))
      const result = await importStudentsBatch(
        importPreview.valid.map((r) => r.data),
        usernames,
      )
      await logAudit({
        islem: 'Excel İçe Aktarma',
        detay: `${result.created} eklendi, ${result.skipped} atlandı`,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      showToast(
        'success',
        'İçe aktarma tamamlandı',
        `${result.created} yeni · ${result.skipped} atlandı · ${importPreview.invalid.length} hatalı satır`,
      )
      setImportPreview(null)
      await reload()
    } catch (err) {
      showToast('error', 'İçe aktarma başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (student: Student) => {
    const confirmed = await askConfirm({
      title: 'Öğrenciyi Sil',
      description: 'Bu öğrenci kaydı kalıcı olarak silinecek. Emin misiniz?',
      confirmLabel: 'Evet, Sil',
      cancelLabel: 'Vazgeç',
      variant: 'danger',
      children: (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm">
          <p className="font-bold text-slate-900">{student.adSoyad}</p>
          <p className="mt-1 text-slate-600">
            {student.bolum} · Oda {student.odaNo} · @{student.username}
          </p>
        </div>
      ),
    })
    if (!confirmed) return
    try {
      await deleteStudent(student.id)
      await logAudit({
        islem: 'Öğrenci Silme',
        detay: student.adSoyad,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      showToast('success', 'Öğrenci silindi')
      await reload()
    } catch (err) {
      showToast('error', 'Silme başarısız', err instanceof Error ? err.message : undefined)
    }
  }

  if (loading && !students) {
    return (
      <div className="page-container">
        <PageHeader title="Öğrenci Yönetimi" description="Kayıtlı öğrencileri görüntüleyin, ekleyin ve düzenleyin." />
        <ListSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Öğrenci Yönetimi"
        description="Kayıtlı öğrencileri görüntüleyin, ekleyin ve düzenleyin."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void exportStudentsTemplate()}>
              <FileSpreadsheet className="h-4 w-4" /> Şablon
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => students && void exportStudentsExcel(students)}
              disabled={!students?.length}
            >
              <FileDown className="h-4 w-4" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4" /> İçe Aktar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Yeni Öğrenci
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <Input
          id="search"
          placeholder="Ad, kullanıcı adı veya oda no ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {Object.keys(groups).length === 0 ? (
        <EmptyState title="Öğrenci bulunamadı" description="Arama kriterlerini değiştirin veya yeni öğrenci ekleyin." />
      ) : (
        Object.entries(groups).map(([bolum, list]) => (
            <Card key={bolum} className="mb-6">
              <div className="mb-4 flex items-center gap-2">
                <CardTitle>{bolum}</CardTitle>
                <Badge tone="primary">{list.length} öğrenci</Badge>
              </div>
              <div className="space-y-2">
                {list.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ProfileAvatar
                        name={student.adSoyad}
                        photoUrl={student.photoUrl}
                        size="list"
                        className="rounded-xl"
                      />
                      <div>
                        <p className="font-bold text-slate-900">
                          {student.adSoyad}
                          {student.canManageAttendance ? (
                            <Badge className="ml-2" tone="primary">
                              Yetkili
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500">
                          Oda {student.odaNo} · {getSinifLabel(student.sinif)} · @{student.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(student)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(student)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Öğrenci Düzenle' : 'Yeni Öğrenci Kaydı'}
      >
        <div className="space-y-4">
          <Input
            id="adSoyad"
            label="Ad Soyad"
            value={form.adSoyad}
            onChange={(e) => setForm({ ...form, adSoyad: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="bolum"
              label="Bölüm"
              value={form.bolum}
              onChange={(e) => setForm({ ...form, bolum: e.target.value })}
            >
              {BOLUMLER.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <Select
              id="sinif"
              label="Sınıf"
              value={form.sinif}
              onChange={(e) => setForm({ ...form, sinif: e.target.value })}
            >
              {SINIFLAR.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              id="odaNo"
              label="Oda"
              value={form.odaNo}
              onChange={(e) => setForm({ ...form, odaNo: e.target.value })}
            >
              {ODALAR.map((o) => (
                <option key={o} value={o}>
                  {o}. Oda
                </option>
              ))}
            </Select>
            <Select
              id="donem"
              label="Dönem"
              value={form.donem}
              onChange={(e) => setForm({ ...form, donem: e.target.value })}
            >
              {DONEMLER.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <Input
            id="username"
            label="Kullanıcı Adı"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <Input
            id="password"
            label="Şifre"
            type="text"
            autoComplete="off"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Switch
            id="canManage"
            label="Yoklama yetkisi ver"
            checked={form.canManageAttendance}
            onChange={(checked) => setForm({ ...form, canManageAttendance: checked })}
          />
          <Button fullWidth size="lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!importPreview}
        onClose={() => setImportPreview(null)}
        title="Excel İçe Aktarma Önizleme"
        className="max-w-lg"
      >
        {importPreview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                <p className="font-bold text-emerald-800 dark:text-emerald-200">Geçerli</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {importPreview.valid.length}
                </p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                <p className="font-bold text-rose-800 dark:text-rose-200">Hatalı</p>
                <p className="text-2xl font-black text-rose-700 dark:text-rose-300">
                  {importPreview.invalid.length}
                </p>
              </div>
            </div>
            {importPreview.invalid.length > 0 ? (
              <div className="max-h-32 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                {importPreview.invalid.map((row) => (
                  <p key={row.rowNumber} className="text-rose-600 dark:text-rose-400">
                    Satır {row.rowNumber}: {row.error}
                  </p>
                ))}
              </div>
            ) : null}
            <Button fullWidth onClick={handleImportConfirm} disabled={importing || importPreview.valid.length === 0}>
              {importing ? 'Aktarılıyor...' : `${importPreview.valid.length} Öğrenciyi Aktar`}
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
