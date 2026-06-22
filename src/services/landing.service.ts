import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { DEFAULT_LANDING_CONTENT, type LandingContent } from '@/config/landing'
import { db, storage } from '@/lib/firebase'
import { deepStripUndefined } from '@/lib/utils'

const PREVIEW_DRAFT_KEY = 'landing_preview_draft'

function mergeLandingContent(data: Partial<LandingContent>): LandingContent {
  return {
    ...DEFAULT_LANDING_CONTENT,
    ...data,
    hero: { ...DEFAULT_LANDING_CONTENT.hero, ...data.hero },
    hakkimizda: { ...DEFAULT_LANDING_CONTENT.hakkimizda, ...data.hakkimizda },
    kurucu: { ...DEFAULT_LANDING_CONTENT.kurucu, ...data.kurucu },
    misyon: { ...DEFAULT_LANDING_CONTENT.misyon, ...data.misyon },
    vizyon: { ...DEFAULT_LANDING_CONTENT.vizyon, ...data.vizyon },
    iletisim: { ...DEFAULT_LANDING_CONTENT.iletisim, ...data.iletisim },
    galeri: data.galeri?.length ? data.galeri : DEFAULT_LANDING_CONTENT.galeri,
  }
}

function readPreviewDraftRaw(): string | null {
  return localStorage.getItem(PREVIEW_DRAFT_KEY) ?? sessionStorage.getItem(PREVIEW_DRAFT_KEY)
}

function writePreviewDraftRaw(value: string): void {
  localStorage.setItem(PREVIEW_DRAFT_KEY, value)
  sessionStorage.setItem(PREVIEW_DRAFT_KEY, value)
}

function removePreviewDraftRaw(): void {
  localStorage.removeItem(PREVIEW_DRAFT_KEY)
  sessionStorage.removeItem(PREVIEW_DRAFT_KEY)
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: string }).code)
  }
  return undefined
}

export async function fetchLandingContent(): Promise<LandingContent> {
  try {
    const snap = await getDoc(doc(db, 'site_ayarlari', 'landing'))
    if (!snap.exists()) return DEFAULT_LANDING_CONTENT
    const data = snap.data() as Partial<LandingContent>
    return mergeLandingContent(data)
  } catch {
    return DEFAULT_LANDING_CONTENT
  }
}

export async function saveLandingContent(
  content: LandingContent,
  editorName: string,
): Promise<void> {
  const payload = deepStripUndefined({
    ...content,
    updatedAt: new Date().toISOString(),
    updatedBy: editorName,
  })

  try {
    await setDoc(doc(db, 'site_ayarlari', 'landing'), payload)
    clearLandingPreviewDraft()
  } catch (error) {
    const code = getErrorCode(error)
    const message = error instanceof Error ? error.message : ''
    if (code === 'permission-denied') {
      throw new Error(
        'Firestore yazma izni yok. Terminalde npm run deploy:firestore çalıştırıp kuralları yayınlayın.',
      )
    }
    if (code === 'invalid-argument' || message.includes('exceeds the maximum allowed size')) {
      throw new Error(
        'Site içeriği çok büyük. Daha az fotoğraf kullanın veya daha küçük görseller yükleyin.',
      )
    }
    throw error instanceof Error ? error : new Error('Site içeriği kaydedilemedi.')
  }
}

export function setLandingPreviewDraft(content: LandingContent): void {
  writePreviewDraftRaw(JSON.stringify(content))
}

export function readLandingPreviewDraft(): LandingContent | null {
  const raw = readPreviewDraftRaw()
  if (!raw) return null
  try {
    return mergeLandingContent(JSON.parse(raw) as Partial<LandingContent>)
  } catch {
    return null
  }
}

export function clearLandingPreviewDraft(): void {
  removePreviewDraftRaw()
}

export async function uploadLandingImage(file: File, folder: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `landing/${folder}/${Date.now()}_${safeName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export function createGalleryId(): string {
  return `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
