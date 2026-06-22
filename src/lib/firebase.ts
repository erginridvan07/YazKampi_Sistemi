import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

let messagingPromise: Promise<import('firebase/messaging').Messaging | null> | null = null

export async function getMessagingInstance(): Promise<import('firebase/messaging').Messaging | null> {
  if (typeof window === 'undefined') return null
  if (!messagingPromise) {
    messagingPromise = import('firebase/messaging').then(async ({ getMessaging, isSupported }) => {
      const supported = await isSupported()
      if (!supported) return null
      return getMessaging(app)
    })
  }
  return messagingPromise
}
