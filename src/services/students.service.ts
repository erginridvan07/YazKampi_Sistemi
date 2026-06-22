import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CACHE_KEYS, cachedQuery, invalidateQueryCache } from '@/lib/queryCache'
import { stripUndefined } from '@/lib/utils'
import type { Student, StudentFormData } from '@/types'

const COL = 'ogrenciler'

function mapStudentListDoc(docSnap: { id: string; data: () => Record<string, unknown> }): Student | null {
  const data = docSnap.data()
  if (data.role === 'admin') return null

  return {
    id: docSnap.id,
    adSoyad: String(data.adSoyad ?? ''),
    username: String(data.username ?? ''),
    password: data.password ? String(data.password) : undefined,
    bolum: String(data.bolum ?? ''),
    sinif: data.sinif as string | number,
    odaNo: data.odaNo as string | number,
    donem: data.donem ? String(data.donem) : 'Güz',
    canManageAttendance: data.canManageAttendance === true,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
  }
}

async function loadStudentsList(): Promise<Student[]> {
  const snap = await getDocs(collection(db, COL))
  const students: Student[] = []

  snap.forEach((docSnap) => {
    const student = mapStudentListDoc(docSnap)
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
  invalidateQueryCache(CACHE_KEYS.studentsList)
}

export async function createStudent(data: StudentFormData): Promise<void> {
  await addDoc(
    collection(db, COL),
    stripUndefined({
      adSoyad: data.adSoyad.trim(),
      username: data.username.trim(),
      password: data.password.trim(),
      bolum: data.bolum,
      sinif: data.sinif,
      odaNo: data.odaNo,
      donem: data.donem,
      role: 'student',
      canManageAttendance: data.canManageAttendance,
      akademikNotlar: {},
      donemOrtalamalari: {},
    }),
  )
  bumpStudentsCache()
}

export async function updateStudent(id: string, data: Partial<StudentFormData>): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  if (data.adSoyad) payload.adSoyad = data.adSoyad.trim()
  if (data.username) payload.username = data.username.trim()
  if (data.password) payload.password = data.password.trim()
  await updateDoc(doc(db, COL, id), stripUndefined(payload))
  bumpStudentsCache()
}

export async function deleteStudent(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
  bumpStudentsCache()
}

export async function importStudentsBatch(
  rows: StudentFormData[],
  existingUsernames: Set<string>,
): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  for (const data of rows) {
    const username = data.username.trim().toLowerCase()
    if (existingUsernames.has(username)) {
      skipped++
      continue
    }
    await createStudent(data)
    existingUsernames.add(username)
    created++
  }

  return { created, skipped }
}

export function getSinifLabel(sinif: string | number): string {
  return sinif === '0' || sinif === 0 ? 'Hazırlık' : `${sinif}. Sınıf`
}
