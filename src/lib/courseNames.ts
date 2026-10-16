/** Comparison / suggestion helpers only — never rewrite stored course names. */

export function normalizeCourseKey(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
}

export function courseNamesMatch(a: string, b: string): boolean {
  const ka = normalizeCourseKey(a)
  const kb = normalizeCourseKey(b)
  if (!ka || !kb) return false
  return ka === kb
}

/** Prefer the most frequent spelling; ties → Turkish localeCompare. */
export function pickDisplayName(candidates: string[]): string {
  if (candidates.length === 0) return ''
  if (candidates.length === 1) return candidates[0]

  const counts = new Map<string, number>()
  for (const raw of candidates) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0], 'tr')
    })[0][0]
}

export function findDuplicateCourseDisplay(dersAdlari: string[]): string | null {
  const seen = new Map<string, string>()
  for (const raw of dersAdlari) {
    const key = normalizeCourseKey(raw)
    if (!key) continue
    const existing = seen.get(key)
    if (existing) return existing
    seen.set(key, raw.trim().replace(/\s+/g, ' ') || raw)
  }
  return null
}

/**
 * Blocks only newly introduced duplicates vs a baseline snapshot.
 * Legacy duplicates already present in baseline remain editable.
 */
export function findIntroducedDuplicateDisplay(
  baselineAdlari: string[],
  currentAdlari: string[],
): string | null {
  const baselineCounts = new Map<string, number>()
  for (const raw of baselineAdlari) {
    const key = normalizeCourseKey(raw)
    if (!key) continue
    baselineCounts.set(key, (baselineCounts.get(key) || 0) + 1)
  }

  const currentCounts = new Map<string, { count: number; display: string }>()
  for (const raw of currentAdlari) {
    const key = normalizeCourseKey(raw)
    if (!key) continue
    const display = raw.trim().replace(/\s+/g, ' ') || raw
    const prev = currentCounts.get(key)
    if (prev) prev.count += 1
    else currentCounts.set(key, { count: 1, display })
  }

  for (const [key, curr] of currentCounts) {
    const allowed = baselineCounts.get(key) || 0
    if (curr.count > allowed && curr.count > 1) return curr.display
  }

  return null
}
