import { useMemo, useState, type ChangeEvent } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle } from 'lucide-react'
import { PERIOD_OPTIONS } from '@/config/constants'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import {
  buildTranscriptImportPlan,
  type TranscriptImportPlan,
} from '@/lib/transcriptHelpers'
import { parseTranscriptPdf } from '@/lib/transcriptParser'
import type { DersNotu } from '@/types'

interface TranscriptImportModalProps {
  open: boolean
  onClose: () => void
  existingNotes: Record<string, DersNotu[]>
  existingAverages: Record<string, string>
  existingGeneralAverage: string
  onImport: (plan: TranscriptImportPlan) => Promise<void>
}

function periodLabel(period: string): string {
  return PERIOD_OPTIONS.find((item) => item.value === period)?.label || period
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Transkript PDF okunamadı.'
}

export function TranscriptImportModal({
  open,
  onClose,
  existingNotes,
  existingAverages,
  existingGeneralAverage,
  onImport,
}: TranscriptImportModalProps) {
  const [firstPeriod, setFirstPeriod] = useState('1_Guz')
  const [terms, setTerms] = useState<Awaited<ReturnType<typeof parseTranscriptPdf>>>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')

  const planResult = useMemo(() => {
    if (terms.length === 0) return { plan: null, error: '' }
    try {
      return {
        plan: buildTranscriptImportPlan(
          terms,
          firstPeriod,
          existingNotes,
          existingAverages,
          existingGeneralAverage,
        ),
        error: '',
      }
    } catch (error) {
      return { plan: null, error: errorMessage(error) }
    }
  }, [terms, firstPeriod, existingNotes, existingAverages, existingGeneralAverage])

  const reset = () => {
    setTerms([])
    setFileName('')
    setMessage('')
    setParsing(false)
    setSaving(false)
    setFirstPeriod('1_Guz')
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
    setTerms([])
    try {
      const parsedTerms = await parseTranscriptPdf(file)
      setTerms(parsedTerms)
      setFileName(file.name)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!planResult.plan) return
    setSaving(true)
    setMessage('')
    try {
      await onImport(planResult.plan)
      close(true)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const plan = planResult.plan
  const courseCount = plan?.targets.reduce((total, target) => total + target.courseCount, 0) || 0

  return (
    <Modal
      open={open}
      onClose={close}
      title="Transkript PDF içe aktar"
      description="Belge yalnızca bu cihazda okunur; PDF, kimlik bilgileri ve barkod saklanmaz."
      className="max-w-2xl"
    >
      <div className="space-y-5">
        <label className="block rounded-2xl border border-dashed border-primary-300 bg-primary-50/50 p-5 text-center transition hover:bg-primary-50 dark:border-primary-700 dark:bg-primary-950/30 dark:hover:bg-primary-950/50">
          <FileUp className="mx-auto h-7 w-7 text-primary-600 dark:text-primary-300" />
          <span className="mt-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Transkript PDF seçin
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Metin içeren YÖK/e-Devlet transkriptleri · En fazla 10 MB
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
            <LoaderCircle className="h-5 w-5 animate-spin text-primary-600 dark:text-primary-300" />
            Transkript bu cihazda okunuyor…
          </div>
        ) : null}

        {message || planResult.error ? (
          <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{message || planResult.error}</p>
          </div>
        ) : null}

        {terms.length > 0 ? (
          <>
            <Select
              id="transcript-first-period"
              label="Transkriptteki ilk normal dönem"
              value={firstPeriod}
              onChange={(event) => setFirstPeriod(event.target.value)}
              disabled={saving}
            >
              {PERIOD_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sistem sonraki Güz/Bahar dönemlerini sırayla eşleştirir. Yaz okulu dersleri, PDF'de daha
              önce görünen aynı dersin normal dönemine yerleştirilir; kaynak yaz okulu bilgisi korunur.
            </p>

            {plan ? (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/25">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div>
                    <p className="font-semibold text-emerald-950 dark:text-emerald-100">
                      {terms.length} dönemden {courseCount} ders aktarılmaya hazır
                    </p>
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                      Ders adı, kodu, AKTS, harf notu, dönem ortalaması ve son genel ortalama aktarılır.
                      Vize, final ve ders ortalaması belgede olmadığı için boş bırakılır.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 border-t border-emerald-200 pt-3 text-sm dark:border-emerald-900/70">
                  {plan.targets.map((target) => (
                    <li
                      key={`${target.sourceLabel}-${target.targetPeriod}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-slate-700 dark:text-slate-200"
                    >
                      <span>{target.sourceLabel}</span>
                      <span className="font-medium text-emerald-900 dark:text-emerald-100">
                        {periodLabel(target.targetPeriod)} · {target.courseCount} ders
                        {target.isSummer ? ' · Yaz okulu' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan?.warnings.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">Aktarım uyarıları</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {plan.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button fullWidth size="lg" onClick={() => void handleImport()} disabled={!plan || saving}>
              {saving ? 'Notlar kaydediliyor…' : 'Transkripti aktar ve kaydet'}
            </Button>
          </>
        ) : null}

        {fileName ? <p className="text-center text-xs text-slate-500 dark:text-slate-400">Seçilen dosya: {fileName}</p> : null}
      </div>
    </Modal>
  )
}
