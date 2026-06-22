const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_OUTPUT_CHARS = 180_000
const MAX_SIDE = 256

export interface CompressImageOptions {
  maxSide?: number
  maxOutputChars?: number
  maxFileBytes?: number
}

export const PROFILE_IMAGE_OPTS: CompressImageOptions = {
  maxSide: 256,
  maxOutputChars: 180_000,
}

export const GALLERY_IMAGE_OPTS: CompressImageOptions = {
  maxSide: 560,
  maxOutputChars: 100_000,
}

export const KURUCU_IMAGE_OPTS: CompressImageOptions = {
  maxSide: 480,
  maxOutputChars: 120_000,
}

export function getProfileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR')
  }
  return (parts[0]?.[0] ?? '?').toLocaleUpperCase('tr-TR')
}

export async function compressImageToDataUrl(
  file: File,
  options: CompressImageOptions = PROFILE_IMAGE_OPTS,
): Promise<string> {
  const maxSide = options.maxSide ?? MAX_SIDE
  const maxOutputChars = options.maxOutputChars ?? MAX_OUTPUT_CHARS
  const maxFileBytes = options.maxFileBytes ?? MAX_FILE_BYTES

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Sadece JPG, PNG, WebP veya GIF yükleyebilirsiniz.')
  }
  if (file.size > maxFileBytes) {
    throw new Error('Dosya en fazla 8 MB olabilir.')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Görsel işlenemedi.')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = 0.85
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > maxOutputChars && quality > 0.35) {
    quality -= 0.1
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }

  if (dataUrl.length > maxOutputChars) {
    throw new Error('Fotoğraf çok büyük. Daha küçük bir görsel deneyin.')
  }

  return dataUrl
}
