import { useEffect } from 'react'
import { isSupported } from 'firebase/messaging'
import { getMessagingInstance } from '@/lib/firebase'
import {
  getNotificationPreference,
  showLocalNotification,
  subscribeForegroundMessages,
  subscribePendingLeaveAlerts,
  subscribeStudentLeaveUpdates,
} from '@/services/notifications.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

export function NotificationProvider() {
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    if (!profile || !getNotificationPreference()) return

    const cleanups: (() => void)[] = []

    if (profile.role === 'student') {
      cleanups.push(
        subscribeStudentLeaveUpdates(profile.adSoyad, (durum, gidisTarihi) => {
          const title = durum === 'Onaylandı' ? 'İzin talebiniz onaylandı' : 'İzin talebiniz reddedildi'
          const body = `${gidisTarihi} tarihli evci izin talebiniz ${durum.toLowerCase()}.`
          showLocalNotification(title, body, `leave-${gidisTarihi}`)
          useToastStore.getState().showToast(
            durum === 'Onaylandı' ? 'success' : 'error',
            title,
            body,
          )
        }),
      )
    }

    if (profile.role === 'admin') {
      cleanups.push(
        subscribePendingLeaveAlerts((ogrenciAd) => {
          const title = 'Yeni izin talebi'
          const body = `${ogrenciAd} evci izin talebi gönderdi.`
          showLocalNotification(title, body, `pending-${ogrenciAd}`)
          useToastStore.getState().showToast('info', title, body)
        }),
      )
    }

    void (async () => {
      try {
        const supported = await isSupported()
        if (!supported) return
        const messaging = await getMessagingInstance()
        if (!messaging) return
        cleanups.push(
          subscribeForegroundMessages(messaging, (title, body) => {
            showLocalNotification(title, body)
            useToastStore.getState().showToast('info', title, body)
          }),
        )
      } catch {
        // FCM not configured
      }
    })()

    return () => cleanups.forEach((fn) => fn())
  }, [profile])

  return null
}
