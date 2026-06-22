export const BOLUMLER = ['İlahiyat', 'Mühendislik', 'Hukuk'] as const
export type Bolum = (typeof BOLUMLER)[number]

export const SINIFLAR = [
  { value: '0', label: 'Hazırlık' },
  { value: '1', label: '1. Sınıf' },
  { value: '2', label: '2. Sınıf' },
  { value: '3', label: '3. Sınıf' },
  { value: '4', label: '4. Sınıf' },
] as const

export const DONEMLER = ['Güz', 'Bahar'] as const

export const VAKITLER = ['Sabah', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'] as const
export type Vakit = (typeof VAKITLER)[number]

export const ODALAR = Array.from({ length: 16 }, (_, i) => String(i + 1))

export const HARF_NOTLARI = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FD', 'FF'] as const

export const PERIOD_OPTIONS = [
  { value: 'Hazirlik_Guz', label: 'Hazırlık - Güz' },
  { value: 'Hazirlik_Bahar', label: 'Hazırlık - Bahar' },
  { value: '1_Guz', label: '1. Sınıf - Güz' },
  { value: '1_Bahar', label: '1. Sınıf - Bahar' },
  { value: '2_Guz', label: '2. Sınıf - Güz' },
  { value: '2_Bahar', label: '2. Sınıf - Bahar' },
  { value: '3_Guz', label: '3. Sınıf - Güz' },
  { value: '3_Bahar', label: '3. Sınıf - Bahar' },
  { value: '4_Guz', label: '4. Sınıf - Güz' },
  { value: '4_Bahar', label: '4. Sınıf - Bahar' },
] as const

export const DEVAMSIZLIK_RISK_ESIGI = 5

export const BOLUM_IKON: Record<string, { color: string; label: string }> = {
  İlahiyat: { color: '#4f46e5', label: 'İlahiyat' },
  Mühendislik: { color: '#f59e0b', label: 'Mühendislik' },
  Hukuk: { color: '#10b981', label: 'Hukuk' },
  Diğer: { color: '#64748b', label: 'Diğer' },
}
