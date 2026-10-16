import { useCallback, useState } from 'react'

function readPersistedBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // localStorage kapalı veya erişilemiyor
  }
  return fallback
}

function writePersistedBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {
    // localStorage dolu veya erişilemiyor
  }
}

/**
 * Boolean state that survives refresh via localStorage.
 * Falls back to `defaultValue` (usually false = collapsed) when unset/unavailable.
 */
export function usePersistedBoolean(
  key: string,
  defaultValue = false,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState(() => readPersistedBoolean(key, defaultValue))

  const setPersistedValue = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        writePersistedBoolean(key, resolved)
        return resolved
      })
    },
    [key],
  )

  return [value, setPersistedValue]
}
