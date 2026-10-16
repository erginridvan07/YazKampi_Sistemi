import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { normalizeCourseKey } from '@/lib/courseNames'
import type { CourseSuggestion } from '@/services/courseSuggestions.service'

interface CourseNameInputProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  suggestions?: CourseSuggestion[]
  placeholder?: string
  className?: string
}

export function CourseNameInput({
  id,
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = 'Ders seç veya yaz',
  className,
}: CourseNameInputProps) {
  const autoId = useId()
  const inputId = id || autoId
  const listboxId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const filtered = useMemo(() => {
    const term = normalizeCourseKey(value)
    if (!term) return suggestions
    return suggestions.filter(
      (item) =>
        normalizeCourseKey(item.displayName).includes(term) || item.key.includes(term),
    )
  }, [suggestions, value])

  const safeActiveIndex =
    activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      setOpen(false)
      setActiveIndex(-1)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const selectSuggestion = (item: CourseSuggestion) => {
    onChange(item.displayName)
    setOpen(false)
    setActiveIndex(-1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      if (!open) {
        setOpen(true)
        setActiveIndex(filtered.length > 0 ? 0 : -1)
        event.preventDefault()
        return
      }
      if (filtered.length === 0) return
      event.preventDefault()
      setActiveIndex((prev) => {
        const base = prev >= 0 && prev < filtered.length ? prev : -1
        return (base + 1) % filtered.length
      })
      return
    }

    if (event.key === 'ArrowUp') {
      if (!open || filtered.length === 0) return
      event.preventDefault()
      setActiveIndex((prev) => {
        const base = prev >= 0 && prev < filtered.length ? prev : 0
        return base <= 0 ? filtered.length - 1 : base - 1
      })
      return
    }

    if (event.key === 'Enter') {
      if (open && safeActiveIndex >= 0 && filtered[safeActiveIndex]) {
        event.preventDefault()
        selectSuggestion(filtered[safeActiveIndex])
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative w-full space-y-2', className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300"
        >
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && safeActiveIndex >= 0 ? `${listboxId}-option-${safeActiveIndex}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveIndex(-1)
          setOpen(true)
        }}
        onFocus={() => {
          setActiveIndex(-1)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800',
          'placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100',
          'dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500',
          'dark:focus:border-primary-500 dark:focus:bg-slate-800 dark:focus:ring-primary-500/30',
        )}
      />

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Ders önerileri"
          className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {suggestions.length === 0
                ? 'Öneri yok — yeni ders adı yazabilirsiniz'
                : 'Eşleşen öneri yok — yeni ders adı yazabilirsiniz'}
            </li>
          ) : (
            filtered.map((item, index) => {
              const active = index === safeActiveIndex
              return (
                <li
                  key={item.key}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm text-slate-800 dark:text-slate-100',
                    active
                      ? 'bg-primary-50 text-primary-900 dark:bg-primary-950/50 dark:text-primary-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectSuggestion(item)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="font-medium">{item.displayName}</span>
                  {item.usageCount > 1 ? (
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                      {item.usageCount} öğrenci
                    </span>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
