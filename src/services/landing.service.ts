import { DEFAULT_LANDING_CONTENT, type LandingContent } from '@/config/landing'
import { CACHE_KEYS, cachedQuery, getCachedQuery, invalidateQueryCache } from '@/lib/queryCache'
import { deepStripUndefined } from '@/lib/utils'

const PREVIEW_DRAFT_KEY = 'landing_preview_draft'
const LANDING_PERSIST_KEY = 'landing_content_v1'
const LANDING_CACHE_TTL = 30 * 60_000

function normalizeParagraphs(
  paragraphs: string[] | undefined,
  legacyContent: string | undefined,
  fallback: string[],
): string[] {
  const cleaned = paragraphs?.map((p) => p.trim()).filter(Boolean)
  if (cleaned?.length) return cleaned
  if (legacyContent?.trim()) return [legacyContent.trim()]
  return fallback
}

function mergeLandingContent(data: Partial<LandingContent> & {
  misyon?: { content?: string; paragraphs?: string[]; title?: string }
  vizyon?: { content?: string; paragraphs?: string[]; title?: string; bullets?: string[] }
}): LandingContent {
  return {
    ...DEFAULT_LANDING_CONTENT,
    ...data,
    hero: { ...DEFAULT_LANDING_CONTENT.hero, ...data.hero },
    hakkimizda: { ...DEFAULT_LANDING_CONTENT.hakkimizda, ...data.hakkimizda },
    kurucu: { ...DEFAULT_LANDING_CONTENT.kurucu, ...data.kurucu },
    misyon: {
      ...DEFAULT_LANDING_CONTENT.misyon,
      ...data.misyon,
      paragraphs: normalizeParagraphs(
        data.misyon?.paragraphs,
        data.misyon?.content,
        DEFAULT_LANDING_CONTENT.misyon.paragraphs,
      ),
    },
    vizyon: {
      ...DEFAULT_LANDING_CONTENT.vizyon,
      ...data.vizyon,
      paragraphs: normalizeParagraphs(
        data.vizyon?.paragraphs,
        data.vizyon?.content,
        DEFAULT_LANDING_CONTENT.vizyon.paragraphs,
      ),
    },
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

export function readPersistedLandingContent(): LandingContent | null {
  try {
    const raw = localStorage.getItem(LANDING_PERSIST_KEY)
    if (!raw) return null
    const { data, at } = JSON.parse(raw) as { data: Partial<LandingContent>; at: number }
    if (Date.now() - at > LANDING_CACHE_TTL) return null
    return mergeLandingContent(data)
  } catch {
    return null
  }
}

function persistLandingContent(content: LandingContent): void {
  try {
    localStorage.setItem(
      LANDING_PERSIST_KEY,
      JSON.stringify({ data: content, at: Date.now() }),
    )
  } catch {
    // localStorage dolu veya devre dışı
  }
}

export function getInitialLandingContent(): LandingContent {
  return readPersistedLandingContent() ?? DEFAULT_LANDING_CONTENT
}

export async function fetchLandingContent(): Promise<LandingContent> {
  const memoryHit = getCachedQuery<LandingContent>(CACHE_KEYS.landingContent, LANDING_CACHE_TTL)
  if (memoryHit) return memoryHit

  return cachedQuery(
    CACHE_KEYS.landingContent,
    async () => {
      try {
        const [{ db }, { doc, getDoc }] = await Promise.all([
          import('@/lib/firebase'),
          import('firebase/firestore'),
        ])
        const snap = await getDoc(doc(db, 'site_ayarlari', 'landing'))
        if (!snap.exists()) {
          persistLandingContent(DEFAULT_LANDING_CONTENT)
          return DEFAULT_LANDING_CONTENT
        }
        const content = mergeLandingContent(snap.data() as Partial<LandingContent>)
        persistLandingContent(content)
        return content
      } catch {
        const fallback = readPersistedLandingContent() ?? DEFAULT_LANDING_CONTENT
        return fallback
      }
    },
    LANDING_CACHE_TTL,
  )
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
    const [{ db }, { doc, setDoc }] = await Promise.all([
      import('@/lib/firebase'),
      import('firebase/firestore'),
    ])
    await setDoc(doc(db, 'site_ayarlari', 'landing'), payload)
    invalidateQueryCache(CACHE_KEYS.landingContent)
    persistLandingContent(content)
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
  const [{ storage }, { getDownloadURL, ref, uploadBytes }] = await Promise.all([
    import('@/lib/firebase'),
    import('firebase/storage'),
  ])
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `landing/${folder}/${Date.now()}_${safeName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export function createGalleryId(): string {
  return `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
