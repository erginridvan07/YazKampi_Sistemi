import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

type ConfirmVariant = 'primary' | 'success' | 'danger' | 'warning'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  loading?: boolean
  children?: ReactNode
}

const variantConfig: Record<
  ConfirmVariant,
  { icon: typeof CheckCircle2; iconBg: string; iconColor: string; buttonVariant: 'primary' | 'danger' | 'accent' }
> = {
  primary: {
    icon: Info,
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-700',
    buttonVariant: 'primary',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    buttonVariant: 'primary',
  },
  danger: {
    icon: XCircle,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    buttonVariant: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    buttonVariant: 'accent',
  },
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  variant = 'primary',
  loading = false,
  children,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <Modal open={open} onClose={onClose} title="" hideHeader className="max-w-md">
      <div className="text-center">
        <div
          className={cn(
            'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
            config.iconBg,
          )}
        >
          <Icon className={cn('h-7 w-7', config.iconColor)} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
        {children ? <div className="mt-4 text-left">{children}</div> : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={config.buttonVariant}
            fullWidth
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'İşleniyor...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
