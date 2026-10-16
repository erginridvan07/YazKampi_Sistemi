import { SINIFLAR } from '@/config/constants'

/** Canonical class values used by Student forms / SINIFLAR. Keep logic aligned with shared/studentPromotion.mjs */
export const SINIF_ORDER = ['0', '1', '2', '3', '4'] as const
export type SinifValue = (typeof SINIF_ORDER)[number]

export type PromotionUiStatus =
  | 'will_promote'
  | 'unchanged'
  | 'manual_review'
  | 'excluded'
  | 'stale'

export type PromotionPreviewRow = {
  id: string
  adSoyad: string
  currentSinif: string
  targetSinif: string
  selected: boolean
  suggestedSinif: string | null
  isTerminal: boolean
  isUnknown: boolean
  status: PromotionUiStatus
  stale?: boolean
}

export type PromotionSummary = {
  total: number
  willUpdate: number
  excluded: number
  manualReview: number
  unchanged: number
  stale: number
}

export type BulkPromotePayloadItem = {
  id: string
  expectedCurrentSinif: string
  targetSinif: string
}

const VALID_SINIF = new Set<string>(SINIF_ORDER)

export const VALID_SINIF_OPTIONS = SINIFLAR.map((s) => ({
  value: s.value,
  label: s.label,
}))

export function normalizeSinifValue(sinif: string | number | null | undefined): string | null {
  if (sinif === null || sinif === undefined) return null
  const raw = String(sinif).trim()
  if (!raw) return null
  if (VALID_SINIF.has(raw)) return raw

  const lower = raw.toLowerCase()
  if (lower === 'hazırlık' || lower === 'hazirlik') return '0'

  const digits = raw.replace(/[^\d]/g, '')
  if (digits && VALID_SINIF.has(digits)) return digits
  return null
}

export function isValidSinifValue(sinif: string): boolean {
  return VALID_SINIF.has(sinif)
}

export function isTerminalSinif(sinif: string | number): boolean {
  return normalizeSinifValue(sinif) === '4'
}

export function getNextSinif(sinif: string | number): string | null {
  const current = normalizeSinifValue(sinif)
  if (!current) return null
  const index = SINIF_ORDER.indexOf(current as SinifValue)
  if (index < 0 || index >= SINIF_ORDER.length - 1) return null
  return SINIF_ORDER[index + 1]
}

export function formatSinifLabel(sinif: string | number): string {
  const normalized = normalizeSinifValue(sinif)
  if (!normalized) return `Bilinmeyen (${String(sinif)})`
  if (normalized === '0') return 'Hazırlık'
  return `${normalized}. Sınıf`
}

export function resolvePromotionStatus(row: {
  selected: boolean
  currentSinif: string
  targetSinif: string
  isTerminal: boolean
  isUnknown: boolean
  stale?: boolean
}): PromotionUiStatus {
  if (row.stale) return 'stale'
  if (!row.selected) {
    if (row.isTerminal || row.isUnknown) return 'manual_review'
    return 'excluded'
  }
  if (row.targetSinif === row.currentSinif) {
    if (row.isTerminal || row.isUnknown) return 'manual_review'
    return 'unchanged'
  }
  return 'will_promote'
}

export function buildPromotionPreviewRows(
  students: Array<{ id: string; adSoyad: string; sinif: string | number }>,
): PromotionPreviewRow[] {
  return students
    .map((student) => {
      const currentSinif = normalizeSinifValue(student.sinif)
      const isUnknown = currentSinif === null
      const isTerminal = currentSinif === '4'
      const suggestedSinif = currentSinif ? getNextSinif(currentSinif) : null
      const selected = !isUnknown && !isTerminal && suggestedSinif !== null
      const targetSinif = suggestedSinif ?? currentSinif ?? '1'
      const row: PromotionPreviewRow = {
        id: student.id,
        adSoyad: student.adSoyad,
        currentSinif: currentSinif ?? String(student.sinif ?? ''),
        targetSinif,
        selected,
        suggestedSinif,
        isTerminal,
        isUnknown,
        status: 'will_promote',
      }
      row.status = resolvePromotionStatus(row)
      return row
    })
    .sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr'))
}

export function summarizePromotionRows(rows: PromotionPreviewRow[]): PromotionSummary {
  const summary: PromotionSummary = {
    total: rows.length,
    willUpdate: 0,
    excluded: 0,
    manualReview: 0,
    unchanged: 0,
    stale: 0,
  }

  for (const row of rows) {
    switch (row.status) {
      case 'will_promote':
        summary.willUpdate += 1
        break
      case 'excluded':
        summary.excluded += 1
        break
      case 'manual_review':
        summary.manualReview += 1
        break
      case 'unchanged':
        summary.unchanged += 1
        break
      case 'stale':
        summary.stale += 1
        break
    }
  }

  return summary
}

export function promotionStatusLabel(status: PromotionUiStatus): string {
  switch (status) {
    case 'will_promote':
      return 'Yükseltilecek'
    case 'unchanged':
      return 'Aynı kalacak'
    case 'manual_review':
      return 'Mezuniyet değerlendirmesi gerekli'
    case 'excluded':
      return 'İşlem dışı'
    case 'stale':
      return 'Veri değişmiş — tekrar kontrol edin'
  }
}

export function promotionStatusTone(
  status: PromotionUiStatus,
): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'will_promote':
      return 'success'
    case 'unchanged':
      return 'default'
    case 'manual_review':
      return 'warning'
    case 'excluded':
      return 'default'
    case 'stale':
      return 'danger'
  }
}

export function toBulkPromotePayload(rows: PromotionPreviewRow[]): BulkPromotePayloadItem[] {
  return rows
    .filter((row) => row.selected && row.targetSinif !== row.currentSinif && !row.isUnknown)
    .filter((row) => getNextSinif(row.currentSinif) === row.targetSinif)
    .map((row) => ({
      id: row.id,
      expectedCurrentSinif: row.currentSinif,
      targetSinif: row.targetSinif,
    }))
}
