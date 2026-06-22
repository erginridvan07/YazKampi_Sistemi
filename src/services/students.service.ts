import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { stripUndefined } from '@/lib/utils'
import { fetchStudentPhotoMap } from '@/services/profile.service'
import type { Student, StudentFormData } from '@/types'

const COL = 'ogrenciler'

export async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, COL))
  const students: Student[] = []

  snap.forEach((docSnap) => {
    const data = docSnap.data()
    if (data.role === 'admin') return
    students.push({ id: docSnap.id, ...data } as Student)
  })

  return students.sort((a, b) => Number(a.odaNo || 999) - Number(b.odaNo || 999))
}

export async function fetchStudentsWithPhotos(): Promise<Student[]> {
  const [students, photoMap] = await Promise.all([
    fetchStudents(),
    fetchStudentPhotoMap().catch(() => ({} as Record<string, string>)),
  ])

  return students.map((student) => ({
    ...student,
    photoUrl: student.photoUrl || photoMap[student.username.trim().toLowerCase()],
  }))
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
}

export async function updateStudent(id: string, data: Partial<StudentFormData>): Promise<void> {
  const payload: Record<string, unknown> = { ...data }
  if (data.adSoyad) payload.adSoyad = data.adSoyad.trim()
  if (data.username) payload.username = data.username.trim()
  if (data.password) payload.password = data.password.trim()
  await updateDoc(doc(db, COL, id), stripUndefined(payload))
}

export async function deleteStudent(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
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
