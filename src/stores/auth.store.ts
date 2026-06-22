import { create } from 'zustand'
import type { UserProfile } from '@/types'

interface AuthState {
  profile: UserProfile | null
  isLoading: boolean
  isInitialized: boolean
  setProfile: (profile: UserProfile | null) => void
  setLoading: (isLoading: boolean) => void
  setInitialized: (isInitialized: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  isLoading: true,
  isInitialized: false,
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  clear: () => set({ profile: null, isLoading: false }),
}))
