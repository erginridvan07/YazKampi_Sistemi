import { Plus, Trash2 } from 'lucide-react'
import { HARF_NOTLARI, PERIOD_OPTIONS } from '@/config/constants'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { DersNotu, EkNot } from '@/types'

interface GradeEditorProps {
  period: string
  onPeriodChange: (period: string) => void
  dersler: DersNotu[]
  onDerslerChange: (dersler: DersNotu[]) => void
  donemOrt: string
  genelOrt: string
  onDonemOrtChange: (v: string) => void
  onGenelOrtChange: (v: string) => void
  onSave: () => void
  saving?: boolean
}

export function GradeEditor({
  period,
  onPeriodChange,
  dersler,
  onDerslerChange,
  donemOrt,
  genelOrt,
  onDonemOrtChange,
  onGenelOrtChange,
  onSave,
  saving,
}: GradeEditorProps) {
  const updateDers = (index: number, patch: Partial<DersNotu>) => {
    const next = [...dersler]
    next[index] = { ...next[index], ...patch }
    onDerslerChange(next)
  }

  const addDers = () => {
    onDerslerChange([...dersler, { ad: '', vize: '', final: '', ort: '', harf: '', ekler: [] }])
  }

  const removeDers = (index: number) => {
    onDerslerChange(dersler.filter((_, i) => i !== index))
  }

  const addEk = (dersIndex: number) => {
    const next = [...dersler]
    const ekler = [...(next[dersIndex].ekler || []), { tip: 'Quiz', not: '' }]
    next[dersIndex] = { ...next[dersIndex], ekler }
    onDerslerChange(next)
  }

  const updateEk = (dersIndex: number, ekIndex: number, patch: Partial<EkNot>) => {
    const next = [...dersler]
    const ekler = [...(next[dersIndex].ekler || [])]
    ekler[ekIndex] = { ...ekler[ekIndex], ...patch }
    next[dersIndex] = { ...next[dersIndex], ekler }
    onDerslerChange(next)
  }

  const removeEk = (dersIndex: number, ekIndex: number) => {
    const next = [...dersler]
    const ekler = (next[dersIndex].ekler || []).filter((_, i) => i !== ekIndex)
    next[dersIndex] = { ...next[dersIndex], ekler }
    onDerslerChange(next)
  }

  return (
    <div className="space-y-4">
      <Select id="period" label="Dönem" value={period} onChange={(e) => onPeriodChange(e.target.value)}>
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>

      {dersler.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Bu dönem için ders bulunamadı.
        </p>
      ) : null}

      {dersler.map((ders, index) => (
        <Card key={index} className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              id={`ders-${index}`}
              placeholder="Ders adı"
              value={ders.ad}
              onChange={(e) => updateDers(index, { ad: e.target.value })}
            />
            <Button variant="danger" size="icon" onClick={() => removeDers(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id={`vize-${index}`}
              label="Vize"
              type="number"
              value={String(ders.vize ?? '')}
              onChange={(e) => updateDers(index, { vize: e.target.value })}
            />
            <Input
              id={`final-${index}`}
              label="Final"
              type="number"
              value={String(ders.final ?? '')}
              onChange={(e) => updateDers(index, { final: e.target.value })}
            />
          </div>
          {(ders.ekler || []).map((ek, ekIndex) => (
            <div key={ekIndex} className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 p-3">
              <select
                value={ek.tip}
                onChange={(e) => updateEk(index, ekIndex, { tip: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {['Quiz', 'Ödev', 'Proje', 'Bütünleme', 'Diğer'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={ek.not}
                onChange={(e) => updateEk(index, ekIndex, { not: e.target.value })}
                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Not"
              />
              <Button variant="ghost" size="sm" onClick={() => removeEk(index, ekIndex)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => addEk(index)}>
            + Ek kategori
          </Button>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id={`ort-${index}`}
              label="Ortalama"
              value={String(ders.ort ?? '')}
              onChange={(e) => updateDers(index, { ort: e.target.value })}
            />
            <Select
              id={`harf-${index}`}
              label="Harf notu"
              value={ders.harf || ''}
              onChange={(e) => updateDers(index, { harf: e.target.value })}
            >
              <option value="">Seç</option>
              {HARF_NOTLARI.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      ))}

      <Button variant="secondary" onClick={addDers}>
        <Plus className="h-4 w-4" /> Yeni ders ekle
      </Button>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="donemOrt" label="Dönem ort." value={donemOrt} onChange={(e) => onDonemOrtChange(e.target.value)} />
        <Input id="genelOrt" label="Genel GPA" value={genelOrt} onChange={(e) => onGenelOrtChange(e.target.value)} />
      </div>

      <Button fullWidth size="lg" onClick={onSave} disabled={saving}>
        {saving ? 'Kaydediliyor...' : 'Kaydet'}
      </Button>
    </div>
  )
}
