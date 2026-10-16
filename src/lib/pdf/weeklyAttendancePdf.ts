import type { VakitAttendanceCounts, WeeklyAttendanceReport } from '@/types'

type AttendanceCountKey = 'geldi' | 'gelmedi' | 'izinli'

const REPORT_COLORS = {
  navy: '#0f172a',
  navySoft: '#16213a',
  border: '#334155',
  muted: '#94a3b8',
  white: '#f8fafc',
  success: '#34d399',
  danger: '#fb7185',
  warning: '#fbbf24',
} as const

function countCell(counts: VakitAttendanceCounts, key: AttendanceCountKey, color: string) {
  return {
    text: counts.kayitYok ? '—' : String(counts[key]),
    color: counts.kayitYok ? REPORT_COLORS.muted : color,
    bold: !counts.kayitYok,
    alignment: 'center',
    margin: [5, 9, 5, 9],
  }
}

/** Renk anlamları ekrandaki haftalık tabloyla aynıdır: yeşil geldi, kırmızı gelmedi, sarı izinli. */
export function buildWeeklyAttendancePdfDefinition(data: WeeklyAttendanceReport) {
  const header = [
    { text: 'GÜN', color: REPORT_COLORS.muted, bold: true, fontSize: 8, margin: [5, 7, 5, 7] },
    { text: 'TARİH', color: REPORT_COLORS.muted, bold: true, fontSize: 8, margin: [5, 7, 5, 7] },
    { text: 'SABAH\nGELDİ', color: REPORT_COLORS.success, bold: true, fontSize: 8, alignment: 'center', margin: [5, 6, 5, 6] },
    { text: 'SABAH\nGELMEDİ', color: REPORT_COLORS.danger, bold: true, fontSize: 8, alignment: 'center', margin: [5, 6, 5, 6] },
    { text: 'SABAH\nİZİNLİ', color: REPORT_COLORS.warning, bold: true, fontSize: 8, alignment: 'center', margin: [5, 6, 5, 6] },
    { text: 'YATSI\nGELDİ', color: REPORT_COLORS.success, bold: true, fontSize: 8, alignment: 'center', margin: [5, 6, 5, 6] },
    { text: 'YATSI\nGELMEDİ', color: REPORT_COLORS.danger, bold: true, fontSize: 8, alignment: 'center', margin: [5, 6, 5, 6] },
    { text: 'YATSI\nİZİNLİ', color: REPORT_COLORS.warning, bold: true, fontSize: 8, alignment: 'center', margin: [5, 6, 5, 6] },
  ]

  const rows = data.gunler.map((gun) => [
    { text: gun.gunLabel, color: REPORT_COLORS.white, bold: true, margin: [5, 9, 5, 9] },
    { text: gun.tarihLabel, color: REPORT_COLORS.muted, margin: [5, 9, 5, 9] },
    countCell(gun.sabah, 'geldi', REPORT_COLORS.success),
    countCell(gun.sabah, 'gelmedi', REPORT_COLORS.danger),
    countCell(gun.sabah, 'izinli', REPORT_COLORS.warning),
    countCell(gun.yatsi, 'geldi', REPORT_COLORS.success),
    countCell(gun.yatsi, 'gelmedi', REPORT_COLORS.danger),
    countCell(gun.yatsi, 'izinli', REPORT_COLORS.warning),
  ])

  const generatedAt = new Date().toLocaleString('tr-TR')

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 34],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: REPORT_COLORS.white },
    content: [
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'HAFTALIK NAMAZ YOKLAMA RAPORU', fontSize: 18, bold: true, color: REPORT_COLORS.white },
              { text: data.haftaLabel, fontSize: 10, color: '#bfdbfe', margin: [0, 5, 0, 0] },
            ],
            fillColor: REPORT_COLORS.navySoft,
            margin: [16, 14, 16, 14],
            border: [false, false, false, false],
          }]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: [42, 50, '*', '*', '*', '*', '*', '*'],
          body: [header, ...rows],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? REPORT_COLORS.navySoft : REPORT_COLORS.navy,
          hLineColor: () => REPORT_COLORS.border,
          vLineColor: () => REPORT_COLORS.border,
          hLineWidth: () => 0.7,
          vLineWidth: () => 0.7,
        },
      },
      {
        columns: [
          { text: '● Geldi', color: REPORT_COLORS.success, fontSize: 9 },
          { text: '● Gelmedi', color: REPORT_COLORS.danger, fontSize: 9 },
          { text: '● İzinli', color: REPORT_COLORS.warning, fontSize: 9 },
          { text: '— Kayıt yok', color: REPORT_COLORS.muted, fontSize: 9, alignment: 'right' },
        ],
        margin: [0, 16, 0, 0],
      },
    ],
    footer: {
      text: `Gaye Vakfı Portal · Oluşturulma: ${generatedAt}`,
      color: '#64748b',
      fontSize: 8,
      alignment: 'center',
      margin: [0, 0, 0, 12],
    },
  }
}

export async function downloadWeeklyAttendancePdf(data: WeeklyAttendanceReport): Promise<void> {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])

  pdfMake.addVirtualFileSystem(pdfFonts)
  const startDate = data.gunler[0]?.tarih || new Date().toISOString().slice(0, 10)
  const endDate = data.gunler.at(-1)?.tarih || startDate
  pdfMake
    .createPdf(buildWeeklyAttendancePdfDefinition(data))
    .download(`Haftalik_Namaz_Yoklama_${startDate}_${endDate}.pdf`)
}
