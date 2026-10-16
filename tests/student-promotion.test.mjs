import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPromotionPreviewRows,
  formatSinifLabel,
  getNextSinif,
  isTerminalSinif,
  normalizeSinifValue,
  resolvePromotionStatus,
  summarizePromotionRows,
  toBulkPromotePayload,
} from '../shared/studentPromotion.mjs'

test('A) 1. Sınıf → 2. Sınıf', () => {
  assert.equal(getNextSinif('1'), '2')
  assert.equal(getNextSinif(1), '2')
})

test('B) 2. Sınıf → 3. Sınıf', () => {
  assert.equal(getNextSinif('2'), '3')
})

test('C) 3. Sınıf → 4. Sınıf', () => {
  assert.equal(getNextSinif('3'), '4')
})

test('D) Son sınıf otomatik değişmez', () => {
  assert.equal(getNextSinif('4'), null)
  assert.equal(isTerminalSinif('4'), true)
  assert.equal(isTerminalSinif(4), true)
  const rows = buildPromotionPreviewRows([{ id: 'a', adSoyad: 'Ali', sinif: '4' }])
  assert.equal(rows[0].selected, false)
  assert.equal(rows[0].status, 'manual_review')
  assert.equal(rows[0].suggestedSinif, null)
})

test('Hazırlık → 1. Sınıf', () => {
  assert.equal(normalizeSinifValue('0'), '0')
  assert.equal(getNextSinif('0'), '1')
  assert.equal(formatSinifLabel('0'), 'Hazırlık')
})

test('E) Checkbox kaldırılan öğrenci payload dışı', () => {
  const rows = buildPromotionPreviewRows([
    { id: 'a', adSoyad: 'Ali', sinif: '1' },
    { id: 'b', adSoyad: 'Veli', sinif: '2' },
  ])
  rows[0].selected = false
  rows[0].status = resolvePromotionStatus(rows[0])
  const payload = toBulkPromotePayload(rows)
  assert.equal(payload.some((p) => p.id === 'a'), false)
  assert.equal(payload.some((p) => p.id === 'b'), true)
})

test('F) Yalnız ardışık hedef sınıf payloada girer', () => {
  const rows = buildPromotionPreviewRows([{ id: 'a', adSoyad: 'Ali', sinif: '1' }])
  rows[0].targetSinif = '1'
  rows[0].status = resolvePromotionStatus(rows[0])
  assert.equal(rows[0].status, 'unchanged')
  assert.deepEqual(toBulkPromotePayload(rows), [])

  rows[0].targetSinif = '3'
  rows[0].status = resolvePromotionStatus(rows[0])
  assert.equal(rows[0].status, 'will_promote')
  assert.deepEqual(toBulkPromotePayload(rows), [])

  rows[0].targetSinif = '2'
  assert.deepEqual(toBulkPromotePayload(rows), [
    { id: 'a', expectedCurrentSinif: '1', targetSinif: '2' },
  ])
})

test('G/H/I) Payload allowlist yalnız id + sınıflar', () => {
  const payload = toBulkPromotePayload(
    buildPromotionPreviewRows([{ id: 'stu1', adSoyad: 'Ali', sinif: '2' }]),
  )
  assert.deepEqual(Object.keys(payload[0]).sort(), [
    'expectedCurrentSinif',
    'id',
    'targetSinif',
  ])
  assert.equal('ownerUid' in payload[0], false)
  assert.equal('canManageAttendance' in payload[0], false)
  assert.equal('username' in payload[0], false)
})

test('Summary counts', () => {
  const rows = buildPromotionPreviewRows([
    { id: '1', adSoyad: 'A', sinif: '0' },
    { id: '2', adSoyad: 'B', sinif: '1' },
    { id: '3', adSoyad: 'C', sinif: '4' },
  ])
  const summary = summarizePromotionRows(rows)
  assert.equal(summary.total, 3)
  assert.equal(summary.willUpdate, 2)
  assert.equal(summary.manualReview, 1)
})

test('Number and label aliases normalize', () => {
  assert.equal(normalizeSinifValue(0), '0')
  assert.equal(normalizeSinifValue('Hazırlık'), '0')
  assert.equal(normalizeSinifValue('hazirlik'), '0')
  assert.equal(normalizeSinifValue('9'), null)
})
