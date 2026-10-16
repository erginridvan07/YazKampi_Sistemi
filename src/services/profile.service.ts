import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CACHE_KEYS, invalidateQueryCache } from '@/lib/queryCache'
import { fetchUserProfile } from '@/services/auth.service'
import type { UserProfile } from '@/types'

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: string }).code)
  }
  return undefined
}

async function refreshProfile(uid: string): Promise<UserProfile> {
  const profile = await fetchUserProfile(uid)
  if (!profile) {
    throw new Error('Profil güncellenemedi.')
  }
  return profile
}

/**
 * Canonical student photo lives on users/{uid}.photoUrl only, keyed by Auth uid.
 * Do not write ogrenciler/{id}.photoUrl — students will not have roster write under S5.
 */
export async function fetchStudentPhotoMap(): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, 'users'))
  const map: Record<string, string> = {}

  snap.forEach((docSnap) => {
    const data = docSnap.data() as UserProfile
    if (
      data.role === 'student'
      && typeof data.photoUrl === 'string'
      && data.photoUrl
    ) {
      map[docSnap.id] = data.photoUrl
    }
  })

  return map
}

export async function updateProfilePhoto(uid: string, photoUrl: string): Promise<UserProfile> {
  const updatedAt = new Date().toISOString()
  try {
    await setDoc(doc(db, 'users', uid), { photoUrl, updatedAt }, { merge: true })
    return await refreshProfile(uid)
  } catch (error) {
    if (getErrorCode(error) === 'permission-denied') {
      throw new Error('Profil fotoğrafı kaydedilemedi. Firestore kurallarını kontrol edin.', {
        cause: error,
      })
    }
    throw error instanceof Error ? error : new Error('Profil fotoğrafı kaydedilemedi.', { cause: error })
  }
}

export async function removeProfilePhoto(uid: string): Promise<UserProfile> {
  const updatedAt = new Date().toISOString()
  try {
    await updateDoc(doc(db, 'users', uid), { photoUrl: deleteField(), updatedAt })
    return await refreshProfile(uid)
  } catch (error) {
    if (getErrorCode(error) === 'permission-denied') {
      throw new Error('Profil fotoğrafı kaldırılamadı. Firestore kurallarını kontrol edin.', {
        cause: error,
      })
    }
    throw error instanceof Error
      ? error
      : new Error('Profil fotoğrafı kaldırılamadı.', { cause: error })
  }
}

/** Admin-only UI path: student photos are stored only on users/{ownerUid}. */
export async function updateStudentProfilePhoto(ownerUid: string, photoUrl: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  try {
    await updateDoc(doc(db, 'users', ownerUid), { photoUrl, updatedAt })
    invalidateQueryCache(CACHE_KEYS.studentsList)
  } catch (error) {
    if (getErrorCode(error) === 'permission-denied') {
      throw new Error('Öğrenci fotoğrafı kaydedilemedi. Yönetici yetkisini ve Firestore kurallarını kontrol edin.', {
        cause: error,
      })
    }
    throw error instanceof Error ? error : new Error('Öğrenci fotoğrafı kaydedilemedi.', { cause: error })
  }
}

/** Admin-only UI path: remove the canonical student profile photo. */
export async function removeStudentProfilePhoto(ownerUid: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  try {
    await updateDoc(doc(db, 'users', ownerUid), { photoUrl: deleteField(), updatedAt })
    invalidateQueryCache(CACHE_KEYS.studentsList)
  } catch (error) {
    if (getErrorCode(error) === 'permission-denied') {
      throw new Error('Öğrenci fotoğrafı kaldırılamadı. Yönetici yetkisini ve Firestore kurallarını kontrol edin.', {
        cause: error,
      })
    }
    throw error instanceof Error ? error : new Error('Öğrenci fotoğrafı kaldırılamadı.', { cause: error })
  }
}
