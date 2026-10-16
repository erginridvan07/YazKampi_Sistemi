/**
 * Student class promotion helpers (pure).
 * Keep in sync with src/lib/studentPromotion.ts usage.
 */

export const SINIF_ORDER = ['0', '1', '2', '3', '4']

export const VALID_SINIF_OPTIONS = [
  { value: '0', label: 'Hazırlık' },
  { value: '1', label: '1. Sınıf' },
  { value: '2', label: '2. Sınıf' },
  { value: '3', label: '3. Sınıf' },
  { value: '4', label: '4. Sınıf' },
]

const VALID_SINIF = new Set(SINIF_ORDER)

export function normalizeSinifValue(sinif) {
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

export function isValidSinifValue(sinif) {
  return VALID_SINIF.has(sinif)
}

export function isTerminalSinif(sinif) {
  return normalizeSinifValue(sinif) === '4'
}

export function getNextSinif(sinif) {
  const current = normalizeSinifValue(sinif)
  if (!current) return null
  const index = SINIF_ORDER.indexOf(current)
  if (index < 0 || index >= SINIF_ORDER.length - 1) return null
  return SINIF_ORDER[index + 1]
}

export function formatSinifLabel(sinif) {
  const normalized = normalizeSinifValue(sinif)
  if (!normalized) return `Bilinmeyen (${String(sinif)})`
  if (normalized === '0') return 'Hazırlık'
  return `${normalized}. Sınıf`
}

export function resolvePromotionStatus(row) {
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

export function buildPromotionPreviewRows(students) {
  return students
    .map((student) => {
      const currentSinif = normalizeSinifValue(student.sinif)
      const isUnknown = currentSinif === null
      const isTerminal = currentSinif === '4'
      const suggestedSinif = currentSinif ? getNextSinif(currentSinif) : null
      const selected = !isUnknown && !isTerminal && suggestedSinif !== null
      const targetSinif = suggestedSinif ?? currentSinif ?? '1'
      const row = {
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

export function summarizePromotionRows(rows) {
  const summary = {
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

export function promotionStatusLabel(status) {
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
    default:
      return status
  }
}

export function promotionStatusTone(status) {
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
    default:
      return 'default'
  }
}

export function toBulkPromotePayload(rows) {
  return rows
    .filter((row) => row.selected && row.targetSinif !== row.currentSinif && !row.isUnknown)
    .filter((row) => getNextSinif(row.currentSinif) === row.targetSinif)
    .map((row) => ({
      id: row.id,
      expectedCurrentSinif: row.currentSinif,
      targetSinif: row.targetSinif,
    }))
}
