import * as admin from 'firebase-admin'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'

admin.initializeApp()

async function getTokensByAdSoyad(adSoyad: string): Promise<string[]> {
  const snap = await admin
    .firestore()
    .collection('users')
    .where('adSoyad', '==', adSoyad)
    .limit(1)
    .get()

  if (snap.empty) return []
  const data = snap.docs[0].data()
  const tokens = data.fcmTokens
  return Array.isArray(tokens) ? tokens.filter(Boolean) : []
}

async function getAdminTokens(): Promise<string[]> {
  const snap = await admin.firestore().collection('users').where('role', '==', 'admin').get()
  const tokens: string[] = []
  snap.forEach((doc) => {
    const data = doc.data()
    if (data.notificationsEnabled !== false && Array.isArray(data.fcmTokens)) {
      tokens.push(...data.fcmTokens.filter(Boolean))
    }
  })
  return [...new Set(tokens)]
}

async function sendPush(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      fcmOptions: { link: '/' },
      notification: { icon: '/favicon.svg' },
    },
  })

  logger.info('Push sent', { success: response.successCount, failure: response.failureCount })
}

export const onLeaveRequestCreated = onDocumentCreated(
  'evciTalepleri/{id}',
  async (event) => {
    const data = event.data?.data()
    if (!data || data.durum !== 'Beklemede') return

    const tokens = await getAdminTokens()
    await sendPush(
      tokens,
      'Yeni evci izin talebi',
      `${data.ogrenciAd} · ${data.gidisTarihi} → ${data.donusTarihi}`,
    )
  },
)

export const onLeaveRequestUpdated = onDocumentUpdated(
  'evciTalepleri/{id}',
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    if (before.durum !== 'Beklemede' || after.durum === 'Beklemede') return

    const tokens = await getTokensByAdSoyad(after.ogrenciAd)
    const approved = after.durum === 'Onaylandı'
    await sendPush(
      tokens,
      approved ? 'İzin talebiniz onaylandı' : 'İzin talebiniz reddedildi',
      `${after.gidisTarihi} tarihli evci izin talebiniz ${String(after.durum).toLowerCase()}.`,
    )
  },
)
