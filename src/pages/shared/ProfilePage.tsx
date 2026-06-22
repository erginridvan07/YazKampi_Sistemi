import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Bell, BellOff, Camera, Moon, Sun, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { ProfileAvatar } from '@/components/shared/ProfileAvatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { compressImageToDataUrl } from '@/lib/avatar'
import { changePassword } from '@/services/auth.service'
import { removeProfilePhoto, updateProfilePhoto } from '@/services/profile.service'
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermission,
  getNotificationPreference,
  isNotificationSupported,
} from '@/services/notifications.service'
import { getSinifLabel } from '@/services/students.service'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'
import { useToastStore } from '@/stores/toast.store'

export function ProfilePage() {
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const showToast = useToastStore((s) => s.showToast)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [notificationsOn, setNotificationsOn] = useState(getNotificationPreference())
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    void getNotificationPermission().then(setNotifPermission)
  }, [])

  const handlePasswordChange = async () => {
    if (!newPassword || !currentPassword) {
      showToast('error', 'Tüm şifre alanlarını doldurun')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Yeni şifreler eşleşmiyor')
      return
    }

    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('success', 'Şifreniz güncellendi')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast('error', 'Şifre güncellenemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const toggleNotifications = async () => {
    if (!profile) return
    setNotifLoading(true)
    try {
      if (notificationsOn) {
        await disablePushNotifications(profile.uid)
        setNotificationsOn(false)
        showToast('info', 'Bildirimler kapatıldı')
      } else {
        const enabled = await enablePushNotifications(profile.uid)
        setNotificationsOn(enabled)
        setNotifPermission(await getNotificationPermission())
        showToast(
          enabled ? 'success' : 'warning',
          enabled ? 'Bildirimler açıldı' : 'Bildirim izni verilmedi',
          enabled
            ? 'İzin sonuçları ve yeni talepler anlık bildirilecek.'
            : 'Tarayıcı ayarlarından bildirim iznini açabilirsiniz.',
        )
      }
    } catch (err) {
      showToast('error', 'Bildirim ayarı değiştirilemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setNotifLoading(false)
    }
  }

  const handlePhotoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !profile) return

    setPhotoLoading(true)
    try {
      const photoUrl = await compressImageToDataUrl(file)
      const updated = await updateProfilePhoto(profile.uid, photoUrl)
      setProfile(updated)
      showToast('success', 'Profil fotoğrafı güncellendi')
    } catch (err) {
      showToast('error', 'Fotoğraf yüklenemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setPhotoLoading(false)
    }
  }

  const handlePhotoRemove = async () => {
    if (!profile?.photoUrl) return

    setPhotoLoading(true)
    try {
      const updated = await removeProfilePhoto(profile.uid)
      setProfile(updated)
      showToast('success', 'Profil fotoğrafı kaldırıldı')
    } catch (err) {
      showToast('error', 'Fotoğraf kaldırılamadı', err instanceof Error ? err.message : undefined)
    } finally {
      setPhotoLoading(false)
    }
  }

  if (!profile) return null

  return (
    <div className="page-container">
      <PageHeader
        title="Profilim"
        description="Hesap bilgileriniz ve uygulama tercihleri"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <ProfileAvatar name={profile.adSoyad} photoUrl={profile.photoUrl} size="lg" />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={photoLoading}
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {photoLoading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
                </Button>
                {profile.photoUrl ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={photoLoading}
                    onClick={handlePhotoRemove}
                  >
                    <Trash2 className="h-4 w-4" /> Kaldır
                  </Button>
                ) : null}
              </div>
              <p className="max-w-xs text-center text-xs text-slate-500 dark:text-slate-400 sm:text-left">
                JPG, PNG veya WebP · En fazla 8 MB · Firebase Storage gerekmez
              </p>
            </div>
            <div className="flex-1">
              <CardTitle>{profile.adSoyad}</CardTitle>
              <CardDescription>@{profile.username}</CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={profile.role === 'admin' ? 'primary' : 'success'}>
                  {profile.role === 'admin' ? 'Yönetici' : 'Öğrenci'}
                </Badge>
                {profile.canManageAttendance ? (
                  <Badge tone="warning">Yoklama Yetkilisi</Badge>
                ) : null}
              </div>
            </div>
          </div>

          {profile.role === 'student' ? (
            <dl className="mt-6 space-y-3 text-sm">
              {profile.bolum ? (
                <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                  <dt className="text-slate-500 dark:text-slate-400">Bölüm</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">{profile.bolum}</dd>
                </div>
              ) : null}
              {profile.sinif !== undefined ? (
                <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                  <dt className="text-slate-500 dark:text-slate-400">Sınıf</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {getSinifLabel(profile.sinif)}
                  </dd>
                </div>
              ) : null}
              {profile.odaNo !== undefined ? (
                <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                  <dt className="text-slate-500 dark:text-slate-400">Oda</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">{profile.odaNo}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </Card>

        <Card accent="primary">
          <CardTitle>Görünüm</CardTitle>
          <CardDescription>Açık veya koyu tema seçin</CardDescription>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              ) : (
                <Sun className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {theme === 'dark' ? 'Koyu Tema' : 'Açık Tema'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tercihiniz cihazınızda saklanır</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? 'Açık Mod' : 'Koyu Mod'}
            </Button>
          </div>
        </Card>

        <Card accent="success">
          <CardTitle>Bildirimler</CardTitle>
          <CardDescription>
            İzin sonuçları ve yeni talepler hakkında anlık uyarı alın
          </CardDescription>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              {notificationsOn ? (
                <Bell className="h-5 w-5 text-emerald-600" />
              ) : (
                <BellOff className="h-5 w-5 text-slate-400" />
              )}
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {notificationsOn ? 'Bildirimler açık' : 'Bildirimler kapalı'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {!isNotificationSupported()
                    ? 'Tarayıcı desteklemiyor'
                    : notifPermission === 'denied'
                      ? 'İzin reddedildi — tarayıcı ayarlarından açın'
                      : 'Portal açıkken anlık bildirim'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleNotifications}
              disabled={notifLoading || !isNotificationSupported()}
            >
              {notifLoading ? '...' : notificationsOn ? 'Kapat' : 'Aç'}
            </Button>
          </div>
        </Card>

        <Card accent="warning" className="lg:col-span-2">
          <CardTitle>Şifre Değiştir</CardTitle>
          <CardDescription>Güvenliğiniz için mevcut şifrenizi doğrulamanız gerekir</CardDescription>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Input
              id="currentPassword"
              label="Mevcut şifre"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              id="newPassword"
              label="Yeni şifre"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              id="confirmPassword"
              label="Yeni şifre (tekrar)"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button className="mt-4" onClick={handlePasswordChange} disabled={saving}>
            {saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
