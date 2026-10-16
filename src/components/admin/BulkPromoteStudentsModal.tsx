import { useMemo, useState } from 'react'
import { ArrowUpFromLine } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import {
  buildPromotionPreviewRows,
  formatSinifLabel,
  promotionStatusLabel,
  promotionStatusTone,
  resolvePromotionStatus,
  summarizePromotionRows,
  toBulkPromotePayload,
  VALID_SINIF_OPTIONS,
  type PromotionPreviewRow,
} from '@/lib/studentPromotion'
import { bulkPromoteStudents } from '@/services/students.service'
import { logAudit } from '@/services/audit.service'
import { askConfirm } from '@/stores/confirm.store'
import { useToastStore } from '@/stores/toast.store'
import type { Student } from '@/types'

type BulkPromoteStudentsModalProps = {
  open: boolean
  students: Student[]
  onClose: () => void
  onCompleted: () => Promise<void> | void
}

function updateRow(
  row: PromotionPreviewRow,
  patch: Partial<Pick<PromotionPreviewRow, 'selected' | 'targetSinif'> & { stale?: boolean }>,
): PromotionPreviewRow {
  const next = { ...row, ...patch }
  next.status = resolvePromotionStatus({
    selected: next.selected,
    currentSinif: next.currentSinif,
    targetSinif: next.targetSinif,
    isTerminal: next.isTerminal,
    isUnknown: next.isUnknown,
    stale: next.stale,
  })
  return next
}

export function BulkPromoteStudentsModal({
  open,
  students,
  onClose,
  onCompleted,
}: BulkPromoteStudentsModalProps) {
  if (!open) return null

  return (
    <BulkPromoteStudentsModalBody
      students={students}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  )
}

function BulkPromoteStudentsModalBody({
  students,
  onClose,
  onCompleted,
}: {
  students: Student[]
  onClose: () => void
  onCompleted: () => Promise<void> | void
}) {
  const showToast = useToastStore((s) => s.showToast)
  const [rows, setRows] = useState(() => buildPromotionPreviewRows(students))
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => summarizePromotionRows(rows), [rows])
  const payload = useMemo(() => toBulkPromotePayload(rows), [rows])

  const setSelected = (id: string, selected: boolean) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? updateRow(row, { selected, stale: false }) : row)),
    )
  }

  const setTarget = (id: string, targetSinif: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? updateRow(row, { targetSinif, stale: false }) : row)),
    )
  }

  const handleConfirm = async () => {
    if (payload.length === 0) {
      showToast(
        'warning',
        'Güncellenecek öğrenci yok',
        'En az bir öğrenciyi seçip farklı hedef sınıf belirleyin.',
      )
      return
    }

    const confirmed = await askConfirm({
      title: 'Toplu Sınıf Yükseltme',
      description: `Bu işlem ${payload.length} öğrencinin sınıf bilgisini değiştirecek.`,
      confirmLabel: 'Onayla ve Kaydet',
      cancelLabel: 'Vazgeç',
      variant: 'warning',
      children: (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-slate-800 dark:text-slate-100">
            <span className="font-bold">{payload.length}</span> öğrenci güncellenecek
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-bold">{summary.excluded + summary.unchanged}</span> öğrenci
            atlanacak / aynı kalacak
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-bold">{summary.manualReview}</span> öğrenci son sınıf / manuel karar
          </p>
        </div>
      ),
    })
    if (!confirmed) return

    setSaving(true)
    try {
      const result = await bulkPromoteStudents(payload)

      if (result.staleIds.length > 0) {
        const staleSet = new Set(result.staleIds)
        setRows((prev) =>
          prev.map((row) =>
            staleSet.has(row.id) ? updateRow(row, { selected: false, stale: true }) : row,
          ),
        )
      }

      if (result.updated === 0) {
        showToast(
          'error',
          'Güncelleme yapılamadı',
          result.staleIds.length > 0
            ? 'Bazı kayıtlar değişmiş. Listeyi kontrol edip tekrar deneyin.'
            : 'Seçili öğrenciler için geçerli değişiklik bulunamadı.',
        )
        return
      }

      showToast('success', `${result.updated} öğrencinin sınıfı başarıyla güncellendi.`)
      await logAudit({
        islem: 'Toplu Sınıf Yükseltme',
        detay: `${result.updated} öğrencinin sınıfı yükseltildi`,
      })
      onClose()
      await onCompleted()
    } catch (err) {
      showToast(
        'error',
        'Toplu yükseltme başarısız',
        err instanceof Error ? err.message : 'Lütfen tekrar deneyin.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose()
      }}
      title="Toplu Sınıf Yükselt"
      description="Önizlemeyi kontrol edin. Kaydetmeden hiçbir sınıf değişmez."
      className="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip label="Aktif öğrenci" value={summary.total} />
          <SummaryChip label="Yükseltilecek" value={summary.willUpdate} tone="success" />
          <SummaryChip label="İşlem dışı / aynı" value={summary.excluded + summary.unchanged} />
          <SummaryChip label="Manuel karar" value={summary.manualReview} tone="warning" />
        </div>

        {summary.stale > 0 ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {summary.stale} kayıt canlı veriyle uyuşmuyor. Bu öğrenciler güncellenmedi; tekrar kontrol
            edin.
          </p>
        ) : null}

        <div className="hidden max-h-[50vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 lg:block">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
              <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-3 py-2">
                  <span className="sr-only">Seç</span>
                </th>
                <th className="px-3 py-2">Ad Soyad</th>
                <th className="px-3 py-2">Mevcut Sınıf</th>
                <th className="px-3 py-2">Önerilen / Yeni Sınıf</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-3 align-middle">
                    <input
                      id={`promote-check-${row.id}`}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800"
                      checked={row.selected}
                      disabled={saving || row.isUnknown}
                      onChange={(e) => setSelected(row.id, e.target.checked)}
                      aria-label={`${row.adSoyad} seç`}
                    />
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    <label htmlFor={`promote-check-${row.id}`}>{row.adSoyad}</label>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                    {formatSinifLabel(row.currentSinif)}
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      id={`promote-target-${row.id}`}
                      aria-label={`${row.adSoyad} yeni sınıf`}
                      value={row.targetSinif}
                      disabled={saving || row.isUnknown}
                      onChange={(e) => setTarget(row.id, e.target.value)}
                      className="h-10"
                    >
                      {VALID_SINIF_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={promotionStatusTone(row.status)}>
                      {promotionStatusLabel(row.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto lg:hidden">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="flex items-start gap-3">
                <input
                  id={`promote-check-m-${row.id}`}
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800"
                  checked={row.selected}
                  disabled={saving || row.isUnknown}
                  onChange={(e) => setSelected(row.id, e.target.checked)}
                  aria-label={`${row.adSoyad} seç`}
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor={`promote-check-m-${row.id}`}
                      className="font-bold text-slate-900 dark:text-slate-100"
                    >
                      {row.adSoyad}
                    </label>
                    <Badge tone={promotionStatusTone(row.status)}>
                      {promotionStatusLabel(row.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Mevcut:{' '}
                    <span className="font-semibold">{formatSinifLabel(row.currentSinif)}</span>
                  </p>
                  <Select
                    id={`promote-target-m-${row.id}`}
                    label="Yeni Sınıf"
                    aria-label={`${row.adSoyad} yeni sınıf`}
                    value={row.targetSinif}
                    disabled={saving || row.isUnknown}
                    onChange={(e) => setTarget(row.id, e.target.value)}
                  >
                    {VALID_SINIF_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={saving || payload.length === 0}>
            <ArrowUpFromLine className="h-4 w-4" />
            {saving ? 'Kaydediliyor...' : `Yükseltmeyi Onayla (${payload.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SummaryChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : 'bg-slate-50 text-slate-800 dark:bg-slate-800/60 dark:text-slate-100'

  return (
    <div className={`rounded-xl px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl font-black tabular-nums">{value}</p>
    </div>
  )
}
