import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CACHE_KEYS, invalidateQueryCache } from '@/lib/queryCache'
import type { DersNotu, Student } from '@/types'

export async function fetchStudentById(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, 'ogrenciler', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Student
}

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
