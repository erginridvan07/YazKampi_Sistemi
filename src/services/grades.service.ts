import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fetchStudents } from '@/services/students.service'
import type { DersNotu, Student } from '@/types'

export async function fetchStudentById(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, 'ogrenciler', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Student
}

export async function fetchStudentByUsername(username: string): Promise<Student | null> {
  const students = await fetchStudents()
  return students.find((s) => s.username === username) || null
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
