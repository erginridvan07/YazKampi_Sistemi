import {
  doc,
  onSnapshot,
  query,
  collection,
  where,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore'
import { getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging'
import { db, getMessagingInstance } from '@/lib/firebase'

const PREF_KEY = 'gv-notifications-enabled'

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPreference(): boolean {
  return localStorage.getItem(PREF_KEY) === 'true'
}

export function setNotificationPreference(enabled: boolean): void {
  localStorage.setItem(PREF_KEY, enabled ? 'true' : 'false')
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export function showLocalNotification(title: string, body: string, tag?: string): void {
  if (!getNotificationPreference()) return
  if (Notification.permission !== 'granted') return

  try {
    new Notification(title, {
      body,
      tag: tag || title,
      icon: '/favicon.svg',
    })
  } catch {
    // Some browsers block Notification outside service worker
  }
}

async function saveFcmToken(uid: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    fcmTokens: arrayUnion(token),
    notificationsEnabled: true,
    updatedAt: new Date().toISOString(),
  })
}

export async function enablePushNotifications(uid: string): Promise<boolean> {
  if (!isNotificationSupported()) {
    throw new Error('Bu tarayıcı bildirimleri desteklemiyor.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    setNotificationPreference(false)
    return false
  }

  setNotificationPreference(true)

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return true

  try {
    const supported = await isSupported()
    if (!supported) return true

    const messaging = await getMessagingInstance()
    if (!messaging) return true

    let registration: ServiceWorkerRegistration | undefined
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    } catch {
      return true
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (token) {
      await saveFcmToken(uid, token)
    }
  } catch {
    // FCM optional — local notifications still work
  }

  return true
}

export async function disablePushNotifications(uid: string): Promise<void> {
  setNotificationPreference(false)
  await updateDoc(doc(db, 'users', uid), {
    notificationsEnabled: false,
    updatedAt: new Date().toISOString(),
  })
}

export function subscribeForegroundMessages(
  messaging: Messaging,
  onNotify: (title: string, body: string) => void,
): () => void {
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || 'Gaye Vakfı Portal'
    const body = payload.notification?.body || ''
    onNotify(title, body)
  })
}

export function subscribeStudentLeaveUpdates(
  studentName: string,
  onUpdate: (durum: string, gidisTarihi: string) => void,
): () => void {
  const q = query(
    collection(db, 'evciTalepleri'),
    where('ogrenciAd', '==', studentName),
  )

  let initial = true
  const known = new Map<string, string>()

  return onSnapshot(q, (snap) => {
    snap.forEach((docSnap) => {
      const data = docSnap.data()
      const prev = known.get(docSnap.id)
      known.set(docSnap.id, data.durum)

      if (initial) return
      if (prev === 'Beklemede' && data.durum !== 'Beklemede') {
        onUpdate(data.durum, data.gidisTarihi)
      }
    })
    initial = false
  })
}

export function subscribePendingLeaveAlerts(onNewRequest: (ogrenciAd: string) => void): () => void {
  const q = query(collection(db, 'evciTalepleri'), where('durum', '==', 'Beklemede'))

  let initial = true
  const known = new Set<string>()

  return onSnapshot(q, (snap) => {
    snap.forEach((docSnap) => {
      if (known.has(docSnap.id)) return
      known.add(docSnap.id)
      if (!initial) {
        onNewRequest(docSnap.data().ogrenciAd)
      }
    })
    initial = false
  })
}

