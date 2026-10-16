const PERIOD_VALUES = [
  'Hazirlik_Guz',
  'Hazirlik_Bahar',
  '1_Guz',
  '1_Bahar',
  '2_Guz',
  '2_Bahar',
  '3_Guz',
  '3_Bahar',
  '4_Guz',
  '4_Bahar',
]

const LETTER_GRADES = new Set(['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FD', 'FF'])

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function decimal(value) {
  return clean(value).replace(',', '.')
}

function transcriptTermKind(value) {
  const normalized = value.toLocaleLowerCase('tr-TR')
  if (normalized.startsWith('yaz')) return 'summer'
  if (normalized.startsWith('bahar')) return 'spring'
  return 'fall'
}

function parseCourseLine(line) {
  const match = clean(line).match(
    /^([A-ZÇĞİÖŞÜ]{2,10}\s*-?\s*\d{2,4}[A-Z]?)\s+(.+?)\s+(?:Z|S|E)\s+(?:TR|EN|Tr|En|Türkçe|Türkce|English)\s+(.+)$/i,
  )
  if (!match) return null

  const [, rawCode, rawTitle, rawValues] = match
  const gradeMatch = rawValues.match(/\b(AA|BA|BB|CB|CC|DC|DD|FD|FF)\b/i)
  if (!gradeMatch) return null

  const grade = gradeMatch[1].toUpperCase()
  if (!LETTER_GRADES.has(grade)) return null

  const numbersBeforeGrade = rawValues
    .slice(0, gradeMatch.index)
    .match(/\d+(?:[.,]\d+)?/g) || []

  return {
    code: clean(rawCode).replace(/\s+/g, ''),
    title: clean(rawTitle),
    letterGrade: grade,
    // The last numeric value before the letter grade is AKTS in the supported
    // YÖK transcript layout. "Puan" is intentionally never imported.
    ects: numbersBeforeGrade.length >= 4 ? decimal(numbersBeforeGrade.at(-1)) : '',
  }
}

/**
 * Parse normalized PDF text rows from the supported YÖK/e-Devlet transcript
 * layout. This deliberately ignores identity data, barcode data, and score
 * columns that are not reliable exam averages.
 */
export function parseTranscriptLines(lines) {
  const terms = []
  let current = null

  for (const rawLine of lines) {
    const line = clean(rawLine)
    if (!line) continue

    const termMatch = line.match(/(\d{4}\s*-\s*\d{4})\s+(Güz|Guz|Bahar|Yaz(?:\s+Okulu)?)(?:\s+Dönemi)?/i)
    if (termMatch) {
      current = {
        sourceLabel: `${termMatch[1].replace(/\s/g, '')} ${clean(termMatch[2])}`,
        academicYear: termMatch[1].replace(/\s/g, ''),
        kind: transcriptTermKind(termMatch[2]),
        courses: [],
        termAverage: '',
        generalAverage: '',
      }
      terms.push(current)
      continue
    }

    if (!current) continue

    const dnoMatch = line.match(/DNO\s*:\s*(\d+(?:[.,]\d+)?)/i)
    const gnoMatch = line.match(/GNO\s*:\s*(\d+(?:[.,]\d+)?)/i)
    if (dnoMatch || gnoMatch) {
      if (dnoMatch) current.termAverage = decimal(dnoMatch[1])
      if (gnoMatch) current.generalAverage = decimal(gnoMatch[1])
      continue
    }

    const course = parseCourseLine(line)
    if (course) current.courses.push(course)
  }

  return terms.filter((term) => term.courses.length > 0)
}

function courseKeys(course) {
  const keys = []
  const code = clean(course.kod || course.code)
  if (code) keys.push(`code:${code.toLocaleUpperCase('tr-TR')}`)
  const name = clean(course.ad || course.title)
  if (name) keys.push(`name:${name.toLocaleLowerCase('tr-TR')}`)
  return keys
}

function mergeCourses(existing, imported) {
  const index = new Map()
  existing.forEach((course, courseIndex) => {
    courseKeys(course).forEach((key) => index.set(key, courseIndex))
  })
  const next = [...existing]

  for (const course of imported) {
    const keys = courseKeys(course)
    const matchIndex = keys.map((key) => index.get(key)).find((value) => value !== undefined)
    if (matchIndex === undefined) {
      keys.forEach((key) => index.set(key, next.length))
      next.push(course)
      continue
    }

    const previous = next[matchIndex]
    // Preserve manually-entered assessment details that a transcript cannot
    // reliably provide; transcript letter grade and metadata take precedence.
    next[matchIndex] = {
      ...previous,
      ...course,
      vize: previous.vize ?? '',
      final: previous.final ?? '',
      ort: previous.ort ?? '',
      ekler: previous.ekler ?? [],
    }
    keys.forEach((key) => index.set(key, matchIndex))
  }

  return next
}

function findPreviousRegularPeriod(course, regularCoursePeriods) {
  return courseKeys(course)
    .map((key) => regularCoursePeriods.get(key))
    .find(Boolean) || ''
}

function removePreviouslyMisplacedSummerCourse(notes, course, targetPeriod, sourceLabel) {
  for (const [period, courses] of Object.entries(notes)) {
    if (period === targetPeriod) continue

    const next = courses.filter(
      (existing) =>
        !(
          existing.kaynakDonem === sourceLabel &&
          courseKeys(existing).some((key) => courseKeys(course).includes(key))
        ),
    )
    if (next.length !== courses.length) notes[period] = next
  }
}

/**
 * Map transcript terms into the portal's fixed period vocabulary. The caller
 * chooses the first portal period once; subsequent regular terms advance in
 * order. Each summer-school course is returned to the latest preceding normal
 * term where the same course code (or, as a fallback, title) occurs. This
 * keeps repeat courses in their real academic period while retaining the
 * summer-school source label on the course itself.
 */
export function buildTranscriptImportPlan(parsedTerms, firstPeriod, existingNotes = {}, existingAverages = {}, existingGeneralAverage = '') {
  const firstIndex = PERIOD_VALUES.indexOf(firstPeriod)
  if (firstIndex < 0) throw new Error('Başlangıç dönemi geçersiz.')

  const akademikNotlar = { ...existingNotes }
  const donemOrtalamalari = { ...existingAverages }
  const targets = []
  const warnings = []
  let cursor = firstIndex
  let genelOrt = existingGeneralAverage
  const regularCoursePeriods = new Map()

  for (const term of parsedTerms) {
    if (term.kind === 'summer') {
      const coursesByPeriod = new Map()
      const unmatchedCourses = []

      for (const course of term.courses) {
        const targetPeriod = findPreviousRegularPeriod(course, regularCoursePeriods)
        if (!targetPeriod) {
          unmatchedCourses.push(course)
          continue
        }
        const courses = coursesByPeriod.get(targetPeriod) || []
        courses.push(course)
        coursesByPeriod.set(targetPeriod, courses)
      }

      for (const [targetPeriod, courses] of coursesByPeriod) {
        const importedCourses = courses.map((course) => ({
          ad: course.title,
          kod: course.code,
          ...(course.ects ? { akts: course.ects } : {}),
          kaynakDonem: term.sourceLabel,
          vize: '',
          final: '',
          ort: '',
          harf: course.letterGrade,
          ekler: [],
        }))

        courses.forEach((course) =>
          removePreviouslyMisplacedSummerCourse(akademikNotlar, course, targetPeriod, term.sourceLabel),
        )
        akademikNotlar[targetPeriod] = mergeCourses(akademikNotlar[targetPeriod] || [], importedCourses)
        targets.push({
          sourceLabel: term.sourceLabel,
          targetPeriod,
          courseCount: importedCourses.length,
          isSummer: true,
        })
      }

      if (unmatchedCourses.length) {
        warnings.push(
          `${term.sourceLabel}: ${unmatchedCourses.length} yaz okulu dersi önceki normal dönemlerde bulunamadı; yanlış döneme eklenmedi.`,
        )
      }
      if (term.generalAverage) genelOrt = term.generalAverage
      continue
    }

    const targetPeriod = PERIOD_VALUES[cursor] || ''
    cursor += 1
    if (!targetPeriod) {
      warnings.push(`${term.sourceLabel}: Portalda karşılık gelen dönem bulunmadığı için aktarılmadı.`)
      continue
    }

    const importedCourses = term.courses.map((course) => ({
      ad: course.title,
      kod: course.code,
      ...(course.ects ? { akts: course.ects } : {}),
      kaynakDonem: term.sourceLabel,
      vize: '',
      final: '',
      ort: '',
      harf: course.letterGrade,
      ekler: [],
    }))

    akademikNotlar[targetPeriod] = mergeCourses(akademikNotlar[targetPeriod] || [], importedCourses)
    term.courses.forEach((course) =>
      courseKeys(course).forEach((key) => regularCoursePeriods.set(key, targetPeriod)),
    )
    if (term.termAverage) donemOrtalamalari[targetPeriod] = term.termAverage
    if (term.generalAverage) genelOrt = term.generalAverage

    targets.push({
      sourceLabel: term.sourceLabel,
      targetPeriod,
      courseCount: importedCourses.length,
      isSummer: term.kind === 'summer',
    })
  }

  if (targets.length === 0) throw new Error('Aktarılabilecek ders veya dönem bulunamadı.')

  return {
    akademikNotlar,
    donemOrtalamalari,
    genelOrt,
    targets,
    warnings,
  }
}
