import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { toAuthEmail, stripUndefined } from '@/lib/utils'
import type { LegacyUserRecord, LoginType, UserProfile, UserRole } from '@/types'

function mapLegacyToProfile(
  uid: string,
  username: string,
  legacy: LegacyUserRecord,
  collectionName: LoginType,
  legacyDocId: string,
): UserProfile {
  const role: UserRole = collectionName === 'yoneticiler' ? 'admin' : 'student'

  const profile: UserProfile = {
    uid,
    username,
    adSoyad: legacy.adSoyad || username,
    role,
    canManageAttendance: role === 'admin' ? true : legacy.canManageAttendance === true,
    legacyCollection: collectionName,
    legacyDocId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Öğrenciye özel alanlar — yöneticide yoksa Firestore'a yazma
  if (role === 'student') {
    if (legacy.bolum !== undefined) profile.bolum = legacy.bolum
    if (legacy.sinif !== undefined) profile.sinif = legacy.sinif
    if (legacy.odaNo !== undefined) profile.odaNo = legacy.odaNo
    if (legacy.donem !== undefined) profile.donem = legacy.donem
  }

  return profile
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: string }).code)
  }
  return undefined
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Bilinmeyen hata oluştu.'
}

function translateAuthError(code: string | undefined): string | null {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Firebase Email/Password girişi kapalı. Console → Authentication → Sign-in method bölümünden açın.'
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalıdır (Firebase güvenlik kuralı).'
    case 'auth/invalid-email':
      return 'Kullanıcı adı geçersiz karakterler içeriyor. Sadece harf, rakam ve ._- kullanın.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
      return null
    case 'permission-denied':
      return 'Firestore izin hatası. Firebase Console → Firestore → Rules bölümünden kuralları yayınlayın.'
    default:
      return null
  }
}

async function findLegacyUser(
  loginType: LoginType,
  username: string,
  password: string,
): Promise<{ data: LegacyUserRecord; id: string } | null> {
  try {
    const q = query(collection(db, loginType), where('username', '==', username))
    const snapshot = await getDocs(q)

    const matchedDoc = snapshot.docs.find((docSnap) => docSnap.data().password === password)
    if (!matchedDoc) return null

    return { data: matchedDoc.data() as LegacyUserRecord, id: matchedDoc.id }
  } catch (error) {
    const code = getErrorCode(error)
    if (code === 'permission-denied') {
      throw new Error(
        'Firestore okuma izni yok. Firebase Console → Firestore Database → Rules sekmesine gidin, güncel kuralları yapıştırıp Publish (Yayınla) butonuna basın.',
      )
    }
    throw error
  }
}

async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    const cleanProfile = stripUndefined({ ...profile } as Record<string, unknown>)
    await setDoc(doc(db, 'users', profile.uid), cleanProfile, { merge: true })
  } catch (error) {
    const code = getErrorCode(error)
    if (code === 'permission-denied') {
      throw new Error(
        'Kullanıcı profili kaydedilemedi. Firestore Rules yayınlandığından emin olun.',
      )
    }
    throw error
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null
  return snapshot.data() as UserProfile
}

async function createProfileFromLegacy(
  loginType: LoginType,
  username: string,
  password: string,
): Promise<UserProfile> {
  const legacy = await findLegacyUser(loginType, username, password)
  if (!legacy) {
    throw new Error('Hatalı kullanıcı adı veya şifre.')
  }

  const email = toAuthEmail(username)

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const profile = mapLegacyToProfile(
      credential.user.uid,
      username,
      legacy.data,
      loginType,
      legacy.id,
    )
    await saveUserProfile(profile)
    return profile
  } catch (error) {
    const code = getErrorCode(error)

    if (code === 'auth/email-already-in-use') {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      let profile = await fetchUserProfile(credential.user.uid)

      if (!profile) {
        profile = mapLegacyToProfile(
          credential.user.uid,
          username,
          legacy.data,
          loginType,
          legacy.id,
        )
        await saveUserProfile(profile)
      }

      return profile
    }

    const translated = translateAuthError(code)
    if (translated) throw new Error(translated)
    throw new Error(getErrorMessage(error))
  }
}

export async function login(
  loginType: LoginType,
  username: string,
  password: string,
): Promise<UserProfile> {
  const trimmedUsername = username.trim()

  if (!trimmedUsername || !password.trim()) {
    throw new Error('Lütfen kullanıcı adı ve şifre girin.')
  }

  if (password.length < 6) {
    throw new Error('Şifre en az 6 karakter olmalıdır (Firebase güvenlik kuralı).')
  }

  await signOut(auth)

  const email = toAuthEmail(trimmedUsername)

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    let profile = await fetchUserProfile(credential.user.uid)

    if (!profile) {
      const legacy = await findLegacyUser(loginType, trimmedUsername, password)
      if (!legacy) {
        throw new Error('Hesap var ancak profil bulunamadı. Yöneticiye başvurun.')
      }

      profile = mapLegacyToProfile(
        credential.user.uid,
        trimmedUsername,
        legacy.data,
        loginType,
        legacy.id,
      )
      await saveUserProfile(profile)
    }

    return profile
  } catch (error) {
    const code = getErrorCode(error)
    const translated = translateAuthError(code)

    if (translated && code === 'permission-denied') {
      throw new Error(translated)
    }

    const isInvalidLogin =
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials' ||
      code === 'auth/wrong-password'

    if (isInvalidLogin) {
      return createProfileFromLegacy(loginType, trimmedUsername, password)
    }

    if (translated) throw new Error(translated)
    throw new Error(getErrorMessage(error))
  }
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
  }

  if (newPassword.length < 6) {
    throw new Error('Yeni şifre en az 6 karakter olmalıdır.')
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

export function subscribeToAuthChanges(
  callback: (user: User | null, profile: UserProfile | null) => void,
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null)
      return
    }

    try {
      const profile = await fetchUserProfile(user.uid)
      callback(user, profile)
    } catch {
      callback(user, null)
    }
  })
}
