import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { subscribeToAuthChanges } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { getDefaultRoute } from '@/config/navigation'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setProfile = useAuthStore((state) => state.setProfile)
  const setLoading = useAuthStore((state) => state.setLoading)
  const setInitialized = useAuthStore((state) => state.setInitialized)

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((_user, profile) => {
      setProfile(profile)
      setLoading(false)
      setInitialized(true)
    })

    return unsubscribe
  }, [setInitialized, setLoading, setProfile])

  return children
}

export function RootRedirect() {
  const profile = useAuthStore((state) => state.profile)

  if (!profile) {
    return <Navigate to="/" replace />
  }

  return (
    <Navigate
      to={getDefaultRoute(profile.role, profile.canManageAttendance)}
      replace
    />
  )
}
