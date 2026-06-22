import { Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  allowedRoles: UserRole[]
  requireAttendancePermission?: boolean
}

export function ProtectedRoute({
  allowedRoles,
  requireAttendancePermission = false,
}: ProtectedRouteProps) {
  const profile = useAuthStore((state) => state.profile)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isInitialized = useAuthStore((state) => state.isInitialized)

  if (!isInitialized || isLoading) {
    return <Spinner label="Oturum kontrol ediliyor..." />
  }

  if (!profile) {
    return <Navigate to="/giris" replace />
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/ogrenci'} replace />
  }

  if (requireAttendancePermission && !profile.canManageAttendance && profile.role !== 'admin') {
    return <Navigate to="/ogrenci" replace />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
