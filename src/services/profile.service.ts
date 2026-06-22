import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
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

async function syncPhotoToStudentRecord(
  profile: UserProfile,
  photoUrl: string | null,
): Promise<void> {
  if (profile.role !== 'student') return

  const payload = photoUrl ? { photoUrl } : { photoUrl: deleteField() }

  try {
    if (profile.legacyDocId && profile.legacyCollection === 'ogrenciler') {
      await updateDoc(doc(db, 'ogrenciler', profile.legacyDocId), payload)
      invalidateQueryCache(CACHE_KEYS.studentsList)
      return
    }

    const snap = await getDocs(
      query(collection(db, 'ogrenciler'), where('username', '==', profile.username)),
    )
    if (!snap.empty) {
      await updateDoc(doc(db, 'ogrenciler', snap.docs[0].id), payload)
    }
    invalidateQueryCache(CACHE_KEYS.studentsList)
  } catch {
    // Ogrencli kaydina yazma basarisiz olsa da profil fotografi kaydedilmis kalir
  }
}

export async function fetchStudentPhotoMap(): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, 'users'))
  const map: Record<string, string> = {}

  snap.forEach((docSnap) => {
    const data = docSnap.data() as UserProfile
    if (data.role === 'student' && data.photoUrl && data.username) {
      map[data.username.trim().toLowerCase()] = data.photoUrl
    }
  })

  return map
}

export async function updateProfilePhoto(uid: string, photoUrl: string): Promise<UserProfile> {
  const updatedAt = new Date().toISOString()
  try {
    await setDoc(doc(db, 'users', uid), { photoUrl, updatedAt }, { merge: true })
    const profile = await refreshProfile(uid)
    await syncPhotoToStudentRecord(profile, photoUrl)
    return profile
  } catch (error) {
    if (getErrorCode(error) === 'permission-denied') {
      throw new Error('Profil fotoğrafı kaydedilemedi. Firestore kurallarını kontrol edin.')
    }
    throw error instanceof Error ? error : new Error('Profil fotoğrafı kaydedilemedi.')
  }
}

export async function removeProfilePhoto(uid: string): Promise<UserProfile> {
  const updatedAt = new Date().toISOString()
  try {
    await updateDoc(doc(db, 'users', uid), { photoUrl: deleteField(), updatedAt })
    const profile = await refreshProfile(uid)
    await syncPhotoToStudentRecord(profile, null)
    return profile
  } catch (error) {
    if (getErrorCode(error) === 'permission-denied') {
      throw new Error('Profil fotoğrafı kaldırılamadı. Firestore kurallarını kontrol edin.')
    }
    throw error instanceof Error ? error : new Error('Profil fotoğrafı kaldırılamadı.')
  }
}
