import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { GRADUATE_AUTH_USERNAME, graduateAuthEmail, isGraduateSharedUsername } from '@/lib/graduateAuth'
import { auth, db } from '@/lib/firebase'
import { toAuthEmail } from '@/lib/utils'
import type { LoginType, UserProfile, UserRole } from '@/types'

const GENERIC_LOGIN_ERROR = 'Hatalı kullanıcı adı veya şifre.'
const MISSING_PROFILE_ERROR =
  'Hesap var ancak profil bulunamadı. Yöneticiye başvurun.'
const GRADUATE_PROFILE_ERROR =
  'Mezun hesabı profili bulunamadı veya geçersiz. Yöneticiyle iletişime geçin.'

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

function getLoginTypeMismatchMessage(loginType: LoginType, profile: UserProfile): string | null {
  if (loginType === 'mezunlar') {
    if (profile.role !== 'graduate') {
      if (profile.role === 'admin') {
        return 'Bu hesap bir yönetici hesabıdır. Lütfen "Yönetici Girişi" seçin.'
      }
      return 'Bu hesap bir öğrenci hesabıdır. Lütfen "Öğrenci Girişi" seçin.'
    }
    return null
  }

  if (profile.role === 'graduate') {
    return 'Bu hesap mezun girişi gerektirir. Lütfen "Mezun Girişi" seçin.'
  }

  const expectedRole: UserRole = loginType === 'yoneticiler' ? 'admin' : 'student'

  if (profile.legacyCollection && profile.legacyCollection !== loginType) {
    return profile.role === 'admin'
      ? 'Bu hesap bir yönetici hesabıdır. Lütfen "Yönetici Girişi" seçin.'
      : 'Bu hesap bir öğrenci hesabıdır. Lütfen "Öğrenci Girişi" seçin.'
  }

  if (profile.role !== expectedRole) {
    return profile.role === 'admin'
      ? 'Bu hesap bir yönetici hesabıdır. Lütfen "Yönetici Girişi" seçin.'
      : 'Bu hesap bir öğrenci hesabıdır. Lütfen "Öğrenci Girişi" seçin.'
  }

  return null
}

async function ensureLoginTypeMatches(loginType: LoginType, profile: UserProfile): Promise<void> {
  const message = getLoginTypeMismatchMessage(loginType, profile)
  if (message) {
    await signOut(auth)
    throw new Error(message)
  }
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

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null
  return snapshot.data() as UserProfile
}

/**
 * Graduate login is Auth-only against the fixed mezun.portal identity.
 * No Firestore password read, no legacy fallback, no client users-profile create.
 */
async function loginAsGraduate(username: string, password: string): Promise<UserProfile> {
  if (!isGraduateSharedUsername(username)) {
    throw new Error(GENERIC_LOGIN_ERROR)
  }

  const email = graduateAuthEmail()

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const profile = await fetchUserProfile(credential.user.uid)

    if (!profile) {
      await signOut(auth)
      throw new Error(GRADUATE_PROFILE_ERROR)
    }

    if (profile.role !== 'graduate') {
      await signOut(auth)
      throw new Error(GRADUATE_PROFILE_ERROR)
    }

    return profile
  } catch (error) {
    if (error instanceof Error && error.message === GRADUATE_PROFILE_ERROR) {
      throw error
    }

    const code = getErrorCode(error)
    const isInvalidLogin =
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials' ||
      code === 'auth/wrong-password'

    if (isInvalidLogin) {
      throw new Error(GENERIC_LOGIN_ERROR, { cause: error })
    }

    const translated = translateAuthError(code)
    if (translated) throw new Error(translated, { cause: error })
    throw new Error(getErrorMessage(error), { cause: error })
  }
}

/**
 * Student/admin/graduate: Firebase Auth only (no Firestore password fallback).
 * Graduate: fixed mezun.portal identity + existing users/{uid} role=graduate
 * (no client profile bootstrap, no Auth-fail fallback to a Firestore password).
 */
export async function login(
  loginType: LoginType,
  username: string,
  password: string,
): Promise<UserProfile> {
  const trimmedUsername = username.trim()
  const trimmedPassword = password.trim()

  if (loginType === 'mezunlar') {
    if (!trimmedPassword) {
      throw new Error('Lütfen şifre girin.')
    }
    if (trimmedPassword.length < 6) {
      throw new Error('Şifre en az 6 karakter olmalıdır (Firebase güvenlik kuralı).')
    }
    await signOut(auth)
    return loginAsGraduate(trimmedUsername || GRADUATE_AUTH_USERNAME, trimmedPassword)
  }

  if (!trimmedUsername || !trimmedPassword) {
    throw new Error('Lütfen kullanıcı adı ve şifre girin.')
  }

  if (trimmedPassword.length < 6) {
    throw new Error('Şifre en az 6 karakter olmalıdır (Firebase güvenlik kuralı).')
  }

  await signOut(auth)

  const email = toAuthEmail(trimmedUsername)

  try {
    const credential = await signInWithEmailAndPassword(auth, email, trimmedPassword)
    const profile = await fetchUserProfile(credential.user.uid)

    if (!profile) {
      await signOut(auth)
      throw new Error(MISSING_PROFILE_ERROR)
    }

    await ensureLoginTypeMatches(loginType, profile)
    return profile
  } catch (error) {
    const code = getErrorCode(error)
    const translated = translateAuthError(code)

    if (
      error instanceof Error &&
      (error.message === MISSING_PROFILE_ERROR ||
        error.message === GRADUATE_PROFILE_ERROR ||
        error.message.includes('yönetici hesabıdır') ||
        error.message.includes('öğrenci hesabıdır') ||
        error.message.includes('mezun girişi gerektirir'))
    ) {
      throw error
    }

    if (translated && code === 'permission-denied') {
      throw new Error(translated, { cause: error })
    }

    const isInvalidLogin =
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials' ||
      code === 'auth/wrong-password'

    if (isInvalidLogin) {
      throw new Error(GENERIC_LOGIN_ERROR, { cause: error })
    }

    if (translated) throw new Error(translated, { cause: error })
    throw new Error(getErrorMessage(error), { cause: error })
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

  const profile = await fetchUserProfile(user.uid)
  if (profile?.role === 'graduate') {
    throw new Error('Mezun giriş parolası bu ekrandan değiştirilemez.')
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
