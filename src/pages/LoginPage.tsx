import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { login } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { getDefaultRoute } from '@/config/navigation'
import type { LoginType } from '@/types'

export function LoginPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const showToast = useToastStore((state) => state.showToast)

  const [loginType, setLoginType] = useState<LoginType>('ogrenciler')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (profile) {
    return <Navigate to={getDefaultRoute(profile.role, profile.canManageAttendance)} replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Lütfen tüm alanları doldurun.')
      return
    }

    setIsSubmitting(true)

    try {
      const userProfile = await login(loginType, username, password)
      setProfile(userProfile)
      showToast('success', 'Giriş başarılı', `Hoş geldin, ${userProfile.adSoyad}`)
      navigate(getDefaultRoute(userProfile.role, userProfile.canManageAttendance), {
        replace: true,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Giriş sırasında beklenmeyen bir hata oluştu.'
      setError(message)
      showToast('error', 'Giriş başarısız', message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-primary-50 to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30">
            <LogIn className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">Gaye Vakfı Portal</h1>
          <p className="mt-2 text-sm text-slate-500">
            Öğrenci ve yönetici girişini güvenli şekilde yapın.
          </p>
        </div>

        <Card className="shadow-xl shadow-slate-200/70">
          <CardTitle>Giriş Yap</CardTitle>
          <CardDescription className="mt-1">
            Mevcut kullanıcı adı ve şifrenizle giriş yapabilirsiniz. İlk girişte hesabınız
            otomatik olarak güvenli sisteme taşınır.
          </CardDescription>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Select
              id="loginType"
              label="Giriş Tipi"
              value={loginType}
              onChange={(event) => setLoginType(event.target.value as LoginType)}
            >
              <option value="ogrenciler">Öğrenci Girişi</option>
              <option value="yoneticiler">Yönetici Girişi</option>
            </Select>

            <Input
              id="username"
              label="Kullanıcı Adı"
              placeholder="Kullanıcı adınız"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />

            <Input
              id="password"
              label="Şifre"
              type="password"
              placeholder="Şifreniz"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />

            {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

            <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>

          {isSubmitting ? <Spinner className="py-4" label="Hesap doğrulanıyor..." /> : null}
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="font-semibold text-primary-700 hover:underline">
            Ana sayfaya dön
          </Link>
        </p>
      </div>
    </div>
  )
}
