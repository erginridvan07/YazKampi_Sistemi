/**
 * Evci talepleri ownerUid backfill helpers.
 * Keep classification logic pure for migrate-legacy-auth self-tests.
 */

export const LEAVE_OWNER_STATUS = {
  OWNER_OK: 'OWNER_OK',
  OWNER_SAFE_TO_BACKFILL: 'OWNER_SAFE_TO_BACKFILL',
  OWNER_AMBIGUOUS: 'OWNER_AMBIGUOUS',
  OWNER_NOT_FOUND: 'OWNER_NOT_FOUND',
  OWNER_IDENTITY_INVALID: 'OWNER_IDENTITY_INVALID',
  OWNER_MISMATCH: 'OWNER_MISMATCH',
}

/** Statuses eligible for automatic ownerUid backfill (live mode only). */
export const LEAVE_OWNER_BACKFILL_ELIGIBLE = new Set([
  LEAVE_OWNER_STATUS.OWNER_SAFE_TO_BACKFILL,
])

/** Statuses requiring manual review before any automated fix. */
export function isLeaveOwnerManualReview(status) {
  return !LEAVE_OWNER_BACKFILL_ELIGIBLE.has(status) && status !== LEAVE_OWNER_STATUS.OWNER_OK
}

/**
 * @param {Array<{ id: string, data: Record<string, unknown> }>} studentDocs
 * @returns {Map<string, Array<{ id: string, data: Record<string, unknown> }>>}
 */
export function buildStudentsByAdSoyadIndex(studentDocs) {
  /** @type {Map<string, Array<{ id: string, data: Record<string, unknown> }>>} */
  const index = new Map()

  for (const doc of studentDocs) {
    const data = doc.data || {}
    if (data.role === 'admin') continue

    const adSoyad = typeof data.adSoyad === 'string' ? data.adSoyad.trim() : ''
    if (!adSoyad) continue

    if (!index.has(adSoyad)) index.set(adSoyad, [])
    index.get(adSoyad).push({ id: doc.id, data })
  }

  return index
}

/**
 * Verify student.ownerUid ↔ users/{uid} identity binding.
 * @returns {{ valid: boolean, expectedOwnerUid: string|null, reason?: string }}
 */
export function verifyStudentOwnerIdentity(studentId, studentData, usersProfile) {
  const ownerUid =
    typeof studentData?.ownerUid === 'string' ? studentData.ownerUid.trim() : ''

  if (!ownerUid) {
    return { valid: false, expectedOwnerUid: null, reason: 'missing_student_ownerUid' }
  }

  if (!usersProfile) {
    return { valid: false, expectedOwnerUid: ownerUid, reason: 'users_profile_missing' }
  }

  const bindingOk =
    usersProfile.role === 'student' &&
    usersProfile.legacyCollection === 'ogrenciler' &&
    usersProfile.legacyDocId === studentId

  if (!bindingOk) {
    return { valid: false, expectedOwnerUid: ownerUid, reason: 'identity_binding_mismatch' }
  }

  return { valid: true, expectedOwnerUid: ownerUid }
}

/**
 * Classify one evciTalepleri document for ownerUid backfill readiness.
 * Chain: ogrenciAd → ogrenciler.adSoyad (exact) → student.ownerUid → users profile binding.
 *
 * @param {{
 *   leaveRequestId: string,
 *   leaveData: Record<string, unknown>,
 *   studentsByAdSoyad: Map<string, Array<{ id: string, data: Record<string, unknown> }>>,
 *   usersByUid: Map<string, Record<string, unknown>>,
 * }} input
 */
export function classifyLeaveOwnerRequest({
  leaveRequestId,
  leaveData,
  studentsByAdSoyad,
  usersByUid,
}) {
  const ogrenciAd =
    typeof leaveData?.ogrenciAd === 'string' ? leaveData.ogrenciAd.trim() : ''
  const existingOwnerUid =
    typeof leaveData?.ownerUid === 'string' ? leaveData.ownerUid.trim() : ''
  const timestamp = leaveData?.tarih ?? null

  const base = {
    leaveRequestId,
    matchedStudentId: null,
    expectedOwnerUid: null,
    timestamp,
  }

  if (!ogrenciAd) {
    return {
      ...base,
      status: LEAVE_OWNER_STATUS.OWNER_NOT_FOUND,
      reason: 'missing_ogrenciAd',
    }
  }

  const matches = studentsByAdSoyad.get(ogrenciAd) || []

  if (matches.length === 0) {
    return {
      ...base,
      status: LEAVE_OWNER_STATUS.OWNER_NOT_FOUND,
    }
  }

  if (matches.length > 1) {
    return {
      ...base,
      status: LEAVE_OWNER_STATUS.OWNER_AMBIGUOUS,
      ambiguousStudentIds: matches.map((m) => m.id),
    }
  }

  const { id: studentId, data: studentData } = matches[0]
  const ownerUidOnStudent =
    typeof studentData?.ownerUid === 'string' ? studentData.ownerUid.trim() : ''
  const usersProfile = ownerUidOnStudent ? usersByUid.get(ownerUidOnStudent) || null : null

  const identity = verifyStudentOwnerIdentity(studentId, studentData, usersProfile)
  if (!identity.valid) {
    return {
      ...base,
      status: LEAVE_OWNER_STATUS.OWNER_IDENTITY_INVALID,
      matchedStudentId: studentId,
      expectedOwnerUid: identity.expectedOwnerUid,
      reason: identity.reason,
    }
  }

  const expectedOwnerUid = identity.expectedOwnerUid

  if (!existingOwnerUid) {
    return {
      ...base,
      status: LEAVE_OWNER_STATUS.OWNER_SAFE_TO_BACKFILL,
      matchedStudentId: studentId,
      expectedOwnerUid,
    }
  }

  if (existingOwnerUid === expectedOwnerUid) {
    return {
      ...base,
      status: LEAVE_OWNER_STATUS.OWNER_OK,
      matchedStudentId: studentId,
      expectedOwnerUid,
    }
  }

  return {
    ...base,
    status: LEAVE_OWNER_STATUS.OWNER_MISMATCH,
    matchedStudentId: studentId,
    expectedOwnerUid,
    existingOwnerUid,
  }
}

/** Manifest-safe row — never includes sebep, passwords, or tokens. */
export function toLeaveOwnerManifestRow(classification) {
  return {
    leaveRequestId: classification.leaveRequestId,
    status: classification.status,
    matchedStudentId: classification.matchedStudentId ?? null,
    expectedOwnerUid: classification.expectedOwnerUid ?? null,
    timestamp: classification.timestamp ?? null,
  }
}
