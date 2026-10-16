import { formatDateTR } from '@/lib/dates'
import { formatMoney, type FinanceSummary, type FinanceWeekRange } from '@/lib/financeHelpers'
import type { FinanceTransaction } from '@/types'

const COLORS = {
  navy: '#0f172a',
  navySoft: '#172554',
  border: '#334155',
  muted: '#94a3b8',
  white: '#f8fafc',
  income: '#34d399',
  expense: '#fb7185',
  carry: '#a78bfa',
  warning: '#fbbf24',
} as const

const CURRENCIES = ['TRY', 'EUR', 'USD'] as const
const FUNDS = ['Genel', 'Zekât', 'Bağış'] as const

export const FINANCE_REPORT_SECTIONS = [
  'summary',
  'funds',
  'carries',
  'conversions',
  'income',
  'expense',
  'accounts',
] as const

export type FinanceReportSection = typeof FINANCE_REPORT_SECTIONS[number]

type FinanceReportData = {
  period: FinanceWeekRange
  summary: FinanceSummary
  generatedBy: string
  visibleSections?: FinanceReportSection[]
}

function accountLabel(transaction: FinanceTransaction): string {
  const source = transaction.hesap === 'nakit' ? 'Nakit' : 'Banka'
  const target = transaction.hedefHesap === 'nakit' ? 'Nakit' : transaction.hedefHesap === 'banka' ? 'Banka' : source
  const movement = transaction.tur === 'fon_donusumu' && target !== source ? `${source} → ${target}` : source
  return `${movement} · ${transaction.paraBirimi}`
}

function currencyLabel(currency: typeof CURRENCIES[number]) {
  return currency === 'TRY' ? 'Türk Lirası' : currency === 'EUR' ? 'Euro' : 'ABD Doları'
}

function transactionRows(transactions: FinanceTransaction[], type: FinanceTransaction['tur']) {
  const rows = transactions.filter((transaction) => transaction.tur === type)
  if (rows.length === 0) {
    return [[{ text: 'Bu hafta kayıt bulunmuyor.', colSpan: 5, color: COLORS.muted, italics: true }, {}, {}, {}, {}]]
  }

  return rows.map((transaction) => [
    { text: formatDateTR(transaction.tarih), color: COLORS.white },
    { text: transaction.taraf, color: COLORS.white, bold: true },
    { text: `${transaction.kategori}\n${transaction.fon}`, color: COLORS.muted, fontSize: 8 },
    { text: accountLabel(transaction), color: COLORS.muted, fontSize: 8 },
    {
      text: formatMoney(transaction.tutarKurus, transaction.paraBirimi),
      color: type === 'gelir' ? COLORS.income : type === 'gider' ? COLORS.expense : COLORS.carry,
      alignment: 'right',
      bold: true,
    },
  ])
}

function summaryRows(summary: FinanceSummary) {
  return CURRENCIES.map((currency) => [
    { text: currencyLabel(currency), color: COLORS.white, bold: true },
    { text: formatMoney(summary.opening[currency], currency), color: COLORS.white, alignment: 'right' },
    { text: formatMoney(summary.income[currency], currency), color: COLORS.income, alignment: 'right', bold: true },
    { text: formatMoney(summary.expense[currency], currency), color: COLORS.expense, alignment: 'right', bold: true },
    { text: formatMoney(summary.closing[currency], currency), color: COLORS.warning, alignment: 'right', bold: true },
  ])
}

function fundTransferRows(transactions: FinanceTransaction[]) {
  const rows = transactions.filter((transaction) => transaction.tur === 'fon_donusumu')
  if (rows.length === 0) {
    return [[{ text: 'Bu hafta fon veya konum dönüşümü bulunmuyor.', colSpan: 5, color: COLORS.muted, italics: true }, {}, {}, {}, {}]]
  }

  return rows.map((transaction) => [
    { text: formatDateTR(transaction.tarih), color: COLORS.white },
    { text: transaction.taraf, color: COLORS.white, bold: true },
    {
      text: transaction.fon === 'Bağış' && transaction.hedefFon === 'Bağış'
        ? 'Bağış · Konum değişimi'
        : `${transaction.fon} → ${transaction.hedefFon}`,
      color: COLORS.carry,
      bold: true,
    },
    { text: accountLabel(transaction), color: COLORS.muted, fontSize: 8 },
    { text: formatMoney(transaction.tutarKurus, transaction.paraBirimi), color: COLORS.carry, alignment: 'right', bold: true },
  ])
}

function balanceRows(summary: FinanceSummary) {
  return CURRENCIES.map((currency) => [
    { text: currency, color: COLORS.white, bold: true },
    { text: formatMoney(summary.accountBalances[currency].nakit, currency), color: COLORS.white, alignment: 'right' },
    { text: formatMoney(summary.accountBalances[currency].banka, currency), color: COLORS.white, alignment: 'right' },
    { text: formatMoney(summary.closing[currency], currency), color: COLORS.warning, alignment: 'right', bold: true },
  ])
}

function fundRows(summary: FinanceSummary) {
  return FUNDS.map((fund) => [
    { text: fund, color: COLORS.white, bold: true },
    { text: formatMoney(summary.fundBalances[fund].TRY, 'TRY'), color: COLORS.white, alignment: 'right' },
    { text: formatMoney(summary.fundBalances[fund].EUR, 'EUR'), color: COLORS.white, alignment: 'right' },
    { text: formatMoney(summary.fundBalances[fund].USD, 'USD'), color: COLORS.white, alignment: 'right' },
  ])
}

function sectionTitle(text: string, color: string) {
  return { text, color, fontSize: 12, bold: true, margin: [0, 18, 0, 7] }
}

function tableLayout(padding = 6) {
  return {
    fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.navySoft : COLORS.navy,
    hLineColor: () => COLORS.border,
    vLineColor: () => COLORS.border,
    hLineWidth: () => 0.6,
    vLineWidth: () => 0.6,
    paddingLeft: () => padding,
    paddingRight: () => padding,
    paddingTop: () => padding,
    paddingBottom: () => padding,
  }
}

export function buildWeeklyFinancePdfDefinition(data: FinanceReportData) {
  const generatedAt = new Date().toLocaleString('tr-TR')
  const active = data.summary.periodTransactions.filter((transaction) => transaction.durum === 'aktif')
  const carries = active.filter((transaction) => transaction.tur === 'devir')
  const visibleSections = new Set(data.visibleSections ?? FINANCE_REPORT_SECTIONS)
  const isVisible = (section: FinanceReportSection) => visibleSections.has(section)
  const content: Array<Record<string, unknown>> = [{
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'HAFTALIK MALİ RAPOR', fontSize: 18, bold: true, color: COLORS.white },
          { text: data.period.label, fontSize: 10, color: '#bfdbfe', margin: [0, 5, 0, 0] },
          { text: `Hazırlayan: ${data.generatedBy}`, fontSize: 8, color: COLORS.muted, margin: [0, 7, 0, 0] },
        ],
        fillColor: COLORS.navySoft,
        margin: [15, 14, 15, 14],
        border: [false, false, false, false],
      }]],
    },
    layout: 'noBorders',
  }]

  if (isVisible('summary')) {
    content.push(sectionTitle('Haftalık Özet', COLORS.white))
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*', '*'],
        body: [[
          { text: 'PARA BİRİMİ', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'DEVREDEN', color: COLORS.muted, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'GELİR', color: COLORS.income, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'GİDER', color: COLORS.expense, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'KALAN', color: COLORS.warning, bold: true, fontSize: 8, alignment: 'right' },
        ], ...summaryRows(data.summary)],
      },
      layout: tableLayout(7),
    })
  }

  if (isVisible('funds')) {
    content.push(sectionTitle('Fon Bakiyeleri', COLORS.carry))
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*'],
        body: [[
          { text: 'FON', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'TÜRK LİRASI', color: COLORS.muted, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'EURO', color: COLORS.muted, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'ABD DOLARI', color: COLORS.muted, bold: true, fontSize: 8, alignment: 'right' },
        ], ...fundRows(data.summary)],
      },
      layout: tableLayout(7),
    })
  }

  if (isVisible('carries') && carries.length > 0) {
    content.push(sectionTitle('Dönem İçi Devir Girişleri', COLORS.carry))
    content.push({
      ul: carries.map((transaction) => (
        `${formatDateTR(transaction.tarih)} · ${accountLabel(transaction)} · ${formatMoney(transaction.tutarKurus, transaction.paraBirimi)} · ${transaction.aciklama || transaction.taraf}`
      )),
      color: COLORS.muted,
      margin: [8, 0, 0, 0],
    })
  }

  if (isVisible('conversions')) {
    content.push(sectionTitle('Fon ve Konum Dönüşümleri', COLORS.carry))
    content.push({
      table: {
        headerRows: 1,
        widths: [48, '*', 98, 72, 74],
        body: [[
          { text: 'TARİH', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'ÖĞRENCİ / KAYNAK', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'DÖNÜŞÜM', color: COLORS.carry, bold: true, fontSize: 8 },
          { text: 'YER', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'TUTAR', color: COLORS.carry, bold: true, fontSize: 8, alignment: 'right' },
        ], ...fundTransferRows(active)],
      },
      layout: tableLayout(),
    })
  }

  if (isVisible('income')) {
    content.push(sectionTitle('Gelirler', COLORS.income))
    content.push({
      table: {
        headerRows: 1,
        widths: [48, '*', 86, 64, 74],
        body: [[
          { text: 'TARİH', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'KİMDEN', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'TÜR / FON', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'HESAP', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'TUTAR', color: COLORS.income, bold: true, fontSize: 8, alignment: 'right' },
        ], ...transactionRows(active, 'gelir')],
      },
      layout: tableLayout(),
    })
  }

  if (isVisible('expense')) {
    content.push(sectionTitle('Giderler', COLORS.expense))
    content.push({
      table: {
        headerRows: 1,
        widths: [48, '*', 86, 64, 74],
        body: [[
          { text: 'TARİH', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'KİME / NEREYE', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'KATEGORİ / FON', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'HESAP', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'TUTAR', color: COLORS.expense, bold: true, fontSize: 8, alignment: 'right' },
        ], ...transactionRows(active, 'gider')],
      },
      layout: tableLayout(),
    })
  }

  if (isVisible('accounts')) {
    content.push(sectionTitle('Kasa ve Banka Bakiyesi', COLORS.warning))
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*', '*'],
        body: [[
          { text: 'PARA BİRİMİ', color: COLORS.muted, bold: true, fontSize: 8 },
          { text: 'NAKİT', color: COLORS.muted, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'BANKA', color: COLORS.muted, bold: true, fontSize: 8, alignment: 'right' },
          { text: 'TOPLAM', color: COLORS.warning, bold: true, fontSize: 8, alignment: 'right' },
        ], ...balanceRows(data.summary)],
      },
      layout: tableLayout(7),
    })
  }

  return {
    pageSize: 'A4',
    pageMargins: [30, 28, 30, 34],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: COLORS.white },
    content,
    footer: {
      text: `Gaye Vakfı Portal · Oluşturulma: ${generatedAt} · Bu rapor mevcut aktif kayıtlarla hazırlanmıştır.`,
      color: '#64748b',
      fontSize: 8,
      alignment: 'center',
      margin: [0, 0, 0, 12],
    },
  }
}

export async function downloadWeeklyFinancePdf(data: FinanceReportData): Promise<void> {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])

  pdfMake.addVirtualFileSystem(pdfFonts)
  pdfMake
    .createPdf(buildWeeklyFinancePdfDefinition(data))
    .download(`Haftalik_Mali_Rapor_${data.period.start}_${data.period.end}.pdf`)
}
