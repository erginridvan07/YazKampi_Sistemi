import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { parseFlexibleDate, toISO } from '@/lib/dates'
import { fetchAttendanceRecords } from '@/services/attendance.service'

export interface MigrationPreview {
  legacyCount: number
  isoCount: number
  total: number
}

export async function previewAttendanceDateMigration(): Promise<MigrationPreview> {
  const records = await fetchAttendanceRecords()
  let legacyCount = 0
  let isoCount = 0

  for (const record of records) {
    if (record.tarih.includes('.')) legacyCount++
    else isoCount++
  }

  return { legacyCount, isoCount, total: records.length }
}

export async function migrateAttendanceDatesToISO(): Promise<{ updated: number; skipped: number }> {
  const records = await fetchAttendanceRecords()
  let updated = 0
  let skipped = 0

  for (const record of records) {
    if (!record.tarih.includes('.')) {
      skipped++
      continue
    }

    const parsed = parseFlexibleDate(record.tarih)
    if (!parsed) {
      skipped++
      continue
    }

    await updateDoc(doc(db, 'yoklamalar', record.id), {
      tarih: toISO(parsed),
    })
    updated++
  }

  return { updated, skipped }
}
