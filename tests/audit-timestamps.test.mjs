import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUDIT_TIMESTAMP_STATUS,
  AUDIT_TIMESTAMP_NORMALIZE_ELIGIBLE,
  assertNoSensitiveAuditFields,
  buildAuditTimestampNormalizeUpdate,
  classifyAuditTimestamp,
  isAuditTimestampManualReview,
  isTimestampOnlyUpdate,
  parseLegacyIsoInstant,
  shouldNormalizeAuditTimestamp,
  toAuditTimestampManifestRow,
} from '../shared/auditTimestamps.mjs'

function fakeTimestamp(seconds) {
  return {
    seconds,
    nanoseconds: 0,
    toDate() {
      return new Date(seconds * 1000)
    },
  }
}

test('valid ISO Z is LEGACY_ISO and parses to the same instant', () => {
  const iso = '2026-01-01T00:00:00.000Z'
  const classified = classifyAuditTimestamp({ timestamp: iso })
  assert.equal(classified.status, AUDIT_TIMESTAMP_STATUS.LEGACY_ISO)
  assert.equal(classified.parsedIso, true)
  assert.equal(shouldNormalizeAuditTimestamp(classified.status), true)
  const parsed = parseLegacyIsoInstant(iso)
  assert.ok(parsed)
  assert.equal(parsed.toISOString(), iso)
})

test('timezone offset ISO preserves the same instant (no TZ loss)', () => {
  const offsetIso = '2026-08-18T21:00:00+03:00'
  const utcIso = '2026-08-18T18:00:00.000Z'
  const classified = classifyAuditTimestamp({ timestamp: offsetIso })
  assert.equal(classified.status, AUDIT_TIMESTAMP_STATUS.LEGACY_ISO)
  const parsed = parseLegacyIsoInstant(offsetIso)
  assert.ok(parsed)
  assert.equal(parsed.getTime(), new Date(utcIso).getTime())
  assert.equal(parsed.toISOString(), utcIso)
})

test('invalid string is INVALID / MANUAL_REVIEW and is not auto-fixed', () => {
  for (const value of ['not-a-date', '18.08.2026', '2026-01-01', '', 'August 18, 2026']) {
    const classified = classifyAuditTimestamp({ timestamp: value })
    assert.equal(classified.status, AUDIT_TIMESTAMP_STATUS.INVALID)
    assert.equal(classified.parsedIso, false)
    assert.equal(parseLegacyIsoInstant(value), null)
    assert.equal(shouldNormalizeAuditTimestamp(classified.status), false)
    assert.equal(isAuditTimestampManualReview(classified.status), true)
  }
})

test('Timestamp already OK is idempotent (no normalize)', () => {
  const classified = classifyAuditTimestamp({ timestamp: fakeTimestamp(1_700_000_000) })
  assert.equal(classified.status, AUDIT_TIMESTAMP_STATUS.OK)
  assert.equal(classified.parsedIso, false)
  assert.equal(shouldNormalizeAuditTimestamp(classified.status), false)
  assert.equal(AUDIT_TIMESTAMP_NORMALIZE_ELIGIBLE.has(classified.status), false)
})

test('missing timestamp is MISSING / MANUAL_REVIEW', () => {
  const classified = classifyAuditTimestamp({ islem: 'İzin Onayı' })
  assert.equal(classified.status, AUDIT_TIMESTAMP_STATUS.MISSING)
  assert.equal(shouldNormalizeAuditTimestamp(classified.status), false)
  assert.equal(isAuditTimestampManualReview(classified.status), true)
})

test('unexpected types are INVALID', () => {
  assert.equal(classifyAuditTimestamp({ timestamp: 1700000000000 }).status, AUDIT_TIMESTAMP_STATUS.INVALID)
  assert.equal(classifyAuditTimestamp({ timestamp: new Date() }).status, AUDIT_TIMESTAMP_STATUS.INVALID)
  assert.equal(classifyAuditTimestamp({ timestamp: null }).status, AUDIT_TIMESTAMP_STATUS.INVALID)
})

test('normalize update writes only timestamp', () => {
  const ts = fakeTimestamp(1)
  const update = buildAuditTimestampNormalizeUpdate(ts)
  assert.equal(isTimestampOnlyUpdate(update), true)
  assert.equal(update.timestamp, ts)
  assert.equal(isTimestampOnlyUpdate({ timestamp: ts, detay: 'nope' }), false)
})

test('write mode: only LEGACY_ISO is eligible; OK is idempotent no-op', () => {
  assert.equal(shouldNormalizeAuditTimestamp(AUDIT_TIMESTAMP_STATUS.LEGACY_ISO), true)
  assert.equal(shouldNormalizeAuditTimestamp(AUDIT_TIMESTAMP_STATUS.OK), false)
  assert.equal(shouldNormalizeAuditTimestamp(AUDIT_TIMESTAMP_STATUS.INVALID), false)
  assert.equal(shouldNormalizeAuditTimestamp(AUDIT_TIMESTAMP_STATUS.MISSING), false)
})

test('manifest row has operational metadata only', () => {
  const row = toAuditTimestampManifestRow({
    docId: 'log-1',
    status: AUDIT_TIMESTAMP_STATUS.LEGACY_ISO,
    parsedIso: true,
  })
  assert.deepEqual(row, {
    docId: 'log-1',
    timestampStatus: 'AUDIT_TIMESTAMP_LEGACY_ISO',
    parsedIso: true,
  })
  assert.equal('timestamp' in row, false)
  assertNoSensitiveAuditFields(row)
})
