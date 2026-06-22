import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
}

export function Switch({ checked, onChange, label, id }: SwitchProps) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {label ? <span className="text-sm font-semibold text-slate-700">{label}</span> : null}
    </label>
  )
}
