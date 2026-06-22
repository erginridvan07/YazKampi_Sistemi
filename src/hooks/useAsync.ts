import { useCallback, useEffect, useState } from 'react'

interface UseAsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseAsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
