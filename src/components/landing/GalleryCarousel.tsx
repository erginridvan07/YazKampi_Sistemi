import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { GalleryItem } from '@/config/landing'

interface GalleryCarouselProps {
  items: GalleryItem[]
}

export function GalleryCarousel({ items }: GalleryCarouselProps) {
  const slides = items.filter((item) => item.src)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 text-white md:h-80">
        <p className="text-sm font-semibold text-primary-100">Galeri fotoğrafları eklendiğinde burada döner</p>
      </div>
    )
  }

  const current = slides[index]

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl">
      <div className="relative h-64 md:h-80">
        {slides.map((slide, i) => (
          <img
            key={slide.id}
            src={slide.src}
            alt={slide.label}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <p className="text-lg font-bold text-white">{current.label}</p>
          <p className="text-sm text-white/80">
            {index + 1} / {slides.length}
          </p>
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-xl bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 right-4 flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/50'
                }`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
