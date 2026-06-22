import { PERIOD_OPTIONS } from '@/config/constants'
import { getSinifLabel } from '@/services/students.service'
import type { DersNotu, Student } from '@/types'

function periodLabel(period: string): string {
  return PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period.replace('_', ' - ')
}

function dersBlock(ders: DersNotu) {
  const notlar: string[] = []
  if (ders.vize) notlar.push(`Vize: ${ders.vize}`)
  if (ders.final) notlar.push(`Final: ${ders.final}`)
  ders.ekler?.forEach((ek) => notlar.push(`${ek.tip}: ${ek.not}`))

  return {
    stack: [
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: (ders.ad || 'Ders').toUpperCase(), style: 'dersTitle', border: [false, false, false, false] },
              { text: `Harf: ${ders.harf || '-'}`, style: 'dersMeta', alignment: 'right', border: [false, false, false, false] },
            ],
          ],
        },
        layout: 'noBorders',
        fillColor: '#f8fafc',
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: notlar.join('  |  ') || '—', style: 'dersDetail', width: '*' },
          { text: `Ortalama: ${ders.ort || '-'}`, style: 'dersOrt', width: 'auto', alignment: 'right' },
        ],
        margin: [8, 0, 8, 8],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 12] },
    ],
  }
}

export type GradesPdfScope = 'current' | 'all'

function buildDocDefinition(student: Student, scope: GradesPdfScope, currentPeriod: string) {
  const today = new Date().toLocaleDateString('tr-TR')
  const content: object[] = []

  if (scope === 'current') {
    content.push({ text: `Dönem: ${periodLabel(currentPeriod)}`, style: 'sectionTitle', margin: [0, 0, 0, 8] })
    const dersler = student.akademikNotlar?.[currentPeriod] || []
    if (dersler.length === 0) {
      content.push({ text: 'Bu dönem için kayıtlı ders bulunmuyor.', style: 'muted' })
    } else {
      dersler.forEach((d) => content.push(dersBlock(d)))
    }
  } else {
    const periods = Object.keys(student.akademikNotlar || {}).sort().reverse()
    if (periods.length === 0) {
      content.push({ text: 'Kayıtlı dönem bulunmuyor.', style: 'muted' })
    }
    for (const period of periods) {
      content.push({ text: periodLabel(period), style: 'sectionTitle', margin: [0, 8, 0, 6] })
      student.akademikNotlar![period].forEach((d) => content.push(dersBlock(d)))
    }
  }

  const donemOrt =
    scope === 'current'
      ? student.donemOrtalamalari?.[currentPeriod] || '0.00'
      : student.genelOrt || '0.00'

  content.push({
    table: {
      widths: ['*', '*'],
      body: [
        [
          { text: `Dönem Ortalaması: ${donemOrt}`, style: 'footerText', fillColor: '#4f46e5', color: '#ffffff', border: [false, false, false, false] },
          { text: `Genel GPA: ${student.genelOrt || '0.00'}`, style: 'footerText', fillColor: '#4f46e5', color: '#ffffff', alignment: 'right', border: [false, false, false, false] },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 16, 0, 0],
  })

  return {
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#334155' },
    styles: {
      headerTitle: { fontSize: 20, bold: true, color: '#ffffff', alignment: 'center' },
      info: { fontSize: 11, color: '#334155' },
      sectionTitle: { fontSize: 12, bold: true, color: '#4f46e5' },
      dersTitle: { fontSize: 11, bold: true, color: '#4f46e5', margin: [8, 6, 8, 0] },
      dersMeta: { fontSize: 10, color: '#1e293b', margin: [8, 6, 8, 0] },
      dersDetail: { fontSize: 9, color: '#64748b' },
      dersOrt: { fontSize: 10, bold: true, color: '#0f172a' },
      muted: { fontSize: 10, color: '#94a3b8', italics: true },
      footerText: { fontSize: 11, bold: true, margin: [10, 12, 10, 12] },
    },
    content: [
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'AKADEMİK NOT RAPORU', style: 'headerTitle', fillColor: '#4f46e5', border: [false, false, false, false] }]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20],
      },
      {
        columns: [
          {
            stack: [
              { text: `Öğrenci: ${student.adSoyad}`, style: 'info' },
              { text: `Bölüm: ${student.bolum}`, style: 'info', margin: [0, 4, 0, 0] },
              { text: `Sınıf: ${getSinifLabel(student.sinif)}`, style: 'info', margin: [0, 4, 0, 0] },
            ],
            width: '*',
          },
          { text: `Tarih: ${today}`, style: 'info', alignment: 'right', width: 'auto' },
        ],
        margin: [0, 0, 0, 16],
      },
      ...content,
    ],
  }
}

export async function downloadGradesPdf(
  student: Student,
  scope: GradesPdfScope,
  currentPeriod: string,
): Promise<void> {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])

  pdfMake.addVirtualFileSystem(pdfFonts)

  const safeName = student.adSoyad.replace(/\s+/g, '_')
  pdfMake.createPdf(buildDocDefinition(student, scope, currentPeriod)).download(`${safeName}_Not_Raporu.pdf`)
}
