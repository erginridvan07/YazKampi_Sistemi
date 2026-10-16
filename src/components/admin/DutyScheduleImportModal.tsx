import { useMemo, useState, type ChangeEvent } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDateTR } from '@/lib/dates'
import { resolveDutyRosterName, type ParsedDutySchedule } from '@/lib/dutyScheduleHelpers'
import { parseDutySchedulePdf } from '@/lib/dutyScheduleParser'
import type { DailyDuty } from '@/types'
import type { DailyDutyImportItem } from '@/services/announcements.service'

type PreviewStatus = 'new' | 'update' | 'unchanged' | 'unresolved'

type PreviewRow = {
  tarih: string
  gunLabel: string
  imam: string
  muezzin: string
  status: PreviewStatus
  existing: Pick<DailyDuty, 'imam' | 'muezzin'> | null
  unresolvedNames: string[]
  adjustedNames: boolean
}

type ImportSummary = {
  newCount: number
  updateCount: number
  unchangedCount: number
}

interface DutyScheduleImportModalProps {
  open: boolean
  onClose: () => void
  rosterNames: string[]
  existingDuties: DailyDuty[]
  onImport: (items: DailyDutyImportItem[], summary: ImportSummary) => Promise<boolean>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Görev çizelgesi PDF okunamadı.'
}

function statusPresentation(status: PreviewStatus) {
  return {
    new: { label: 'Yeni', className: 'text-emerald-700 dark:text-emerald-300' },
    update: { label: 'Güncellenecek', className: 'text-amber-700 dark:text-amber-300' },
    unchanged: { label: 'Değişiklik yok', className: 'text-slate-500 dark:text-slate-400' },
    unresolved: { label: 'İsim kontrolü gerekli', className: 'text-rose-700 dark:text-rose-300' },
  }[status]
}

export function DutyScheduleImportModal({
  open,
  onClose,
  rosterNames,
  existingDuties,
  onImport,
}: DutyScheduleImportModalProps) {
  const [schedule, setSchedule] = useState<ParsedDutySchedule | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const preview = useMemo(() => {
    if (!schedule) return { rows: [] as PreviewRow[], newCount: 0, updateCount: 0, unchangedCount: 0 }

    const dutiesByDate = new Map(existingDuties.map((duty) => [duty.id, duty]))

    let newCount = 0
    let updateCount = 0
    let unchangedCount = 0
    const rows = schedule.entries.map((entry): PreviewRow => {
      const imamMatch = resolveDutyRosterName(entry.imam, rosterNames)
      const muezzinMatch = resolveDutyRosterName(entry.muezzin, rosterNames)
      const imam = imamMatch?.name
      const muezzin = muezzinMatch?.name
      const unresolvedNames = [
        ...(imam ? [] : [entry.imam]),
        ...(muezzin ? [] : [entry.muezzin]),
      ]
      const existingDuty = dutiesByDate.get(entry.tarih)
      const existing = existingDuty
        ? { imam: existingDuty.imam, muezzin: existingDuty.muezzin }
        : null

      if (!imam || !muezzin) {
        return {
          ...entry,
          imam: imam || entry.imam,
          muezzin: muezzin || entry.muezzin,
          status: 'unresolved',
          existing,
          unresolvedNames,
          adjustedNames: false,
        }
      }
      if (!existing) {
        newCount += 1
        return {
          ...entry,
          imam,
          muezzin,
          status: 'new',
          existing,
          unresolvedNames,
          adjustedNames: imamMatch.match !== 'exact' || muezzinMatch.match !== 'exact',
        }
      }
      if (existing.imam === imam && existing.muezzin === muezzin) {
        unchangedCount += 1
        return {
          ...entry,
          imam,
          muezzin,
          status: 'unchanged',
          existing,
          unresolvedNames,
          adjustedNames: imamMatch.match !== 'exact' || muezzinMatch.match !== 'exact',
        }
      }

      updateCount += 1
      return {
        ...entry,
        imam,
        muezzin,
        status: 'update',
        existing,
        unresolvedNames,
        adjustedNames: imamMatch.match !== 'exact' || muezzinMatch.match !== 'exact',
      }
    })

    return { rows, newCount, updateCount, unchangedCount }
  }, [schedule, rosterNames, existingDuties])

  const unresolvedNames = [...new Set(preview.rows.flatMap((row) => row.unresolvedNames))]
  const writeCount = preview.newCount + preview.updateCount

  const reset = () => {
    setSchedule(null)
    setFileName('')
    setParsing(false)
    setSaving(false)
    setMessage('')
  }

  const close = (force = false) => {
    if (!force && (parsing || saving)) return
    reset()
    onClose()
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setParsing(true)
    setMessage('')
    setSchedule(null)
    try {
      setSchedule(await parseDutySchedulePdf(file))
      setFileName(file.name)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (writeCount === 0 || unresolvedNames.length > 0) return
    setSaving(true)
    setMessage('')
    try {
      const items: DailyDutyImportItem[] = preview.rows
        .filter((row) => row.status === 'new' || row.status === 'update')
        .map((row) => ({
          tarih: row.tarih,
          imam: row.imam,
          muezzin: row.muezzin,
          expectedExisting: row.existing,
        }))
      const imported = await onImport(items, {
        newCount: preview.newCount,
        updateCount: preview.updateCount,
        unchangedCount: preview.unchangedCount,
      })
      if (imported) close(true)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Aylık görev PDF’sini aktar"
      description="PDF yalnızca bu cihazda okunur; belge ve kişi bilgileri sisteme yüklenmez."
      className="max-w-3xl"
    >
      <div className="space-y-5">
        <label className="block rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-5 text-center transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40">
          <FileUp className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          <span className="mt-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            İmam/müezzin görev PDF’si seçin
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Metin içeren Gaye görev çizelgesi · En fazla 10 MB
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => void handleFile(event)}
            disabled={parsing || saving}
          />
        </label>

        {parsing ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-300" />
            Görev çizelgesi bu cihazda okunuyor…
          </div>
        ) : null}

        {message ? (
          <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{message}</p>
          </div>
        ) : null}

        {schedule ? (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/25">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <div>
                  <p className="font-semibold text-emerald-950 dark:text-emerald-100">
                    {schedule.entries.length} görev satırı bulundu
                  </p>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">{schedule.rangeLabel}</p>
                  <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                    {preview.newCount} yeni · {preview.updateCount} güncellenecek · {preview.unchangedCount} değişiklik yok
                  </p>
                </div>
              </div>
            </div>

            {unresolvedNames.length > 0 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-100">
                <p className="font-semibold">Öğrenci listesinde bulunamayan isimler</p>
                <p className="mt-1 text-xs">
                  {unresolvedNames.join(', ')}. Bu isimler düzeltilmeden liste kaydedilmez.
                </p>
              </div>
            ) : null}

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              {preview.rows.map((row) => {
                const status = statusPresentation(row.status)
                return (
                  <div key={row.tarih} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.gunLabel} · {formatDateTR(row.tarih)}
                      </p>
                      <span className={`text-xs font-semibold ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      İmam: <b>{row.imam}</b> · Müezzin: <b>{row.muezzin}</b>
                    </p>
                    {row.adjustedNames ? (
                      <p className="mt-1 text-xs text-primary-700 dark:text-primary-300">
                        PDF adı sistemdeki öğrenci adıyla eşleştirildi.
                      </p>
                    ) : null}
                    {row.status === 'update' && row.existing ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Mevcut: İmam {row.existing.imam} · Müezzin {row.existing.muezzin}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Geçmiş tarihli görevler saklanır ancak gün geçince yönetim listesinden otomatik gizlenir.
            </p>

            <Button
              fullWidth
              size="lg"
              onClick={() => void handleImport()}
              disabled={writeCount === 0 || unresolvedNames.length > 0 || saving}
            >
              {saving ? 'Görevler kaydediliyor…' : `${writeCount} görevi içe aktar ve kaydet`}
            </Button>
          </>
        ) : null}

        {fileName ? <p className="text-center text-xs text-slate-500 dark:text-slate-400">Seçilen dosya: {fileName}</p> : null}
      </div>
    </Modal>
  )
}
