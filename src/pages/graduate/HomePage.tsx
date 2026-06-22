import { useMemo, useState } from 'react'
import { GraduationCap, Search, Users } from 'lucide-react'
import { GraduateCard } from '@/components/graduate/GraduateCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import {
  fetchGraduateLoginSettings,
  fetchGraduates,
  groupGraduatesByYear,
} from '@/services/graduates.service'

export function GraduateHomePage() {
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')

  const settingsQuery = useAsync(() => fetchGraduateLoginSettings(), [])
  const graduatesQuery = useAsync(() => fetchGraduates(), [])

  const graduates = graduatesQuery.data || []
  const groups = useMemo(() => groupGraduatesByYear(graduates), [graduates])
  const years = useMemo(() => [...groups.keys()].sort((a, b) => b - a), [groups])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr')
    const result = new Map<number, typeof graduates>()

    for (const [year, list] of groups) {
      if (yearFilter !== 'all' && String(year) !== yearFilter) continue

      const filtered = list.filter((graduate) => {
        if (!term) return true
        const haystack = [
          graduate.adSoyad,
          graduate.bolum,
          graduate.gorev,
          graduate.calistigiYer,
          graduate.sehir,
          graduate.notlar,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr')
        return haystack.includes(term)
      })

      if (filtered.length > 0) result.set(year, filtered)
    }

    return result
  }, [groups, search, yearFilter])

  const settings = settingsQuery.data
  const loading = graduatesQuery.loading || settingsQuery.loading

  if (loading) {
    return <Spinner label="Mezun ağı yükleniyor..." />
  }

  return (
    <div className="page-container pb-24">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 px-6 py-10 text-white shadow-xl shadow-primary-900/20">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-indigo-300/20 blur-2xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <GraduationCap className="h-4 w-4" />
            Mezun Ağı
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {settings?.welcomeTitle || 'Mezun Ağı'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-100 sm:text-base">
            {settings?.welcomeMessage ||
              'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge tone="primary" className="bg-white/15 text-white ring-1 ring-white/20">
              <Users className="mr-1 inline h-3.5 w-3.5" />
              {graduates.length} mezun
            </Badge>
            <Badge tone="primary" className="bg-white/15 text-white ring-1 ring-white/20">
              {years.length} giriş dönemi
            </Badge>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="graduate-search"
            label="Mezun ara"
            className="pl-11"
            placeholder="İsim, meslek, şehir..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="min-w-[180px]">
          <label htmlFor="year-filter" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Giriş yılı
          </label>
          <select
            id="year-filter"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none ring-primary-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm yıllar</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year} girişliler
              </option>
            ))}
          </select>
        </div>
      </div>

      {graduates.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Henüz mezun kaydı yok"
          description="Yönetici Ayarlar bölümünden mezun bilgilerini ekleyebilir."
        />
      ) : filteredGroups.size === 0 ? (
        <EmptyState
          className="mt-8"
          title="Sonuç bulunamadı"
          description="Arama veya yıl filtresini değiştirmeyi deneyin."
        />
      ) : (
        <div className="mt-8 space-y-10">
          {[...filteredGroups.entries()].map(([year, list]) => (
            <section key={year}>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-400">
                    Giriş Dönemi
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {year} Girişli Mezunlar
                  </h2>
                </div>
                <Badge tone="default">{list.length} kişi</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((graduate) => (
                  <GraduateCard key={graduate.id} graduate={graduate} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card className="mt-10 border-dashed border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/20">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Bu alan Gaye Vakfı mezunlarının birbirleriyle bağlantıda kalması için hazırlanmıştır.
          Bilgiler yönetici tarafından güncellenir.
        </p>
      </Card>
    </div>
  )
}
