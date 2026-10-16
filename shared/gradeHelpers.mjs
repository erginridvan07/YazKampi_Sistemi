/**
 * Shared grade helpers (manual entry; no auto-calculation).
 * Keep in sync with src/lib/gradeHelpers.ts.
 */

export function lastUpdateEqual(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a === 'string' && typeof b === 'string') return a === b
  const aMs = Date.parse(String(a))
  const bMs = Date.parse(String(b))
  if (Number.isFinite(aMs) && Number.isFinite(bMs)) return aMs === bMs
  return false
}

/** Merge manual period edits into full grade maps — values are stored as entered. */
export function buildManualGradeWritePayload(
  period,
  dersler,
  donemOrt,
  genelOrt,
  existingAkademikNotlar = {},
  existingDonemOrtalamalari = {},
) {
  return {
    akademikNotlar: { ...existingAkademikNotlar, [period]: dersler },
    donemOrtalamalari: { ...existingDonemOrtalamalari, [period]: donemOrt },
    genelOrt,
    lastUpdate: new Date().toISOString(),
  }
}

export function addDers(courses) {
  return [...(courses || []), { ad: '', vize: '', final: '', ort: '', harf: '', ekler: [] }]
}

export function removeDers(courses, index) {
  return (courses || []).filter((_, i) => i !== index)
}

export function addEk(courses, courseIndex) {
  return (courses || []).map((course, index) =>
    index === courseIndex
      ? { ...course, ekler: [...(course.ekler || []), { tip: 'Quiz', not: '' }] }
      : course,
  )
}

export function removeEk(courses, courseIndex, ekIndex) {
  return (courses || []).map((course, index) =>
    index === courseIndex
      ? { ...course, ekler: (course.ekler || []).filter((_, i) => i !== ekIndex) }
      : course,
  )
}
