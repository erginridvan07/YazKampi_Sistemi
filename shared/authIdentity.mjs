/**
 * Canonical Auth email helpers for local migration script.
 * Keep algorithm in sync with src/lib/utils.ts → toAuthEmail().
 */

export const AUTH_EMAIL_DOMAIN = 'gayevakfi.portal'

/** Reserved usernames that must never be migrated as student/admin. */
export const RESERVED_USERNAMES = new Set(['mezun.portal'])

/**
 * Same normalization chain as historical client `toAuthEmail`.
 * Do not diverge — Auth email mismatch would break login.
 */
export function toAuthEmail(username) {
  const normalized = String(username)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9._-]/g, '')

  if (!normalized) {
    throw new Error('Geçersiz kullanıcı adı. Sadece harf, rakam ve ._- kullanın.')
  }

  return `${normalized}@${AUTH_EMAIL_DOMAIN}`
}

export function tryToAuthEmail(username) {
  try {
    const email = toAuthEmail(username)
    return { ok: true, email, localPart: email.slice(0, email.indexOf('@')) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'invalid_username',
    }
  }
}

export function isReservedUsername(username) {
  const folded = String(username)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
  const normalized = folded.replace(/[^a-z0-9._-]/g, '')
  return RESERVED_USERNAMES.has(folded) || RESERVED_USERNAMES.has(normalized)
}
