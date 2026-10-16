import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeDutyName,
  parseDutyScheduleRows,
  resolveDutyRosterName,
} from '../src/lib/dutyScheduleHelpers.js'

const sampleRows = [
  { tarih: '29 Eyl', gun: 'Salı', imam: 'Berat Rıza Özmenteş', muezzin: 'Kadir Can Karaağaç' },
  { tarih: '1 Eki', gun: 'Per', imam: 'Recep Kılıç Keser', muezzin: 'Furkan İçim' },
  { tarih: '3 Eki', gun: 'Cmt', imam: 'Zeynel Öztürk', muezzin: 'İsmail Aşık' },
]

test('Gaye monthly duty rows map to the correct ISO dates', () => {
  const result = parseDutyScheduleRows('29 Eylül 2026 - 28 Ekim 2026', sampleRows)

  assert.equal(result.entries.length, 3)
  assert.deepEqual(
    result.entries.map((entry) => entry.tarih),
    ['2026-09-29', '2026-10-01', '2026-10-03'],
  )
  assert.equal(result.rangeLabel, '29 Eylül 2026 - 28 Ekim 2026')
  assert.equal(result.entries[1].imam, 'Recep Kılıç Keser')
  assert.equal(result.entries[1].muezzin, 'Furkan İçim')
})

test('duty parser handles a December to January schedule range', () => {
  const result = parseDutyScheduleRows('29 Aralık 2026 - 28 Ocak 2027', [
    { tarih: '29 Ara', gun: 'Salı', imam: 'Ali Veli', muezzin: 'Ayşe Kaya' },
    { tarih: '1 Oca', gun: 'Cuma', imam: 'Mehmet Demir', muezzin: 'Fatma Yılmaz' },
  ])

  assert.deepEqual(
    result.entries.map((entry) => entry.tarih),
    ['2026-12-29', '2027-01-01'],
  )
})

test('duty parser rejects a weekday mismatch and duplicate date', () => {
  assert.throws(
    () => parseDutyScheduleRows('29 Eylül 2026 - 28 Ekim 2026', [
      { tarih: '29 Eyl', gun: 'Pzt', imam: 'Ali Veli', muezzin: 'Ayşe Kaya' },
    ]),
    /gün bilgisi takvimle uyuşmuyor/,
  )

  assert.throws(
    () => parseDutyScheduleRows('29 Eylül 2026 - 28 Ekim 2026', [
      ...sampleRows,
      { tarih: '29 Eyl', gun: 'Salı', imam: 'Ali Veli', muezzin: 'Ayşe Kaya' },
    ]),
    /birden fazla kez/,
  )
})

test('name matching normalization preserves Turkish letters and collapses whitespace', () => {
  assert.equal(normalizeDutyName('  Ömer   Taş '), 'ömer taş')
})

test('roster matching safely resolves common PDF name differences', () => {
  const roster = [
    'Abdülsamet Mutlu',
    'Recep Kılıçkeser',
    'Feyzullah Hamza Türkkan',
    'Ömer Faruk Açıksöz',
    'Muhammed Enes Avnioğlu',
    'Muhammed Demir',
    'Muhammed Enes Demirci',
  ]

  assert.equal(resolveDutyRosterName('Abdulsamet Mutlu', roster)?.name, 'Abdülsamet Mutlu')
  assert.equal(resolveDutyRosterName('Recep Kılıç Keser', roster)?.name, 'Recep Kılıçkeser')
  assert.equal(resolveDutyRosterName('Feyzullah Türkan', roster)?.name, 'Feyzullah Hamza Türkkan')
  assert.equal(resolveDutyRosterName('Ömer Açıksöz', roster)?.name, 'Ömer Faruk Açıksöz')
  assert.equal(resolveDutyRosterName('Enes Avnioğlu', roster)?.name, 'Muhammed Enes Avnioğlu')
  assert.equal(resolveDutyRosterName('Muhammet Demir', roster)?.name, 'Muhammed Demir')
})

test('ambiguous roster name is never resolved automatically', () => {
  assert.equal(resolveDutyRosterName('Ömer Açıksöz', ['Ömer Faruk Açıksöz', 'Ömer Ali Açıksöz']), null)
})
