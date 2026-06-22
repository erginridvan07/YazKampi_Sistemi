import { Link } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Globe,
  Home,
  LogOut,
  Megaphone,
  Settings,
  UserCircle,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ProfileAvatar } from '@/components/shared/ProfileAvatar'
import { Button } from '@/components/ui/Button'
import { logout } from '@/services/auth.service'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { ADMIN_NAV, STUDENT_ATTENDANCE_NAV, STUDENT_NAV } from '@/config/navigation'
import { cn } from '@/lib/utils'

function profilePath(role?: string) {
  return role === 'admin' ? '/admin/profil' : '/ogrenci/profil'
}

const iconMap = {
  home: Home,
  users: Users,
  'check-circle': CheckCircle2,
  megaphone: Megaphone,
  'graduation-cap': GraduationCap,
  'bar-chart': BarChart3,
  settings: Settings,
  globe: Globe,
}

function useNavItems() {
  const profile = useAuthStore((state) => state.profile)
  if (!profile) return []

  if (profile.role === 'admin') {
    return ADMIN_NAV
  }

  if (profile.canManageAttendance) {
    return [...STUDENT_NAV.slice(0, 1), ...STUDENT_ATTENDANCE_NAV, ...STUDENT_NAV.slice(1)]
  }

  return STUDENT_NAV
}

export function AppHeader() {
  const profile = useAuthStore((state) => state.profile)

  const handleLogout = async () => {
    const confirmed = await askConfirm({
      title: 'Çıkış Yap',
      description: 'Oturumunuz kapatılacak. Devam etmek istiyor musunuz?',
      confirmLabel: 'Evet, Çıkış Yap',
      cancelLabel: 'Vazgeç',
      variant: 'primary',
    })
    if (!confirmed) return
    try {
      await logout()
      useAuthStore.getState().clear()
      useToastStore.getState().showToast('success', 'Çıkış yapıldı')
    } catch {
      useToastStore.getState().showToast('error', 'Çıkış sırasında hata oluştu')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-primary-700/20 bg-gradient-to-r from-primary-600 to-primary-800 text-white shadow-lg shadow-primary-900/10">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div>
          <p className="text-sm font-bold">Gaye Vakfı Portal</p>
          {profile ? (
            <p className="text-xs text-primary-100">
              {profile.adSoyad} · {profile.role === 'admin' ? 'Yönetici' : 'Öğrenci'}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Link
            to={profilePath(profile?.role)}
            className="rounded-xl p-1 text-white transition hover:bg-white/15"
            aria-label="Profil"
          >
            {profile ? (
              <ProfileAvatar
                name={profile.adSoyad}
                photoUrl={profile.photoUrl}
                size="header"
                className="rounded-xl ring-2 ring-white/20"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center">
                <UserCircle className="h-5 w-5" />
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-white hover:bg-white/15"
            aria-label="Çıkış yap"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

function NavLinkItem({
  path,
  label,
  icon,
}: {
  path: string
  label: string
  icon: keyof typeof iconMap
}) {
  const Icon = iconMap[icon]

  return (
    <NavLink
      to={path}
      end={path.endsWith('/admin') || path.endsWith('/ogrenci')}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition',
          isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  )
}

export function BottomNav() {
  const items = useNavItems()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {items.map((item) => (
          <NavLinkItem key={item.id} path={item.path} label={item.label} icon={item.icon} />
        ))}
      </div>
    </nav>
  )
}

export function SidebarNav() {
  const items = useNavItems()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
      <div className="sticky top-16 p-4">
        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Menü
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = iconMap[item.icon]
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path.endsWith('/admin') || item.path.endsWith('/ogrenci')}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-primary-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-primary-300',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <div className="mx-auto flex max-w-7xl">
        <SidebarNav />
        <main className="min-h-[calc(100dvh-4rem)] flex-1">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
