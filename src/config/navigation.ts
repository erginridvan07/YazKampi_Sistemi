import type { UserRole } from '@/types'

export const ADMIN_NAV = [
  { id: 'dashboard', label: 'Ana Sayfa', path: '/admin', icon: 'home' },
  { id: 'students', label: 'Öğrenciler', path: '/admin/ogrenciler', icon: 'users' },
  { id: 'attendance', label: 'Yoklama', path: '/admin/yoklama', icon: 'check-circle' },
  { id: 'announcements', label: 'Duyuru', path: '/admin/duyuru', icon: 'megaphone' },
  { id: 'grades', label: 'Notlar', path: '/admin/notlar', icon: 'graduation-cap' },
  { id: 'reports', label: 'Raporlar', path: '/admin/raporlar', icon: 'bar-chart' },
  { id: 'settings', label: 'Ayarlar', path: '/admin/ayarlar', icon: 'settings' },
  { id: 'site', label: 'Site', path: '/admin/site', icon: 'globe' },
] as const

export const STUDENT_NAV = [
  { id: 'home', label: 'Ana Sayfa', path: '/ogrenci', icon: 'home' },
  { id: 'grades', label: 'Notlar', path: '/ogrenci/notlar', icon: 'graduation-cap' },
  { id: 'reports', label: 'Raporlar', path: '/ogrenci/raporlar', icon: 'bar-chart' },
] as const

export const STUDENT_ATTENDANCE_NAV = [
  { id: 'attendance', label: 'Yoklama', path: '/ogrenci/yoklama', icon: 'check-circle' },
  { id: 'announcements', label: 'Duyuru', path: '/ogrenci/duyuru', icon: 'megaphone' },
] as const

export function getDefaultRoute(role: UserRole, canManageAttendance?: boolean): string {
  if (role === 'admin') return '/admin'
  if (role === 'graduate') return '/mezun'
  if (canManageAttendance) return '/ogrenci'
  return '/ogrenci'
}
