import { toAuthEmail } from '@/lib/utils'

/** Fixed shared graduate Auth identity. Not bound to Firestore username. */
export const GRADUATE_AUTH_USERNAME = 'mezun.portal'

export const GRADUATE_LOGIN_MODE = 'auth-only' as const

export function graduateAuthEmail(): string {
  return toAuthEmail(GRADUATE_AUTH_USERNAME)
}

export function isGraduateSharedUsername(username: string): boolean {
  try {
    return toAuthEmail(username) === graduateAuthEmail()
  } catch {
    return false
  }
}
