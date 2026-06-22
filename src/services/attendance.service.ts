import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CACHE_KEYS, cachedQuery, invalidateQueryCache, invalidateQueryCachePrefix } from '@/lib/queryCache'
import { getMonthYear, parseFlexibleDate, toISO, toLegacyDate, formatDateTR } from '@/lib/dates'
import { DEVAMSIZLIK_RISK_ESIGI } from '@/config/constants'
import type {
  AttendanceRecord,
  AttendanceStatus,
  DashboardStats,
  DevamsizlikOzet,
  MonthlyAbsenceTrend,
  VakitAttendanceCounts,
  WeeklyAttendanceDay,
  WeeklyAttendanceReport,
} from '@/types'

const COL = 'yoklamalar'

async function loadAttendanceRecords(): Promise<AttendanceRecord[]> {
  const snap = await getDocs(collection(db, COL))
  const records: AttendanceRecord[] = []
  snap.forEach((docSnap) => records.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord))
  return records
}

export function fetchAttendanceRecords(): Promise<AttendanceRecord[]> {
  return cachedQuery(CACHE_KEYS.attendanceAll, loadAttendanceRecords)
}

function bumpAttendanceCache() {
  invalidateQueryCache(CACHE_KEYS.attendanceAll)
  invalidateQueryCachePrefix('attendance:recent:')
}

export async function fetchRecentAttendance(limit = 30): Promise<AttendanceRecord[]> {
  try {
    const q = query(collection(db, COL), orderBy('timestamp', 'desc'))
    const snap = await getDocs(q)
    const records: AttendanceRecord[] = []
    snap.forEach((docSnap) => {
      if (records.length < limit) {
        records.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord)
      }
    })
    return records
  } catch {
    const all = await fetchAttendanceRecords()
    return all
      .sort((a, b) => {
        const da = parseFlexibleDate(a.tarih)?.getTime() || 0
        const db2 = parseFlexibleDate(b.tarih)?.getTime() || 0
        return db2 - da
      })
      .slice(0, limit)
  }
}

export async function saveAttendance(data: {
  tarihISO: string
  vakit: string
  statuses: Record<string, AttendanceStatus>
  kaydeden: string
}): Promise<void> {
  const gelenler: string[] = []
  const gelmeyenler: string[] = []
  const izinliler: string[] = []

  for (const [ad, durum] of Object.entries(data.statuses)) {
    if (durum === 'Geldi') gelenler.push(ad)
    else if (durum === 'İzinli') izinliler.push(ad)
    else gelmeyenler.push(ad)
  }

  const tarihDate = parseFlexibleDate(data.tarihISO)
  const normalizedTarih = tarihDate ? toISO(tarihDate) : data.tarihISO

  await addDoc(collection(db, COL), {
    vakit: data.vakit,
    tarih: normalizedTarih,
    timestamp: tarihDate || new Date(),
    sistemeGirisZamani: new Date(),
    gelenOgrenciler: gelenler,
    gelmeyenOgrenciler: gelmeyenler,
    izinliOgrenciler: izinliler,
    kaydeden: data.kaydeden,
  })
  bumpAttendanceCache()
}

export async function updateAttendance(
  id: string,
  statuses: Record<string, AttendanceStatus>,
  editorName: string,
): Promise<void> {
  const gelenler: string[] = []
  const gelmeyenler: string[] = []
  const izinliler: string[] = []

  for (const [ad, durum] of Object.entries(statuses)) {
    if (durum === 'Geldi') gelenler.push(ad)
    else if (durum === 'İzinli') izinliler.push(ad)
    else gelmeyenler.push(ad)
  }

  await updateDoc(doc(db, COL, id), {
    gelenOgrenciler: gelenler,
    gelmeyenOgrenciler: gelmeyenler,
    izinliOgrenciler: izinliler,
    sonDuzenleyen: editorName,
    duzenlemeTarihi: new Date(),
  })
  bumpAttendanceCache()
}

export async function deleteAttendance(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
  bumpAttendanceCache()
}

export function countMonthlyAbsences(
  records: AttendanceRecord[],
  studentName: string,
  refDate = new Date(),
): number {
  const { month, year } = getMonthYear(refDate)

  return records.filter((record) => {
    if (!record.gelmeyenOgrenciler?.includes(studentName)) return false
    const parsed = parseFlexibleDate(record.tarih)
    if (!parsed) return false
    return parsed.getMonth() + 1 === month && parsed.getFullYear() === year
  }).length
}

export function buildDevamsizlikList(
  students: { adSoyad: string; odaNo: string | number }[],
  records: AttendanceRecord[],
  refDate = new Date(),
): DevamsizlikOzet[] {
  return students
    .map((student) => ({
      adSoyad: student.adSoyad,
      odaNo: student.odaNo,
      devamsizlik: countMonthlyAbsences(records, student.adSoyad, refDate),
    }))
    .sort((a, b) => b.devamsizlik - a.devamsizlik)
}

export async function fetchDashboardAttendanceStats(
  studentNames: string[],
): Promise<Pick<DashboardStats, 'riskliDevamsizlik'>> {
  const records = await fetchAttendanceRecords()
  const now = new Date()
  let riskli = 0

  for (const name of studentNames) {
    if (countMonthlyAbsences(records, name, now) >= DEVAMSIZLIK_RISK_ESIGI) {
      riskli++
    }
  }

  return { riskliDevamsizlik: riskli }
}

export function getStudentStatusForRecord(
  record: AttendanceRecord,
  studentName: string,
): 'geldi' | 'gelmedi' | 'izinli' {
  if (record.gelenOgrenciler?.includes(studentName)) return 'geldi'
  if (record.izinliOgrenciler?.includes(studentName)) return 'izinli'
  return 'gelmedi'
}

export function getAttendanceForDate(
  records: AttendanceRecord[],
  tarih: string,
  vakit: string,
): AttendanceRecord | undefined {
  const parsed = parseFlexibleDate(tarih)
  const iso = parsed ? toISO(parsed) : tarih
  const legacy = parsed
    ? `${String(parsed.getDate()).padStart(2, '0')}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${parsed.getFullYear()}`
    : tarih

  return records.find(
    (r) => (r.tarih === iso || r.tarih === legacy || r.tarih === tarih) && r.vakit === vakit,
  )
}

export function buildCalendarMonth(
  records: AttendanceRecord[],
  studentName: string,
  year: number,
  month: number,
  approvedLeaves: { gidisTarihi: string; donusTarihi: string }[],
): { day: number; dots: ('geldi' | 'gelmedi' | 'izinli' | 'bos')[] }[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const result = []

  for (let day = 1; day <= daysInMonth; day++) {
    const legacy = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`
    const date = new Date(year, month, day)
    const onLeave = approvedLeaves.some((l) => {
      const start = parseFlexibleDate(l.gidisTarihi)
      const end = parseFlexibleDate(l.donusTarihi)
      return start && end && date >= start && date <= end
    })

    const dots: ('geldi' | 'gelmedi' | 'izinli' | 'bos')[] = []
    for (const vakit of ['Sabah', 'Yatsı']) {
      const record = getAttendanceForDate(records, legacy, vakit)
      if (onLeave) dots.push('izinli')
      else if (!record) dots.push('bos')
      else dots.push(getStudentStatusForRecord(record, studentName))
    }

    result.push({ day, dots })
  }

  return result
}

export function calcAttendanceRate(records: AttendanceRecord[], studentName: string) {
  let total = 0
  let attended = 0

  for (const record of records) {
    const involved =
      record.gelenOgrenciler?.includes(studentName) ||
      record.gelmeyenOgrenciler?.includes(studentName) ||
      record.izinliOgrenciler?.includes(studentName)

    if (involved) {
      total++
      if (record.gelenOgrenciler?.includes(studentName)) attended++
    }
  }

  return { total, attended, percent: total > 0 ? Math.round((attended / total) * 100) : 0 }
}

export function buildMonthlyAbsenceTrend(
  records: AttendanceRecord[],
  studentNames: string[],
  monthsBack = 6,
): MonthlyAbsenceTrend[] {
  const result: MonthlyAbsenceTrend[] = []
  const now = new Date()

  for (let i = monthsBack - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = ref.getMonth() + 1
    const year = ref.getFullYear()
    const label = ref.toLocaleDateString('tr-TR', { month: 'short' })

    let toplamDevamsizlik = 0
    for (const name of studentNames) {
      toplamDevamsizlik += countMonthlyAbsences(records, name, ref)
    }

    result.push({ label, month, year, toplamDevamsizlik })
  }

  return result
}

const HAFTA_GUNLERI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

function getWeekStartMonday(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = start.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  start.setDate(start.getDate() + diff)
  return start
}

function countsFromRecord(record?: AttendanceRecord): VakitAttendanceCounts {
  if (!record) {
    return { geldi: 0, gelmedi: 0, izinli: 0, kayitYok: true }
  }
  return {
    geldi: record.gelenOgrenciler?.length ?? 0,
    gelmedi: record.gelmeyenOgrenciler?.length ?? 0,
    izinli: record.izinliOgrenciler?.length ?? 0,
    kayitYok: false,
  }
}

export function buildWeeklyAttendanceReport(
  records: AttendanceRecord[],
  refDate = new Date(),
): WeeklyAttendanceReport {
  const weekStart = getWeekStartMonday(refDate)
  const gunler: WeeklyAttendanceDay[] = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const legacy = toLegacyDate(date)
    const iso = toISO(date)

    gunler.push({
      tarih: iso,
      gunLabel: HAFTA_GUNLERI[i],
      tarihLabel: formatDateTR(iso).slice(0, 5),
      sabah: countsFromRecord(getAttendanceForDate(records, legacy, 'Sabah')),
      yatsi: countsFromRecord(getAttendanceForDate(records, legacy, 'Yatsı')),
    })
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const haftaLabel = `${weekStart.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  })} – ${weekEnd.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`

  return { haftaLabel, gunler }
}
