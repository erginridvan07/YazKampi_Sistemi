import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import {
  compressImageToDataUrl,
  type CompressImageOptions,
  GALLERY_IMAGE_OPTS,
} from '@/lib/avatar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToastStore } from '@/stores/toast.store'

interface ImageUploadFieldProps {
  id: string
  value?: string
  onChange: (value: string) => void
  onClear?: () => void
  label?: string
  urlLabel?: string
  urlPlaceholder?: string
  previewClassName?: string
  compressOptions?: CompressImageOptions
  showUrlInput?: boolean
  helperText?: string
}

export function ImageUploadField({
  id,
  value,
  onChange,
  onClear,
  label,
  urlLabel = 'veya görsel adresi',
  urlPlaceholder = '/gallery/foto.jpg veya https://...',
  previewClassName,
  compressOptions = GALLERY_IMAGE_OPTS,
  showUrlInput = true,
  helperText = 'JPG, PNG veya WebP · Firebase Storage gerekmez',
}: ImageUploadFieldProps) {
  const showToast = useToastStore((s) => s.showToast)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setLoading(true)
    try {
      const dataUrl = await compressImageToDataUrl(file, compressOptions)
      onChange(dataUrl)
      showToast('success', 'Fotoğraf eklendi', 'Yayınlamak için Kaydet\'e basın')
    } catch (err) {
      showToast('error', 'Fotoğraf yüklenemedi', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {label ? <p className="text-xs font-bold uppercase text-slate-500">{label}</p> : null}

      {value ? (
        <img
          src={value}
          alt=""
          className={cn('rounded-xl object-cover', previewClassName ?? 'h-32 w-full max-w-xs')}
        />
      ) : null}

      <input
        ref={fileInputRef}
        id={`${id}-file`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          {loading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
        </Button>
        {value && onClear ? (
          <Button type="button" variant="danger" size="sm" disabled={loading} onClick={onClear}>
            <Trash2 className="h-4 w-4" /> Kaldır
          </Button>
        ) : null}
      </div>

      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}

      {showUrlInput ? (
        <Input
          id={`${id}-url`}
          label={urlLabel}
          placeholder={urlPlaceholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  )
}
