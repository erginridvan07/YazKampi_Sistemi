import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import {
  parseDutyScheduleRows,
  type ParsedDutySchedule,
  type RawDutyScheduleRow,
} from '@/lib/dutyScheduleHelpers'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 2

type PdfTextItem = {
  str: string
  transform: number[]
}

type PositionedText = {
  text: string
  x: number
}

function validatePdf(file: File): void {
  const extensionOk = file.name.toLocaleLowerCase('tr-TR').endsWith('.pdf')
  const typeOk = !file.type || file.type === 'application/pdf'
  if (!extensionOk || !typeOk) throw new Error('Lütfen PDF biçiminde bir görev çizelgesi seçin.')
  if (file.size === 0) throw new Error('Seçilen dosya boş.')
  if (file.size > MAX_PDF_BYTES) throw new Error('Görev çizelgesi PDF dosyası en fazla 10 MB olabilir.')
}

function groupRows(items: readonly unknown[]): PositionedText[][] {
  const rows = new Map<number, PositionedText[]>()

  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item) || !('transform' in item)) continue
    const textItem = item as PdfTextItem
    const text = textItem.str?.trim()
    if (!text || !Array.isArray(textItem.transform)) continue
    const y = Math.round((textItem.transform[5] || 0) * 2) / 2
    const row = rows.get(y) || []
    row.push({ text, x: textItem.transform[4] || 0 })
    rows.set(y, row)
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => row.sort((a, b) => a.x - b.x))
}

function joinColumn(items: PositionedText[], from: number, to: number): string {
  return items
    .filter((item) => item.x >= from && item.x < to)
    .map((item) => item.text)
    .join(' ')
    .trim()
}

/** The supplied Gaye template has fixed columns; thresholds leave room for fractional PDF glyph coordinates. */
function extractTableRows(items: readonly unknown[]): RawDutyScheduleRow[] {
  const rows: RawDutyScheduleRow[] = []

  for (const row of groupRows(items)) {
    const tarih = joinColumn(row, 0, 100)
    if (!/^\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+$/u.test(tarih)) continue

    rows.push({
      tarih,
      gun: joinColumn(row, 100, 140),
      imam: joinColumn(row, 140, 350),
      muezzin: joinColumn(row, 350, Number.POSITIVE_INFINITY),
    })
  }

  return rows
}

/**
 * Reads a text-based monthly imam/muezzin PDF in the browser only.
 * Raw PDF bytes and the task-list names are never uploaded or retained.
 */
export async function parseDutySchedulePdf(file: File): Promise<ParsedDutySchedule> {
  validatePdf(file)

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })

  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error('Görev çizelgesi en fazla 2 sayfa olabilir.')
    }

    const allText: string[] = []
    const rows: RawDutyScheduleRow[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      rows.push(...extractTableRows(content.items))
      for (const item of content.items) {
        if (item && typeof item === 'object' && 'str' in item) allText.push(String(item.str || ''))
      }
    }

    if (rows.length === 0) {
      throw new Error(
        'Bu PDF desteklenen tarih/gün/imam/müezzin tablo düzeninde değil. Metin içeren Gaye görev çizelgesini kullanın.',
      )
    }
    return parseDutyScheduleRows(allText.join(' '), rows)
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Görev çizelgesi PDF okunamadı.', { cause: error })
  } finally {
    await loadingTask.destroy()
  }
}
