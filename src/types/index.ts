export type UserRole = 'admin' | 'student'
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
  legacyCollection?: 'ogrenciler' | 'yoneticiler'
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
  akademikNotlar?: Record<string, DersNotu[]>
  donemOrtalamalari?: Record<string, string>
  genelOrt?: string
}

export interface StudentFormData {
  adSoyad: string
  username: string
  password: string
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
  yapan: string
  rol: UserRole
  timestamp: string
}

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
}

export type LoginType = 'ogrenciler' | 'yoneticiler'

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
