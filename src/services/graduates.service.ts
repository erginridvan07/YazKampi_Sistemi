import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
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
import { auth, db } from '@/lib/firebase'
import { stripUndefined, toAuthEmail } from '@/lib/utils'
import type { Graduate, GraduateFormData, GraduateLoginSettings } from '@/types'

const GRADUATES_COL = 'mezunlar'
const GRADUATE_AUTH_USERNAME = 'mezun.portal'

function loginDocRef() {
  return doc(db, 'ayarlar', 'mezun_giris')
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

function graduateAuthEmail(): string {
  return toAuthEmail(GRADUATE_AUTH_USERNAME)
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

export async function fetchGraduateLoginSettings(): Promise<GraduateLoginSettings | null> {
  const snap = await getDoc(loginDocRef())
  if (!snap.exists()) return null
  return snap.data() as GraduateLoginSettings
}

export async function verifyGraduatePortalLogin(
  username: string,
  password: string,
): Promise<GraduateLoginSettings> {
  const settings = await fetchGraduateLoginSettings()
  if (!settings?.username || !settings.password) {
    throw new Error('Mezun girişi henüz yapılandırılmamış. Yöneticiye başvurun.')
  }
  if (settings.enabled === false) {
    throw new Error('Mezun girişi geçici olarak kapalı.')
  }
  if (username.trim() !== settings.username || password !== settings.password) {
    throw new Error('Hatalı kullanıcı adı veya şifre.')
  }
  return settings
}

async function ensureGraduateUserProfile(uid: string, settings: Pick<GraduateLoginSettings, 'username'>): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    stripUndefined({
      uid,
      username: settings.username,
      adSoyad: 'Mezun',
      role: 'graduate',
      legacyCollection: 'mezunlar',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }),
    { merge: true },
  )
}

/** Mezun Firebase hesabını oluşturur veya şifresini günceller (yönetici kaydı sırasında). */
export async function syncGraduateFirebaseAccount(
  newPassword: string,
  portalUsername: string,
  previousPassword?: string,
): Promise<'created' | 'updated' | 'unchanged'> {
  const email = graduateAuthEmail()

  if (previousPassword && previousPassword !== newPassword) {
    const credential = await signInWithEmailAndPassword(auth, email, previousPassword)
    await updatePassword(credential.user, newPassword)
    await ensureGraduateUserProfile(credential.user.uid, { username: portalUsername })
    await signOut(auth)
    return 'updated'
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, newPassword)
    await ensureGraduateUserProfile(credential.user.uid, { username: portalUsername })
    await signOut(auth)
    return 'created'
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : undefined

    if (code === 'auth/email-already-in-use') {
      const credential = await signInWithEmailAndPassword(auth, email, newPassword)
      await ensureGraduateUserProfile(credential.user.uid, { username: portalUsername })
      await signOut(auth)
      return 'unchanged'
    }

    throw error
  }
}

export async function saveGraduateLoginSettings(
  settings: GraduateLoginSettings,
  previousPassword?: string,
): Promise<'created' | 'updated' | 'unchanged' | 'settings-only'> {
  const payload: GraduateLoginSettings = {
    ...settings,
    username: settings.username.trim(),
    password: settings.password,
    enabled: settings.enabled !== false,
    welcomeTitle: settings.welcomeTitle?.trim() || 'Mezun Ağı',
    welcomeMessage:
      settings.welcomeMessage?.trim() ||
      'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
    updatedAt: new Date().toISOString(),
  }

  await setDoc(loginDocRef(), stripUndefined({ ...payload } as Record<string, unknown>), { merge: true })

  if (previousPassword === undefined) {
    return syncGraduateFirebaseAccount(settings.password, settings.username)
  }
  if (previousPassword !== settings.password) {
    return syncGraduateFirebaseAccount(settings.password, settings.username, previousPassword)
  }
  return 'settings-only'
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
