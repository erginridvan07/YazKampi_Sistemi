import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RootRedirect } from '@/components/layout/AuthProvider'
import { NotificationProvider } from '@/components/layout/NotificationProvider'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { ToastContainer } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmProvider'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import {
  AdminAnnouncementsPage,
  AdminAttendancePage,
  AdminDashboardPage,
  AdminGradesPage,
  AdminReportsPage,
  AdminSettingsPage,
  AdminSitePage,
  AdminStudentsPage,
} from '@/pages/admin'
import {
  StudentAnnouncementsPage,
  StudentAttendancePage,
  StudentGradesPage,
  StudentHomePage,
  StudentReportsPage,
} from '@/pages/student'
import { ProfilePage } from '@/pages/shared/ProfilePage'
import { useAuthStore } from '@/stores/auth.store'

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile)

  // Yönetici ana sayfayı önizleyebilsin
  if (profile && profile.role !== 'admin') {
    return <RootRedirect />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <PublicOnlyRoute>
                <LandingPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/giris"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          <Route path="/yonlendir" element={<RootRedirect />} />

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/ogrenciler" element={<AdminStudentsPage />} />
            <Route path="/admin/yoklama" element={<AdminAttendancePage />} />
            <Route path="/admin/duyuru" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/notlar" element={<AdminGradesPage />} />
            <Route path="/admin/raporlar" element={<AdminReportsPage />} />
            <Route path="/admin/ayarlar" element={<AdminSettingsPage />} />
            <Route path="/admin/site" element={<AdminSitePage />} />
            <Route path="/admin/profil" element={<ProfilePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/ogrenci" element={<StudentHomePage />} />
            <Route path="/ogrenci/notlar" element={<StudentGradesPage />} />
            <Route path="/ogrenci/raporlar" element={<StudentReportsPage />} />
            <Route path="/ogrenci/profil" element={<ProfilePage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={['student']}
                requireAttendancePermission
              />
            }
          >
            <Route path="/ogrenci/yoklama" element={<StudentAttendancePage />} />
            <Route path="/ogrenci/duyuru" element={<StudentAnnouncementsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
        <ConfirmProvider />
        <NotificationProvider />
      </AuthProvider>
    </BrowserRouter>
  )
}
