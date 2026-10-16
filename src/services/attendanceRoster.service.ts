import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  ATTENDANCE_ROSTER_COLLECTION,
  buildAttendanceRosterEntry,
  sortAttendanceRosterEntries,
} from '@/lib/attendanceRoster'
import { CACHE_KEYS, cachedQuery } from '@/lib/queryCache'
import type { AttendanceRosterEntry } from '@/types'

export {
  ATTENDANCE_ROSTER_COLLECTION,
  buildAttendanceRosterEntry,
  sortAttendanceRosterEntries,
} from '@/lib/attendanceRoster'

async function loadAttendanceRoster(): Promise<AttendanceRosterEntry[]> {
  const snap = await getDocs(collection(db, ATTENDANCE_ROSTER_COLLECTION))
  const entries: AttendanceRosterEntry[] = []

  snap.forEach((docSnap) => {
    const data = docSnap.data()
    const entry = buildAttendanceRosterEntry(docSnap.id, data)
    if (!entry) return
    // Enforce doc id === studentId
    if (entry.studentId !== docSnap.id) return
    entries.push(entry)
  })

  return sortAttendanceRosterEntries(entries)
}

/** Reads yoklama_roster. Sorted by odaNo like former fetchStudentsList. */
export function fetchAttendanceRoster(): Promise<AttendanceRosterEntry[]> {
  return cachedQuery(CACHE_KEYS.attendanceRoster, loadAttendanceRoster)
}
