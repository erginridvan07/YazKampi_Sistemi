import type { DersNotu } from '@/types'

export function lastUpdateEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a === 'string' && typeof b === 'string') return a === b
  const aMs = Date.parse(String(a))
  const bMs = Date.parse(String(b))
  if (Number.isFinite(aMs) && Number.isFinite(bMs)) return aMs === bMs
  return false
}

export type ManualGradeWritePayload = {
  akademikNotlar: Record<string, DersNotu[]>
  donemOrtalamalari: Record<string, string>
  genelOrt: string
  lastUpdate: string
}

/** Merge manual period edits into full grade maps — values are stored as entered. */
export function buildManualGradeWritePayload(
  period: string,
  dersler: DersNotu[],
  donemOrt: string,
  genelOrt: string,
  existingAkademikNotlar: Record<string, DersNotu[]> = {},
  existingDonemOrtalamalari: Record<string, string> = {},
): ManualGradeWritePayload {
  return {
    akademikNotlar: { ...existingAkademikNotlar, [period]: dersler },
    donemOrtalamalari: { ...existingDonemOrtalamalari, [period]: donemOrt },
    genelOrt,
    lastUpdate: new Date().toISOString(),
  }
}
