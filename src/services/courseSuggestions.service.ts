import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  normalizeCourseKey,
  pickDisplayName,
} from '@/lib/courseNames'
import { cachedQuery, invalidateQueryCache } from '@/lib/queryCache'
import type { DersNotu } from '@/types'

export interface CourseSuggestion {
  key: string
  displayName: string
  usageCount: number
}

const TTL_MS = 5 * 60_000

export function courseSuggestionsCacheKey(
  bolum: string,
  sinif: string | number,
  period: string,
): string {
  const normalizedBolum = bolum.trim()
  const normalizedSinif = String(sinif).trim()
  return `course-suggestions:${normalizedBolum}:${normalizedSinif}:${period}`
}

export function invalidateCourseSuggestionsCache(
  bolum: string,
  sinif: string | number,
  period: string,
): void {
  invalidateQueryCache(courseSuggestionsCacheKey(bolum, sinif, period))
}

function sameSinif(a: unknown, b: string | number): boolean {
  return String(a ?? '').trim() === String(b).trim()
}

function extractPeriodCourses(
  akademikNotlar: unknown,
  period: string,
): DersNotu[] {
  if (!akademikNotlar || typeof akademikNotlar !== 'object') return []
  const map = akademikNotlar as Record<string, unknown>
  const list = map[period]
  return Array.isArray(list) ? (list as DersNotu[]) : []
}

async function loadCourseSuggestions(
  bolum: string,
  sinif: string | number,
  period: string,
): Promise<CourseSuggestion[]> {
  const bolumValue = bolum.trim()
  if (!bolumValue || !period) return []

  // Single equality query (no composite index). sinif string/number reconciled client-side.
  const snap = await getDocs(
    query(collection(db, 'ogrenciler'), where('bolum', '==', bolumValue)),
  )

  const buckets = new Map<string, { names: string[]; students: Set<string> }>()

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    if (data.role === 'admin') continue
    if (!sameSinif(data.sinif, sinif)) continue

    const dersler = extractPeriodCourses(data.akademikNotlar, period)
    const seenInStudent = new Set<string>()

    for (const ders of dersler) {
      const ad = typeof ders?.ad === 'string' ? ders.ad : ''
      const key = normalizeCourseKey(ad)
      if (!key || seenInStudent.has(key)) continue
      seenInStudent.add(key)

      const bucket = buckets.get(key) || { names: [], students: new Set<string>() }
      bucket.names.push(ad)
      bucket.students.add(docSnap.id)
      buckets.set(key, bucket)
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      displayName: pickDisplayName(bucket.names),
      usageCount: bucket.students.size,
    }))
    .sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount
      return a.displayName.localeCompare(b.displayName, 'tr')
    })
}

export function fetchCourseSuggestions(
  bolum: string,
  sinif: string | number,
  period: string,
): Promise<CourseSuggestion[]> {
  const key = courseSuggestionsCacheKey(bolum, sinif, period)
  return cachedQuery(key, () => loadCourseSuggestions(bolum, sinif, period), TTL_MS)
}
