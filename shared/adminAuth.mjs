/**
 * Admin / yoneticiler Auth binding classifiers (local Admin SDK inventory).
 * Password VALUES are never returned. Presence is boolean/status only.
 */

import { isReservedUsername, tryToAuthEmail } from './authIdentity.mjs'
import { hasPlaintextPasswordField } from './graduateAuth.mjs'

export const ADMIN_LEGACY_COLLECTION = 'yoneticiler'
export const ADMIN_EXPECTED_ROLE = 'admin'

export const ADMIN_BINDING_STATUS = {
  OK: 'ADMIN_BINDING_OK',
  AUTH_MISSING: 'ADMIN_AUTH_MISSING',
  PROFILE_MISSING: 'ADMIN_PROFILE_MISSING',
  PROFILE_MISMATCH: 'ADMIN_PROFILE_MISMATCH',
  AUTH_DISABLED: 'ADMIN_AUTH_DISABLED',
  USERNAME_INVALID: 'ADMIN_USERNAME_INVALID',
  DUPLICATE_USERNAME: 'ADMIN_DUPLICATE_USERNAME',
}

export const ADMIN_PASSWORD_STATUS = {
  PRESENT: 'ADMIN_PASSWORD_PRESENT',
  ABSENT: 'ADMIN_PASSWORD_ABSENT',
}

export const ADMIN_CLEANUP_BLOCK = {
  BINDING_NOT_OK: 'ADMIN_BINDING_NOT_OK',
  AUTH_DISABLED: 'ADMIN_AUTH_DISABLED',
  PASSWORD_ABSENT: 'ADMIN_PASSWORD_ABSENT',
  MANUAL_REVIEW: 'ADMIN_MANUAL_REVIEW',
}

export function hasAdminPlaintextPasswordField(data) {
  return hasPlaintextPasswordField(data)
}

export function normalizeAdminUsername(username) {
  return typeof username === 'string' ? username.trim() : ''
}

export function adminUsernameDuplicateKey(username) {
  return normalizeAdminUsername(username).toLowerCase()
}

/**
 * Pre-scan yoneticiler rows for duplicate usernames and canonical email collisions.
 * Never auto-matches Auth when either flag is true for a row.
 */
export function buildAdminCollisionIndex(rows) {
  const usernameCounts = new Map()
  const emailCounts = new Map()

  for (const row of rows) {
    const username = normalizeAdminUsername(row.username)
    if (username) {
      const key = adminUsernameDuplicateKey(username)
      usernameCounts.set(key, (usernameCounts.get(key) || 0) + 1)
    }
    const emailTry = tryToAuthEmail(username)
    if (username && emailTry.ok) {
      emailCounts.set(emailTry.email, (emailCounts.get(emailTry.email) || 0) + 1)
    }
  }

  return { usernameCounts, emailCounts }
}

export function adminCollisionFlags(username, index) {
  const normalized = normalizeAdminUsername(username)
  const usernameKey = adminUsernameDuplicateKey(normalized)
  const emailTry = tryToAuthEmail(normalized)
  const duplicateUsername = Boolean(normalized) && (index.usernameCounts.get(usernameKey) || 0) > 1
  const emailCollision = Boolean(emailTry.ok) && (index.emailCounts.get(emailTry.email) || 0) > 1
  return {
    duplicateUsername,
    emailCollision,
    emailOk: emailTry.ok,
    email: emailTry.ok ? emailTry.email : null,
  }
}

function profileMatchesAdmin(profile, legacyDocId, username) {
  if (!profile || typeof profile !== 'object') return false
  return (
    profile.role === ADMIN_EXPECTED_ROLE &&
    profile.legacyCollection === ADMIN_LEGACY_COLLECTION &&
    profile.legacyDocId === legacyDocId &&
    profile.username === username
  )
}

/**
 * Binding and password status are independent.
 * Duplicate username / canonical email collision: never auto-match Auth.
 */
export function classifyAdminBinding({
  legacyDocId,
  username,
  passwordPresent = false,
  duplicateUsername = false,
  emailCollision = false,
  authExists = false,
  authDisabled = false,
  profile = null,
}) {
  const normalized = normalizeAdminUsername(username)
  const emailTry = tryToAuthEmail(normalized)
  const passwordStatus = passwordPresent
    ? ADMIN_PASSWORD_STATUS.PRESENT
    : ADMIN_PASSWORD_STATUS.ABSENT

  const base = {
    passwordStatus,
    passwordPresent: Boolean(passwordPresent),
    disabled: Boolean(authDisabled),
    uid: null,
    email: emailTry.ok ? emailTry.email : null,
  }

  if (!normalized || isReservedUsername(normalized) || !emailTry.ok) {
    return {
      ...base,
      bindingStatus: ADMIN_BINDING_STATUS.USERNAME_INVALID,
      manualReviewRequired: true,
      reason: !normalized
        ? 'missing_username'
        : isReservedUsername(normalized)
          ? 'reserved_username'
          : 'invalid_username_email',
    }
  }

  if (duplicateUsername || emailCollision) {
    return {
      ...base,
      bindingStatus: ADMIN_BINDING_STATUS.DUPLICATE_USERNAME,
      manualReviewRequired: true,
      reason: duplicateUsername ? 'duplicate_username' : 'canonical_email_collision',
    }
  }

  if (!authExists) {
    return {
      ...base,
      bindingStatus: ADMIN_BINDING_STATUS.AUTH_MISSING,
      manualReviewRequired: true,
      reason: 'auth_missing',
    }
  }

  if (authDisabled) {
    return {
      ...base,
      bindingStatus: ADMIN_BINDING_STATUS.AUTH_DISABLED,
      manualReviewRequired: true,
      reason: 'auth_disabled',
    }
  }

  if (!profile) {
    return {
      ...base,
      bindingStatus: ADMIN_BINDING_STATUS.PROFILE_MISSING,
      manualReviewRequired: true,
      reason: 'profile_missing',
    }
  }

  if (!profileMatchesAdmin(profile, legacyDocId, normalized)) {
    return {
      ...base,
      bindingStatus: ADMIN_BINDING_STATUS.PROFILE_MISMATCH,
      manualReviewRequired: true,
      reason: 'identity_binding_mismatch',
    }
  }

  return {
    ...base,
    bindingStatus: ADMIN_BINDING_STATUS.OK,
    manualReviewRequired: false,
    reason: 'ok',
  }
}

export function classifyAdminPasswordCleanup({
  bindingStatus,
  authDisabled = false,
  passwordPresent = false,
  manualReviewRequired = false,
}) {
  if (manualReviewRequired) {
    return { allowed: false, reason: ADMIN_CLEANUP_BLOCK.MANUAL_REVIEW }
  }
  if (bindingStatus !== ADMIN_BINDING_STATUS.OK) {
    return { allowed: false, reason: ADMIN_CLEANUP_BLOCK.BINDING_NOT_OK }
  }
  if (authDisabled) {
    return { allowed: false, reason: ADMIN_CLEANUP_BLOCK.AUTH_DISABLED }
  }
  if (!passwordPresent) {
    return { allowed: false, reason: ADMIN_CLEANUP_BLOCK.PASSWORD_ABSENT }
  }
  return { allowed: true, reason: 'READY' }
}

/**
 * Live update payload: ONLY delete yoneticiler/{id}.password.
 * Caller must pass FieldValue.delete() as the sentinel.
 */
export function buildAdminPasswordDeleteUpdate(fieldValueDelete) {
  if (fieldValueDelete === undefined || fieldValueDelete === null) {
    throw new Error('FieldValue.delete() sentinel is required')
  }
  return { password: fieldValueDelete }
}

export function toAdminAuthManifestRow({
  legacyDocId,
  username,
  uid,
  classified,
  cleanupEligible,
  timestamp,
}) {
  return {
    legacyDocId,
    username: username || null,
    uid: uid || null,
    bindingStatus: classified.bindingStatus,
    passwordStatus: classified.passwordStatus,
    disabled: Boolean(classified.disabled),
    manualReviewRequired: Boolean(classified.manualReviewRequired),
    cleanupEligible: Boolean(cleanupEligible),
    reason: classified.reason || null,
    timestamp,
  }
}

export function emptyAdminBindingCounts() {
  return {
    ADMIN_BINDING_OK: 0,
    ADMIN_AUTH_MISSING: 0,
    ADMIN_PROFILE_MISSING: 0,
    ADMIN_PROFILE_MISMATCH: 0,
    ADMIN_AUTH_DISABLED: 0,
    ADMIN_USERNAME_INVALID: 0,
    ADMIN_DUPLICATE_USERNAME: 0,
    ADMIN_PASSWORD_PRESENT: 0,
    ADMIN_PASSWORD_ABSENT: 0,
  }
}

export function incrementAdminCounts(counts, classified) {
  if (Object.prototype.hasOwnProperty.call(counts, classified.bindingStatus)) {
    counts[classified.bindingStatus] += 1
  }
  if (classified.passwordStatus === ADMIN_PASSWORD_STATUS.PRESENT) {
    counts.ADMIN_PASSWORD_PRESENT += 1
  } else {
    counts.ADMIN_PASSWORD_ABSENT += 1
  }
}

export function assertNoPasswordValueInAdminPayload(payload) {
  const serialized = JSON.stringify(payload)
  if (serialized.includes('"password":') && !serialized.includes('ADMIN_PASSWORD_')) {
    throw new Error('admin auth report must not contain a password field value')
  }
  if (/"password"\s*:\s*"/i.test(serialized)) {
    throw new Error('admin auth report must not contain a password string value')
  }
  return true
}
