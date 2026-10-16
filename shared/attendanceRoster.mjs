/**
 * Minimal attendance roster helpers (yoklama_roster).
 * Keep in sync with src/lib/attendanceRoster.ts
 */

export const ATTENDANCE_ROSTER_COLLECTION = 'yoklama_roster'

export const ROSTER_FORBIDDEN_KEYS = [
  'password',
  'akademikNotlar',
  'ownerUid',
  'username',
  'canManageAttendance',
  'photoUrl',
  'role',
  'legacyCollection',
  'legacyDocId',
  'bolum',
  'sinif',
  'donem',
  'genelOrt',
  'donemOrtalamalari',
]

/**
 * Allowlist-only roster document. Never copies sensitive/extra student fields.
 * @returns {{ studentId: string, adSoyad: string, odaNo: string|number } | null}
 */
export function buildAttendanceRosterEntry(studentId, studentData) {
  const id = typeof studentId === 'string' ? studentId.trim() : ''
  if (!id) return null

  const adSoyad =
    typeof studentData?.adSoyad === 'string' ? studentData.adSoyad.trim() : ''
  if (!adSoyad) return null

  if (!isAcceptableRosterOdaNo(studentData?.odaNo)) return null

  return {
    studentId: id,
    adSoyad,
    odaNo: studentData.odaNo,
  }
}

export function isAcceptableRosterOdaNo(odaNo) {
  if (odaNo === null || odaNo === undefined) return false
  if (typeof odaNo === 'number') return Number.isFinite(odaNo)
  if (typeof odaNo === 'string') return odaNo.trim() !== ''
  return false
}

export function isEligibleAttendanceRosterSource(studentId, studentData) {
  return buildAttendanceRosterEntry(studentId, studentData) !== null
}

/** Same ordering as students.service loadStudentsList. */
export function sortAttendanceRosterEntries(entries) {
  return [...entries].sort(
    (a, b) => Number(a.odaNo || 999) - Number(b.odaNo || 999),
  )
}

export function rosterEntriesEqual(expected, actual) {
  if (!expected || !actual) return false
  return (
    expected.studentId === actual.studentId &&
    expected.adSoyad === actual.adSoyad &&
    String(expected.odaNo) === String(actual.odaNo)
  )
}

/**
 * Compare one student source doc vs roster doc.
 * @returns {'ROSTER_OK'|'ROSTER_MISSING'|'ROSTER_MISMATCH'|'ROSTER_INVALID_SOURCE'}
 */
export function classifyAttendanceRosterAgainstSource(studentId, studentData, rosterData) {
  const expected = buildAttendanceRosterEntry(studentId, studentData)
  if (!expected) return 'ROSTER_INVALID_SOURCE'
  if (!rosterData) return 'ROSTER_MISSING'

  const actual = {
    studentId:
      typeof rosterData.studentId === 'string' ? rosterData.studentId.trim() : studentId,
    adSoyad: typeof rosterData.adSoyad === 'string' ? rosterData.adSoyad.trim() : '',
    odaNo: rosterData.odaNo,
  }

  if (actual.studentId !== studentId) return 'ROSTER_MISMATCH'
  if (rosterEntriesEqual(expected, actual)) return 'ROSTER_OK'
  return 'ROSTER_MISMATCH'
}

/** Assert builder never emits forbidden keys (self-test). */
export function assertRosterEntryAllowlist(entry) {
  if (!entry) return true
  for (const key of Object.keys(entry)) {
    if (key !== 'studentId' && key !== 'adSoyad' && key !== 'odaNo') return false
    if (ROSTER_FORBIDDEN_KEYS.includes(key)) return false
  }
  return true
}
