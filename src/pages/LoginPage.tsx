import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { GRADUATE_AUTH_USERNAME } from '@/lib/graduateAuth'
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (profile) {
    return <Navigate to={getDefaultRoute(profile.role, profile.canManageAttendance)} replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (loginType === 'mezunlar') {
      if (!password.trim()) {
        setError('Lütfen şifre girin.')
        return
      }
    } else if (!username.trim() || !password.trim()) {
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
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-primary-50 to-slate-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30 dark:shadow-primary-900/40">
            <LogIn className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Gaye Vakfı Portal</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Öğrenci, yönetici ve mezun girişini güvenli şekilde yapın.
          </p>
        </div>

        <Card className="shadow-xl shadow-slate-200/70 dark:shadow-slate-950/50">
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
              onChange={(event) => {
                const next = event.target.value as LoginType
                setLoginType(next)
                if (next === 'mezunlar') {
                  setUsername(GRADUATE_AUTH_USERNAME)
                } else if (username === GRADUATE_AUTH_USERNAME) {
                  setUsername('')
                }
              }}
            >
              <option value="ogrenciler">Öğrenci Girişi</option>
              <option value="yoneticiler">Yönetici Girişi</option>
              <option value="mezunlar">Mezun Girişi</option>
            </Select>

            <Input
              id="username"
              label="Kullanıcı Adı"
              placeholder="Kullanıcı adınız"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              readOnly={loginType === 'mezunlar'}
              className={loginType === 'mezunlar' ? 'cursor-default opacity-80' : undefined}
            />
            {loginType === 'mezunlar' ? (
              <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
                Mezun girişi ortak hesap üzerinden yapılır. Şifreyi girmeniz yeterlidir.
              </p>
            ) : null}

            <Input
              id="password"
              label="Şifre"
              type={isPasswordVisible ? 'text' : 'password'}
              placeholder="Şifreniz"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  aria-label={isPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            />

            {error ? (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </p>
            ) : null}

            <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>

          {isSubmitting ? <Spinner className="py-4" label="Hesap doğrulanıyor..." /> : null}
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/"
            className="font-semibold text-primary-700 hover:underline dark:text-primary-300"
          >
            Ana sayfaya dön
          </Link>
        </p>
      </div>
    </div>
  )
}
