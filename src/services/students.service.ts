import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  ATTENDANCE_ROSTER_COLLECTION,
  buildAttendanceRosterEntry,
} from '@/lib/attendanceRoster'
import { CACHE_KEYS, cachedQuery, invalidateQueryCache } from '@/lib/queryCache'
import {
  getNextSinif,
  normalizeSinifValue,
  type BulkPromotePayloadItem,
} from '@/lib/studentPromotion'
import { stripUndefined } from '@/lib/utils'
import { fetchStudentPhotoMap } from '@/services/profile.service'
import type { Student, StudentFormData } from '@/types'

/** Firestore writeBatch soft ceiling (official hard limit is 500). */
const FIRESTORE_BATCH_CHUNK = 450

const COL = 'ogrenciler'

function mapStudentListDoc(
  docSnap: { id: string; data: () => Record<string, unknown> },
  photoMap: Record<string, string>,
): Student | null {
  const data = docSnap.data()
  if (data.role === 'admin') return null

  const username = String(data.username ?? '')
  const ownerUid =
    typeof data.ownerUid === 'string' && data.ownerUid.trim() ? data.ownerUid.trim() : undefined

  return {
    id: docSnap.id,
    adSoyad: String(data.adSoyad ?? ''),
    username,
    password: data.password ? String(data.password) : undefined,
    bolum: String(data.bolum ?? ''),
    sinif: data.sinif as string | number,
    odaNo: data.odaNo as string | number,
    donem: data.donem ? String(data.donem) : 'Güz',
    canManageAttendance: data.canManageAttendance === true,
    photoUrl: ownerUid ? photoMap[ownerUid] : undefined,
    ownerUid,
  }
}

async function loadStudentsList(): Promise<Student[]> {
  const [snap, photoMap] = await Promise.all([
    getDocs(collection(db, COL)),
    fetchStudentPhotoMap(),
  ])
  const students: Student[] = []

  snap.forEach((docSnap) => {
    const student = mapStudentListDoc(docSnap, photoMap)
    if (student) students.push(student)
  })

  return students.sort((a, b) => Number(a.odaNo || 999) - Number(b.odaNo || 999))
}

/** Liste sayfaları için — not verileri ve büyük alanlar çekilmez. */
export function fetchStudentsList(): Promise<Student[]> {
  return cachedQuery(CACHE_KEYS.studentsList, loadStudentsList)
}

/** Geriye dönük uyumluluk — liste görünümü için fetchStudentsList kullanır. */
export async function fetchStudents(): Promise<Student[]> {
  return fetchStudentsList()
}

export function groupStudentsByBolum(students: Student[]): Record<string, Student[]> {
  const groups: Record<string, Student[]> = {}
  for (const student of students) {
    const bolum = student.bolum || 'Diğer'
    if (!groups[bolum]) groups[bolum] = []
    groups[bolum].push(student)
  }

  for (const bolum of Object.keys(groups)) {
    groups[bolum].sort((a, b) => Number(b.sinif || 0) - Number(a.sinif || 0))
  }

  return groups
}

function bumpStudentsCache() {
  invalidateQueryCache(CACHE_KEYS.studentsList, CACHE_KEYS.attendanceRoster)
}

function rosterRef(studentId: string) {
  return doc(db, ATTENDANCE_ROSTER_COLLECTION, studentId)
}

/**
 * Creates ogrenciler/{id} + yoklama_roster/{id} in one writeBatch.
 * Does NOT create Firebase Auth / users/{uid} / ownerUid.
 * Does NOT store plaintext password (Auth-only login; provision via local CLI).
 * @returns new ogrenciler document id
 */
export async function createStudent(data: StudentFormData): Promise<string> {
  const adSoyad = data.adSoyad.trim()
  const studentRef = doc(collection(db, COL))
  const rosterEntry = buildAttendanceRosterEntry(studentRef.id, {
    adSoyad,
    odaNo: data.odaNo,
  })
  if (!rosterEntry) {
    throw new Error('Yoklama roster için ad soyad ve oda bilgisi gerekli.')
  }

  const now = new Date().toISOString()
  const batch = writeBatch(db)
  batch.set(
    studentRef,
    stripUndefined({
      adSoyad,
      username: data.username.trim(),
      bolum: data.bolum,
      sinif: data.sinif,
      odaNo: data.odaNo,
      donem: data.donem,
      role: 'student',
      canManageAttendance: data.canManageAttendance === true,
      akademikNotlar: {},
      donemOrtalamalari: {},
      createdAt: now,
      updatedAt: now,
    }),
  )
  batch.set(rosterRef(studentRef.id), rosterEntry)
  await batch.commit()

  bumpStudentsCache()
  return studentRef.id
}

/**
 * Updates student roster fields.
 * When canManageAttendance changes, atomically syncs users/{ownerUid} in the same batch.
 * When adSoyad/odaNo change, atomically syncs yoklama_roster/{id} in the same batch.
 * ownerUid is immutable from this path.
 * Username is immutable once provisioned (ownerUid present) — Auth email binding.
 */
export async function updateStudent(id: string, data: Partial<StudentFormData>): Promise<void> {
  const studentRef = doc(db, COL, id)
  const snap = await getDoc(studentRef)
  if (!snap.exists()) {
    throw new Error('Öğrenci bulunamadı.')
  }

  const current = snap.data()
  const currentOwnerUid =
    typeof current.ownerUid === 'string' && current.ownerUid.trim()
      ? current.ownerUid.trim()
      : ''
  const currentUsername =
    typeof current.username === 'string' ? current.username.trim() : ''
  const currentAdSoyad =
    typeof current.adSoyad === 'string' ? current.adSoyad.trim() : ''
  const currentOdaNo = current.odaNo

  if (currentOwnerUid && data.username !== undefined) {
    const nextUsername = data.username.trim()
    if (nextUsername !== currentUsername) {
      throw new Error(
        'Provision edilmiş öğrencinin kullanıcı adı değiştirilemez (Auth e-posta bağı).',
      )
    }
  }

  const previousAttendance = current.canManageAttendance === true
  const nextAttendance =
    data.canManageAttendance !== undefined ? data.canManageAttendance === true : previousAttendance
  const attendanceChanging =
    data.canManageAttendance !== undefined && nextAttendance !== previousAttendance

  const nextAdSoyad = data.adSoyad !== undefined ? data.adSoyad.trim() : currentAdSoyad
  const nextOdaNo = data.odaNo !== undefined ? data.odaNo : currentOdaNo
  const adSoyadChanging = data.adSoyad !== undefined && nextAdSoyad !== currentAdSoyad
  const odaChanging =
    data.odaNo !== undefined && String(data.odaNo) !== String(currentOdaNo ?? '')
  const rosterFieldsChanging = adSoyadChanging || odaChanging

  const payload: Record<string, unknown> = { ...data }
  delete payload.password
  // ownerUid is never accepted from client forms.
  delete (payload as { ownerUid?: unknown }).ownerUid

  if (data.adSoyad) payload.adSoyad = data.adSoyad.trim()
  if (currentOwnerUid) {
    // Provisioned: never rewrite username (even identical) from client payload.
    delete payload.username
  } else if (data.username) {
    payload.username = data.username.trim()
  }
  if (data.canManageAttendance !== undefined) {
    payload.canManageAttendance = nextAttendance
  }

  const now = new Date().toISOString()
  payload.updatedAt = now

  const cleanPayload = stripUndefined(payload)

  if (attendanceChanging || rosterFieldsChanging) {
    if (attendanceChanging && !currentOwnerUid) {
      throw new Error('Bu öğrencinin kullanıcı bağlantısı bulunamadı.')
    }

    let rosterEntry = null
    if (rosterFieldsChanging) {
      rosterEntry = buildAttendanceRosterEntry(id, {
        adSoyad: nextAdSoyad,
        odaNo: nextOdaNo,
      })
      if (!rosterEntry) {
        throw new Error('Yoklama roster için ad soyad ve oda bilgisi gerekli.')
      }
    }

    const batch = writeBatch(db)
    batch.update(studentRef, cleanPayload)

    if (attendanceChanging) {
      batch.update(doc(db, 'users', currentOwnerUid), {
        canManageAttendance: nextAttendance,
        updatedAt: now,
      })
    }

    if (rosterEntry) {
      // Recreate if missing; exact allowlist overwrite (no merge of stale fields).
      batch.set(rosterRef(id), rosterEntry)
    }

    await batch.commit()
  } else {
    await updateDoc(studentRef, cleanPayload)
  }

  bumpStudentsCache()
}

/**
 * Deletes ogrenciler/{id} + yoklama_roster/{id} in one writeBatch.
 * Missing roster doc does not block delete (Firestore delete is idempotent).
 * Does not delete Auth / users/{uid}.
 */
export async function deleteStudent(id: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, COL, id))
  batch.delete(rosterRef(id))
  await batch.commit()
  bumpStudentsCache()
}

/**
 * Excel import — uses createStudent so yoklama_roster is created in the same batch.
 */
export async function importStudentsBatch(
  rows: StudentFormData[],
  existingUsernames: Set<string>,
): Promise<{ created: number; skipped: number; createdIds: string[] }> {
  let created = 0
  let skipped = 0
  const createdIds: string[] = []

  for (const data of rows) {
    const username = data.username.trim().toLowerCase()
    if (existingUsernames.has(username)) {
      skipped++
      continue
    }
    const id = await createStudent(data)
    createdIds.push(id)
    existingUsernames.add(username)
    created++
  }

  return { created, skipped, createdIds }
}

export function getSinifLabel(sinif: string | number): string {
  return sinif === '0' || sinif === 0 ? 'Hazırlık' : `${sinif}. Sınıf`
}

export type BulkPromoteResult = {
  updated: number
  skipped: number
  staleIds: string[]
}

/**
 * Bulk-update only ogrenciler.sinif (+ updatedAt) for allowlisted payloads.
 * Re-reads each doc before write; skips stale / unchanged / invalid rows.
 * Does not touch ownerUid, username, Auth, users, roster, grades, or attendance flags.
 */
export async function bulkPromoteStudents(
  items: BulkPromotePayloadItem[],
): Promise<BulkPromoteResult> {
  const allowlisted: BulkPromotePayloadItem[] = []
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) continue
    if (getNextSinif(item.expectedCurrentSinif) !== item.targetSinif) continue
    allowlisted.push({
      id: item.id.trim(),
      expectedCurrentSinif: item.expectedCurrentSinif,
      targetSinif: item.targetSinif,
    })
  }

  if (allowlisted.length === 0) {
    return { updated: 0, skipped: 0, staleIds: [] }
  }

  const now = new Date().toISOString()
  const pending: Array<{ id: string; targetSinif: string }> = []
  const staleIds: string[] = []
  let skipped = 0

  for (const item of allowlisted) {
    const snap = await getDoc(doc(db, COL, item.id))
    if (!snap.exists()) {
      staleIds.push(item.id)
      skipped += 1
      continue
    }

    const data = snap.data()
    if (data.role === 'admin') {
      skipped += 1
      continue
    }

    const liveSinif = normalizeSinifValue(data.sinif as string | number)
    if (!liveSinif || liveSinif !== item.expectedCurrentSinif) {
      staleIds.push(item.id)
      skipped += 1
      continue
    }

    if (getNextSinif(liveSinif) !== item.targetSinif) {
      skipped += 1
      continue
    }

    pending.push({ id: item.id, targetSinif: item.targetSinif })
  }

  let updated = 0
  for (let i = 0; i < pending.length; i += FIRESTORE_BATCH_CHUNK) {
    const chunk = pending.slice(i, i + FIRESTORE_BATCH_CHUNK)
    const batch = writeBatch(db)
    for (const row of chunk) {
      batch.update(doc(db, COL, row.id), {
        sinif: row.targetSinif,
        updatedAt: now,
      })
    }
    await batch.commit()
    updated += chunk.length
  }

  if (updated > 0) {
    bumpStudentsCache()
  }

  return { updated, skipped, staleIds }
}
