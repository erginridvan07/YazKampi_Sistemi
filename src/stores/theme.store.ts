import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function getStoredTheme(): Theme {
  const stored = localStorage.getItem('gv-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    localStorage.setItem('gv-theme', theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
  initTheme: () => {
    const theme = getStoredTheme()
    applyTheme(theme)
    set({ theme })
  },
}))
