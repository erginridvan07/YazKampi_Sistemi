/**
 * Minimal attendance roster helpers (yoklama_roster).
 * Keep in sync with shared/attendanceRoster.mjs
 */

import type { AttendanceRosterEntry } from '@/types'

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
] as const

export function isAcceptableRosterOdaNo(odaNo: unknown): boolean {
  if (odaNo === null || odaNo === undefined) return false
  if (typeof odaNo === 'number') return Number.isFinite(odaNo)
  if (typeof odaNo === 'string') return odaNo.trim() !== ''
  return false
}

/**
 * Allowlist-only roster document. Never copies sensitive/extra student fields.
 */
export function buildAttendanceRosterEntry(
  studentId: string,
  studentData: { adSoyad?: unknown; odaNo?: unknown },
): AttendanceRosterEntry | null {
  const id = typeof studentId === 'string' ? studentId.trim() : ''
  if (!id) return null

  const adSoyad =
    typeof studentData?.adSoyad === 'string' ? studentData.adSoyad.trim() : ''
  if (!adSoyad) return null

  if (!isAcceptableRosterOdaNo(studentData?.odaNo)) return null

  return {
    studentId: id,
    adSoyad,
    odaNo: studentData.odaNo as string | number,
  }
}

/** Same ordering as students.service loadStudentsList. */
export function sortAttendanceRosterEntries(
  entries: AttendanceRosterEntry[],
): AttendanceRosterEntry[] {
  return [...entries].sort(
    (a, b) => Number(a.odaNo || 999) - Number(b.odaNo || 999),
  )
}
