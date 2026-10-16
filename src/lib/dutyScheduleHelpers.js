const MONTH_INDEX = {
  oca: 0,
  ocak: 0,
  şub: 1,
  şubat: 1,
  mar: 2,
  mart: 2,
  nis: 3,
  nisan: 3,
  may: 4,
  mayıs: 4,
  haz: 5,
  haziran: 5,
  tem: 6,
  temmuz: 6,
  ağu: 7,
  ağustos: 7,
  eyl: 8,
  eylül: 8,
  eki: 9,
  ekim: 9,
  kas: 10,
  kasım: 10,
  ara: 11,
  aralık: 11,
}

const WEEKDAY_INDEX = {
  pzt: 1,
  pazartesi: 1,
  sal: 2,
  salı: 2,
  çar: 3,
  çarşamba: 3,
  per: 4,
  perşembe: 4,
  cum: 5,
  cuma: 5,
  cmt: 6,
  cumartesi: 6,
  paz: 0,
  pazar: 0,
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeToken(value) {
  return normalizeText(value).replace(/\.$/, '').toLocaleLowerCase('tr-TR')
}

function getMonthIndex(value) {
  const month = MONTH_INDEX[normalizeToken(value)]
  if (month === undefined) throw new Error(`Tanımlanamayan ay: ${normalizeText(value)}`)
  return month
}

function createDate(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day)
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    throw new Error('Geçersiz tarih bulundu.')
  }
  return date
}

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLongDates(value) {
  const text = normalizeText(value)
  const matches = [...text.matchAll(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/g)]
  if (matches.length < 2) {
    throw new Error('PDF başlığında yıl bilgisi içeren tarih aralığı bulunamadı.')
  }

  const rangeMatches = matches.slice(0, 2)
  return {
    dates: rangeMatches.map((match) => createDate(
      Number(match[3]),
      getMonthIndex(match[2]),
      Number(match[1]),
    )),
    label: text.slice(
      rangeMatches[0].index,
      (rangeMatches[1].index || 0) + rangeMatches[1][0].length,
    ),
  }
}

function parseShortDate(value, startDate, endDate) {
  const match = normalizeText(value).match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)$/)
  if (!match) throw new Error(`Tarih okunamadı: ${normalizeText(value) || 'boş değer'}`)

  const day = Number(match[1])
  const monthIndex = getMonthIndex(match[2])
  const candidates = []
  for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
    const candidate = createDate(year, monthIndex, day)
    if (candidate >= startDate && candidate <= endDate) candidates.push(candidate)
  }

  if (candidates.length !== 1) {
    throw new Error(`Tarih PDF başlığındaki aralıkla eşleşmiyor: ${normalizeText(value)}`)
  }
  return candidates[0]
}

function weekdayFromLabel(value) {
  const weekday = WEEKDAY_INDEX[normalizeToken(value)]
  if (weekday === undefined) throw new Error(`Tanımlanamayan gün: ${normalizeText(value)}`)
  return weekday
}

/** İsim eşleştirmesinde büyük/küçük harf ve boşluk farklarını yok eder. */
export function normalizeDutyName(value) {
  return normalizeText(value).toLocaleLowerCase('tr-TR')
}

function comparableName(value) {
  return normalizeDutyName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '')
}

function comparableTokens(value) {
  return normalizeDutyName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    for (let index = 0; index < previous.length; index += 1) previous[index] = current[index]
  }
  return previous[right.length]
}

function similarity(left, right) {
  const longest = Math.max(left.length, right.length)
  return longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest
}

/**
 * Resolves common spacing, Turkish-character and abbreviated-name differences.
 * A fuzzy result is returned only when exactly one roster candidate is safe.
 */
export function resolveDutyRosterName(sourceName, rosterNames) {
  const source = normalizeDutyName(sourceName)
  if (!source || !Array.isArray(rosterNames)) return null

  const candidates = rosterNames
    .map((name) => ({ name: normalizeText(name), normalized: normalizeDutyName(name) }))
    .filter((candidate) => candidate.name)
  const unique = (matches, match) => matches.length === 1 ? { name: matches[0].name, match } : null

  const exact = unique(candidates.filter((candidate) => candidate.normalized === source), 'exact')
  if (exact) return exact

  const sourceComparable = comparableName(source)
  const normalized = unique(
    candidates.filter((candidate) => comparableName(candidate.name) === sourceComparable),
    'normalized',
  )
  if (normalized) return normalized

  const sourceTokens = comparableTokens(source)
  if (sourceTokens.length < 2) return null
  const contained = unique(
    candidates.filter((candidate) => {
      const candidateTokens = comparableTokens(candidate.name)
      return sourceTokens.every((token) => candidateTokens.includes(token))
    }),
    'expanded',
  )
  if (contained) return contained

  const fuzzy = unique(
    candidates.filter((candidate) => {
      const candidateTokens = comparableTokens(candidate.name)
      if (candidateTokens.length < 2) return false
      const firstSimilarity = similarity(sourceTokens[0], candidateTokens[0])
      const lastSimilarity = similarity(sourceTokens.at(-1), candidateTokens.at(-1))
      return firstSimilarity >= 0.65 && lastSimilarity >= 0.8
    }),
    'similar',
  )
  return fuzzy
}

/**
 * Converts the supported four-column monthly duty template to dated task rows.
 * Dates are validated against the explicit year-bearing range in the PDF title.
 */
export function parseDutyScheduleRows(rangeText, rows) {
  const parsedRange = parseLongDates(rangeText)
  const [startDate, endDate] = parsedRange.dates
  const seenDates = new Set()
  const entries = []

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('PDF’de görev satırı bulunamadı.')
  }
  if (rows.length > 31) {
    throw new Error('Bir PDF içe aktarması en fazla 31 günlük görev içerebilir.')
  }

  for (const row of rows) {
    const tarihText = normalizeText(row?.tarih)
    const gunLabel = normalizeText(row?.gun)
    const imam = normalizeText(row?.imam)
    const muezzin = normalizeText(row?.muezzin)

    if (!tarihText || !gunLabel || !imam || !muezzin) {
      throw new Error(`Eksik görev satırı bulundu: ${tarihText || 'tarih yok'}`)
    }

    const date = parseShortDate(tarihText, startDate, endDate)
    if (date.getDay() !== weekdayFromLabel(gunLabel)) {
      throw new Error(`${tarihText} için gün bilgisi takvimle uyuşmuyor.`)
    }

    const tarih = toISO(date)
    if (seenDates.has(tarih)) throw new Error(`${tarih} tarihi PDF’de birden fazla kez bulunuyor.`)
    seenDates.add(tarih)
    entries.push({ tarih, gunLabel, imam, muezzin })
  }

  return { rangeLabel: parsedRange.label, entries }
}
