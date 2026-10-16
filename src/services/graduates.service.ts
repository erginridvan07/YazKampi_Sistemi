import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { stripUndefined } from '@/lib/utils'
import type { Graduate, GraduateFormData, GraduateWelcomeSettings } from '@/types'

const GRADUATES_COL = 'mezunlar'
const WELCOME_COL = 'mezun_ayarlar'
const WELCOME_DOC_ID = 'karsilama'

/** S5.3-P2: mezunlar field visibility (adSoyad/bölüm/yıl/şehir/görev/photo vs admin-only notlar) is unchanged here. */
/** S5.3-P3.1 debt: leftover welcomeTitle/welcomeMessage on ayarlar/mezun_giris are unused by client; do not live-delete here. */

export const DEFAULT_GRADUATE_WELCOME: GraduateWelcomeSettings = {
  welcomeTitle: 'Mezun Ağı',
  welcomeMessage: 'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
}

function welcomeDocRef() {
  return doc(db, WELCOME_COL, WELCOME_DOC_ID)
}

export const EMPTY_GRADUATE_FORM: GraduateFormData = {
  adSoyad: '',
  girisYili: String(new Date().getFullYear()),
  bolum: '',
  mezuniyetYili: '',
  evlilikDurumu: 'Belirtilmemiş',
  cocukSayisi: '0',
  gorev: '',
  calistigiYer: '',
  sehir: '',
  iletisim: '',
  photoUrl: '',
  notlar: '',
  sosyalMedya: '',
}

function mapGraduate(id: string, data: Record<string, unknown>): Graduate {
  return {
    id,
    adSoyad: String(data.adSoyad || ''),
    girisYili: Number(data.girisYili) || new Date().getFullYear(),
    bolum: data.bolum ? String(data.bolum) : undefined,
    mezuniyetYili: data.mezuniyetYili ? Number(data.mezuniyetYili) : undefined,
    evlilikDurumu: data.evlilikDurumu as Graduate['evlilikDurumu'],
    cocukSayisi: data.cocukSayisi !== undefined ? Number(data.cocukSayisi) : undefined,
    gorev: data.gorev ? String(data.gorev) : undefined,
    calistigiYer: data.calistigiYer ? String(data.calistigiYer) : undefined,
    sehir: data.sehir ? String(data.sehir) : undefined,
    iletisim: data.iletisim ? String(data.iletisim) : undefined,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    notlar: data.notlar ? String(data.notlar) : undefined,
    sosyalMedya: data.sosyalMedya ? String(data.sosyalMedya) : undefined,
    siraNo: data.siraNo !== undefined ? Number(data.siraNo) : undefined,
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  }
}

function formToPayload(form: GraduateFormData): Record<string, unknown> {
  const girisYili = Number(form.girisYili)
  const mezuniyetYili = form.mezuniyetYili.trim() ? Number(form.mezuniyetYili) : undefined
  const cocukSayisi = form.cocukSayisi.trim() ? Number(form.cocukSayisi) : 0

  return stripUndefined({
    adSoyad: form.adSoyad.trim(),
    girisYili: Number.isFinite(girisYili) ? girisYili : new Date().getFullYear(),
    bolum: form.bolum.trim() || undefined,
    mezuniyetYili: mezuniyetYili !== undefined && Number.isFinite(mezuniyetYili) ? mezuniyetYili : undefined,
    evlilikDurumu: form.evlilikDurumu,
    cocukSayisi: Number.isFinite(cocukSayisi) ? cocukSayisi : 0,
    gorev: form.gorev.trim() || undefined,
    calistigiYer: form.calistigiYer.trim() || undefined,
    sehir: form.sehir.trim() || undefined,
    iletisim: form.iletisim.trim() || undefined,
    photoUrl: form.photoUrl.trim() || undefined,
    notlar: form.notlar.trim() || undefined,
    sosyalMedya: form.sosyalMedya.trim() || undefined,
    updatedAt: new Date().toISOString(),
  })
}

function mapWelcome(data: Record<string, unknown> | undefined): GraduateWelcomeSettings {
  const title = typeof data?.welcomeTitle === 'string' ? data.welcomeTitle.trim() : ''
  const message = typeof data?.welcomeMessage === 'string' ? data.welcomeMessage.trim() : ''
  return {
    welcomeTitle: title || DEFAULT_GRADUATE_WELCOME.welcomeTitle,
    welcomeMessage: message || DEFAULT_GRADUATE_WELCOME.welcomeMessage,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : undefined,
  }
}

/**
 * Direct getDoc(mezun_ayarlar/karsilama). Never lists. Never reads ayarlar/mezun_giris.
 * Missing/denied document → safe defaults; caller page must not break.
 */
export async function fetchGraduateWelcomeSettings(): Promise<GraduateWelcomeSettings> {
  try {
    const snap = await getDoc(welcomeDocRef())
    if (!snap.exists()) return DEFAULT_GRADUATE_WELCOME
    return mapWelcome(snap.data() as Record<string, unknown>)
  } catch {
    return DEFAULT_GRADUATE_WELCOME
  }
}

/**
 * Admin create/update of mezun_ayarlar/karsilama only.
 * Never writes password, username, enabled, uid, role, or ayarlar/mezun_giris.
 */
export async function saveGraduateWelcomeSettings(
  settings: Pick<GraduateWelcomeSettings, 'welcomeTitle' | 'welcomeMessage'>,
): Promise<void> {
  const payload = {
    welcomeTitle: settings.welcomeTitle?.trim() || DEFAULT_GRADUATE_WELCOME.welcomeTitle,
    welcomeMessage: settings.welcomeMessage?.trim() || DEFAULT_GRADUATE_WELCOME.welcomeMessage,
    updatedAt: new Date().toISOString(),
  }

  await setDoc(welcomeDocRef(), payload)
}

export async function fetchGraduates(): Promise<Graduate[]> {
  const snap = await getDocs(query(collection(db, GRADUATES_COL), orderBy('girisYili', 'desc')))
  const list = snap.docs.map((docSnap) => mapGraduate(docSnap.id, docSnap.data()))

  return list.sort((a, b) => {
    if (a.girisYili !== b.girisYili) return b.girisYili - a.girisYili
    const orderA = a.siraNo ?? 9999
    const orderB = b.siraNo ?? 9999
    if (orderA !== orderB) return orderA - orderB
    return a.adSoyad.localeCompare(b.adSoyad, 'tr')
  })
}

export function groupGraduatesByYear(graduates: Graduate[]): Map<number, Graduate[]> {
  const groups = new Map<number, Graduate[]>()
  for (const graduate of graduates) {
    const year = graduate.girisYili
    const list = groups.get(year) || []
    list.push(graduate)
    groups.set(year, list)
  }
  return groups
}

export async function createGraduate(form: GraduateFormData): Promise<void> {
  const payload = formToPayload(form)
  await addDoc(collection(db, GRADUATES_COL), {
    ...payload,
    createdAt: new Date().toISOString(),
  })
}

export async function updateGraduate(id: string, form: GraduateFormData): Promise<void> {
  await updateDoc(doc(db, GRADUATES_COL, id), formToPayload(form))
}

export async function deleteGraduate(id: string): Promise<void> {
  await deleteDoc(doc(db, GRADUATES_COL, id))
}

export function graduateToForm(graduate: Graduate): GraduateFormData {
  return {
    adSoyad: graduate.adSoyad,
    girisYili: String(graduate.girisYili),
    bolum: graduate.bolum || '',
    mezuniyetYili: graduate.mezuniyetYili ? String(graduate.mezuniyetYili) : '',
    evlilikDurumu: graduate.evlilikDurumu || 'Belirtilmemiş',
    cocukSayisi: graduate.cocukSayisi !== undefined ? String(graduate.cocukSayisi) : '0',
    gorev: graduate.gorev || '',
    calistigiYer: graduate.calistigiYer || '',
    sehir: graduate.sehir || '',
    iletisim: graduate.iletisim || '',
    photoUrl: graduate.photoUrl || '',
    notlar: graduate.notlar || '',
    sosyalMedya: graduate.sosyalMedya || '',
  }
}
