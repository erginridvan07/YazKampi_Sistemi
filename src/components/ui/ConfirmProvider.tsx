import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useConfirmStore } from '@/stores/confirm.store'

export function ConfirmProvider() {
  const isOpen = useConfirmStore((s) => s.isOpen)
  const options = useConfirmStore((s) => s.options)
  const resolveAndClose = useConfirmStore((s) => s.resolveAndClose)

  if (!options) return null

  return (
    <ConfirmDialog
      open={isOpen}
      onClose={() => resolveAndClose(false)}
      onConfirm={() => resolveAndClose(true)}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant}
    >
      {options.children}
    </ConfirmDialog>
  )
}
