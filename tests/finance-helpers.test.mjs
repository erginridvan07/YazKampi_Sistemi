import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateFinanceSummary,
  dayBefore,
  getFinanceWeekRange,
  parseMoneyToKurus,
} from '../src/lib/financeHelpers.js'

test('Turkish money input is stored exactly as integer kuruş', () => {
  assert.equal(parseMoneyToKurus('1.250,50'), 125050)
  assert.equal(parseMoneyToKurus('12.350'), 1235000)
  assert.equal(parseMoneyToKurus('374,23 ₺'), 37423)
  assert.equal(parseMoneyToKurus('100.5'), 10050)
  assert.equal(parseMoneyToKurus('0'), null)
  assert.equal(parseMoneyToKurus('12,345'), null)
})

test('finance week always starts Saturday and ends Friday', () => {
  const period = getFinanceWeekRange(new Date(2026, 8, 16))
  assert.deepEqual(period, {
    start: '2026-09-12',
    end: '2026-09-18',
    label: '12 Eylül 2026 – 18 Eylül 2026',
  })
  assert.equal(dayBefore(period.start), '2026-09-11')
})

test('summary keeps currencies and accounts separate and ignores canceled entries', () => {
  const transactions = [
    {
      id: 'opening', tur: 'devir', tarih: '2026-09-11', tutarKurus: 100000,
      paraBirimi: 'TRY', hesap: 'nakit', durum: 'aktif',
      fon: 'Genel',
    },
    {
      id: 'income', tur: 'gelir', tarih: '2026-09-12', tutarKurus: 50000,
      paraBirimi: 'TRY', hesap: 'banka', durum: 'aktif',
      fon: 'Bağış',
    },
    {
      id: 'zakat-income', tur: 'gelir', tarih: '2026-09-12', tutarKurus: 50000,
      paraBirimi: 'TRY', hesap: 'banka', durum: 'aktif',
      fon: 'Zekât',
    },
    {
      id: 'expense', tur: 'gider', tarih: '2026-09-13', tutarKurus: 20000,
      paraBirimi: 'TRY', hesap: 'nakit', durum: 'aktif',
      fon: 'Genel',
    },
    {
      id: 'euro', tur: 'devir', tarih: '2026-09-14', tutarKurus: 300000,
      paraBirimi: 'EUR', hesap: 'nakit', durum: 'aktif',
      fon: 'Zekât',
    },
    {
      id: 'dollar', tur: 'devir', tarih: '2026-09-14', tutarKurus: 10000,
      paraBirimi: 'USD', hesap: 'banka', durum: 'aktif',
      fon: 'Genel',
    },
    {
      id: 'conversion', tur: 'fon_donusumu', tarih: '2026-09-15', tutarKurus: 30000,
      paraBirimi: 'TRY', hesap: 'banka', durum: 'aktif',
      fon: 'Zekât', hedefFon: 'Bağış', hedefHesap: 'nakit', ogrenciId: 'student-1',
    },
    {
      id: 'donation-account-transfer', tur: 'fon_donusumu', tarih: '2026-09-15', tutarKurus: 10000,
      paraBirimi: 'TRY', hesap: 'banka', durum: 'aktif',
      fon: 'Bağış', hedefFon: 'Bağış', hedefHesap: 'nakit', ogrenciId: 'student-1',
    },
    {
      id: 'canceled', tur: 'gelir', tarih: '2026-09-15', tutarKurus: 99999,
      paraBirimi: 'TRY', hesap: 'nakit', durum: 'iptal',
      fon: 'Bağış',
    },
  ]

  const summary = calculateFinanceSummary(transactions, '2026-09-12', '2026-09-18')
  assert.equal(summary.opening.TRY, 100000)
  assert.equal(summary.income.TRY, 100000)
  assert.equal(summary.expense.TRY, 20000)
  assert.equal(summary.closing.TRY, 180000)
  assert.equal(summary.accountBalances.TRY.nakit, 120000)
  assert.equal(summary.accountBalances.TRY.banka, 60000)
  assert.equal(summary.opening.EUR, 0)
  assert.equal(summary.carryIn.EUR, 300000)
  assert.equal(summary.closing.EUR, 300000)
  assert.equal(summary.carryIn.USD, 10000)
  assert.equal(summary.closing.USD, 10000)
  assert.equal(summary.fundBalances.Genel.TRY, 80000)
  assert.equal(summary.fundBalances.Bağış.TRY, 80000)
  assert.equal(summary.fundBalances.Zekât.TRY, 20000)
  assert.equal(summary.fundBalances.Zekât.EUR, 300000)
  assert.equal(summary.fundBalances.Genel.USD, 10000)
  assert.equal(summary.periodTransactions.some((transaction) => transaction.id === 'conversion'), true)
  assert.equal(summary.periodTransactions.some((transaction) => transaction.id === 'canceled'), false)
})
