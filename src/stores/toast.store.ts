import { create } from 'zustand'
import type { ToastMessage, ToastType } from '@/types'

interface ToastState {
  toasts: ToastMessage[]
  showToast: (type: ToastType, title: string, description?: string) => void
  dismissToast: (id: string) => void
}

let toastCounter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (type, title, description) => {
    const id = `toast-${++toastCounter}`
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, description }],
    }))

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }))
    }, 4200)
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))
