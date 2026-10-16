export type UserRole = 'admin' | 'student' | 'graduate'
export type EvlilikDurumu = 'Bekar' | 'Evli' | 'Belirtilmemiş'
export type LeaveStatus = 'Beklemede' | 'Onaylandı' | 'Reddedildi'
export type AttendanceStatus = 'Geldi' | 'Gelmedi' | 'İzinli'

export interface UserProfile {
  uid: string
  username: string
  adSoyad: string
  role: UserRole
  bolum?: string
  sinif?: string | number
  odaNo?: string | number
  donem?: string
  canManageAttendance?: boolean
  photoUrl?: string
  legacyCollection?: 'ogrenciler' | 'yoneticiler' | 'mezunlar'
  legacyDocId?: string
  createdAt?: string
  updatedAt?: string
}

export interface Student {
  id: string
  adSoyad: string
  username: string
  password?: string
  bolum: string
  sinif: string | number
  odaNo: string | number
  donem: string
  role?: string
  photoUrl?: string
  canManageAttendance?: boolean
  /** Firebase Auth uid binding — set by local provisioning; not editable in UI. */
  ownerUid?: string
  akademikNotlar?: Record<string, DersNotu[]>
  donemOrtalamalari?: Record<string, string>
  genelOrt?: string
  lastUpdate?: string
}

export interface StudentFormData {
  adSoyad: string
  username: string
  /** Deprecated for Auth-only login; ignored on create/update writes. */
  password?: string
  bolum: string
  sinif: string
  odaNo: string
  donem: string
  canManageAttendance: boolean
}

export interface EkNot {
  tip: string
  not: string | number
}

export interface DersNotu {
  ad: string
  /** Optional transcript metadata; manual grade entries remain fully supported. */
  kod?: string
  akts?: string | number
  /** Original transcript term, useful when a summer course is attached to Bahar. */
  kaynakDonem?: string
  vize?: string | number
  final?: string | number
  ort?: string | number
  harf?: string
  ekler?: EkNot[]
}

export interface AttendanceRecord {
  id: string
  vakit: string
  tarih: string
  timestamp?: { seconds: number } | Date | string
  gelenOgrenciler: string[]
  gelmeyenOgrenciler: string[]
  izinliOgrenciler: string[]
  kaydeden?: string
  sonDuzenleyen?: string
}

/** Minimal yoklama listesi — hassas öğrenci alanları yok. */
export interface AttendanceRosterEntry {
  studentId: string
  adSoyad: string
  odaNo: string | number
}

export interface Announcement {
  id: string
  baslik: string
  icerik: string
  etkinlikTarihi?: string | null
  hatirlatmaGun?: number
  tarih?: { seconds: number } | Date | string
}

export interface LeaveRequest {
  id: string
  ownerUid: string
  ogrenciAd: string
  gidisTarihi: string
  donusTarihi: string
  sebep: string
  durum: LeaveStatus
  tarih?: string
  onaylayanAdmin?: string
  islemTarihi?: string
}

export interface DailyDuty {
  id: string
  imam: string
  muezzin: string
}

export type FinanceTransactionType = 'gelir' | 'gider' | 'devir' | 'fon_donusumu'
export type FinanceCurrency = 'TRY' | 'EUR' | 'USD'
export type FinanceAccount = 'nakit' | 'banka'
export type FinanceFund = 'Genel' | 'Zekât' | 'Bağış'
export type FinanceTransactionStatus = 'aktif' | 'iptal'

/** Admin-only cash ledger entry. Monetary values are stored as integer kuruş. */
export interface FinanceTransaction {
  id: string
  tur: FinanceTransactionType
  tarih: string
  tutarKurus: number
  paraBirimi: FinanceCurrency
  hesap: FinanceAccount
  fon: FinanceFund
    /** Only used by a fund conversion. */
  hedefFon?: FinanceFund
  /** Where the money is moved to during a fund conversion. Omitted means it stayed put. */
  hedefHesap?: FinanceAccount
  /** Linked student document ID for a fund conversion. */
  ogrenciId?: string
  kategori: string
  taraf: string
  aciklama: string
  durum: FinanceTransactionStatus
  iptalNotu: string
  createdByUid: string
  createdByName: string
  createdAt?: string | Date | { seconds: number; nanoseconds?: number; toDate?: () => Date }
  updatedAt?: string | Date | { seconds: number; nanoseconds?: number; toDate?: () => Date }
}

export interface FinanceTransactionInput {
  tur: FinanceTransactionType
  tarih: string
  tutarKurus: number
  paraBirimi: FinanceCurrency
  hesap: FinanceAccount
  fon: FinanceFund
  hedefFon?: FinanceFund
  hedefHesap?: FinanceAccount
  ogrenciId?: string
  kategori: string
  taraf: string
  aciklama: string
}

export interface DashboardStats {
  toplamOgrenci: number
  yetkiliOgrenci: number
  bekleyenIzin: number
  riskliDevamsizlik: number
}

export interface DevamsizlikOzet {
  adSoyad: string
  odaNo: string | number
  devamsizlik: number
}

export interface MonthlyAbsenceTrend {
  label: string
  month: number
  year: number
  toplamDevamsizlik: number
}

export interface VakitAttendanceCounts {
  geldi: number
  gelmedi: number
  izinli: number
  kayitYok: boolean
}

export interface WeeklyAttendanceDay {
  tarih: string
  gunLabel: string
  tarihLabel: string
  sabah: VakitAttendanceCounts
  yatsi: VakitAttendanceCounts
}

export interface WeeklyAttendanceReport {
  haftaLabel: string
  gunler: WeeklyAttendanceDay[]
}

export interface AuditLog {
  id: string
  islem: string
  detay?: string
  actorUid?: string
  yapan: string
  rol: UserRole
  timestamp: string | Date | { seconds: number; nanoseconds?: number; toDate?: () => Date }
}

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
}

export type LoginType = 'ogrenciler' | 'yoneticiler' | 'mezunlar'

/** Safe mezun_giris leftover fields. Client no longer reads/writes welcome here. */
export interface GraduateLoginSettings {
  enabled?: boolean
  welcomeTitle?: string
  welcomeMessage?: string
  updatedAt?: string
}

/** mezun_ayarlar/karsilama — public-to-graduates copy only. No auth fields. */
export interface GraduateWelcomeSettings {
  welcomeTitle: string
  welcomeMessage: string
  updatedAt?: string
}

export interface Graduate {
  id: string
  adSoyad: string
  girisYili: number
  bolum?: string
  mezuniyetYili?: number
  evlilikDurumu?: EvlilikDurumu
  cocukSayisi?: number
  gorev?: string
  calistigiYer?: string
  sehir?: string
  iletisim?: string
  photoUrl?: string
  notlar?: string
  sosyalMedya?: string
  siraNo?: number
  createdAt?: string
  updatedAt?: string
}

export interface GraduateFormData {
  adSoyad: string
  girisYili: string
  bolum: string
  mezuniyetYili: string
  evlilikDurumu: EvlilikDurumu
  cocukSayisi: string
  gorev: string
  calistigiYer: string
  sehir: string
  iletisim: string
  photoUrl: string
  notlar: string
  sosyalMedya: string
}

export interface LegacyUserRecord {
  username?: string
  password?: string
  adSoyad?: string
  role?: string
  bolum?: string
  sinif?: string | number
  odaNo?: string | number
  donem?: string
  canManageAttendance?: boolean
}
