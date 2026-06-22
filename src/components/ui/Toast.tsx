import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useToastStore } from '@/stores/toast.store'
import { cn } from '@/lib/utils'

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const toneMap = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-primary-200 bg-primary-50 text-primary-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-3 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-lg shadow-slate-300/30',
              toneMap[toast.type],
            )}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm opacity-90">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-lg p-1 opacity-70 transition hover:opacity-100"
                aria-label="Bildirimi kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
