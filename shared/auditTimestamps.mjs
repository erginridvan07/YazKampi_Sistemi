/**
 * islem_loglari timestamp inventory / normalize helpers.
 * Pure classifiers for migrate-legacy-auth self-tests (no Firebase I/O).
 */

export const AUDIT_LOG_COLLECTION = 'islem_loglari'

export const AUDIT_TIMESTAMP_STATUS = {
  OK: 'AUDIT_TIMESTAMP_OK',
  LEGACY_ISO: 'AUDIT_TIMESTAMP_LEGACY_ISO',
  INVALID: 'AUDIT_TIMESTAMP_INVALID',
  MISSING: 'AUDIT_TIMESTAMP_MISSING',
}

/** Live normalize may convert only parseable ISO strings. */
export const AUDIT_TIMESTAMP_NORMALIZE_ELIGIBLE = new Set([
  AUDIT_TIMESTAMP_STATUS.LEGACY_ISO,
])

const SENSITIVE_AUDIT_KEYS = new Set([
  'detay',
  'islem',
  'yapan',
  'rol',
  'actorUid',
  'ogrenciAd',
  'password',
  'token',
])

/** Full ISO-8601 datetime with timezone (Z or ±HH:MM). Date-only is rejected. */
const ISO_INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/

export function isAuditTimestampManualReview(status) {
  return (
    status === AUDIT_TIMESTAMP_STATUS.INVALID ||
    status === AUDIT_TIMESTAMP_STATUS.MISSING
  )
}

export function shouldNormalizeAuditTimestamp(status) {
  return AUDIT_TIMESTAMP_NORMALIZE_ELIGIBLE.has(status)
}

/**
 * Admin SDK Timestamp (or duck-typed equivalent). Do not treat Date / epoch numbers as OK.
 * @param {unknown} value
 */
export function isFirestoreTimestampLike(value) {
  if (!value || typeof value !== 'object') return false
  const seconds =
    typeof value.seconds === 'number'
      ? value.seconds
      : typeof value._seconds === 'number'
        ? value._seconds
        : null
  return seconds != null && Number.isFinite(seconds) && typeof value.toDate === 'function'
}

/**
 * Parse a legacy ISO instant. Invalid values are not auto-fixed.
 * Offset and Z forms resolve to the same absolute millisecond instant.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseLegacyIsoInstant(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!ISO_INSTANT_RE.test(trimmed)) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * Classify one islem_loglari document timestamp field.
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {{ status: string, parsedIso: boolean }}
 */
export function classifyAuditTimestamp(data) {
  if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, 'timestamp')) {
    return { status: AUDIT_TIMESTAMP_STATUS.MISSING, parsedIso: false }
  }

  const value = data.timestamp
  if (value == null || value === '') {
    return { status: AUDIT_TIMESTAMP_STATUS.INVALID, parsedIso: false }
  }

  if (isFirestoreTimestampLike(value)) {
    return { status: AUDIT_TIMESTAMP_STATUS.OK, parsedIso: false }
  }

  if (typeof value === 'string') {
    if (parseLegacyIsoInstant(value)) {
      return { status: AUDIT_TIMESTAMP_STATUS.LEGACY_ISO, parsedIso: true }
    }
    return { status: AUDIT_TIMESTAMP_STATUS.INVALID, parsedIso: false }
  }

  return { status: AUDIT_TIMESTAMP_STATUS.INVALID, parsedIso: false }
}

/**
 * Live update payload: timestamp field only.
 * @param {unknown} firestoreTimestamp
 */
export function buildAuditTimestampNormalizeUpdate(firestoreTimestamp) {
  return { timestamp: firestoreTimestamp }
}

export function isTimestampOnlyUpdate(update) {
  if (!update || typeof update !== 'object' || Array.isArray(update)) return false
  const keys = Object.keys(update)
  return keys.length === 1 && keys[0] === 'timestamp' && update.timestamp != null
}

/**
 * Manifest-safe row — no log content, no timestamp value.
 * @param {{ docId: string, status: string, parsedIso: boolean }} classification
 */
export function toAuditTimestampManifestRow(classification) {
  return {
    docId: classification.docId,
    timestampStatus: classification.status,
    parsedIso: Boolean(classification.parsedIso),
  }
}

function collectKeys(value, acc = new Set()) {
  if (!value || typeof value !== 'object') return acc
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc)
    return acc
  }
  for (const [key, nested] of Object.entries(value)) {
    acc.add(key)
    collectKeys(nested, acc)
  }
  return acc
}

/** Throw if a report/manifest includes sensitive audit content keys. */
export function assertNoSensitiveAuditFields(payload) {
  const keys = collectKeys(payload)
  for (const key of SENSITIVE_AUDIT_KEYS) {
    if (keys.has(key)) {
      throw new Error(`Audit timestamp report leaked sensitive field: ${key}`)
    }
  }
  const serialized = JSON.stringify(payload)
  if (serialized.includes('"detay"') || serialized.includes('"yapan"')) {
    throw new Error('Audit timestamp report leaked sensitive audit content')
  }
}
