/** YYYY-MM-DD */
export function todayISO(): string {
  const now = new Date()
  return toISO(now)
}

export function toISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** DD.MM.YYYY görüntüleme */
export function formatDateTR(isoOrLegacy: string): string {
  if (isoOrLegacy.includes('-')) {
    const [year, month, day] = isoOrLegacy.split('-')
    return `${day}.${month}.${year}`
  }
  return isoOrLegacy
}

/** DD.MM.YYYY → Date */
export function parseLegacyDate(value: string): Date | null {
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (!day || !month || !year) return null
  return new Date(year, month - 1, day)
}

/** YYYY-MM-DD veya DD.MM.YYYY → Date */
export function parseFlexibleDate(value: string): Date | null {
  if (value.includes('-')) {
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }
  return parseLegacyDate(value)
}

/** Yoklama kayıtları için geriye dönük uyumluluk: DD.MM.YYYY */
export function toLegacyDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export function isoToLegacy(iso: string): string {
  const parsed = parseFlexibleDate(iso)
  return parsed ? toLegacyDate(parsed) : iso
}

export function getMonthYear(date: Date): { month: number; year: number } {
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}

export function isDateInRange(date: Date, start: string, end: string): boolean {
  const startDate = parseFlexibleDate(start)
  const endDate = parseFlexibleDate(end)
  if (!startDate || !endDate) return false
  return date >= startDate && date <= endDate
}
