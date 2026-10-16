const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

const CURRENCIES = ['TRY', 'EUR', 'USD']
const ACCOUNTS = ['nakit', 'banka']
const FUNDS = ['Genel', 'Zekât', 'Bağış']

function localISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed
}

function emptyCurrencyTotals() {
  return { TRY: 0, EUR: 0, USD: 0 }
}

function emptyAccountTotals() {
  return {
    TRY: { nakit: 0, banka: 0 },
    EUR: { nakit: 0, banka: 0 },
    USD: { nakit: 0, banka: 0 },
  }
}

function emptyFundTotals() {
  return {
    Genel: emptyCurrencyTotals(),
    Zekât: emptyCurrencyTotals(),
    Bağış: emptyCurrencyTotals(),
  }
}

/** Turkish-friendly currency input to integer kuruş. Returns null for an invalid amount. */
export function parseMoneyToKurus(rawValue) {
  if (typeof rawValue !== 'string') return null
  const value = rawValue.trim().replace(/[₺€\s]/g, '')
  if (!value || !/^\d[\d.,]*$/.test(value)) return null

  let integerPart = value
  let fractionalPart = ''

  if (value.includes(',')) {
    const parts = value.split(',')
    if (parts.length !== 2 || !parts[1] || parts[1].length > 2) return null
    integerPart = parts[0].replace(/\./g, '')
    fractionalPart = parts[1]
  } else if (value.includes('.')) {
    const parts = value.split('.')
    const last = parts.at(-1) || ''
    const groupedThousands = parts.length > 1 && parts.slice(1).every((part) => /^\d{3}$/.test(part))
    if (groupedThousands) {
      integerPart = parts.join('')
    } else if (parts.length === 2 && last.length <= 2) {
      integerPart = parts[0]
      fractionalPart = last
    } else {
      return null
    }
  }

  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(fractionalPart)) return null
  const whole = Number(integerPart)
  if (!Number.isSafeInteger(whole)) return null
  const cents = Number(fractionalPart.padEnd(2, '0') || '0')
  const result = whole * 100 + cents
  return Number.isSafeInteger(result) && result > 0 ? result : null
}

export function formatMoney(kurus, currency = 'TRY') {
  const amount = Number.isFinite(kurus) ? kurus / 100 : 0
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getFinanceWeekRange(reference = new Date()) {
  const anchor = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const daysSinceSaturday = (anchor.getDay() + 1) % 7
  const startDate = new Date(anchor)
  startDate.setDate(anchor.getDate() - daysSinceSaturday)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const start = localISO(startDate)
  const end = localISO(endDate)
  const startLabel = `${startDate.getDate()} ${MONTH_NAMES_TR[startDate.getMonth()]} ${startDate.getFullYear()}`
  const endLabel = `${endDate.getDate()} ${MONTH_NAMES_TR[endDate.getMonth()]} ${endDate.getFullYear()}`

  return { start, end, label: `${startLabel} – ${endLabel}` }
}

export function dayBefore(isoDate) {
  const parsed = parseISODate(isoDate)
  if (!parsed) return ''
  parsed.setDate(parsed.getDate() - 1)
  return localISO(parsed)
}

export function isFinanceDateInRange(date, start, end) {
  return typeof date === 'string' && date >= start && date <= end
}

/**
 * Calculates balances from the append-only financial ledger. Amounts always remain
 * separate per currency; no exchange-rate conversion is guessed.
 */
export function calculateFinanceSummary(transactions, start, end) {
  const opening = emptyCurrencyTotals()
  const income = emptyCurrencyTotals()
  const expense = emptyCurrencyTotals()
  const carryIn = emptyCurrencyTotals()
  const closing = emptyCurrencyTotals()
  const accountBalances = emptyAccountTotals()
  const fundBalances = emptyFundTotals()
  const periodTransactions = []

  for (const transaction of transactions || []) {
    if (!transaction || transaction.durum === 'iptal') continue
    if (!CURRENCIES.includes(transaction.paraBirimi) || !ACCOUNTS.includes(transaction.hesap)) continue
    if (!Number.isSafeInteger(transaction.tutarKurus) || transaction.tutarKurus <= 0) continue
    if (!parseISODate(transaction.tarih) || transaction.tarih > end) continue

    const currency = transaction.paraBirimi
    const isFundConversion = transaction.tur === 'fon_donusumu'

    if (isFundConversion) {
      if (!FUNDS.includes(transaction.fon) || !FUNDS.includes(transaction.hedefFon)) continue
      fundBalances[transaction.fon][currency] -= transaction.tutarKurus
      fundBalances[transaction.hedefFon][currency] += transaction.tutarKurus

      // Older conversions did not record a destination account. Treat those as
      // staying in the same place, so historical balances remain unchanged.
      const targetAccount = ACCOUNTS.includes(transaction.hedefHesap)
        ? transaction.hedefHesap
        : transaction.hesap
      accountBalances[currency][transaction.hesap] -= transaction.tutarKurus
      accountBalances[currency][targetAccount] += transaction.tutarKurus

      if (transaction.tarih >= start) periodTransactions.push(transaction)
      continue
    }

    const sign = transaction.tur === 'gider' ? -1 : 1
    const signedAmount = transaction.tutarKurus * sign

    closing[currency] += signedAmount
    accountBalances[currency][transaction.hesap] += signedAmount
    if (FUNDS.includes(transaction.fon)) fundBalances[transaction.fon][currency] += signedAmount

    if (transaction.tarih < start) {
      opening[currency] += signedAmount
      continue
    }

    periodTransactions.push(transaction)
    if (transaction.tur === 'gelir') income[currency] += transaction.tutarKurus
    if (transaction.tur === 'gider') expense[currency] += transaction.tutarKurus
    if (transaction.tur === 'devir') carryIn[currency] += transaction.tutarKurus
  }

  return {
    opening,
    income,
    expense,
    carryIn,
    closing,
    accountBalances,
    fundBalances,
    periodTransactions: periodTransactions.sort((left, right) => right.tarih.localeCompare(left.tarih)),
  }
}

export function financeDirectionLabel(direction) {
  return {
    gelir: 'Gelir',
    gider: 'Gider',
    devir: 'Devir',
    fon_donusumu: 'Fon Dönüşümü',
  }[direction] || 'İşlem'
}
