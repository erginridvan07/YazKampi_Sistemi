import { create } from 'zustand'
import type { ReactNode } from 'react'

export type ConfirmVariant = 'primary' | 'success' | 'danger' | 'warning'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  children?: ReactNode
}

interface ConfirmState {
  isOpen: boolean
  options: ConfirmOptions | null
  _resolve: ((value: boolean) => void) | null
  ask: (options: ConfirmOptions) => Promise<boolean>
  resolveAndClose: (result: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  _resolve: null,
  ask: (options) =>
    new Promise((resolve) => {
      set({ isOpen: true, options, _resolve: resolve })
    }),
  resolveAndClose: (result) => {
    get()._resolve?.(result)
    set({ isOpen: false, options: null, _resolve: null })
  },
}))

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(options)
}
