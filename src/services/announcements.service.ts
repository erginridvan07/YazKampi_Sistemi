import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  const snap = await getDocs(collection(db, GOREV_COL))
  const items: DailyDuty[] = []
  snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as DailyDuty))
  return items.sort((a, b) => b.id.localeCompare(a.id))
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

export async function deleteDailyDuty(tarih: string): Promise<void> {
  await deleteDoc(doc(db, GOREV_COL, tarih))
}
