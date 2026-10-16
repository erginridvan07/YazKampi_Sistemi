import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth.store'
import type { AuditLog } from '@/types'

const COL = 'islem_loglari'
const USERS_COL = 'users'

type AuditLogInput = {
  islem: string
  detay?: string
}

type AuditActor = {
  actorUid: string
  yapan: string
  rol: AuditLog['rol']
}

function warnAudit(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[audit] ${message}`)
  }
}

function normalizeAuditTimestamp(value: AuditLog['timestamp'] | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().toISOString()
    }
    if ('seconds' in value && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toISOString()
    }
  }
  return ''
}

async function resolveAuditActor(): Promise<AuditActor | null> {
  const currentUser = auth.currentUser
  if (!currentUser?.uid) {
    warnAudit('missing auth.currentUser; audit skipped')
    return null
  }

  const storeProfile = useAuthStore.getState().profile
  if (storeProfile?.uid === currentUser.uid) {
    return {
      actorUid: currentUser.uid,
      yapan: storeProfile.adSoyad || 'Kullanıcı',
      rol: storeProfile.role,
    }
  }

  try {
    const profileSnap = await getDoc(doc(db, USERS_COL, currentUser.uid))
    if (!profileSnap.exists()) {
      warnAudit(`users/${currentUser.uid} profile missing; audit skipped`)
      return null
    }

    const profile = profileSnap.data() as { adSoyad?: string; role?: AuditLog['rol'] }
    if (profile.role !== 'admin' && profile.role !== 'student' && profile.role !== 'graduate') {
      warnAudit(`users/${currentUser.uid} role invalid; audit skipped`)
      return null
    }

    return {
      actorUid: currentUser.uid,
      yapan: typeof profile.adSoyad === 'string' && profile.adSoyad.trim() ? profile.adSoyad : 'Kullanıcı',
      rol: profile.role,
    }
  } catch {
    warnAudit(`users/${currentUser.uid} lookup failed; audit skipped`)
    return null
  }
}

export async function logAudit(entry: AuditLogInput): Promise<void> {
  try {
    const actor = await resolveAuditActor()
    if (!actor) return

    await addDoc(collection(db, COL), {
      islem: entry.islem,
      ...(entry.detay?.trim() ? { detay: entry.detay.trim() } : {}),
      actorUid: actor.actorUid,
      yapan: actor.yapan,
      rol: actor.rol,
      timestamp: serverTimestamp(),
    })
  } catch {
    // Audit failure should not block user actions
    warnAudit('write failed; primary action continues')
  }
}

export async function fetchRecentAuditLogs(max = 20): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, COL), orderBy('timestamp', 'desc'), limit(max))
    const snap = await getDocs(q)
    const items: AuditLog[] = []
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Omit<AuditLog, 'id'>
      items.push({
        id: docSnap.id,
        ...data,
        timestamp: normalizeAuditTimestamp(data.timestamp),
      })
    })
    return items
  } catch {
    return []
  }
}
