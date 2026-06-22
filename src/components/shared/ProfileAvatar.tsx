import { UserCircle } from 'lucide-react'
import { getProfileInitials } from '@/lib/avatar'
import { cn } from '@/lib/utils'

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  list: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-base',
  lg: 'h-24 w-24 text-2xl',
  header: 'h-8 w-8 text-xs',
}

interface ProfileAvatarProps {
  name: string
  photoUrl?: string
  size?: keyof typeof sizeMap
  className?: string
}

export function ProfileAvatar({ name, photoUrl, size = 'md', className }: ProfileAvatarProps) {
  const sizeClass = sizeMap[size]

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn('shrink-0 rounded-2xl object-cover', sizeClass, className)}
      />
    )
  }

  const initials = getProfileInitials(name)
  const showInitials = initials !== '?'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl bg-primary-100 font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-200',
        sizeClass,
        className,
      )}
      aria-hidden={!showInitials}
    >
      {showInitials ? initials : <UserCircle className="h-[55%] w-[55%]" />}
    </div>
  )
}
