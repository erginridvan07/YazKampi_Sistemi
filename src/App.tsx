import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RootRedirect } from '@/components/layout/AuthProvider'
import { NotificationProvider } from '@/components/layout/NotificationProvider'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { ToastContainer } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmProvider'
import { Spinner } from '@/components/ui/Spinner'
import { LandingPage } from '@/pages/LandingPage'
import { useAuthStore } from '@/stores/auth.store'

const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/DashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminStudentsPage = lazy(() =>
  import('@/pages/admin/StudentsPage').then((m) => ({ default: m.AdminStudentsPage })),
)
const AdminAttendancePage = lazy(() =>
  import('@/pages/shared/AttendancePage').then((m) => ({ default: m.AttendancePage })),
)
const AdminAnnouncementsPage = lazy(() =>
  import('@/pages/shared/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })),
)
const AdminGradesPage = lazy(() =>
  import('@/pages/admin/GradesPage').then((m) => ({ default: m.AdminGradesPage })),
)
const AdminReportsPage = lazy(() =>
  import('@/pages/admin/ReportsPage').then((m) => ({ default: m.AdminReportsPage })),
)
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/SettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
)
const AdminSitePage = lazy(() =>
  import('@/pages/admin/SitePage').then((m) => ({ default: m.AdminSitePage })),
)
const GraduateHomePage = lazy(() =>
  import('@/pages/graduate/HomePage').then((m) => ({ default: m.GraduateHomePage })),
)
const StudentHomePage = lazy(() =>
  import('@/pages/student/HomePage').then((m) => ({ default: m.StudentHomePage })),
)
const StudentGradesPage = lazy(() =>
  import('@/pages/student/GradesPage').then((m) => ({ default: m.StudentGradesPage })),
)
const StudentReportsPage = lazy(() =>
  import('@/pages/student/ReportsPage').then((m) => ({ default: m.StudentReportsPage })),
)
const StudentAttendancePage = lazy(() =>
  import('@/pages/shared/AttendancePage').then((m) => ({ default: m.AttendancePage })),
)
const StudentAnnouncementsPage = lazy(() =>
  import('@/pages/shared/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/shared/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)

function PageLoader() {
  return <Spinner label="Sayfa yükleniyor..." />
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((state) => state.profile)
  const isInitialized = useAuthStore((state) => state.isInitialized)

  if (!isInitialized) {
    return children
  }

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
        <Suspense fallback={<PageLoader />}>
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

            <Route element={<ProtectedRoute allowedRoles={['graduate']} />}>
              <Route path="/mezun" element={<GraduateHomePage />} />
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
        </Suspense>
        <ToastContainer />
        <ConfirmProvider />
        <NotificationProvider />
      </AuthProvider>
    </BrowserRouter>
  )
}
