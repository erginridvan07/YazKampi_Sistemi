import type { Student, StudentFormData } from '@/types'

export const STUDENT_EXCEL_HEADERS = [
  'Ad Soyad',
  'Kullanıcı Adı',
  'Şifre',
  'Bölüm',
  'Sınıf',
  'Oda',
  'Dönem',
  'Yoklama Yetkisi',
] as const

export interface ParsedStudentRow {
  rowNumber: number
  data: StudentFormData
  error?: string
}

export interface ImportPreview {
  valid: ParsedStudentRow[]
  invalid: ParsedStudentRow[]
}

function parseSinif(value: unknown): string {
  const raw = String(value ?? '1').trim().toLowerCase()
  if (raw === 'hazırlık' || raw === 'hazirlik' || raw === '0') return '0'
  const num = raw.replace(/[^\d]/g, '')
  return num || '1'
}

function parseBool(value: unknown): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return ['evet', 'true', '1', 'yes', 'var'].includes(raw)
}

function rowToStudent(row: Record<string, unknown>, rowNumber: number): ParsedStudentRow {
  const data: StudentFormData = {
    adSoyad: String(row['Ad Soyad'] ?? '').trim(),
    username: String(row['Kullanıcı Adı'] ?? '').trim(),
    password: String(row['Şifre'] ?? '').trim(),
    bolum: String(row['Bölüm'] ?? 'İlahiyat').trim(),
    sinif: parseSinif(row['Sınıf']),
    odaNo: String(row['Oda'] ?? '1').trim(),
    donem: String(row['Dönem'] ?? 'Güz').trim(),
    canManageAttendance: parseBool(row['Yoklama Yetkisi']),
  }

  if (!data.adSoyad) return { rowNumber, data, error: 'Ad Soyad boş' }
  if (!data.username) return { rowNumber, data, error: 'Kullanıcı adı boş' }
  if (!data.password || data.password.length < 6) {
    return { rowNumber, data, error: 'Şifre en az 6 karakter olmalı' }
  }

  return { rowNumber, data }
}

export async function exportStudentsExcel(students: Student[]): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = students.map((s) => ({
    'Ad Soyad': s.adSoyad,
    'Kullanıcı Adı': s.username,
    'Şifre': s.password || '',
    'Bölüm': s.bolum,
    'Sınıf': s.sinif === '0' || s.sinif === 0 ? 'Hazırlık' : s.sinif,
    'Oda': s.odaNo,
    'Dönem': s.donem || 'Güz',
    'Yoklama Yetkisi': s.canManageAttendance ? 'Evet' : 'Hayır',
  }))

  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...STUDENT_EXCEL_HEADERS] })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Öğrenciler')
  XLSX.writeFile(book, `GayeVakfi_Ogrenciler_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function exportStudentsTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const example = [
    {
      'Ad Soyad': 'Ahmet Yılmaz',
      'Kullanıcı Adı': 'ahmetyilmaz',
      'Şifre': '123456',
      'Bölüm': 'İlahiyat',
      'Sınıf': '1',
      'Oda': '3',
      'Dönem': 'Güz',
      'Yoklama Yetkisi': 'Hayır',
    },
  ]
  const sheet = XLSX.utils.json_to_sheet(example, { header: [...STUDENT_EXCEL_HEADERS] })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Şablon')
  XLSX.writeFile(book, 'GayeVakfi_Ogrenci_Sablonu.xlsx')
}

export async function parseStudentsExcel(file: File): Promise<ImportPreview> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const valid: ParsedStudentRow[] = []
  const invalid: ParsedStudentRow[] = []

  rows.forEach((row, index) => {
    const parsed = rowToStudent(row, index + 2)
    if (parsed.error) invalid.push(parsed)
    else valid.push(parsed)
  })

  return { valid, invalid }
}

export async function exportDevamsizlikExcel(
  list: { adSoyad: string; odaNo: string | number; devamsizlik: number }[],
): Promise<void> {
  const XLSX = await import('xlsx')
  const month = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const rows = list.map((item, index) => ({
    Sıra: index + 1,
    'Ad Soyad': item.adSoyad,
    Oda: item.odaNo,
    'Aylık Devamsızlık': item.devamsizlik,
    Durum: item.devamsizlik >= 5 ? 'Riskli' : 'Normal',
  }))

  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Devamsızlık')
  XLSX.writeFile(book, `Devamsizlik_${month.replace(/\s/g, '_')}.xlsx`)
}
