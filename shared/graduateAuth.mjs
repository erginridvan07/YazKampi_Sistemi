/**
 * Shared graduate Auth helpers (client-safe constants + local Admin SDK classifiers).
 *
 * Shared identity is FIXED: mezun.portal → mezun.portal@gayevakfi.portal
 * Do not bind Auth identity to the mutable Firestore username field.
 *
 * S5.3-P2 follow-up (do not change mezunlar docs in this stage):
 * Graduate-visible candidates: adSoyad, bölüm, mezuniyet yılı, şehir, görev/çalıştığı yer, photo, sosyal medya?, iletişim?
 * Likely admin-only: notlar
 */

export const GRADUATE_AUTH_USERNAME = 'mezun.portal'
export const GRADUATE_LOGIN_COLLECTION = 'ayarlar'
export const GRADUATE_LOGIN_DOC_ID = 'mezun_giris'
export const GRADUATE_MIN_PASSWORD_LENGTH = 6

/** Marker: graduate login is Firebase Auth only (no Firestore password compare). */
export const GRADUATE_LOGIN_MODE = 'auth-only'

export const GRADUATE_AUTH_STATUS = {
  OK: 'GRADUATE_AUTH_OK',
  MISSING: 'GRADUATE_AUTH_MISSING',
  DISABLED: 'GRADUATE_AUTH_DISABLED',
  PROFILE_INVALID: 'GRADUATE_PROFILE_INVALID',
}

export const GRADUATE_PASSWORD_STATUS = {
  PRESENT: 'GRADUATE_PLAINTEXT_PASSWORD_PRESENT',
  ABSENT: 'GRADUATE_PLAINTEXT_PASSWORD_ABSENT',
}

export const GRADUATE_CLEANUP_BLOCK = {
  CLIENT_NOT_READY: 'CLIENT_AUTH_ONLY_NOT_READY',
  AUTH_NOT_OK: 'GRADUATE_AUTH_NOT_READY',
  PASSWORD_ABSENT: 'GRADUATE_PLAINTEXT_PASSWORD_ABSENT',
}

export const GRADUATE_ROTATION_STATUS = {
  READY: 'ROTATION_READY',
  AUTH_MISSING: 'GRADUATE_AUTH_MISSING',
  PROFILE_INVALID: 'GRADUATE_PROFILE_INVALID',
  TARGET_MISMATCH: 'ROTATION_TARGET_MISMATCH',
  PASSWORD_TOO_SHORT: 'ROTATION_PASSWORD_TOO_SHORT',
  PASSWORD_CONFIRM_MISMATCH: 'ROTATION_PASSWORD_CONFIRM_MISMATCH',
  FORBIDDEN_FIRESTORE_WRITE: 'ROTATION_FORBIDDEN_FIRESTORE_WRITE',
}

/** True if object has a `password` key. Never returns or logs the value. */
export function hasPlaintextPasswordField(data) {
  if (!data || typeof data !== 'object') return false
  return Object.prototype.hasOwnProperty.call(data, 'password')
}

export function classifyGraduateAuthCheck({
  authExists,
  authDisabled = false,
  profile = null,
  loginDoc = null,
}) {
  let authStatus = GRADUATE_AUTH_STATUS.OK
  if (!authExists) {
    authStatus = GRADUATE_AUTH_STATUS.MISSING
  } else if (authDisabled) {
    authStatus = GRADUATE_AUTH_STATUS.DISABLED
  } else if (!profile || profile.role !== 'graduate') {
    authStatus = GRADUATE_AUTH_STATUS.PROFILE_INVALID
  }

  const passwordPresent = hasPlaintextPasswordField(loginDoc)
  return {
    authStatus,
    passwordStatus: passwordPresent
      ? GRADUATE_PASSWORD_STATUS.PRESENT
      : GRADUATE_PASSWORD_STATUS.ABSENT,
    passwordPresent,
    role: profile && typeof profile.role === 'string' ? profile.role : null,
  }
}

export function assessGraduateClientAuthOnlyReady(sources = {}) {
  const authService = String(sources.authService || '')
  const graduatesService = String(sources.graduatesService || '')
  const adminSettings = String(sources.adminSettings || '')
  const failures = []

  if (authService.includes('verifyGraduatePortalLogin')) {
    failures.push('auth_reads_firestore_password')
  }
  if (!authService.includes('signInWithEmailAndPassword')) {
    failures.push('auth_missing_signInWithEmailAndPassword')
  }
  if (graduatesService.includes('verifyGraduatePortalLogin')) {
    failures.push('graduates_verifies_firestore_password')
  }
  if (graduatesService.includes("from 'firebase/auth'") || /\bupdatePassword\s*\(/.test(graduatesService)) {
    failures.push('graduates_calls_updatePassword')
  }
  if (graduatesService.includes('syncGraduateFirebaseAccount')) {
    failures.push('graduates_syncs_firebase_account')
  }
  if (
    graduatesService.includes('password: settings.password') ||
    graduatesService.includes('password:settings.password')
  ) {
    failures.push('graduates_writes_password_field')
  }
  if (adminSettings.includes('mezun-password') || adminSettings.includes('loginForm.password')) {
    failures.push('admin_password_input')
  }

  return {
    ready: failures.length === 0 && GRADUATE_LOGIN_MODE === 'auth-only',
    failures,
    loginMode: GRADUATE_LOGIN_MODE,
  }
}

export function classifyGraduatePasswordCleanup({
  authStatus,
  clientAuthOnlyReady,
  passwordPresent,
}) {
  if (!clientAuthOnlyReady) {
    return { allowed: false, reason: GRADUATE_CLEANUP_BLOCK.CLIENT_NOT_READY }
  }
  if (authStatus !== GRADUATE_AUTH_STATUS.OK) {
    return { allowed: false, reason: authStatus || GRADUATE_CLEANUP_BLOCK.AUTH_NOT_OK }
  }
  if (!passwordPresent) {
    return { allowed: false, reason: GRADUATE_CLEANUP_BLOCK.PASSWORD_ABSENT }
  }
  return { allowed: true, reason: 'READY' }
}

/**
 * Live update payload: ONLY delete ayarlar/mezun_giris.password.
 * Caller must pass FieldValue.delete() as the sentinel.
 */
export function buildGraduateLoginPasswordDeleteUpdate(fieldValueDelete) {
  if (fieldValueDelete === undefined || fieldValueDelete === null) {
    throw new Error('FieldValue.delete() sentinel is required')
  }
  return { password: fieldValueDelete }
}

export function isPasswordOnlyDeleteUpdate(update) {
  if (!update || typeof update !== 'object') return false
  const keys = Object.keys(update)
  return keys.length === 1 && keys[0] === 'password'
}

/**
 * Rotation classifier — never accepts or returns the password value.
 * Rotation must target the mezun.portal Auth user only and must not write Firestore.
 */
export function classifyGraduatePasswordRotation({
  authExists,
  authEmail,
  expectedEmail,
  authUid,
  resolvedUid,
  profileRole,
  newPasswordLength,
  confirmMatches,
  writesFirestore = false,
}) {
  if (writesFirestore) {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.FORBIDDEN_FIRESTORE_WRITE }
  }
  if (!authExists) {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.AUTH_MISSING }
  }
  if (!authEmail || !expectedEmail || authEmail !== expectedEmail) {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.TARGET_MISMATCH }
  }
  if (!authUid || !resolvedUid || authUid !== resolvedUid) {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.TARGET_MISMATCH }
  }
  if (profileRole !== 'graduate') {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.PROFILE_INVALID }
  }
  if (!confirmMatches) {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.PASSWORD_CONFIRM_MISMATCH }
  }
  if (!newPasswordLength || newPasswordLength < GRADUATE_MIN_PASSWORD_LENGTH) {
    return { allowed: false, status: GRADUATE_ROTATION_STATUS.PASSWORD_TOO_SHORT }
  }
  return { allowed: true, status: GRADUATE_ROTATION_STATUS.READY }
}

export function assertNoPasswordInReport(report) {
  const serialized = JSON.stringify(report)
  if (
    serialized.includes('"password":') &&
    !serialized.includes('GRADUATE_PLAINTEXT_PASSWORD')
  ) {
    throw new Error('report must not contain a password field value')
  }
  return true
}
