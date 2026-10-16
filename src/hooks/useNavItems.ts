import { useMemo } from 'react'
import { ADMIN_NAV, STUDENT_ATTENDANCE_NAV, STUDENT_NAV } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth.store'

export type NavIconKey =
  | 'home'
  | 'users'
  | 'check-circle'
  | 'megaphone'
  | 'graduation-cap'
  | 'bar-chart'
  | 'wallet-cards'
  | 'settings'
  | 'globe'

export interface AppNavItem {
  id: string
  label: string
  path: string
  icon: NavIconKey
}

const EMPTY_NAV: AppNavItem[] = []

export function useNavItems(): AppNavItem[] {
  const profile = useAuthStore((state) => state.profile)

  return useMemo(() => {
    if (!profile) return EMPTY_NAV

    if (profile.role === 'admin') {
      return ADMIN_NAV.map((item) => ({ ...item }))
    }

    if (profile.role === 'graduate') {
      return [{ id: 'mezun', label: 'Mezun Ağı', path: '/mezun', icon: 'graduation-cap' }]
    }

    if (profile.canManageAttendance) {
      return [
        ...STUDENT_NAV.slice(0, 1).map((item) => ({ ...item })),
        ...STUDENT_ATTENDANCE_NAV.map((item) => ({ ...item })),
        ...STUDENT_NAV.slice(1).map((item) => ({ ...item })),
      ]
    }

    return STUDENT_NAV.map((item) => ({ ...item }))
  }, [profile])
}

export function isNavPathActive(itemPath: string, pathname: string) {
  const end =
    itemPath.endsWith('/admin') || itemPath.endsWith('/ogrenci') || itemPath.endsWith('/mezun')
  if (end) {
    return pathname === itemPath || pathname === `${itemPath}/`
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}
