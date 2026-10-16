import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDers,
  addEk,
  buildManualGradeWritePayload,
  lastUpdateEqual,
  removeDers,
  removeEk,
} from '../shared/gradeHelpers.mjs'

test('vize/final girince ort otomatik değişmez', () => {
  const payload = buildManualGradeWritePayload(
    '1_Guz',
    [{ ad: 'Matematik', vize: 80, final: 90, ort: '75', harf: 'CB', ekler: [] }],
    '75',
    '3.1',
  )
  assert.equal(payload.akademikNotlar['1_Guz'][0].ort, '75')
  assert.equal(payload.akademikNotlar['1_Guz'][0].harf, 'CB')
})

test('ort ve harf manuel değerler korunur', () => {
  const payload = buildManualGradeWritePayload(
    '1_Guz',
    [{ ad: 'Fizik', vize: 40, final: 40, ort: '88', harf: 'BA', ekler: [] }],
    '88',
    '88',
  )
  assert.equal(payload.donemOrtalamalari['1_Guz'], '88')
  assert.equal(payload.genelOrt, '88')
})

test('dönem ve genel ortalama manuel girilebilir', () => {
  const payload = buildManualGradeWritePayload(
    '2_Guz',
    [{ ad: 'Kimya', vize: 50, final: 60, ort: '55', harf: 'DD', ekler: [] }],
    '55.5',
    '2.75',
    { '1_Guz': [{ ad: 'Eski', vize: 70, final: 70, ort: 70, harf: 'CC', ekler: [] }] },
    { '1_Guz': '70' },
  )
  assert.equal(payload.donemOrtalamalari['2_Guz'], '55.5')
  assert.equal(payload.genelOrt, '2.75')
  assert.equal(payload.akademikNotlar['1_Guz'][0].ad, 'Eski')
})

test('ders ekle/sil', () => {
  let courses = []
  courses = addDers(courses)
  courses = addDers(courses)
  courses[0] = { ...courses[0], ad: 'A' }
  courses = removeDers(courses, 1)
  assert.equal(courses.length, 1)
  assert.equal(courses[0].ad, 'A')
})

test('ek not ekle/sil', () => {
  let courses = [{ ad: 'Ders', vize: '', final: '', ort: '', harf: '', ekler: [] }]
  courses = addEk(courses, 0)
  assert.equal(courses[0].ekler.length, 1)
  courses = removeEk(courses, 0, 0)
  assert.equal(courses[0].ekler.length, 0)
})

test('lastUpdateEqual compares ISO strings', () => {
  assert.equal(lastUpdateEqual('2026-08-21T12:00:00.000Z', '2026-08-21T12:00:00.000Z'), true)
  assert.equal(lastUpdateEqual(null, null), true)
  assert.equal(lastUpdateEqual('2026-08-21T12:00:00.000Z', '2026-08-21T13:00:00.000Z'), false)
})

test('buildManualGradeWritePayload sets lastUpdate ISO', () => {
  const payload = buildManualGradeWritePayload('1_Guz', [], '', '')
  assert.match(payload.lastUpdate, /^\d{4}-\d{2}-\d{2}T/)
})
