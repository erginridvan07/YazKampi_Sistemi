import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import {
  parseTranscriptLines,
  type ParsedTranscriptTerm,
} from '@/lib/transcriptHelpers'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 12

type PdfTextItem = {
  str: string
  transform: number[]
}

function toReadingLines(items: readonly unknown[]): string[] {
  const rows = new Map<number, Array<{ x: number; text: string }>>()

  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item) || !('transform' in item)) continue
    const textItem = item as PdfTextItem
    if (!textItem.str?.trim() || !Array.isArray(textItem.transform)) continue
    const y = Math.round((textItem.transform[5] || 0) * 2) / 2
    const row = rows.get(y) || []
    row.push({ x: textItem.transform[4] || 0, text: textItem.str })
    rows.set(y, row)
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
}

function validatePdf(file: File): void {
  const extensionOk = file.name.toLocaleLowerCase('tr-TR').endsWith('.pdf')
  const typeOk = !file.type || file.type === 'application/pdf'
  if (!extensionOk || !typeOk) throw new Error('Lütfen PDF biçiminde bir transkript seçin.')
  if (file.size === 0) throw new Error('Seçilen dosya boş.')
  if (file.size > MAX_PDF_BYTES) throw new Error('Transkript PDF dosyası en fazla 10 MB olabilir.')
}

/**
 * Read a text-based YÖK/e-Devlet transcript in the browser only. No PDF bytes
 * or identity data leave the device, and no raw document is retained.
 */
export async function parseTranscriptPdf(file: File): Promise<ParsedTranscriptTerm[]> {
  validatePdf(file)

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })

  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error('Transkript en fazla 12 sayfa olabilir.')
    }

    const lines: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      lines.push(...toReadingLines(content.items))
    }

    const terms = parseTranscriptLines(lines)
    if (terms.length === 0) {
      throw new Error(
        'Bu PDF’de okunabilir transkript tablosu bulunamadı. Taranmış/görüntü PDF yerine e-Devlet’ten indirilen metin tabanlı belgeyi kullanın.',
      )
    }
    return terms
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Transkript PDF okunamadı. Lütfen belgeyi tekrar indirin.', { cause: error })
  } finally {
    await loadingTask.destroy()
  }
}
