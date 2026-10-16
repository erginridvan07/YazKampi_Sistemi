import {
  addDoc,
  collection,
  deleteDoc,
  documentId,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { todayISO } from '@/lib/dates'
import type { Announcement, DailyDuty } from '@/types'

const DUYURU_COL = 'duyurular'
const GOREV_COL = 'gunluk_gorevler'

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const q = query(collection(db, DUYURU_COL), orderBy('tarih', 'desc'))
  const snap = await getDocs(q)
  const items: Announcement[] = []
  snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as Announcement))
  return items
}

export async function createAnnouncement(data: {
  baslik: string
  icerik: string
  etkinlikTarihi?: string
  hatirlatmaGun?: number
}): Promise<void> {
  await addDoc(collection(db, DUYURU_COL), {
    baslik: data.baslik,
    icerik: data.icerik,
    etkinlikTarihi: data.etkinlikTarihi || null,
    hatirlatmaGun: data.hatirlatmaGun ?? 0,
    tarih: serverTimestamp(),
  })
}

export async function updateAnnouncement(
  id: string,
  data: { baslik: string; icerik: string; etkinlikTarihi?: string; hatirlatmaGun?: number },
): Promise<void> {
  await updateDoc(doc(db, DUYURU_COL, id), {
    baslik: data.baslik,
    icerik: data.icerik,
    etkinlikTarihi: data.etkinlikTarihi || null,
    hatirlatmaGun: data.hatirlatmaGun ?? 0,
  })
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, DUYURU_COL, id))
}

export interface DisplayAnnouncement {
  id: string
  title: string
  content: string
  type: 'duty' | 'info'
  tone: 'bugun' | 'yaklasiyor' | 'normal' | 'gecmis' | 'duty'
}

export function filterAnnouncementsForDisplay(
  announcements: Announcement[],
  dutyToday?: DailyDuty | null,
  smartFilter = true,
): DisplayAnnouncement[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const result: DisplayAnnouncement[] = []

  if (dutyToday) {
    result.push({
      id: 'duty-today',
      title: '🕌 Bugünkü Görevliler',
      content: `İmam: ${dutyToday.imam} | Müezzin: ${dutyToday.muezzin}`,
      type: 'duty',
      tone: 'duty',
    })
  }

  for (const item of announcements) {
    let show = true
    let title = item.baslik
    let tone: DisplayAnnouncement['tone'] = 'normal'

    if (item.etkinlikTarihi) {
      const eventDate = new Date(item.etkinlikTarihi)
      eventDate.setHours(0, 0, 0, 0)
      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const reminder = item.hatirlatmaGun ?? 0

      if (diffDays === 0) {
        title = `📢 Bugün: ${item.baslik}`
        tone = 'bugun'
      } else if (diffDays > 0 && diffDays <= reminder) {
        title = `⏳ Yaklaşıyor (${diffDays} gün): ${item.baslik}`
        tone = 'yaklasiyor'
      } else if (diffDays < 0) {
        if (smartFilter) show = false
        else {
          title = `[Süresi geçti] ${item.baslik}`
          tone = 'gecmis'
        }
      } else if (smartFilter) {
        show = false
      }
    }

    if (show) {
      result.push({
        id: item.id,
        title,
        content: item.icerik,
        type: 'info',
        tone,
      })
    }
  }

  return result
}

export async function fetchDailyDuties(): Promise<DailyDuty[]> {
  // Past assignments remain available in Firestore for safety, but disappear from the management list.
  const q = query(
    collection(db, GOREV_COL),
    where(documentId(), '>=', todayISO()),
    orderBy(documentId(), 'asc'),
  )
  const snap = await getDocs(q)
  const items: DailyDuty[] = []
  snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as DailyDuty))
  return items
}

export async function fetchTodayDuty(): Promise<DailyDuty | null> {
  const snap = await getDoc(doc(db, GOREV_COL, todayISO()))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as DailyDuty
}

export async function saveDailyDuty(tarih: string, imam: string, muezzin: string): Promise<void> {
  await setDoc(doc(db, GOREV_COL, tarih), {
    imam,
    muezzin,
    guncellemeZamani: serverTimestamp(),
  })
}

export interface DailyDutyImportItem {
  tarih: string
  imam: string
  muezzin: string
  /** The value displayed in the preview. A mismatch aborts the whole import instead of overwriting a newer edit. */
  expectedExisting: Pick<DailyDuty, 'imam' | 'muezzin'> | null
}

export interface DailyDutyImportResult {
  created: number
  updated: number
  unchanged: number
}

function sameDuty(
  left: Pick<DailyDuty, 'imam' | 'muezzin'> | null,
  right: Pick<DailyDuty, 'imam' | 'muezzin'> | null,
): boolean {
  return left?.imam === right?.imam && left?.muezzin === right?.muezzin
}

/**
 * Atomically imports one monthly schedule after preview.
 * Any duty changed by someone else after the preview aborts the entire write.
 */
export async function importDailyDuties(items: DailyDutyImportItem[]): Promise<DailyDutyImportResult> {
  if (items.length === 0) return { created: 0, updated: 0, unchanged: 0 }
  if (items.length > 31) throw new Error('Bir seferde en fazla 31 günlük görev aktarılabilir.')

  const seenDates = new Set<string>()
  const normalized = items.map((item) => {
    const tarih = item.tarih.trim()
    const imam = item.imam.trim()
    const muezzin = item.muezzin.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || !imam || !muezzin || seenDates.has(tarih)) {
      throw new Error('İçe aktarma listesinde geçersiz veya yinelenen görev bulundu.')
    }
    seenDates.add(tarih)
    return {
      tarih,
      imam,
      muezzin,
      expectedExisting: item.expectedExisting,
    }
  })

  return runTransaction(db, async (transaction) => {
    const refs = normalized.map((item) => doc(db, GOREV_COL, item.tarih))
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)))
    let created = 0
    let updated = 0
    let unchanged = 0

    for (let index = 0; index < normalized.length; index += 1) {
      const item = normalized[index]
      const snap = snapshots[index]
      const current = snap.exists()
        ? {
            imam: String(snap.data().imam || ''),
            muezzin: String(snap.data().muezzin || ''),
          }
        : null

      if (!sameDuty(current, item.expectedExisting)) {
        throw new Error('Görev listesi önizlemeden sonra değişti. Lütfen PDF’yi yeniden okuyun.')
      }
      if (sameDuty(current, item)) {
        unchanged += 1
        continue
      }

      transaction.set(refs[index], {
        imam: item.imam,
        muezzin: item.muezzin,
        guncellemeZamani: serverTimestamp(),
      })
      if (current) updated += 1
      else created += 1
    }

    return { created, updated, unchanged }
  })
}

export async function deleteDailyDuty(tarih: string): Promise<void> {
  await deleteDoc(doc(db, GOREV_COL, tarih))
}
