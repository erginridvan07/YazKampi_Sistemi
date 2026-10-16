import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTranscriptImportPlan,
  parseTranscriptLines,
} from '../src/lib/transcriptHelpers.js'

const lines = [
  '2023-2024 Güz Dönemi Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
  'HUK101 HUKUK BAŞLANGICI I Z Tr 3 0 3 5 AA 20 G',
  'DNO: 3,50 GNO: 3,50 TUK: 0 TAKTS: 30',
  '2023-2024 Bahar Dönemi Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
  'HUK102 TÜRK HUKUK TARİHİ Z Tr 3 0 3 5 BA 17.5 G',
  'DNO: 3.20 GNO: 3.35 TUK: 0 TAKTS: 60',
  '2023-2024 Yaz Okulu Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
  'HUK103 MEDENİ HUKUK Z Tr 3 0 3 4 BB 12 G',
  'DNO: 3.80 GNO: 3.45 TUK: 0 TAKTS: 64',
]

test('YÖK transcript rows parse course, grade, AKTS, DNO and GNO without score import', () => {
  const terms = parseTranscriptLines(lines)
  assert.equal(terms.length, 3)
  assert.deepEqual(terms[0].courses[0], {
    code: 'HUK101',
    title: 'HUKUK BAŞLANGICI I',
    letterGrade: 'AA',
    ects: '5',
  })
  assert.equal(terms[0].termAverage, '3.50')
  assert.equal(terms[1].generalAverage, '3.35')
  assert.equal(terms[2].kind, 'summer')
})

test('summer-school courses return to the matching previous regular term', () => {
  const matchingSummerLines = [
    '2023-2024 Güz Dönemi Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
    'HUK101 HUKUK BAŞLANGICI I Z Tr 3 0 3 5 FF 0 G',
    'DNO: 2,50 GNO: 2,50 TUK: 0 TAKTS: 30',
    '2023-2024 Bahar Dönemi Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
    'HUK102 TÜRK HUKUK TARİHİ Z Tr 3 0 3 5 BA 17.5 G',
    'DNO: 3.20 GNO: 3.35 TUK: 0 TAKTS: 60',
    '2023-2024 Yaz Okulu Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
    'HUK101 HUKUK BAŞLANGICI I Z Tr 3 0 3 5 BB 12 G',
    'DNO: 3.80 GNO: 3.45 TUK: 0 TAKTS: 64',
  ]
  const plan = buildTranscriptImportPlan(parseTranscriptLines(matchingSummerLines), '1_Guz')
  assert.deepEqual(
    plan.targets.map(({ sourceLabel, targetPeriod, isSummer }) => ({ sourceLabel, targetPeriod, isSummer })),
    [
      { sourceLabel: '2023-2024 Güz', targetPeriod: '1_Guz', isSummer: false },
      { sourceLabel: '2023-2024 Bahar', targetPeriod: '1_Bahar', isSummer: false },
      { sourceLabel: '2023-2024 Yaz Okulu', targetPeriod: '1_Guz', isSummer: true },
    ],
  )
  assert.equal(plan.akademikNotlar['1_Guz'].length, 1)
  assert.equal(plan.akademikNotlar['1_Guz'][0].harf, 'BB')
  assert.equal(plan.akademikNotlar['1_Guz'][0].kaynakDonem, '2023-2024 Yaz Okulu')
  assert.equal(plan.akademikNotlar['1_Bahar'].length, 1)
  assert.equal(plan.donemOrtalamalari['1_Guz'], '2.50')
  assert.equal(plan.genelOrt, '3.45')
})

test('a re-import moves a summer course out of the old incorrect target period', () => {
  const plan = buildTranscriptImportPlan(parseTranscriptLines(lines), '1_Guz')
  const repaired = buildTranscriptImportPlan(
    parseTranscriptLines([
      '2023-2024 Güz Dönemi Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
      'HUK101 HUKUK BAŞLANGICI I Z Tr 3 0 3 5 FF 0 G',
      'DNO: 2,50 GNO: 2,50 TUK: 0 TAKTS: 30',
      '2023-2024 Bahar Dönemi Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
      'HUK102 TÜRK HUKUK TARİHİ Z Tr 3 0 3 5 BA 17.5 G',
      'DNO: 3.20 GNO: 3.35 TUK: 0 TAKTS: 60',
      '2023-2024 Yaz Okulu Dersin Statüsü Öğretim Dili AKTS Not Puan Açıklama',
      'HUK101 HUKUK BAŞLANGICI I Z Tr 3 0 3 5 BB 12 G',
      'DNO: 3.80 GNO: 3.45 TUK: 0 TAKTS: 64',
    ]),
    '1_Guz',
    {
      '1_Bahar': [
        {
          ad: 'HUKUK BAŞLANGICI I',
          kod: 'HUK101',
          kaynakDonem: '2023-2024 Yaz Okulu',
          vize: '',
          final: '',
          ort: '',
          harf: 'BB',
          ekler: [],
        },
      ],
    },
  )

  assert.equal(repaired.akademikNotlar['1_Bahar'].length, 1)
  assert.equal(repaired.akademikNotlar['1_Bahar'][0].kod, 'HUK102')
  assert.equal(repaired.akademikNotlar['1_Guz'][0].harf, 'BB')

  // A summer term without a corresponding earlier course must not be placed
  // under an arbitrary regular period.
  assert.deepEqual(plan.warnings, [
    '2023-2024 Yaz Okulu: 1 yaz okulu dersi önceki normal dönemlerde bulunamadı; yanlış döneme eklenmedi.',
  ])
  assert.equal(plan.akademikNotlar['1_Bahar'].length, 1)
  assert.deepEqual(
    plan.targets.map(({ sourceLabel, targetPeriod, isSummer }) => ({ sourceLabel, targetPeriod, isSummer })),
    [
      { sourceLabel: '2023-2024 Güz', targetPeriod: '1_Guz', isSummer: false },
      { sourceLabel: '2023-2024 Bahar', targetPeriod: '1_Bahar', isSummer: false },
    ],
  )
  assert.equal(plan.donemOrtalamalari['1_Bahar'], '3.20')
  assert.equal(plan.genelOrt, '3.45')
})

test('re-import preserves manual assessment details when the course title matches', () => {
  const plan = buildTranscriptImportPlan(
    parseTranscriptLines(lines),
    '1_Guz',
    {
      '1_Guz': [
        {
          ad: 'HUKUK BAŞLANGICI I',
          vize: '82',
          final: '91',
          ort: '88',
          harf: 'CC',
          ekler: [{ tip: 'Ödev', not: '100' }],
        },
      ],
    },
  )
  const course = plan.akademikNotlar['1_Guz'][0]
  assert.equal(course.harf, 'AA')
  assert.equal(course.kod, 'HUK101')
  assert.equal(course.vize, '82')
  assert.equal(course.final, '91')
  assert.equal(course.ort, '88')
  assert.deepEqual(course.ekler, [{ tip: 'Ödev', not: '100' }])
})

test('unrecognized text does not produce a writable import plan', () => {
  assert.deepEqual(parseTranscriptLines(['Taranmış belge', 'Dersler görsel olarak yer alıyor']), [])
})
