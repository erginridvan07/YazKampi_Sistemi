import provinceMeta from '@/data/turkeyProvinceMeta.json'
import type { Graduate } from '@/types'

export interface TurkeyProvinceMeta {
  id: string
  plate: string
  name: string
  cx: number
  cy: number
}

export interface ProvinceGroup {
  plate: string
  name: string
  graduates: Graduate[]
}

const INTERACTIVE_PROVINCES = (provinceMeta as TurkeyProvinceMeta[]).filter(
  (province) => province.plate !== '00' && province.id !== 'guney-kibris',
)

const PLATE_TO_NAME = new Map<string, string>()
for (const province of INTERACTIVE_PROVINCES) {
  if (!PLATE_TO_NAME.has(province.plate)) {
    PLATE_TO_NAME.set(province.plate, province.name.replace(/\s*\(.*\)$/, ''))
  }
}

const PROVINCE_IDS_BY_PLATE = new Map<string, string[]>()
for (const province of INTERACTIVE_PROVINCES) {
  const list = PROVINCE_IDS_BY_PLATE.get(province.plate) || []
  list.push(province.id)
  PROVINCE_IDS_BY_PLATE.set(province.plate, list)
}

function foldTurkish(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\u0307/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CITY_ALIASES = new Map<string, string>()

function registerAlias(alias: string, plate: string) {
  CITY_ALIASES.set(foldTurkish(alias), plate)
}

for (const [plate, name] of PLATE_TO_NAME) {
  registerAlias(name, plate)
  registerAlias(name.replace(/-/g, ' '), plate)
}

registerAlias('istanbul', '34')
registerAlias('izmir', '35')
registerAlias('afyon', '03')
registerAlias('kahramanmaras', '46')
registerAlias('sanliurfa', '63')
registerAlias('usak', '64')
registerAlias('yalova', '77')
registerAlias('kocaeli', '41')
registerAlias('tekirdag', '59')

const DISTRICT_TO_PLATE: Array<[string, string]> = [
  ['kadikoy', '34'],
  ['besiktas', '34'],
  ['uskudar', '34'],
  ['sisli', '34'],
  ['bakirkoy', '34'],
  ['cankaya', '06'],
  ['kecioren', '06'],
  ['bornova', '35'],
  ['karsiyaka', '35'],
  ['nilufer', '16'],
  ['osmangazi', '16'],
  ['selcuklu', '42'],
  ['meram', '42'],
  ['seyhan', '01'],
  ['muratpasa', '07'],
]

for (const [district, plate] of DISTRICT_TO_PLATE) {
  registerAlias(district, plate)
}

export function getProvinceName(plate: string): string {
  return PLATE_TO_NAME.get(plate) || 'Bilinmeyen'
}

export function getProvinceOptions(): Array<{ plate: string; name: string }> {
  return [...PLATE_TO_NAME.entries()]
    .map(([plate, name]) => ({ plate, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

export function normalizeCityToProvinceName(city?: string): string {
  if (!city?.trim()) return ''

  const plate = resolvePlateFromCity(city)
  if (plate) return getProvinceName(plate)

  for (const name of PLATE_TO_NAME.values()) {
    if (foldTurkish(name) === foldTurkish(city)) return name
  }

  return city.trim()
}

export function isKnownProvinceName(city?: string): boolean {
  if (!city?.trim()) return true
  const normalized = normalizeCityToProvinceName(city)
  return getProvinceOptions().some((option) => option.name === normalized)
}

export function getProvinceIdsForPlate(plate: string): string[] {
  return PROVINCE_IDS_BY_PLATE.get(plate) || []
}

export function getMapProvinces(): TurkeyProvinceMeta[] {
  return INTERACTIVE_PROVINCES
}

export function getProvinceLabelMeta(): Array<TurkeyProvinceMeta & { label: string }> {
  const seen = new Set<string>()
  const labels: Array<TurkeyProvinceMeta & { label: string }> = []

  for (const province of INTERACTIVE_PROVINCES) {
    if (seen.has(province.plate)) continue
    seen.add(province.plate)

    const related = INTERACTIVE_PROVINCES.filter((item) => item.plate === province.plate)
    const cx = related.reduce((sum, item) => sum + item.cx, 0) / related.length
    const cy = related.reduce((sum, item) => sum + item.cy, 0) / related.length

    labels.push({
      ...province,
      cx,
      cy,
      label: getProvinceName(province.plate),
    })
  }

  return labels
}

export function resolvePlateFromCity(city?: string): string | null {
  if (!city?.trim()) return null

  const folded = foldTurkish(city)
  if (!folded) return null

  const direct = CITY_ALIASES.get(folded)
  if (direct) return direct

  for (const [alias, plate] of CITY_ALIASES) {
    if (folded.includes(alias) || alias.includes(folded)) {
      return plate
    }
  }

  return null
}

export function groupGraduatesByProvince(graduates: Graduate[]): Map<string, Graduate[]> {
  const groups = new Map<string, Graduate[]>()
  const unknown: Graduate[] = []

  for (const graduate of graduates) {
    const plate = resolvePlateFromCity(graduate.sehir)
    if (!plate) {
      unknown.push(graduate)
      continue
    }

    const list = groups.get(plate) || []
    list.push(graduate)
    groups.set(plate, list)
  }

  if (unknown.length > 0) {
    groups.set('unknown', unknown)
  }

  return groups
}

export function countMappedGraduates(groups: Map<string, Graduate[]>): number {
  let total = 0
  for (const [plate, list] of groups) {
    if (plate !== 'unknown') total += list.length
  }
  return total
}
