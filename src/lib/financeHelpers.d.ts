import type { FinanceAccount, FinanceCurrency, FinanceTransaction } from '@/types'

export interface FinanceWeekRange {
  start: string
  end: string
  label: string
}

export interface FinanceCurrencyTotals {
  TRY: number
  EUR: number
  USD: number
}

export interface FinanceAccountTotals {
  TRY: Record<FinanceAccount, number>
  EUR: Record<FinanceAccount, number>
  USD: Record<FinanceAccount, number>
}

export interface FinanceFundTotals {
  Genel: FinanceCurrencyTotals
  Zekât: FinanceCurrencyTotals
  Bağış: FinanceCurrencyTotals
}

export interface FinanceSummary {
  opening: FinanceCurrencyTotals
  income: FinanceCurrencyTotals
  expense: FinanceCurrencyTotals
  carryIn: FinanceCurrencyTotals
  closing: FinanceCurrencyTotals
  accountBalances: FinanceAccountTotals
  fundBalances: FinanceFundTotals
  periodTransactions: FinanceTransaction[]
}

export function parseMoneyToKurus(rawValue: string): number | null
export function formatMoney(kurus: number, currency?: FinanceCurrency): string
export function getFinanceWeekRange(reference?: Date): FinanceWeekRange
export function dayBefore(isoDate: string): string
export function isFinanceDateInRange(date: string, start: string, end: string): boolean
export function calculateFinanceSummary(
  transactions: FinanceTransaction[],
  start: string,
  end: string,
): FinanceSummary
export function financeDirectionLabel(direction: string): string
