import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { GalleryItem } from '@/config/landing'

export function GalleryImage({ item }: { item: GalleryItem }) {
  const [failed, setFailed] = useState(!item.src)

  return (
    <div
      className={cn(
        'relative flex h-40 items-end overflow-hidden rounded-2xl shadow-lg',
        failed && `bg-gradient-to-br ${item.gradient}`,
      )}
    >
      {!failed && item.src ? (
        <img
          src={item.src}
          alt={item.label}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : null}
      <div className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent p-4">
        <span className="font-bold text-white">{item.label}</span>
      </div>
    </div>
  )
}
