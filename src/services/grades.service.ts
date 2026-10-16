import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { buildManualGradeWritePayload, lastUpdateEqual } from '@/lib/gradeHelpers'
import type { TranscriptImportPlan } from '@/lib/transcriptHelpers'
import { CACHE_KEYS, invalidateQueryCache } from '@/lib/queryCache'
import type { DersNotu, Student, UserProfile } from '@/types'

export async function fetchStudentById(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, 'ogrenciler', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Student
}

/**
 * Student self-view: load roster row via users/{uid}.legacyDocId binding.
 * Does not query by username.
 */
export async function fetchOwnStudentRecord(
  profile: Pick<UserProfile, 'legacyCollection' | 'legacyDocId'> | null | undefined,
): Promise<Student | null> {
  if (!profile) return null
  const legacyDocId = typeof profile.legacyDocId === 'string' ? profile.legacyDocId.trim() : ''
  if (!legacyDocId || profile.legacyCollection !== 'ogrenciler') return null
  return fetchStudentById(legacyDocId)
}

/** @deprecated Prefer fetchOwnStudentRecord / fetchStudentById for identity-bound reads. */
export async function fetchStudentByUsername(username: string): Promise<Student | null> {
  const snap = await getDocs(
    query(collection(db, 'ogrenciler'), where('username', '==', username)),
  )
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { id: docSnap.id, ...docSnap.data() } as Student
}

export async function saveStudentGrades(
  studentId: string,
  period: string,
  dersler: DersNotu[],
  donemOrt: string,
  genelOrt: string,
): Promise<void> {
  await updateDoc(doc(db, 'ogrenciler', studentId), {
    [`akademikNotlar.${period}`]: dersler,
    [`donemOrtalamalari.${period}`]: donemOrt,
    genelOrt: genelOrt,
    lastUpdate: new Date().toISOString(),
  })
  invalidateQueryCache(CACHE_KEYS.studentsList)
}

type TranscriptGradeSaveInput = Pick<
  TranscriptImportPlan,
  'akademikNotlar' | 'donemOrtalamalari' | 'genelOrt'
>

function transcriptGradePayload(plan: TranscriptGradeSaveInput) {
  return {
    akademikNotlar: plan.akademikNotlar,
    donemOrtalamalari: plan.donemOrtalamalari,
    genelOrt: plan.genelOrt,
    lastUpdate: new Date().toISOString(),
  }
}

/** Admin transcript import: one document transaction, so no partial term import occurs. */
export async function saveStudentTranscriptGrades(
  studentId: string,
  plan: TranscriptGradeSaveInput,
  expectedLastUpdate: string | null | undefined,
): Promise<void> {
  const ref = doc(db, 'ogrenciler', studentId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Öğrenci kaydı bulunamadı.')
    if (!lastUpdateEqual(snap.data().lastUpdate ?? null, expectedLastUpdate)) {
      throw new Error(STALE_GRADE_MESSAGE)
    }
    tx.update(ref, transcriptGradePayload(plan))
  })
  invalidateQueryCache(CACHE_KEYS.studentsList)
}

const STALE_GRADE_MESSAGE =
  'Notlar başka bir oturumda güncellenmiş. Lütfen sayfayı yenileyin.'

function assertOwnStudentGradeWriteAccess(
  profile: Pick<UserProfile, 'role' | 'legacyCollection' | 'legacyDocId'> | null | undefined,
): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Oturum açmanız gerekiyor.')
  if (!profile || profile.role !== 'student') throw new Error('Bu işlem yalnızca öğrenciler içindir.')
  const legacyDocId = typeof profile.legacyDocId === 'string' ? profile.legacyDocId.trim() : ''
  if (!legacyDocId || profile.legacyCollection !== 'ogrenciler') {
    throw new Error('Öğrenci kaydı bağlantısı bulunamadı.')
  }
  return legacyDocId
}

/**
 * Student self-grade save: manual values only (same model as admin GradeEditor).
 * Writes allowlisted grade fields on own ogrenciler doc with stale lastUpdate guard.
 */
export async function saveOwnStudentGrades(
  profile: Pick<UserProfile, 'role' | 'legacyCollection' | 'legacyDocId'> | null | undefined,
  period: string,
  dersler: DersNotu[],
  donemOrt: string,
  genelOrt: string,
  expectedLastUpdate: string | null | undefined,
): Promise<StudentGradeWriteResult> {
  const studentId = assertOwnStudentGradeWriteAccess(profile)

  const ref = doc(db, 'ogrenciler', studentId)
  let result: StudentGradeWriteResult | null = null

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Öğrenci kaydı bulunamadı.')

    const data = snap.data()
    if (data.ownerUid !== auth.currentUser?.uid) {
      throw new Error('Bu kayıt size ait değil.')
    }

    const liveLastUpdate = data.lastUpdate ?? null
    if (!lastUpdateEqual(liveLastUpdate, expectedLastUpdate)) {
      throw new Error(STALE_GRADE_MESSAGE)
    }

    const payload = buildManualGradeWritePayload(
      period,
      dersler,
      donemOrt,
      genelOrt,
      (data.akademikNotlar || {}) as Record<string, DersNotu[]>,
      (data.donemOrtalamalari || {}) as Record<string, string>,
    )

    tx.update(ref, payload)
    result = {
      studentId,
      period,
      dersler: payload.akademikNotlar[period] || [],
      donemOrt: payload.donemOrtalamalari[period] || '',
      genelOrt: payload.genelOrt,
      lastUpdate: payload.lastUpdate,
      akademikNotlar: payload.akademikNotlar,
      donemOrtalamalari: payload.donemOrtalamalari,
    }
  })

  if (!result) throw new Error('Kayıt tamamlanamadı.')
  invalidateQueryCache(CACHE_KEYS.studentsList)
  return result
}

/**
 * Student transcript import keeps the same owner binding and stale-data guard
 * as manual grade saving, while committing every mapped term in one update.
 */
export async function saveOwnStudentTranscriptGrades(
  profile: Pick<UserProfile, 'role' | 'legacyCollection' | 'legacyDocId'> | null | undefined,
  plan: TranscriptGradeSaveInput,
  expectedLastUpdate: string | null | undefined,
): Promise<TranscriptGradeWriteResult> {
  const studentId = assertOwnStudentGradeWriteAccess(profile)
  const ref = doc(db, 'ogrenciler', studentId)
  let result: TranscriptGradeWriteResult | null = null

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Öğrenci kaydı bulunamadı.')

    const data = snap.data()
    if (data.ownerUid !== auth.currentUser?.uid) {
      throw new Error('Bu kayıt size ait değil.')
    }
    if (!lastUpdateEqual(data.lastUpdate ?? null, expectedLastUpdate)) {
      throw new Error(STALE_GRADE_MESSAGE)
    }

    const payload = transcriptGradePayload(plan)
    tx.update(ref, payload)
    result = {
      studentId,
      akademikNotlar: payload.akademikNotlar,
      donemOrtalamalari: payload.donemOrtalamalari,
      genelOrt: payload.genelOrt,
      lastUpdate: payload.lastUpdate,
    }
  })

  if (!result) throw new Error('Transkript aktarımı tamamlanamadı.')
  invalidateQueryCache(CACHE_KEYS.studentsList)
  return result
}

export type StudentGradeWriteResult = {
  studentId: string
  period: string
  dersler: DersNotu[]
  donemOrt: string
  genelOrt: string
  lastUpdate: string
  akademikNotlar: Record<string, DersNotu[]>
  donemOrtalamalari: Record<string, string>
}

export type TranscriptGradeWriteResult = {
  studentId: string
  akademikNotlar: Record<string, DersNotu[]>
  donemOrtalamalari: Record<string, string>
  genelOrt: string
  lastUpdate: string
}

export function getLatestPeriod(akademikNotlar?: Record<string, DersNotu[]>): string {
  const order = [
    '4_Bahar', '4_Guz', '3_Bahar', '3_Guz', '2_Bahar', '2_Guz',
    '1_Bahar', '1_Guz', 'Hazirlik_Bahar', 'Hazirlik_Guz',
  ]
  if (!akademikNotlar) return '1_Guz'
  for (const period of order) {
    if (akademikNotlar[period]?.length) return period
  }
  return '1_Guz'
}

export function createEmptyDers(): DersNotu {
  return { ad: '', vize: '', final: '', ort: '', harf: '', ekler: [] }
}
