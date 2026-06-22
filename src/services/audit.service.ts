import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AuditLog } from '@/types'

const COL = 'islem_loglari'

export async function logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    await addDoc(collection(db, COL), {
      ...entry,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Audit failure should not block user actions
  }
}

export async function fetchRecentAuditLogs(max = 20): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, COL), orderBy('timestamp', 'desc'), limit(max))
    const snap = await getDocs(q)
    const items: AuditLog[] = []
    snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() } as AuditLog))
    return items
  } catch {
    return []
  }
}
