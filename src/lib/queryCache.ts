type CacheEntry = { data: unknown; at: number }

const store = new Map<string, CacheEntry>()

export const CACHE_KEYS = {
  studentsList: 'students:list',
  attendanceAll: 'attendance:all',
  attendanceRecent: (limit: number) => `attendance:recent:${limit}`,
  landingContent: 'landing:content',
} as const

export function getCachedQuery<T>(key: string, maxAgeMs = 5 * 60_000): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > maxAgeMs) return null
  return entry.data as T
}

export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60_000,
): Promise<T> {
  const hit = getCachedQuery<T>(key, ttlMs)
  if (hit !== null) return hit

  const data = await fetcher()
  store.set(key, { data, at: Date.now() })
  return data
}

export function invalidateQueryCache(...keys: string[]) {
  if (keys.length === 0) {
    store.clear()
    return
  }
  keys.forEach((key) => store.delete(key))
}

export function invalidateQueryCachePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
