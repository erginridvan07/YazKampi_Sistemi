import {
  addDoc,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { LeaveRequest, LeaveStatus } from '@/types'

const COL = 'evciTalepleri'

function requireCurrentUserUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) {
    throw new Error('Oturum bulunamadı.')
  }
  return uid
}

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const snap = await getDocs(collection(db, COL))
  const items: LeaveRequest[] = []
  snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as LeaveRequest))
  return items.sort((a, b) => new Date(b.tarih || 0).getTime() - new Date(a.tarih || 0).getTime())
}

export async function fetchPendingLeaves(): Promise<LeaveRequest[]> {
  const all = await fetchLeaveRequests()
  return all.filter((item) => item.durum === 'Beklemede')
}

export async function fetchApprovedLeavesRecent(days = 15): Promise<LeaveRequest[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const all = await fetchLeaveRequests()
  return all.filter(
    (item) =>
      item.durum === 'Onaylandı' && item.tarih && new Date(item.tarih) >= cutoff,
  )
}

export async function respondLeaveRequest(
  id: string,
  durum: Exclude<LeaveStatus, 'Beklemede'>,
  adminName: string,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    durum,
    onaylayanAdmin: adminName,
    islemTarihi: new Date().toISOString(),
  })
}

/** Creates a leave request bound to the signed-in user. ownerUid is never accepted from callers. */
export async function createLeaveRequest(data: {
  ogrenciAd: string
  gidisTarihi: string
  donusTarihi: string
  sebep: string
}): Promise<void> {
  const ownerUid = requireCurrentUserUid()
  await addDoc(collection(db, COL), {
    ogrenciAd: data.ogrenciAd,
    gidisTarihi: data.gidisTarihi,
    donusTarihi: data.donusTarihi,
    sebep: data.sebep,
    ownerUid,
    durum: 'Beklemede' as LeaveStatus,
    tarih: new Date().toISOString(),
  })
}

export async function fetchStudentLeaves(ownerUid: string): Promise<LeaveRequest[]> {
  const q = query(collection(db, COL), where('ownerUid', '==', ownerUid))
  const snap = await getDocs(q)
  const items: LeaveRequest[] = []
  snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as LeaveRequest))
  return items.sort((a, b) => new Date(b.tarih || 0).getTime() - new Date(a.tarih || 0).getTime())
}
