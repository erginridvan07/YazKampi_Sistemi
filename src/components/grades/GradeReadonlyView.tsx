import { PERIOD_OPTIONS } from '@/config/constants'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import type { DersNotu } from '@/types'

function displayValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

interface GradeReadonlyViewProps {
  period: string
  onPeriodChange: (period: string) => void
  dersler: DersNotu[]
  donemOrt: string
  genelOrt: string
}

/** Student-facing grades display — no inputs, no save, no mutations. */
export function GradeReadonlyView({
  period,
  onPeriodChange,
  dersler,
  donemOrt,
  genelOrt,
}: GradeReadonlyViewProps) {
  return (
    <div className="space-y-4">
      <Select
        id="period"
        label="Dönem"
        value={period}
        onChange={(e) => onPeriodChange(e.target.value)}
      >
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>

      {dersler.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Bu dönem için ders bulunamadı.
        </p>
      ) : null}

      {dersler.map((ders, index) => (
        <Card key={`${ders.ad || 'ders'}-${index}`} className="space-y-3">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
            {ders.ad?.trim() || 'Adsız ders'}
          </p>
          {ders.kod || ders.akts || ders.kaynakDonem ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ders.kod ? `Ders kodu: ${ders.kod}` : ''}
              {ders.kod && ders.akts ? ' · ' : ''}
              {ders.akts ? `${ders.akts} AKTS` : ''}
              {(ders.kod || ders.akts) && ders.kaynakDonem ? ' · ' : ''}
              {ders.kaynakDonem ? `Kaynak dönem: ${ders.kaynakDonem}` : ''}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadonlyField label="Vize" value={displayValue(ders.vize)} />
            <ReadonlyField label="Final" value={displayValue(ders.final)} />
            <ReadonlyField label="Ortalama" value={displayValue(ders.ort)} />
            <ReadonlyField label="Harf notu" value={displayValue(ders.harf)} />
          </div>
          {(ders.ekler || []).length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                Ek notlar
              </p>
              <ul className="space-y-2">
                {(ders.ekler || []).map((ek, ekIndex) => (
                  <li
                    key={`${ek.tip}-${ekIndex}`}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {ek.tip || 'Diğer'}
                    </span>
                    <span className="tabular-nums text-slate-900 dark:text-slate-100">
                      {displayValue(ek.not)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadonlyField label="Dönem ort." value={displayValue(donemOrt)} />
        <ReadonlyField label="Genel GPA" value={displayValue(genelOrt)} />
      </div>
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
        {label}
      </p>
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
        {value}
      </p>
    </div>
  )
}
