import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  hideHeader?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  hideHeader = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          {!hideHeader ? (
            <div>
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
          ) : (
            <div />
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Kapat">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
