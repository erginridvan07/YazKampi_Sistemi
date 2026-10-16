import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { usePersistedBoolean } from '@/hooks/usePersistedBoolean'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  storageKey: string
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Shown next to Göster/Gizle while expanded (e.g. "Yeni Mezun") */
  actions?: ReactNode
  defaultOpen?: boolean
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'none'
  className?: string
  children: ReactNode
}

export function CollapsibleSection({
  storageKey,
  title,
  description,
  icon,
  actions,
  defaultOpen = false,
  accent = 'none',
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = usePersistedBoolean(storageKey, defaultOpen)

  return (
    <Card accent={accent} className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {icon ? <div className="mt-1 shrink-0">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {open && actions ? actions : null}
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? 'Gizle' : 'Göster'}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
            />
          </Button>
        </div>
      </div>

      {open ? <div className="mt-5">{children}</div> : null}
    </Card>
  )
}
